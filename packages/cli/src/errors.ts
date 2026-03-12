export class CLIError extends Error {
  readonly hint?: string;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = "CLIError";
    this.hint = hint;
  }
}

export type ScanErrorCode =
  | "invalid-url"
  | "network-error"
  | "crawl-empty"
  | "docs-not-found"
  | "missing-api-key"
  | "llm-error"
  | "llm-rate-limit"
  | "storage-error";

export class ScanError extends Error {
  constructor(
    public code: ScanErrorCode,
    message: string,
    public suggestion?: string,
  ) {
    super(message);
    this.name = "ScanError";
  }
}

export function handleError(error: unknown): never {
  if (error instanceof CLIError) {
    console.error(`Error: ${error.message}`);
    if (error.hint) {
      console.error(`Hint: ${error.hint}`);
    }
  } else if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error("An unexpected error occurred");
  }

  process.exit(1);
}

export function handleScanError(error: unknown): void {
  if (error instanceof ScanError) {
    console.error(`Error: ${error.message}`);
    if (error.suggestion) {
      console.error(error.suggestion);
    }
    return;
  }

  const message =
    error instanceof Error ? error.message : String(error);

  if (/ENOTFOUND|getaddrinfo/.test(message)) {
    console.error(`Error: Could not reach the website`);
    console.error("Check that the URL is correct and you have an internet connection");
    return;
  }

  if (/\b401\b|api_key/i.test(message)) {
    console.error(`Error: Authentication failed`);
    console.error("Set your API key: export ANTHROPIC_API_KEY=sk-...");
    return;
  }

  if (/\b429\b|rate_limit/i.test(message)) {
    console.error(`Error: Rate limited by LLM provider`);
    console.error("Wait a moment and try again");
    return;
  }

  if (/EACCES|permission/i.test(message)) {
    console.error(`Error: Permission denied`);
    console.error("Check permissions on ~/.basesignal/");
    return;
  }

  console.error(`Error: ${message}`);
  console.error("Use --verbose for more details");
}
