import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runInit } from "./init.js";

describe("runInit", () => {
  let dir: string;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "basesignal-init-test-"));
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("creates basesignal.toml in the specified directory", () => {
    const result = runInit(dir);
    expect(existsSync(result)).toBe(true);
    expect(result).toBe(join(dir, "basesignal.toml"));
  });

  it("writes a valid TOML template with commented-out sections", () => {
    runInit(dir);
    const content = readFileSync(join(dir, "basesignal.toml"), "utf-8");
    expect(content).toContain("[provider]");
    expect(content).toContain("[storage]");
    expect(content).toContain("[crawl]");
    expect(content).toContain("[output]");
    expect(content).toContain("# name =");
  });

  it("does not overwrite an existing file", () => {
    writeFileSync(join(dir, "basesignal.toml"), "existing content", "utf-8");
    runInit(dir);
    const content = readFileSync(join(dir, "basesignal.toml"), "utf-8");
    expect(content).toBe("existing content");
  });

  it("logs message when file already exists", () => {
    writeFileSync(join(dir, "basesignal.toml"), "existing", "utf-8");
    runInit(dir);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Already exists"));
  });

  it("logs creation message on success", () => {
    runInit(dir);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Created"));
  });
});
