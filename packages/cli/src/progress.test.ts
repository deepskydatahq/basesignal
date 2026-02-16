import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ora module
const mockStart = vi.fn().mockReturnThis();
const mockSucceed = vi.fn().mockReturnThis();
const mockFail = vi.fn().mockReturnThis();
const mockSpinner = {
  start: mockStart,
  succeed: mockSucceed,
  fail: mockFail,
  text: "",
};

vi.mock("ora", () => ({
  default: vi.fn(() => mockSpinner),
}));

const { createProgress } = await import("./progress.js");

describe("createProgress", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const originalIsTTY = process.stderr.isTTY;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockStart.mockClear();
    mockSucceed.mockClear();
    mockFail.mockClear();
    mockSpinner.text = "";
  });

  afterEach(() => {
    Object.defineProperty(process.stderr, "isTTY", {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  describe("TTY mode", () => {
    beforeEach(() => {
      Object.defineProperty(process.stderr, "isTTY", {
        value: true,
        writable: true,
        configurable: true,
      });
    });

    it("start creates ora spinner", () => {
      const progress = createProgress(false);
      progress.start("Crawling", "example.com");
      expect(mockStart).toHaveBeenCalled();
    });

    it("done calls spinner.succeed", () => {
      const progress = createProgress(false);
      progress.start("Crawling", "example.com");
      progress.done("Crawling", "5 pages");
      expect(mockSucceed).toHaveBeenCalledWith("Crawling: 5 pages");
    });

    it("fail calls spinner.fail", () => {
      const progress = createProgress(false);
      progress.start("Crawling", "example.com");
      progress.fail("Crawling", "network error");
      expect(mockFail).toHaveBeenCalledWith("Crawling: network error");
    });

    it("verbose mode updates spinner text on detail", () => {
      const progress = createProgress(true);
      progress.start("Analyzing", "pages");
      progress.detail("processing lens 3 of 7");
      expect(mockSpinner.text).toBe("processing lens 3 of 7");
    });

    it("non-verbose mode ignores detail", () => {
      const progress = createProgress(false);
      progress.start("Analyzing", "pages");
      mockSpinner.text = "initial";
      progress.detail("processing lens 3 of 7");
      expect(mockSpinner.text).toBe("initial");
    });
  });

  describe("non-TTY mode", () => {
    beforeEach(() => {
      Object.defineProperty(process.stderr, "isTTY", {
        value: undefined,
        writable: true,
        configurable: true,
      });
    });

    it("start writes to stderr", () => {
      const progress = createProgress(false);
      progress.start("Crawling", "example.com");
      expect(consoleErrorSpy).toHaveBeenCalledWith("[Crawling] example.com");
    });

    it("done writes to stderr", () => {
      const progress = createProgress(false);
      progress.done("Crawling", "5 pages");
      expect(consoleErrorSpy).toHaveBeenCalledWith("[Crawling] Done: 5 pages");
    });

    it("fail writes to stderr", () => {
      const progress = createProgress(false);
      progress.fail("Crawling", "network error");
      expect(consoleErrorSpy).toHaveBeenCalledWith("[Crawling] Failed: network error");
    });

    it("verbose mode prints detail to stderr", () => {
      const progress = createProgress(true);
      progress.detail("processing lens 3 of 7");
      expect(consoleErrorSpy).toHaveBeenCalledWith("  processing lens 3 of 7");
    });

    it("non-verbose mode suppresses detail", () => {
      const progress = createProgress(false);
      progress.detail("processing lens 3 of 7");
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  it("all output goes to stderr, not stdout", () => {
    Object.defineProperty(process.stderr, "isTTY", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const progress = createProgress(true);
    progress.start("Crawling", "example.com");
    progress.detail("page 1");
    progress.done("Crawling", "done");
    progress.fail("Saving", "error");

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(stdoutWriteSpy).not.toHaveBeenCalled();
  });
});
