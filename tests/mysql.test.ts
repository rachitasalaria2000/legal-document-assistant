import { it, expect } from "vitest";
import { createPool, MysqlStore } from "../server/database.js";
import { config } from "../server/config.js";
import { fixturePdf } from "./pdf-fixture.js";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Processor } from "../server/processing.js";
import { Retriever } from "../server/retrieval.js";
it("round-trips JSON embeddings, enforces FK, and persists chats in real MySQL", async () => {
  if (!config.MYSQL_DATABASE.endsWith("_test"))
    throw Error("Use a dedicated *_test database.");
  const pool = createPool();
  const store = new MysqlStore(pool);
  let id = 0;
  try {
    id = await store.create("integration.pdf", "/tmp/integration.pdf", "test");
    await store.saveChunks(id, [
      {
        chunk_index: 0,
        content: "Payment within 30 days.",
        page_number: 2,
        section_heading: "Payment",
        embedding: [0.2, 0.8],
      },
    ]);
    const rows = await store.chunks(id);
    expect(rows[0].embedding).toEqual([0.2, 0.8]);
    expect((await store.get(id))?.total_chunks).toBe(1);
    await store.update(id, "ready", 100);
    await store.saveChat(id, "When?", "30 days.");
    expect(await store.history(id)).toHaveLength(2);
    await expect(store.saveChat(4294967294, "x", "y")).rejects.toThrow();
    await store.clearChunks(id);
    expect(await store.chunks(id)).toEqual([]);
  } finally {
    if (id) await pool.execute("DELETE FROM documents WHERE id=?", [id]);
    await pool.end();
  }
});
it("processes 100 pages into real MySQL and recovers from a partially saved batch", async () => {
  if (!config.MYSQL_DATABASE.endsWith("_test"))
    throw Error("Use a dedicated *_test database.");
  const pool = createPool();
  const store = new MysqlStore(pool);
  const dir = await mkdtemp(path.join(os.tmpdir(), "legal-db-"));
  let id = 0;
  try {
    const file = path.join(dir, "long.pdf");
    await fixturePdf(file, 100);
    id = await store.create("100-page-test.pdf", file, "test");
    let batches = 0;
    const embeddings = {
      embedDocuments: async (text: string[]) => {
        if (++batches === 2) throw Error("Provider interrupted");
        return text.map(() => [1, 0]);
      },
      embedQuery: async () => [1, 0],
    };
    const processor = new Processor(store, () => embeddings);
    await processor.process(id);
    expect((await store.get(id))?.status).toBe("failed");
    expect((await store.get(id))?.total_chunks).toBe(16);
    await processor.process(id);
    expect((await store.get(id))?.status).toBe("ready");
    expect((await store.get(id))?.total_pages).toBe(100);
    expect((await store.get(id))?.total_chunks).toBe(100);
    expect(
      (
        await new Retriever(store, () => embeddings).search(
          "Payment obligations",
          id,
        )
      ).every((c) => c.document_id === id),
    ).toBe(true);
  } finally {
    if (id) await pool.execute("DELETE FROM documents WHERE id=?", [id]);
    await pool.end();
    await rm(dir, { recursive: true, force: true });
  }
});
