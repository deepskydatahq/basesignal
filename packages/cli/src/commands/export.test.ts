import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";

// Mock node:fs -- vi.mock is hoisted above imports
const mockWriteFileSync = vi.fn();
const mockReadFileSync = vi.fn();
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  };
});

// Mock @basesignal/mcp-server export formatters
vi.mock("@basesignal/mcp-server", () => ({
  exportProfileAsJson: vi.fn((profile: Record<string, unknown>) =>
    JSON.stringify({ basesignal_version: "1.0", ...profile }, null, 2),
  ),
  exportProfileAsMarkdown: vi.fn(
    (profile: Record<string, unknown>) =>
      `# ${(profile.identity as { productName?: string } | undefined)?.productName ?? "Unknown"} - Product Profile\n`,
  ),
}));

// Import after mocks
const { registerExportCommand } = await import("./export.js");

// Mock storage adapter
function createMockStorage(
  profiles: Array<{
    id: string;
    name: string;
    url: string;
    updatedAt: number;
  }> = [],
) {
  const fullProfiles = new Map<string, Record<string, unknown>>();
  for (const p of profiles) {
    fullProfiles.set(p.id, {
      id: p.id,
      identity: { productName: p.name },
      metadata: { url: p.url },
      completeness: 0.8,
      overallConfidence: 0.7,
    });
  }

  return {
    list: vi.fn().mockResolvedValue(
      profiles.map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        completeness: 0.8,
        updatedAt: p.updatedAt,
      })),
    ),
    load: vi.fn().mockImplementation(async (id: string) => {
      return fullProfiles.get(id) ?? null;
    }),
    save: vi.fn(),
    delete: vi.fn(),
    search: vi.fn(),
    close: vi.fn(),
  };
}

// Helper to capture stdout/stderr and exit calls
function setupCapture() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let exitCode: number | undefined;

  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    stdout.push(String(chunk));
    return true;
  });
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    stdout.push(args.join(" "));
  });
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    stderr.push(args.join(" "));
  });
  vi.spyOn(process, "exit").mockImplementation(
    ((code?: string | number | null) => {
      exitCode = typeof code === "number" ? code : 0;
      throw new Error(`process.exit(${code})`);
    }) as never,
  );

  return {
    getStdout: () => stdout.join("\n"),
    getStderr: () => stderr.join("\n"),
    getExitCode: () => exitCode,
  };
}

// Helper to run a command with arguments
async function runExport(
  args: string[],
  storage = createMockStorage(),
) {
  const program = new Command();
  program.exitOverride();
  registerExportCommand(program, () => storage as never);

  try {
    await program.parseAsync(["node", "basesignal", "export", ...args]);
  } catch {
    // Commander throws on exit, expected for error cases
  }
}

describe("export command", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockWriteFileSync.mockReset();
    mockReadFileSync.mockReset();
  });

  describe("--list", () => {
    it("shows all stored profiles", async () => {
      const capture = setupCapture();
      const storage = createMockStorage([
        {
          id: "abc123",
          name: "Linear",
          url: "https://linear.app",
          updatedAt: 1707868800000,
        },
        {
          id: "def456",
          name: "Notion",
          url: "https://notion.so",
          updatedAt: 1707782400000,
        },
      ]);

      await runExport(["--list"], storage);

      expect(storage.list).toHaveBeenCalled();
      const output = capture.getStdout();
      expect(output).toContain("abc123");
      expect(output).toContain("Linear");
      expect(output).toContain("https://linear.app");
    });

    it("shows helpful message when no profiles exist", async () => {
      const capture = setupCapture();
      const storage = createMockStorage([]);

      await runExport(["--list"], storage);

      const output = capture.getStdout();
      expect(output).toContain("No profiles stored");
      expect(output).toContain("basesignal scan");
    });
  });

  describe("export by ID", () => {
    it("loads profile from storage and outputs markdown by default", async () => {
      const capture = setupCapture();
      const storage = createMockStorage([
        {
          id: "abc123",
          name: "Linear",
          url: "https://linear.app",
          updatedAt: 1707868800000,
        },
      ]);

      await runExport(["abc123"], storage);

      expect(storage.load).toHaveBeenCalledWith("abc123");
      const output = capture.getStdout();
      expect(output).toContain("Linear");
    });

    it("outputs JSON when --format json is specified", async () => {
      const capture = setupCapture();
      const storage = createMockStorage([
        {
          id: "abc123",
          name: "Linear",
          url: "https://linear.app",
          updatedAt: 1707868800000,
        },
      ]);

      await runExport(["abc123", "--format", "json"], storage);

      const output = capture.getStdout();
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("prints error and exits 1 when profile not found", async () => {
      const capture = setupCapture();
      const storage = createMockStorage();
      storage.load.mockResolvedValue(null);

      await runExport(["nonexistent-id"], storage);

      const errors = capture.getStderr();
      expect(errors).toContain("not found");
      expect(errors).toContain("--list");
      expect(capture.getExitCode()).toBe(1);
    });
  });

  describe("export from file", () => {
    it("detects file paths via resolveInput and reads from disk", async () => {
      const capture = setupCapture();
      const storage = createMockStorage();

      // Make readFileSync throw to simulate missing file
      mockReadFileSync.mockImplementation(() => {
        throw new Error("ENOENT: no such file or directory");
      });

      await runExport(["./profile.json"], storage);

      // Should NOT call storage.load (it's a file path, not a storage ID)
      expect(storage.load).not.toHaveBeenCalled();
      // Will error because the file doesn't exist, which is expected
      expect(capture.getExitCode()).toBe(1);
      expect(capture.getStderr()).toContain("could not read file");
    });
  });

  describe("no arguments", () => {
    it("prints usage hint and exits 1 when no id and no --list", async () => {
      const capture = setupCapture();
      const storage = createMockStorage();

      await runExport([], storage);

      const errors = capture.getStderr();
      expect(errors).toContain("provide a profile ID or file path");
      expect(capture.getExitCode()).toBe(1);
    });
  });

  describe("--output flag", () => {
    it("writes to file and prints confirmation to stderr", async () => {
      const capture = setupCapture();
      const storage = createMockStorage([
        {
          id: "abc123",
          name: "Linear",
          url: "https://linear.app",
          updatedAt: 1707868800000,
        },
      ]);

      await runExport(["abc123", "--output", "out.md"], storage);

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        "out.md",
        expect.any(String),
        "utf-8",
      );
      expect(capture.getStderr()).toContain("Written to out.md");
    });
  });
});
