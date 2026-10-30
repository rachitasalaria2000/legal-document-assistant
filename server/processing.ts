import { extractPdf, chunkPages } from "./pdf.js";
import { AppError, type Store } from "./types.js";
import { providerMessage, type Embedder } from "./ai.js";
export class Processor {
  private queue: number[] = [];
  private active = false;
  constructor(
    private store: Store,
    private embed: (model: string) => Embedder,
  ) {}
  enqueue(id: number) {
    if (!this.queue.includes(id)) this.queue.push(id);
    void this.drain();
  }
  private async drain() {
    if (this.active) return;
    this.active = true;
    try {
      while (this.queue.length) {
        const id = this.queue.shift()!;
        try {
          await this.process(id);
        } catch {
          console.error("Unable to update processing status for document", id);
        }
      }
    } finally {
      this.active = false;
    }
  }
  async process(id: number) {
    try {
      const doc = await this.store.get(id);
      if (!doc) return;
      await this.store.update(id, "processing");
      await this.store.clearChunks(id);
      const pages = await extractPdf(doc.file_path);
      await this.store.update(id, "processing", pages.length);
      const chunks = await chunkPages(pages);
      const embeddings = this.embed(doc.embedding_model);
      for (let i = 0; i < chunks.length; i += 16) {
        const batch = chunks.slice(i, i + 16);
        const vectors = await embeddings.embedDocuments(
          batch.map((c) => c.content),
        );
        if (
          vectors.length !== batch.length ||
          vectors.some((v) => !v.length || v.some((x) => !Number.isFinite(x)))
        )
          throw new Error("Invalid embeddings");
        await this.store.saveChunks(
          id,
          batch.map((c, n) => ({ ...c, embedding: vectors[n] })),
        );
      }
      await this.store.update(id, "ready");
    } catch (e) {
      const ocr = e instanceof AppError && e.message.includes("OCR");
      await this.store.update(
        id,
        ocr ? "ocr_required" : "failed",
        undefined,
        e instanceof AppError ? e.message : providerMessage(e),
      );
    }
  }
}
