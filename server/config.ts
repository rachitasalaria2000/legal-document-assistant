import "dotenv/config";
import path from "node:path";
import { z } from "zod";
const env = z
  .object({
    PORT: z.coerce.number().int().min(1024).default(3003),
    APP_ORIGIN: z.url().default("http://localhost:3003"),
    MYSQL_HOST: z.string().default("127.0.0.1"),
    MYSQL_PORT: z.coerce.number().default(3310),
    MYSQL_DATABASE: z
      .string()
      .regex(/^[a-zA-Z0-9_]+$/)
      .default("legal_assistant"),
    MYSQL_USER: z.string().default("legal_app"),
    MYSQL_PASSWORD: z.string().default(""),
    OPENAI_API_KEY: z.string().default(""),
    OPENAI_CHAT_MODEL: z.string().default("gpt-4.1-mini"),
    OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
    UPLOAD_DIR: z.string().default("storage/uploads"),
  })
  .parse(process.env);
export const config = { ...env, uploadDir: path.resolve(env.UPLOAD_DIR) };
