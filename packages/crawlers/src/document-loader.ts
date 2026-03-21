import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, extname, basename, resolve } from "node:path";
import type { CrawledPage } from "./types.js";

/** Supported file extensions for document loading. */
const SUPPORTED_EXTENSIONS = new Set([".md", ".txt", ".pdf"]);

/** Maximum characters per chunk before splitting. */
const CHUNK_THRESHOLD = 8000;

/**
 * Document metadata stored alongside standard CrawledPage metadata.
 */
export interface DocumentMetadata {
  description?: string;
  ogImage?: string;
  structuredData?: unknown;
  /** Always 'document' for loaded files. */
  source_type: "document";
  /** Absolute path to the original file. */
  original_path: string;
  /** Zero-based chunk index (0 if not chunked). */
  chunk_index: number;
}

/**
 * Load documents from a directory and return them as CrawledPage entries.
 *
 * Reads all .md, .txt, and .pdf files from the given directory.
 * Large documents are chunked to stay within the ~8000 char threshold.
 * Unsupported files are silently skipped.
 *
 * @param dirPath - Path to the directory containing documents
 * @returns Array of CrawledPage entries with pageType='document'
 */
export async function loadDocuments(dirPath: string): Promise<CrawledPage[]> {
  const resolvedDir = resolve(dirPath);

  if (!existsSync(resolvedDir)) {
    return [];
  }

  const entries = readdirSync(resolvedDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && SUPPORTED_EXTENSIONS.has(extname(e.name).toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const pages: CrawledPage[] = [];

  for (const file of files) {
    const filePath = join(resolvedDir, file.name);
    const ext = extname(file.name).toLowerCase();

    try {
      let filePages: CrawledPage[];
      if (ext === ".pdf") {
        filePages = await readPdf(filePath);
      } else if (ext === ".md") {
        filePages = readMarkdown(filePath);
      } else {
        filePages = readText(filePath);
      }
      pages.push(...filePages);
    } catch (error) {
      // Warn on stderr but don't throw — skip unparseable files
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`Warning: skipping ${file.name}: ${msg}`);
    }
  }

  return pages;
}

/**
 * Derive a human-readable title from a filename.
 * Removes extension, replaces dashes and underscores with spaces.
 */
function titleFromFilename(filePath: string): string {
  const name = basename(filePath, extname(filePath));
  return name.replace(/[-_]/g, " ");
}

/**
 * Build a file:// URL from an absolute path.
 */
function fileUrl(filePath: string): string {
  return `file://${resolve(filePath)}`;
}

/**
 * Create a CrawledPage for a document (or chunk of a document).
 */
function makePage(
  filePath: string,
  content: string,
  chunkIndex: number,
  chunkSuffix?: string,
): CrawledPage {
  const title = titleFromFilename(filePath);
  return {
    url: fileUrl(filePath),
    pageType: "document",
    title: chunkSuffix ? `${title} ${chunkSuffix}` : title,
    content,
    metadata: {
      source_type: "document",
      original_path: resolve(filePath),
      chunk_index: chunkIndex,
    } as DocumentMetadata,
  };
}

/**
 * Read a Markdown file. Chunks by heading (##) if content exceeds threshold.
 */
function readMarkdown(filePath: string): CrawledPage[] {
  const raw = readFileSync(filePath, "utf-8");

  if (raw.length <= CHUNK_THRESHOLD) {
    return [makePage(filePath, raw, 0)];
  }

  return chunkMarkdown(filePath, raw);
}

/**
 * Split Markdown content by ## headings into chunks.
 */
function chunkMarkdown(filePath: string, content: string): CrawledPage[] {
  // Split on ## headings (keep the heading with its section)
  const sections: string[] = [];
  const lines = content.split("\n");
  let current: string[] = [];

  for (const line of lines) {
    if (/^#{1,6}\s/.test(line) && current.length > 0) {
      sections.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    sections.push(current.join("\n"));
  }

  // Merge small sections to stay close to threshold
  const chunks: string[] = [];
  let buffer = "";

  for (const section of sections) {
    if (buffer.length + section.length > CHUNK_THRESHOLD && buffer.length > 0) {
      chunks.push(buffer.trim());
      buffer = section;
    } else {
      buffer += (buffer ? "\n" : "") + section;
    }
  }
  if (buffer.trim()) {
    chunks.push(buffer.trim());
  }

  // If we only got one chunk despite trying, just return it
  if (chunks.length <= 1) {
    return [makePage(filePath, content, 0)];
  }

  return chunks.map((chunk, i) => makePage(filePath, chunk, i, `(part ${i + 1})`));
}

/**
 * Read a plain text file. Chunks by paragraph if content exceeds threshold.
 */
function readText(filePath: string): CrawledPage[] {
  const raw = readFileSync(filePath, "utf-8");

  if (raw.length <= CHUNK_THRESHOLD) {
    return [makePage(filePath, raw, 0)];
  }

  return chunkText(filePath, raw);
}

/**
 * Split plain text by double-newline paragraphs into chunks.
 */
function chunkText(filePath: string, content: string): CrawledPage[] {
  const paragraphs = content.split(/\n\n+/);
  const chunks: string[] = [];
  let buffer = "";

  for (const para of paragraphs) {
    if (buffer.length + para.length > CHUNK_THRESHOLD && buffer.length > 0) {
      chunks.push(buffer.trim());
      buffer = para;
    } else {
      buffer += (buffer ? "\n\n" : "") + para;
    }
  }
  if (buffer.trim()) {
    chunks.push(buffer.trim());
  }

  if (chunks.length <= 1) {
    return [makePage(filePath, content, 0)];
  }

  return chunks.map((chunk, i) => makePage(filePath, chunk, i, `(part ${i + 1})`));
}

/**
 * Read a PDF file. Uses pdf-parse to extract text, one CrawledPage per page.
 */
async function readPdf(filePath: string): Promise<CrawledPage[]> {
  const { PDFParse } = await import("pdf-parse");
  const buffer = readFileSync(filePath);

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();

  await parser.destroy();

  if (result.total === 0 || !result.text.trim()) {
    return [makePage(filePath, "", 0)];
  }

  // If small enough, return as single page
  if (result.total === 1 || result.text.length <= CHUNK_THRESHOLD) {
    return [makePage(filePath, result.text.trim(), 0)];
  }

  // Split by PDF page
  const pages: CrawledPage[] = [];
  for (let i = 1; i <= result.total; i++) {
    const pageText = result.getPageText(i).trim();
    if (pageText) {
      pages.push(makePage(filePath, pageText, i - 1, `(page ${i})`));
    }
  }

  return pages.length > 0 ? pages : [makePage(filePath, result.text.trim(), 0)];
}
