import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { registerServeCommand } from "./serve.js";

// Mock @basesignal/mcp-server
const mockCreateServer = vi.fn().mockResolvedValue(undefined);
vi.mock("@basesignal/mcp-server", () => ({
  createServer: (...args: unknown[]) => mockCreateServer(...args),
}));

describe("serve command", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockCreateServer.mockResolvedValue(undefined);
  });

  it("is registered on the program", () => {
    const program = new Command();
    const getStorage = vi.fn();
    const getProvider = vi.fn();

    registerServeCommand(
      program,
      getStorage as never,
      getProvider as never,
    );

    // Commander stores commands internally
    const commands = program.commands.map((c) => c.name());
    expect(commands).toContain("serve");
  });

  it("has correct description", () => {
    const program = new Command();
    registerServeCommand(program, vi.fn() as never, vi.fn() as never);

    const serveCmd = program.commands.find((c) => c.name() === "serve");
    expect(serveCmd?.description()).toContain("MCP server");
    expect(serveCmd?.description()).toContain("stdio");
  });

  it("calls createServer from @basesignal/mcp-server when run", async () => {
    const program = new Command();
    program.exitOverride();

    const mockStorage = { list: vi.fn(), load: vi.fn() };
    const mockProvider = {};

    registerServeCommand(
      program,
      () => mockStorage as never,
      () => mockProvider as never,
    );

    // Capture stderr to avoid noise
    vi.spyOn(console, "error").mockImplementation(() => {});

    await program.parseAsync(["node", "basesignal", "serve"]);

    expect(mockCreateServer).toHaveBeenCalledWith({
      storage: mockStorage,
      llmProvider: mockProvider,
    });
  });

  it("writes startup messages to stderr, not stdout", async () => {
    const stderrMessages: string[] = [];
    const stdoutMessages: string[] = [];

    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      stderrMessages.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      stdoutMessages.push(args.map(String).join(" "));
    });

    const program = new Command();
    program.exitOverride();
    registerServeCommand(program, vi.fn() as never, vi.fn() as never);

    await program.parseAsync(["node", "basesignal", "serve"]);

    expect(stderrMessages.some((m) => m.includes("Starting"))).toBe(true);
    expect(stdoutMessages).toHaveLength(0);
  });

  it("does not accept --transport or --port flags (deferred)", () => {
    const program = new Command();
    registerServeCommand(program, vi.fn() as never, vi.fn() as never);

    const serveCmd = program.commands.find((c) => c.name() === "serve");
    const optionNames = serveCmd?.options.map((o) => o.long) ?? [];
    expect(optionNames).not.toContain("--transport");
    expect(optionNames).not.toContain("--port");
  });
});
