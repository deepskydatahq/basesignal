import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CLIError, ScanError, handleError, handleScanError } from "./errors.js";

describe("CLIError", () => {
  it("has correct name and message", () => {
    const error = new CLIError("test");
    expect(error.name).toBe("CLIError");
    expect(error.message).toBe("test");
  });

  it("stores hint", () => {
    const error = new CLIError("msg", "hint text");
    expect(error.hint).toBe("hint text");
  });

  it("hint is optional", () => {
    const error = new CLIError("msg");
    expect(error.hint).toBeUndefined();
  });

  it("is an instance of Error", () => {
    const error = new CLIError("msg");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("handleError", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => {
        throw new Error("process.exit called");
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats CLIError with hint", () => {
    expect(() =>
      handleError(new CLIError("something failed", "try this instead")),
    ).toThrow("process.exit called");

    expect(consoleErrorSpy).toHaveBeenCalledWith("Error: something failed");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Hint: try this instead",
    );
  });

  it("formats CLIError without hint", () => {
    expect(() => handleError(new CLIError("just a message"))).toThrow(
      "process.exit called",
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith("Error: just a message");
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("formats regular Error", () => {
    expect(() => handleError(new Error("boom"))).toThrow(
      "process.exit called",
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith("Error: boom");
  });

  it("formats unknown error", () => {
    expect(() => handleError("string error")).toThrow("process.exit called");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "An unexpected error occurred",
    );
  });

  it("exits with code 1 for CLIError", () => {
    expect(() => handleError(new CLIError("fail"))).toThrow();
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 for regular Error", () => {
    expect(() => handleError(new Error("fail"))).toThrow();
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with code 1 for unknown error", () => {
    expect(() => handleError(42)).toThrow();
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});

describe("ScanError", () => {
  it("carries code, message, and suggestion", () => {
    const err = new ScanError("invalid-url", "bad url", "try https://...");
    expect(err.code).toBe("invalid-url");
    expect(err.message).toBe("bad url");
    expect(err.suggestion).toBe("try https://...");
    expect(err.name).toBe("ScanError");
  });

  it("suggestion is optional", () => {
    const err = new ScanError("network-error", "cannot reach host");
    expect(err.suggestion).toBeUndefined();
  });

  it("is an instance of Error", () => {
    const err = new ScanError("crawl-empty", "no pages");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("handleScanError", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints message and suggestion for ScanError", () => {
    handleScanError(
      new ScanError("invalid-url", "bad url", "Example: basesignal scan https://linear.app"),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error: bad url");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Example: basesignal scan https://linear.app",
    );
  });

  it("prints message only for ScanError without suggestion", () => {
    handleScanError(new ScanError("crawl-empty", "no pages found"));
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error: no pages found");
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("classifies ENOTFOUND as network error", () => {
    handleScanError(new Error("getaddrinfo ENOTFOUND example.com"));
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error: Could not reach the website",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("internet connection"),
    );
  });

  it("classifies 401 as auth error", () => {
    handleScanError(new Error("Request failed with status 401"));
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error: Authentication failed",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("ANTHROPIC_API_KEY"),
    );
  });

  it("classifies 429 as rate limit error", () => {
    handleScanError(new Error("Request failed with status 429"));
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error: Rate limited by LLM provider",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Wait"),
    );
  });

  it("classifies EACCES as permission error", () => {
    handleScanError(new Error("EACCES: permission denied"));
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error: Permission denied");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("~/.basesignal/"),
    );
  });

  it("falls back to generic message for unknown errors", () => {
    handleScanError(new Error("something unexpected happened"));
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error: something unexpected happened",
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("--verbose"),
    );
  });
});
