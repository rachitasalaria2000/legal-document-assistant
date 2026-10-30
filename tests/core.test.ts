import { describe, it, expect, vi } from "vitest";
import { cosineSimilarity, Retriever } from "../server/retrieval.js";
import { extractPdf, chunkPages } from "../server/pdf.js";
import { Processor } from "../server/processing.js";
import { MemoryStore, chunk } from "./helpers.js";
import { fixturePdf } from "./pdf-fixture.js";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
describe("PDF and chunks", () => {
  it("extracts actual PDF text page by page", async () => {
    const pages = await extractPdf("demo/sample-services-agreement.pdf");
    expect(pages).toHaveLength(5);
    expect(pages[1].text).toContain("30 days");
    expect(pages[3].text).toContain("TERMINATION");
  });
  it("preserves page and section metadata and splits long clauses with overlap", async () => {
    const text =
      "The customer must pay outstanding undisputed invoices within thirty days. ".repeat(
        160,
      );
    const rows = await chunkPages([
      { page: 8, text: "2. PAYMENT\n" + text },
      { page: 9, text: "4. TERMINATION\nTermination requires written notice." },
    ]);
    expect(rows.length).toBeGreaterThan(3);
    expect(rows[0].page_number).toBe(8);
    expect(rows[1].section_heading).toBe("2. PAYMENT");
    expect(rows.at(-1)?.page_number).toBe(9);
    expect(rows.at(-1)?.section_heading).toBe("4. TERMINATION");
    expect(rows.map((x) => x.chunk_index)).toEqual(rows.map((_, i) => i));
  });
  it("rejects non-PDF and reports unreadable scans", async () => {
    await expect(extractPdf("package.json")).rejects.toThrow();
  });
  it("extracts a 100-page PDF and reports OCR for an unreadable PDF", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "legal-pdf-"));
    try {
      const file = path.join(dir, "long.pdf");
      await fixturePdf(file, 100);
      const pages = await extractPdf(file);
      expect(pages).toHaveLength(100);
      const chunks = await chunkPages(pages);
      expect(chunks.at(-1)?.page_number).toBe(100);
      await fixturePdf(file, 2, false);
      await expect(extractPdf(file)).rejects.toThrow("OCR required");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("processes PDF and stores real-shaped embeddings before ready", async () => {
    const s = new MemoryStore();
    const id = await s.create(
      "sample.pdf",
      "demo/sample-services-agreement.pdf",
      "test",
    );
    await new Processor(s, () => ({
      embedDocuments: async (t) => t.map(() => [1, 0]),
      embedQuery: async () => [1, 0],
    })).process(id);
    expect((await s.get(id))?.status).toBe("ready");
    expect((await s.get(id))?.total_pages).toBe(5);
    expect(s.rows.every((c) => c.embedding.length === 2)).toBe(true);
  });
  it("keeps partial progress failed, then clears it on retry", async () => {
    const s = new MemoryStore();
    const id = await s.create(
      "x",
      "demo/sample-services-agreement.pdf",
      "test",
    );
    const embed = vi.fn().mockRejectedValue(new Error("rate limit"));
    const p = new Processor(s, () => ({
      embedDocuments: embed,
      embedQuery: async () => [1, 0],
    }));
    await p.process(id);
    expect((await s.get(id))?.status).toBe("failed");
    embed.mockImplementation(async (t: string[]) => t.map(() => [1, 0]));
    await p.process(id);
    const count = s.rows.length;
    await p.process(id);
    expect(s.rows).toHaveLength(count);
    expect((await s.get(id))?.status).toBe("ready");
  });
});
describe("semantic retrieval", () => {
  it("calculates cosine including orthogonal, opposite and zero vectors", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
    expect(() => cosineSimilarity([1], [1, 0])).toThrow();
    expect(() => cosineSimilarity([NaN], [1])).toThrow();
  });
  it("only retrieves selected document and adds neighbours across pages", async () => {
    const s = new MemoryStore();
    await s.create("one", "x", "test");
    await s.update(1, "ready");
    await s.create("two", "y", "test");
    s.rows = [chunk(1, 1), chunk(2, 2), { ...chunk(3), document_id: 2 }];
    const r = new Retriever(s, () => ({
      embedDocuments: async () => [],
      embedQuery: async () => [1, 0],
    }));
    const result = await r.search("termination", 1);
    expect(result.map((c) => c.id)).toEqual([1, 2]);
    expect(result.every((c) => c.document_id === 1)).toBe(true);
  });
  it("does not search incomplete documents", async () => {
    const s = new MemoryStore();
    await s.create("x", "x", "test");
    await expect(
      new Retriever(s, () => ({
        embedDocuments: async () => [],
        embedQuery: async () => [1],
      })).search("x", 1),
    ).rejects.toThrow("not ready");
  });
});
