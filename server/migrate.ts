import { readFile } from "node:fs/promises";
import { createPool } from "./database.js";
const pool = createPool();
try {
  const sql = await readFile("sql/001_initial.sql", "utf8");
  for (const statement of sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await pool.query(statement);
  console.log("Schema ready.");
} finally {
  await pool.end();
}
