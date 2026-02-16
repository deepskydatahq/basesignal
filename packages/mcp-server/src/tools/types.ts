import type {
  StorageAdapter,
  ProfileSummary,
  ProductProfile,
} from "@basesignal/storage";

export type { StorageAdapter, ProfileSummary, ProductProfile };

export interface ToolDeps {
  storage: StorageAdapter;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function text(markdown: string): ToolResult {
  return { content: [{ type: "text", text: markdown }] };
}

export function error(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
