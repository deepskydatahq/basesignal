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
  };
});

const mockCreateProvider = vi.fn().mockReturnValue({
  complete: vi.fn().mockResolvedValue("{}"),
});
vi.mock("@basesignal/core", () => ({
  createProvider: mockCreateProvider,
}));

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
  outputs: {
    icp_profiles: [],
    activation_map: null,
    measurement_spec: null,
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
});
