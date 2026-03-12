import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { loadDocuments } from "./document-loader.js";

function createTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "basesignal-doc-test-"));
}

describe("loadDocuments", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // -----------------------------------------------------------------------
  // Basic file loading
  // -----------------------------------------------------------------------

  it("loads a markdown file as CrawledPage with pageType='document'", async () => {
    writeFileSync(join(tmpDir, "readme.md"), "# Hello\n\nThis is content.");

    const pages = await loadDocuments(tmpDir);

    expect(pages).toHaveLength(1);
    expect(pages[0].pageType).toBe("document");
    expect(pages[0].content).toBe("# Hello\n\nThis is content.");
    expect(pages[0].title).toBe("readme");
    expect(pages[0].url).toBe(`file://${resolve(join(tmpDir, "readme.md"))}`);
  });

  it("loads a text file as CrawledPage with raw content", async () => {
    writeFileSync(join(tmpDir, "notes.txt"), "Some plain text notes.");

    const pages = await loadDocuments(tmpDir);

    expect(pages).toHaveLength(1);
    expect(pages[0].pageType).toBe("document");
    expect(pages[0].content).toBe("Some plain text notes.");
    expect(pages[0].title).toBe("notes");
  });

  it("converts dashes and underscores in filename to spaces for title", async () => {
    writeFileSync(join(tmpDir, "my-great_doc.md"), "content");

    const pages = await loadDocuments(tmpDir);

    expect(pages[0].title).toBe("my great doc");
  });

  // -----------------------------------------------------------------------
  // Metadata
  // -----------------------------------------------------------------------

  it("includes source_type, original_path, and chunk_index in metadata", async () => {
    writeFileSync(join(tmpDir, "doc.txt"), "hello");

    const pages = await loadDocuments(tmpDir);

    expect(pages[0].metadata).toEqual({
      source_type: "document",
      original_path: resolve(join(tmpDir, "doc.txt")),
      chunk_index: 0,
    });
  });

  // -----------------------------------------------------------------------
  // Markdown chunking
  // -----------------------------------------------------------------------

  it("chunks large markdown files by heading", async () => {
    // Create a markdown file >8000 chars with multiple headings
    const section = "x".repeat(3000);
    const content = [
      "# Intro",
      section,
      "## Part A",
      section,
      "## Part B",
      section,
      "## Part C",
      section,
    ].join("\n");

    writeFileSync(join(tmpDir, "big.md"), content);

    const pages = await loadDocuments(tmpDir);

    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.pageType).toBe("document");
      expect(page.metadata).toHaveProperty("chunk_index");
      expect(page.metadata).toHaveProperty("source_type", "document");
    }
    // Chunk indices should be sequential
    const indices = pages.map((p) => (p.metadata as Record<string, unknown>).chunk_index);
    expect(indices).toEqual(indices.map((_, i) => i));
    // First chunk title is plain, rest have (part N)
    expect(pages[0].title).toContain("(part 1)");
  });

  // -----------------------------------------------------------------------
  // Text chunking
  // -----------------------------------------------------------------------

  it("chunks large text files by paragraph", async () => {
    const paragraph = "p".repeat(3000);
    const content = [paragraph, paragraph, paragraph, paragraph].join("\n\n");

    writeFileSync(join(tmpDir, "big.txt"), content);

    const pages = await loadDocuments(tmpDir);

    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.pageType).toBe("document");
    }
  });

  // -----------------------------------------------------------------------
  // Empty directory
  // -----------------------------------------------------------------------

  it("returns empty array for empty directory", async () => {
    const pages = await loadDocuments(tmpDir);
    expect(pages).toEqual([]);
  });

  it("returns empty array for nonexistent directory", async () => {
    const pages = await loadDocuments(join(tmpDir, "no-such-dir"));
    expect(pages).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Mixed files (only supported types)
  // -----------------------------------------------------------------------

  it("only loads supported file types (.md, .txt, .pdf), ignoring others", async () => {
    writeFileSync(join(tmpDir, "doc.md"), "markdown");
    writeFileSync(join(tmpDir, "notes.txt"), "text");
    writeFileSync(join(tmpDir, "image.jpg"), "not-a-real-image");
    writeFileSync(join(tmpDir, "data.csv"), "a,b,c");
    writeFileSync(join(tmpDir, "script.js"), "console.log('hi')");

    const pages = await loadDocuments(tmpDir);

    expect(pages).toHaveLength(2);
    const titles = pages.map((p) => p.title).sort();
    expect(titles).toEqual(["doc", "notes"]);
  });

  // -----------------------------------------------------------------------
  // PDF loading
  // -----------------------------------------------------------------------

  it("loads a PDF file and extracts text", async () => {
    // Create a minimal valid PDF
    const pdfContent = createMinimalPdf("Hello from PDF");
    writeFileSync(join(tmpDir, "test.pdf"), pdfContent);

    const pages = await loadDocuments(tmpDir);

    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages[0].pageType).toBe("document");
    expect(pages[0].url).toContain("file://");
    expect(pages[0].url).toContain("test.pdf");
    expect(pages[0].metadata).toHaveProperty("source_type", "document");
  });

  // -----------------------------------------------------------------------
  // Unparseable PDF
  // -----------------------------------------------------------------------

  it("skips unparseable PDF with warning, loads other files", async () => {
    writeFileSync(join(tmpDir, "corrupt.pdf"), "this is not a real pdf");
    writeFileSync(join(tmpDir, "good.txt"), "good content");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const pages = await loadDocuments(tmpDir);

    // The good .txt file should still load
    expect(pages.length).toBeGreaterThanOrEqual(1);
    const textPage = pages.find((p) => p.content === "good content");
    expect(textPage).toBeDefined();

    // A warning should have been emitted
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("corrupt.pdf"));

    warnSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // Subdirectories are not traversed
  // -----------------------------------------------------------------------

  it("does not recurse into subdirectories", async () => {
    mkdirSync(join(tmpDir, "subdir"));
    writeFileSync(join(tmpDir, "subdir", "nested.md"), "nested");
    writeFileSync(join(tmpDir, "top.md"), "top level");

    const pages = await loadDocuments(tmpDir);

    expect(pages).toHaveLength(1);
    expect(pages[0].content).toBe("top level");
  });
});

/**
 * Create a minimal valid PDF with the given text.
 * This is a bare-minimum PDF 1.0 file that pdf-parse can read.
 */
function createMinimalPdf(text: string): Buffer {
  const content = `%PDF-1.0
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj

4 0 obj
<< /Length ${26 + text.length} >>
stream
BT /F1 12 Tf 100 700 Td (${text}) Tj ET
endstream
endobj

5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj

xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
${String(344 + text.length).padStart(10, "0")} 00000 n

trailer
<< /Size 6 /Root 1 0 R >>
startxref
${413 + text.length}
%%EOF`;

  return Buffer.from(content);
}
