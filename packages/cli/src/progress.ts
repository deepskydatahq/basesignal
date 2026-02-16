import ora from "ora";
import type { Ora } from "ora";

export interface Progress {
  start(phase: string, detail: string): void;
  detail(message: string): void;
  done(phase: string, result: string): void;
  fail(phase: string, message: string): void;
}

export function createProgress(verbose: boolean): Progress {
  const isTTY = Boolean(process.stderr.isTTY);

  if (isTTY) {
    let spinner: Ora | null = null;

    return {
      start(phase: string, detail: string): void {
        spinner = ora({ text: `${phase}: ${detail}`, stream: process.stderr }).start();
      },
      detail(message: string): void {
        if (verbose && spinner) {
          spinner.text = message;
        }
      },
      done(phase: string, result: string): void {
        if (spinner) {
          spinner.succeed(`${phase}: ${result}`);
          spinner = null;
        }
      },
      fail(phase: string, message: string): void {
        if (spinner) {
          spinner.fail(`${phase}: ${message}`);
          spinner = null;
        }
      },
    };
  }

  // Non-TTY: plain text to stderr
  return {
    start(phase: string, detail: string): void {
      console.error(`[${phase}] ${detail}`);
    },
    detail(message: string): void {
      if (verbose) {
        console.error(`  ${message}`);
      }
    },
    done(phase: string, result: string): void {
      console.error(`[${phase}] Done: ${result}`);
    },
    fail(phase: string, message: string): void {
      console.error(`[${phase}] Failed: ${message}`);
    },
  };
}
