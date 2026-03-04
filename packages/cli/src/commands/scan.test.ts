import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScanError } from "../errors.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCrawl = vi.fn();
vi.mock("@basesignal/crawlers", () => {
  return {
    WebsiteCrawler: class MockWebsiteCrawler {
      name = "website";
      sourceType = "website" as const;
      canCrawl = () => true;
      crawl = mockCrawl;
    },
  };
});

const mockSave = vi.fn().mockResolvedValue("test-profile-id");
const mockClose = vi.fn();
const mockWriteJson = vi.fn();
vi.mock("@basesignal/storage", () => {
  return {
    FileStorage: class MockFileStorage {
      save = mockSave;
      load = vi.fn();
      list = vi.fn();
      delete = vi.fn();
      search = vi.fn();
      close = mockClose;
    },
    ProductDirectory: class MockProductDirectory {
      writeJson = mockWriteJson;
    },
    urlToSlug: (url: string) => {
      try {
        const normalized = url.match(/^https?:\/\//i) ? url : `https://${url}`;
        const parsed = new URL(normalized);
        let hostname = parsed.hostname.toLowerCase();
        if (hostname.startsWith("www.")) hostname = hostname.slice(4);
        return hostname.replace(/\./g, "-");
      } catch {
        return "unknown";
      }
    },
  };
});

const mockCreateProvider = vi.fn().mockReturnValue({
  complete: vi.fn().mockResolvedValue("{}"),
});
vi.mock("@basesignal/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@basesignal/core")>();
  return {
    ...actual,
    createProvider: mockCreateProvider,
  };
});

const mockRunAnalysisPipeline = vi.fn();
vi.mock("@basesignal/mcp-server/analysis/pipeline", () => ({
  runAnalysisPipeline: mockRunAnalysisPipeline,
}));

const mockWriteFileSync = vi.fn();
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  };
});

// Mock ora for progress (avoid TTY issues in tests)
vi.mock("ora", () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: "",
  })),
}));

// Import after mocks
const { validateUrl, runScan } = await import("./scan.js");

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const crawlResultWithPages = {
  pages: [
    {
      url: "https://example.com",
      pageType: "homepage",
      content: "Welcome to Example",
      title: "Example",
    },
    {
      url: "https://example.com/pricing",
      pageType: "pricing",
      content: "Plans: Free, Pro",
      title: "Pricing",
    },
  ],
  timing: { startedAt: 0, completedAt: 100, totalMs: 100 },
  errors: [],
};

const pipelineResult = {
  identity: {
    productName: "Example",
    description: "An example product",
    targetCustomer: "Developers",
    businessModel: "SaaS",
    confidence: 0.85,
    evidence: [{ url: "https://example.com", excerpt: "Welcome" }],
  },
  activation_levels: null,
  lens_candidates: [],
  convergence: null,
  intermediates: {
    lens_results: [
      { lens: "capability_mapping", candidates: [{ name: "test", description: "a test" }] },
    ],
    validated_candidates: [],
    clusters: null,
    quality_report: null,
  },
  outputs: {
    icp_profiles: [],
    activation_map: null,
    measurement_spec: null,
    lifecycle_states: null,
    value_moments: [],
    enriched_outcomes: null,
  },
  errors: [],
  execution_time_ms: 500,
};

// ---------------------------------------------------------------------------
// Tests: validateUrl
// ---------------------------------------------------------------------------

describe("validateUrl", () => {
  it("accepts https URL", () => {
    const url = validateUrl("https://example.com");
    expect(url.href).toBe("https://example.com/");
  });

  it("accepts http URL", () => {
    const url = validateUrl("http://example.com");
    expect(url.protocol).toBe("http:");
  });

  it("auto-prepends https to bare domain", () => {
    const url = validateUrl("example.com");
    expect(url.href).toBe("https://example.com/");
  });

  it("auto-prepends https to domain like linear.app", () => {
    const url = validateUrl("linear.app");
    expect(url.href).toBe("https://linear.app/");
  });

  it("throws ScanError for ftp protocol", () => {
    expect(() => validateUrl("ftp://example.com")).toThrow(ScanError);
    try {
      validateUrl("ftp://example.com");
    } catch (e) {
      expect((e as ScanError).code).toBe("invalid-url");
    }
  });

  it("throws ScanError for nonsense protocol", () => {
    expect(() => validateUrl("not-a-url://what")).toThrow(ScanError);
    try {
      validateUrl("not-a-url://what");
    } catch (e) {
      expect((e as ScanError).code).toBe("invalid-url");
    }
  });

  it("throws ScanError for empty string", () => {
    expect(() => validateUrl("")).toThrow(ScanError);
    try {
      validateUrl("");
    } catch (e) {
      expect((e as ScanError).code).toBe("invalid-url");
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: runScan
// ---------------------------------------------------------------------------

describe("runScan", () => {
  const envVars = [
    "ANTHROPIC_API_KEY",
    "BASESIGNAL_PROVIDER",
    "BASESIGNAL_STORAGE",
    "BASESIGNAL_MODEL",
  ];
  const savedEnv: Record<string, string | undefined> = {};

  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Save and set env
    for (const key of envVars) {
      savedEnv[key] = process.env[key];
    }
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    delete process.env.BASESIGNAL_PROVIDER;
    delete process.env.BASESIGNAL_MODEL;
    process.env.BASESIGNAL_STORAGE = "/tmp/basesignal-test";

    // Set up default mock return values
    mockCrawl.mockResolvedValue(crawlResultWithPages);
    mockRunAnalysisPipeline.mockResolvedValue(pipelineResult);
    mockSave.mockResolvedValue("test-profile-id");
    mockClose.mockReset();
    mockWriteFileSync.mockReset();
    mockWriteJson.mockReset();

    // Non-TTY for predictable output
    Object.defineProperty(process.stderr, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const key of envVars) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
    vi.restoreAllMocks();
  });

  it("calls crawl, analyze, save in sequence", async () => {
    const callOrder: string[] = [];
    mockCrawl.mockImplementation(async () => {
      callOrder.push("crawl");
      return crawlResultWithPages;
    });
    mockRunAnalysisPipeline.mockImplementation(async () => {
      callOrder.push("analyze");
      return pipelineResult;
    });
    mockSave.mockImplementation(async () => {
      callOrder.push("save");
      return "test-id";
    });

    await runScan("https://example.com", { format: "summary", verbose: false });

    expect(callOrder).toEqual(["crawl", "analyze", "save"]);
  });

  it("passes crawled pages to the analysis pipeline", async () => {
    await runScan("https://example.com", { format: "summary", verbose: false });

    expect(mockRunAnalysisPipeline).toHaveBeenCalledWith(
      { pages: crawlResultWithPages.pages },
      expect.anything(),
      expect.any(Function),
    );
  });

  it("saves the analysis result to storage", async () => {
    await runScan("https://example.com", { format: "summary", verbose: false });

    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: pipelineResult.identity,
        metadata: expect.objectContaining({ url: "https://example.com/" }),
      }),
    );
  });

  it("computes completeness from pipeline outputs (identity only = 1/6)", async () => {
    await runScan("https://example.com", { format: "summary", verbose: false });

    const savedProfile = mockSave.mock.calls[0][0];
    // pipelineResult has identity but no activation_levels, empty icp_profiles, null outputs
    expect(savedProfile.completeness).toBeCloseTo(1 / 6, 2);
  });

  it("computes completeness = 1 when all pipeline outputs are present", async () => {
    const richPipelineResult = {
      ...pipelineResult,
      activation_levels: { levels: [{ level: 1 }], primaryActivation: 1, overallConfidence: 0.7 },
      outputs: {
        icp_profiles: [{ id: "icp-1", name: "PM" }],
        activation_map: { stages: [] },
        measurement_spec: { perspectives: { product: { entities: [] }, customer: { entities: [] }, interaction: { entities: [] } }, jsonSchemas: [], confidence: 0.5, sources: [] },
        lifecycle_states: { states: [] },
        value_moments: [],
      },
    };
    mockRunAnalysisPipeline.mockReset();
    mockRunAnalysisPipeline.mockResolvedValue(richPipelineResult);
    mockSave.mockReset();
    mockSave.mockResolvedValue("rich-profile-id");

    await runScan("https://example.com", { format: "summary", verbose: false });

    expect(mockRunAnalysisPipeline).toHaveBeenCalledTimes(1);
    const savedProfile = mockSave.mock.calls[0][0];
    expect(savedProfile.completeness).toBe(1);
  });

  it("prints formatted output to stdout", async () => {
    await runScan("https://example.com", { format: "summary", verbose: false });

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Example");
  });

  it("writes to file when --output is provided", async () => {
    await runScan("https://example.com", {
      format: "summary",
      verbose: false,
      output: "out.json",
    });

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      "out.json",
      expect.any(String),
      "utf-8",
    );
  });

  it("calls storage.close() even when an error occurs", async () => {
    mockCrawl.mockRejectedValue(new Error("network failure"));

    await expect(
      runScan("https://example.com", { format: "summary", verbose: false }),
    ).rejects.toThrow();

    expect(mockClose).toHaveBeenCalled();
  });

  it("throws ScanError with code crawl-empty when crawler returns zero pages", async () => {
    mockCrawl.mockResolvedValue({
      pages: [],
      timing: { startedAt: 0, completedAt: 50, totalMs: 50 },
      errors: [],
    });

    await expect(
      runScan("https://example.com", { format: "summary", verbose: false }),
    ).rejects.toThrow(ScanError);

    try {
      await runScan("https://example.com", { format: "summary", verbose: false });
    } catch (e) {
      expect((e as ScanError).code).toBe("crawl-empty");
    }
  });

  it("outputs JSON to stdout with --format json", async () => {
    await runScan("https://example.com", { format: "json", verbose: false });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("persists artifacts via ProductDirectory", async () => {
    await runScan("https://example.com", { format: "summary", verbose: false });

    // Should have written crawl, lens, and profile artifacts
    const writeCalls = mockWriteJson.mock.calls.map((c: unknown[]) => c[1]);
    expect(writeCalls).toContain("crawl/pages.json");
    expect(writeCalls).toContain("crawl/metadata.json");
    expect(writeCalls).toContain("lenses/capability-mapping.json");
    expect(writeCalls).toContain("profile.json");
  });

  it("stores measurement_spec at top-level, not in profile.metrics", async () => {
    const specData = { perspectives: { product: { entities: [] }, customer: { entities: [] }, interaction: { entities: [] } }, jsonSchemas: [], confidence: 0.5, sources: [] };
    const resultWithSpec = {
      ...pipelineResult,
      outputs: {
        ...pipelineResult.outputs,
        measurement_spec: specData,
      },
    };
    mockRunAnalysisPipeline.mockReset();
    mockRunAnalysisPipeline.mockResolvedValue(resultWithSpec);
    mockSave.mockReset();
    mockSave.mockResolvedValue("spec-profile-id");

    await runScan("https://example.com", { format: "summary", verbose: false });

    const savedProfile = mockSave.mock.calls[0][0];
    expect(savedProfile.measurement_spec).toEqual(specData);
    expect(savedProfile.metrics).toBeUndefined();
  });

  it("persists value_moments in profile when convergence has value_moments", async () => {
    const valueMoments = [
      { id: "vm-1", name: "First value moment", description: "User sees value", confidence: 0.9 },
      { id: "vm-2", name: "Second value moment", description: "User gets result", confidence: 0.8 },
    ];
    const resultWithValueMoments = {
      ...pipelineResult,
      convergence: {
        value_moments: valueMoments,
      },
    };
    mockRunAnalysisPipeline.mockReset();
    mockRunAnalysisPipeline.mockResolvedValue(resultWithValueMoments);
    mockSave.mockReset();
    mockSave.mockResolvedValue("vm-profile-id");

    await runScan("https://example.com", { format: "summary", verbose: false });

    const savedProfile = mockSave.mock.calls[0][0];
    expect(savedProfile.value_moments).toEqual(valueMoments);
  });

  it("does not include value_moments in profile when convergence is null", async () => {
    // Explicitly set pipeline result with convergence: null
    mockRunAnalysisPipeline.mockReset();
    mockRunAnalysisPipeline.mockResolvedValue(pipelineResult);
    mockSave.mockReset();
    mockSave.mockResolvedValue("null-conv-profile-id");

    await runScan("https://example.com", { format: "summary", verbose: false });

    const savedProfile = mockSave.mock.calls[0][0];
    expect(savedProfile).not.toHaveProperty("value_moments");
  });

  it("outputs markdown to stdout with --format markdown", async () => {
    await runScan("https://example.com", { format: "markdown", verbose: false });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("# Example");
  });

  it("with --verbose creates verbose progress and passes onProgress to pipeline", async () => {
    // Make the pipeline invoke onProgress so we can verify detail is logged
    mockRunAnalysisPipeline.mockImplementation(async (_input: unknown, _llm: unknown, onProgress?: (event: { phase: string; status: string }) => void) => {
      onProgress?.({ phase: "lenses_batch1", status: "started" });
      return pipelineResult;
    });

    await runScan("https://example.com", { format: "summary", verbose: true });

    // The pipeline was called with an onProgress callback
    const onProgress = mockRunAnalysisPipeline.mock.calls[0][2];
    expect(onProgress).toBeInstanceOf(Function);

    // In non-TTY verbose mode, detail messages go to console.error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("lenses_batch1"),
    );
  });

  it("writes enriched outcomes to outputs/outcomes.json", async () => {
    const enrichedOutcomes = [
      {
        description: "Increase retention",
        type: "business",
        linkedFeatures: ["onboarding"],
        measurement_references: [{ entity: "project", activity: "created" }],
        suggested_metrics: ["retention_rate"],
      },
    ];
    const resultWithEnrichedOutcomes = {
      ...pipelineResult,
      outputs: {
        ...pipelineResult.outputs,
        enriched_outcomes: enrichedOutcomes,
      },
    };
    mockRunAnalysisPipeline.mockReset();
    mockRunAnalysisPipeline.mockResolvedValue(resultWithEnrichedOutcomes);
    mockSave.mockReset();
    mockSave.mockResolvedValue("enriched-outcomes-id");

    await runScan("https://example.com", { format: "summary", verbose: false });

    const writeCalls = mockWriteJson.mock.calls.map((c: unknown[]) => c[1]);
    expect(writeCalls).toContain("outputs/outcomes.json");

    // Verify the data written is the enriched outcomes
    const outcomeCall = mockWriteJson.mock.calls.find((c: unknown[]) => c[1] === "outputs/outcomes.json");
    expect(outcomeCall).toBeDefined();
    expect(outcomeCall![2]).toEqual(enrichedOutcomes);
  });

  it("prefers enriched outcomes for profile.outcomes.items", async () => {
    const enrichedOutcomes = [
      {
        description: "Increase retention",
        type: "business",
        linkedFeatures: ["onboarding"],
        measurement_references: [{ entity: "project", activity: "created" }],
        suggested_metrics: ["retention_rate"],
      },
    ];
    const resultWithEnrichedOutcomes = {
      ...pipelineResult,
      outputs: {
        ...pipelineResult.outputs,
        enriched_outcomes: enrichedOutcomes,
      },
    };
    mockRunAnalysisPipeline.mockReset();
    mockRunAnalysisPipeline.mockResolvedValue(resultWithEnrichedOutcomes);
    mockSave.mockReset();
    mockSave.mockResolvedValue("enriched-profile-id");

    await runScan("https://example.com", { format: "summary", verbose: false });

    const savedProfile = mockSave.mock.calls[0][0];
    expect(savedProfile.outcomes).toBeDefined();
    expect(savedProfile.outcomes.items).toEqual(enrichedOutcomes);
  });

  it("does not set profile.outcomes when enriched_outcomes is null", async () => {
    // Default pipelineResult has enriched_outcomes: null
    mockRunAnalysisPipeline.mockReset();
    mockRunAnalysisPipeline.mockResolvedValue(pipelineResult);
    mockSave.mockReset();
    mockSave.mockResolvedValue("no-outcomes-id");

    await runScan("https://example.com", { format: "summary", verbose: false });

    const savedProfile = mockSave.mock.calls[0][0];
    expect(savedProfile.outcomes).toBeUndefined();
  });
});
