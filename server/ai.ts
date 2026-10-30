import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { config } from "./config.js";
import { AppError } from "./types.js";
export interface Embedder {
  embedDocuments(text: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}
export function requireKey() {
  if (!config.OPENAI_API_KEY)
    throw new AppError(
      503,
      "Add OPENAI_API_KEY to the server .env file, then restart.",
    );
}
export function createEmbeddings(
  model = config.OPENAI_EMBEDDING_MODEL,
): Embedder {
  requireKey();
  return new OpenAIEmbeddings({
    apiKey: config.OPENAI_API_KEY,
    model,
    batchSize: 16,
    maxRetries: 2,
    timeout: 30000,
  });
}
export function createModel() {
  requireKey();
  return new ChatOpenAI({
    apiKey: config.OPENAI_API_KEY,
    model: config.OPENAI_CHAT_MODEL,
    maxRetries: 2,
    timeout: 30000,
    temperature: 0,
  });
}
export function providerMessage(error: unknown) {
  const status = (error as { status?: number })?.status;
  if (status === 429)
    return "OpenAI rate limit or quota reached. Check billing, wait, then retry.";
  if (status === 401 || status === 403)
    return "OpenAI access was rejected. Check the server API key and model access.";
  return "Processing failed. Check that the PDF is readable and OpenAI is reachable, then retry.";
}
