import { mkdir } from "node:fs/promises";
import { config } from "./config.js";
import { createPool, MysqlStore } from "./database.js";
import { createEmbeddings, createModel, requireKey } from "./ai.js";
import { Processor } from "./processing.js";
import { Retriever } from "./retrieval.js";
import { answerQuestion } from "./agent.js";
import { createApp } from "./app.js";
await mkdir(config.uploadDir, { recursive: true });
const pool = createPool();
try {
  await pool.query("SELECT 1");
  // In-process jobs cannot survive a restart: expose a retryable status instead of remaining stuck.
  await pool.execute(
    "UPDATE documents SET status='failed',error_message='Server restarted during processing. Please retry.' WHERE status IN ('queued','processing')",
  );
} catch (error) {
  const code = (error as { code?: string }).code ?? "UNKNOWN";
  console.error(
    `MySQL startup failed (${code}) at ${config.MYSQL_HOST}:${config.MYSQL_PORT}, database ${config.MYSQL_DATABASE}.`,
  );
  if (code === "ECONNREFUSED") {
    console.error(
      "Start MySQL and check MYSQL_HOST / MYSQL_PORT in .env. See README.md for local startup instructions.",
    );
  } else if (code === "ER_ACCESS_DENIED_ERROR") {
    console.error("Check MYSQL_USER / MYSQL_PASSWORD and database grants.");
  } else if (code === "ER_BAD_DB_ERROR" || code === "ER_NO_SUCH_TABLE") {
    console.error(
      "Create the configured database, then run npm run db:migrate from the project root.",
    );
  } else {
    console.error("Check the MySQL server logs and database configuration.");
  }
  await pool.end();
  process.exit(1);
}
const store = new MysqlStore(pool);
const processor = new Processor(store, createEmbeddings);
const retrieval = new Retriever(store, createEmbeddings);
const app = createApp(
  {
    store,
    enqueue: (id) => processor.enqueue(id),
    modelName: config.OPENAI_EMBEDDING_MODEL,
    requireKey,
    answer: async (id, name, question, signal) =>
      answerQuestion(
        createModel(),
        (query, doc) => retrieval.search(query, doc),
        id,
        name,
        question,
        await store.history(id),
        signal,
      ),
  },
  config.uploadDir,
  config.APP_ORIGIN,
);
const server = app.listen(config.PORT, "127.0.0.1", () =>
  console.log(
    `Legal document assistant: http://localhost:${config.PORT} (OpenAI ${config.OPENAI_API_KEY ? "configured" : "key required"})`,
  ),
);
const stop = () => {
  server.close(() => {
    void pool.end().then(() => process.exit());
  });
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
