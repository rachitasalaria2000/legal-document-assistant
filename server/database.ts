import mysql, {
  type RowDataPacket,
  type ResultSetHeader,
  type Pool,
} from "mysql2/promise";
import { config } from "./config.js";
import type {
  Store,
  StoredDocument,
  DocumentRecord,
  Status,
  Chunk,
  NewChunk,
  Message,
} from "./types.js";
export function createPool() {
  return mysql.createPool({
    host: config.MYSQL_HOST,
    port: config.MYSQL_PORT,
    database: config.MYSQL_DATABASE,
    user: config.MYSQL_USER,
    password: config.MYSQL_PASSWORD,
    connectionLimit: 5,
    timezone: "Z",
    dateStrings: true,
  });
}
export class MysqlStore implements Store {
  constructor(private pool: Pool) {}
  async create(filename: string, filePath: string, model: string) {
    const [r] = await this.pool.execute<ResultSetHeader>(
      "INSERT INTO documents(filename,file_path,embedding_model) VALUES(?,?,?)",
      [filename, filePath, model],
    );
    return r.insertId;
  }
  async list() {
    const [r] = await this.pool.query<RowDataPacket[]>(
      "SELECT id,filename,status,total_pages,total_chunks,error_message,created_at,embedding_model FROM documents ORDER BY id DESC LIMIT 100",
    );
    return r as DocumentRecord[];
  }
  async get(id: number) {
    const [r] = await this.pool.execute<RowDataPacket[]>(
      "SELECT * FROM documents WHERE id=?",
      [id],
    );
    return r[0] as StoredDocument | undefined;
  }
  async update(id: number, status: Status, pages?: number, error?: string) {
    await this.pool.execute(
      "UPDATE documents SET status=?,total_pages=COALESCE(?,total_pages),error_message=? WHERE id=?",
      [status, pages ?? null, error ?? null, id],
    );
  }
  async saveChunks(id: number, chunks: (NewChunk & { embedding: number[] })[]) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      for (const chunk of chunks)
        await c.execute(
          "INSERT INTO document_chunks(document_id,chunk_index,content,page_number,section_heading,embedding) VALUES(?,?,?,?,?,?)",
          [
            id,
            chunk.chunk_index,
            chunk.content,
            chunk.page_number,
            chunk.section_heading,
            JSON.stringify(chunk.embedding),
          ],
        );
      await c.execute(
        "UPDATE documents SET total_chunks=(SELECT COUNT(*) FROM document_chunks WHERE document_id=?) WHERE id=?",
        [id, id],
      );
      await c.commit();
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async chunks(id: number) {
    const [r] = await this.pool.execute<RowDataPacket[]>(
      "SELECT * FROM document_chunks WHERE document_id=? ORDER BY chunk_index",
      [id],
    );
    return r.map((x) => ({
      ...x,
      embedding:
        typeof x.embedding === "string" ? JSON.parse(x.embedding) : x.embedding,
    })) as Chunk[];
  }
  async clearChunks(id: number) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      await c.execute("DELETE FROM document_chunks WHERE document_id=?", [id]);
      await c.execute("UPDATE documents SET total_chunks=0 WHERE id=?", [id]);
      await c.commit();
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async saveChat(id: number, question: string, answer: string) {
    await this.pool.execute(
      "INSERT INTO chat_messages(document_id,role,message) VALUES(?,?,?),(?,?,?)",
      [id, "user", question, id, "assistant", answer],
    );
  }
  async history(id: number) {
    const [r] = await this.pool.execute<RowDataPacket[]>(
      "SELECT role,message FROM (SELECT id,role,message FROM chat_messages WHERE document_id=? ORDER BY id DESC LIMIT 8) recent ORDER BY id",
      [id],
    );
    return r as Message[];
  }
}
