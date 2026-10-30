import { it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server/app.js";
import { AppError } from "../server/types.js";
import { MemoryStore } from "./helpers.js";
let dir: string;
let store: MemoryStore;
let enqueue: ReturnType<typeof vi.fn>;
let app: ReturnType<typeof createApp>;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "legal-upload-"));
  store = new MemoryStore();
  enqueue = vi.fn();
  app = createApp(
    {
      store,
      enqueue,
      modelName: "test",
      requireKey: () => {},
      answer: async () => ({ answer: "Answer [1]", sources: [], searches: 1 }),
    },
    dir,
  );
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
it("accepts PDF and queues it without waiting for embeddings", async () => {
  const r = await request(app)
    .post("/api/documents/upload")
    .attach("file", Buffer.from("%PDF-1.7\n test"), {
      filename: "contract.pdf",
      contentType: "application/pdf",
    });
  expect(r.status).toBe(202);
  expect(enqueue).toHaveBeenCalledWith(1);
  expect((await store.get(1))?.status).toBe("queued");
});
it("rejects wrong extension, MIME type, and fake PDF bytes", async () => {
  for (const [filename, contentType, data] of [
    ["a.txt", "text/plain", "text"],
    ["a.pdf", "application/pdf", "not pdf"],
  ]) {
    const r = await request(app)
      .post("/api/documents/upload")
      .attach("file", Buffer.from(data), { filename, contentType });
    expect(r.status).toBe(400);
  }
  expect(store.docs).toHaveLength(0);
});
it("enforces file size and required file", async () => {
  expect((await request(app).post("/api/documents/upload")).status).toBe(400);
  const r = await request(app)
    .post("/api/documents/upload")
    .attach("file", Buffer.alloc(26 * 1024 * 1024), {
      filename: "large.pdf",
      contentType: "application/pdf",
    });
  expect(r.status).toBe(400);
  expect(r.body.error).toContain("25 MB");
});
it("does not expose filesystem paths", async () => {
  await store.create("a.pdf", "/secret/path", "test");
  const r = await request(app).get("/api/documents/1/status");
  expect(r.body.file_path).toBeUndefined();
  expect(r.body.filename).toBe("a.pdf");
  expect((await request(app).get("/api/documents/100/status")).status).toBe(
    404,
  );
});
it("validates chat and blocks incomplete documents", async () => {
  await store.create("a", "x", "test");
  expect(
    (
      await request(app)
        .post("/api/chat")
        .send({ documentId: 1, question: "  " })
    ).status,
  ).toBe(400);
  expect(
    (
      await request(app)
        .post("/api/chat")
        .send({ documentId: 1, question: "What terms?" })
    ).status,
  ).toBe(409);
  await store.update(1, "ready");
  const r = await request(app)
    .post("/api/chat")
    .send({ documentId: 1, question: "What terms?" });
  expect(r.status).toBe(200);
  expect(store.messages).toHaveLength(2);
});
it("keeps missing-key errors explicit", async () => {
  const noKey = createApp(
    {
      store,
      enqueue,
      modelName: "test",
      requireKey: () => {
        throw new AppError(503, "Add OPENAI_API_KEY");
      },
      answer: async () => {
        throw Error("unused");
      },
    },
    dir,
  );
  const r = await request(noKey).post("/api/documents/upload");
  expect(r.status).toBe(503);
  expect(r.body.error).toContain("OPENAI_API_KEY");
});
it("sanitizes backend errors and invalid JSON", async () => {
  store.list = async () => {
    throw new Error("password=secret SQL detail");
  };
  const r = await request(app).get("/api/documents");
  expect(r.status).toBe(502);
  expect(JSON.stringify(r.body)).not.toContain("secret");
  expect(
    (
      await request(app)
        .post("/api/chat")
        .set("Content-Type", "application/json")
        .send("{")
    ).status,
  ).toBe(400);
  expect((await request(app).get("/api/nope")).status).toBe(404);
});
it("rejects cross-origin requests and permits retry only after failure", async () => {
  expect(
    (
      await request(app)
        .post("/api/chat")
        .set("Origin", "https://other.example")
        .send({})
    ).status,
  ).toBe(403);
  await store.create("a", "x", "test");
  expect((await request(app).post("/api/documents/1/retry")).status).toBe(409);
  await store.update(1, "failed");
  expect((await request(app).post("/api/documents/1/retry")).status).toBe(202);
  expect(enqueue).toHaveBeenCalledWith(1);
});
