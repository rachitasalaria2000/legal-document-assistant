import type {
  Store,
  StoredDocument,
  Status,
  NewChunk,
  Chunk,
  Message,
} from "../server/types.js";
export class MemoryStore implements Store {
  docs: StoredDocument[] = [];
  rows: Chunk[] = [];
  messages: Message[] = [];
  async create(filename: string, file_path: string, embedding_model: string) {
    const id = this.docs.length + 1;
    this.docs.push({
      id,
      filename,
      file_path,
      embedding_model,
      status: "queued",
      total_pages: 0,
      total_chunks: 0,
      error_message: null,
      created_at: "",
    });
    return id;
  }
  async list() {
    return this.docs.map(({ file_path, ...doc }) => doc);
  }
  async get(id: number) {
    return this.docs.find((d) => d.id === id);
  }
  async update(id: number, status: Status, pages?: number, error?: string) {
    const d = this.docs.find((d) => d.id === id)!;
    Object.assign(d, { status, error_message: error ?? null });
    if (pages !== undefined) d.total_pages = pages;
  }
  async clearChunks(id: number) {
    this.rows = this.rows.filter((c) => c.document_id !== id);
    this.docs.find((d) => d.id === id)!.total_chunks = 0;
  }
  async saveChunks(id: number, chunks: (NewChunk & { embedding: number[] })[]) {
    this.rows.push(
      ...chunks.map((c) => ({
        ...c,
        id: this.rows.length + c.chunk_index + 1,
        document_id: id,
      })),
    );
    this.docs.find((d) => d.id === id)!.total_chunks = this.rows.filter(
      (c) => c.document_id === id,
    ).length;
  }
  async chunks(id: number) {
    return this.rows.filter((c) => c.document_id === id);
  }
  async saveChat(_id: number, q: string, a: string) {
    this.messages.push(
      { role: "user", message: q },
      { role: "assistant", message: a },
    );
  }
  async history() {
    return this.messages;
  }
}
export function chunk(id: number, page = 1): Chunk {
  return {
    id,
    document_id: 1,
    chunk_index: id - 1,
    content: `Clause ${id}: amounts due survive termination.`,
    page_number: page,
    section_heading: "Payment",
    embedding: [1, 0],
  };
}
