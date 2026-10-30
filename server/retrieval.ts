import { AppError, type Store, type Chunk } from "./types.js";
import type { Embedder } from "./ai.js";
export function cosineSimilarity(a: number[], b: number[]): number {
  if (
    !a.length ||
    a.length !== b.length ||
    [...a, ...b].some((x) => !Number.isFinite(x))
  )
    throw new Error("Incompatible embedding vectors");
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
export class Retriever {
  constructor(
    private store: Store,
    private embed: (model: string) => Embedder,
  ) {}
  async search(query: string, documentId: number): Promise<Chunk[]> {
    const doc = await this.store.get(documentId);
    if (!doc || doc.status !== "ready")
      throw new AppError(409, "Document is not ready.");
    const vector = await this.embed(doc.embedding_model).embedQuery(query);
    const chunks = await this.store.chunks(documentId);
    const ranked = chunks
      .map((c) => ({ chunk: c, score: cosineSimilarity(vector, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
    // Neighbours bring related continuation clauses into the context, including page boundaries.
    const indices = new Set<number>();
    for (const { chunk } of ranked) {
      indices.add(chunk.chunk_index);
      indices.add(chunk.chunk_index - 1);
      indices.add(chunk.chunk_index + 1);
    }
    return chunks.filter((c) => indices.has(c.chunk_index)).slice(0, 12);
  }
}
