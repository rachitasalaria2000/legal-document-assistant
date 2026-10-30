export type Status =
  "queued" | "processing" | "ready" | "failed" | "ocr_required";
export interface DocumentRecord {
  id: number;
  filename: string;
  status: Status;
  total_pages: number;
  total_chunks: number;
  error_message: string | null;
  created_at: string;
  embedding_model: string;
}
export interface StoredDocument extends DocumentRecord {
  file_path: string;
}
export interface Chunk {
  id: number;
  document_id: number;
  chunk_index: number;
  content: string;
  page_number: number;
  section_heading: string;
  embedding: number[];
}
export type NewChunk = Omit<Chunk, "id" | "document_id" | "embedding">;
export interface Source {
  id: number;
  filename: string;
  page: number;
  heading: string;
  excerpt: string;
}
export interface Answer {
  answer: string;
  sources: Source[];
  searches: number;
}
export interface Message {
  role: "user" | "assistant";
  message: string;
}
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export interface Store {
  create(filename: string, filePath: string, model: string): Promise<number>;
  list(): Promise<DocumentRecord[]>;
  get(id: number): Promise<StoredDocument | undefined>;
  update(
    id: number,
    status: Status,
    pages?: number,
    error?: string,
  ): Promise<void>;
  saveChunks(
    id: number,
    chunks: (NewChunk & { embedding: number[] })[],
  ): Promise<void>;
  chunks(id: number): Promise<Chunk[]>;
  clearChunks(id: number): Promise<void>;
  saveChat(id: number, question: string, answer: string): Promise<void>;
  history(id: number): Promise<Message[]>;
}
