import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock child_process.spawn
const mockOn = vi.fn();
const mockStdoutOn = vi.fn();
const mockStderrOn = vi.fn();
const mockSpawn = vi.fn();

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

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
const { runLoad, findPythonBinary } = await import("./load.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockProcess() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  const stdoutListeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  const stderrListeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  const proc = {
    stdout: {
      on: (event: string, cb: (...args: unknown[]) => void) => {
        stdoutListeners[event] = stdoutListeners[event] || [];
        stdoutListeners[event].push(cb);
      },
    },
    stderr: {
      on: (event: string, cb: (...args: unknown[]) => void) => {
        stderrListeners[event] = stderrListeners[event] || [];
        stderrListeners[event].push(cb);
      },
    },
    on: (event: string, cb: (...args: unknown[]) => void) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    },
    emit(event: string, ...args: unknown[]) {
      (listeners[event] || []).forEach((cb) => cb(...args));
    },
    emitStderr(event: string, ...args: unknown[]) {
      (stderrListeners[event] || []).forEach((cb) => cb(...args));
    },
    emitStdout(event: string, ...args: unknown[]) {
      (stdoutListeners[event] || []).forEach((cb) => cb(...args));
    },
  };
  return proc;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("load command", () => {
  const savedEnv: Record<string, string | undefined> = {};
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let stderrWriteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    savedEnv.BASESIGNAL_STORAGE = process.env.BASESIGNAL_STORAGE;
    process.env.BASESIGNAL_STORAGE = "/tmp/basesignal-test";

    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
    stderrWriteSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    mockSpawn.mockReset();
  });

  afterEach(() => {
    if (savedEnv.BASESIGNAL_STORAGE === undefined) {
      delete process.env.BASESIGNAL_STORAGE;
    } else {
      process.env.BASESIGNAL_STORAGE = savedEnv.BASESIGNAL_STORAGE;
    }
    vi.restoreAllMocks();
  });

  it("rejects unknown platform", async () => {
    await expect(
      runLoad("unknown-platform", {
        product: "acme",
        apiKey: "xxx",
        verbose: false,
      }),
    ).rejects.toThrow("process.exit called");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown platform "unknown-platform"'),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("posthog"),
    );
  });

  it("passes correct args to Python subprocess for posthog", async () => {
    // Mock findPythonBinary to resolve quickly
    const proc = createMockProcess();
    let spawnCallIndex = 0;

    mockSpawn.mockImplementation((bin: string, args: string[]) => {
      spawnCallIndex++;
      // First calls are from findPythonBinary (python3 --version)
      if (args[0] === "--version") {
        const versionProc = createMockProcess();
        setTimeout(() => {
          versionProc.emitStdout("data", Buffer.from("Python 3.12.1\n"));
          versionProc.emit("close", 0);
        }, 0);
        return versionProc;
      }
      // The actual subprocess call
      setTimeout(() => proc.emit("close", 0), 0);
      return proc;
    });

    await runLoad("posthog", {
      product: "acme",
      apiKey: "phx_testkey",
      projectId: "12345",
      verbose: false,
    });

    // Find the call that was the actual loader invocation (not --version)
    const loaderCall = mockSpawn.mock.calls.find(
      (c: unknown[]) => Array.isArray(c[1]) && (c[1] as string[]).includes("-m"),
    );
    expect(loaderCall).toBeDefined();
    const [bin, args] = loaderCall as [string, string[]];
    expect(bin).toBe("python3");
    expect(args).toContain("-m");
    expect(args).toContain("basesignal_loaders");
    expect(args).toContain("--platform");
    expect(args).toContain("posthog");
    expect(args).toContain("--api-key");
    expect(args).toContain("phx_testkey");
    expect(args).toContain("--project-id");
    expect(args).toContain("12345");
    expect(args).toContain("--output");
    expect(args[args.indexOf("--output") + 1]).toContain("taxonomy/events.json");
  });

  it("forwards Python stderr to user", async () => {
    const proc = createMockProcess();
    mockSpawn.mockImplementation((_bin: string, args: string[]) => {
      if (args[0] === "--version") {
        const versionProc = createMockProcess();
        setTimeout(() => {
          versionProc.emitStdout("data", Buffer.from("Python 3.12.1\n"));
          versionProc.emit("close", 0);
        }, 0);
        return versionProc;
      }
      setTimeout(() => {
        proc.emitStderr("data", Buffer.from("Extracting events...\n"));
        proc.emit("close", 0);
      }, 0);
      return proc;
    });

    await runLoad("posthog", {
      product: "acme",
      apiKey: "xxx",
      verbose: false,
    });

    expect(stderrWriteSpy).toHaveBeenCalledWith("Extracting events...\n");
  });

  it("reports non-zero exit code as error", async () => {
    const proc = createMockProcess();
    mockSpawn.mockImplementation((_bin: string, args: string[]) => {
      if (args[0] === "--version") {
        const versionProc = createMockProcess();
        setTimeout(() => {
          versionProc.emitStdout("data", Buffer.from("Python 3.12.1\n"));
          versionProc.emit("close", 0);
        }, 0);
        return versionProc;
      }
      setTimeout(() => {
        proc.emitStderr("data", Buffer.from("API returned 401 Unauthorized\n"));
        proc.emit("close", 1);
      }, 0);
      return proc;
    });

    await expect(
      runLoad("posthog", {
        product: "acme",
        apiKey: "bad-key",
        verbose: false,
      }),
    ).rejects.toThrow("Load failed");
  });

  it("detects missing Python with helpful error", async () => {
    mockSpawn.mockImplementation((_bin: string, args: string[]) => {
      const proc = createMockProcess();
      setTimeout(() => proc.emit("error", new Error("ENOENT")), 0);
      return proc;
    });

    await expect(
      runLoad("posthog", {
        product: "acme",
        apiKey: "xxx",
        verbose: false,
      }),
    ).rejects.toThrow("process.exit called");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Python 3.10+ required"),
    );
  });

  it("passes --host arg when provided", async () => {
    const proc = createMockProcess();
    mockSpawn.mockImplementation((_bin: string, args: string[]) => {
      if (args[0] === "--version") {
        const versionProc = createMockProcess();
        setTimeout(() => {
          versionProc.emitStdout("data", Buffer.from("Python 3.12.1\n"));
          versionProc.emit("close", 0);
        }, 0);
        return versionProc;
      }
      setTimeout(() => proc.emit("close", 0), 0);
      return proc;
    });

    await runLoad("posthog", {
      product: "acme",
      apiKey: "xxx",
      host: "https://posthog.mycompany.com",
      verbose: false,
    });

    const loaderCall = mockSpawn.mock.calls.find(
      (c: unknown[]) => Array.isArray(c[1]) && (c[1] as string[]).includes("-m"),
    );
    expect(loaderCall).toBeDefined();
    const args = loaderCall![1] as string[];
    expect(args).toContain("--host");
    expect(args).toContain("https://posthog.mycompany.com");
  });
});

describe("findPythonBinary", () => {
  beforeEach(() => {
    mockSpawn.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns python3 when version is 3.10+", async () => {
    mockSpawn.mockImplementation((bin: string) => {
      const proc = createMockProcess();
      if (bin === "python3") {
        setTimeout(() => {
          proc.emitStdout("data", Buffer.from("Python 3.12.1\n"));
          proc.emit("close", 0);
        }, 0);
      } else {
        setTimeout(() => proc.emit("error", new Error("ENOENT")), 0);
      }
      return proc;
    });

    const result = await findPythonBinary();
    expect(result).toBe("python3");
  });

  it("falls back to python when python3 not found", async () => {
    mockSpawn.mockImplementation((bin: string) => {
      const proc = createMockProcess();
      if (bin === "python3") {
        setTimeout(() => proc.emit("error", new Error("ENOENT")), 0);
      } else if (bin === "python") {
        setTimeout(() => {
          proc.emitStdout("data", Buffer.from("Python 3.11.0\n"));
          proc.emit("close", 0);
        }, 0);
      }
      return proc;
    });

    const result = await findPythonBinary();
    expect(result).toBe("python");
  });

  it("throws when no Python 3.10+ found", async () => {
    mockSpawn.mockImplementation(() => {
      const proc = createMockProcess();
      setTimeout(() => proc.emit("error", new Error("ENOENT")), 0);
      return proc;
    });

    await expect(findPythonBinary()).rejects.toThrow("Python 3.10+ required");
  });
});
