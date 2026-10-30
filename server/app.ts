import express, { type ErrorRequestHandler } from "express";
import multer from "multer";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { ZodError } from "zod";
import { AppError } from "./types.js";
import { controllers, type Dependencies } from "./controllers.js";
export function createApp(
  deps: Dependencies,
  uploadDir: string,
  origin = "http://localhost:3003",
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "style-src": ["'self'", "'unsafe-inline'"],
          "script-src": ["'self'"],
          "img-src": ["'self'", "data:"],
        },
      },
    }),
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 60,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: "16kb" }));
  app.use("/api", (req, res, next) => {
    if (
      req.method === "POST" &&
      req.headers.origin &&
      req.headers.origin !== origin
    ) {
      res.status(403).json({ error: "Origin not allowed." });
      return;
    }
    next();
  });
  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (_req, _file, cb) => cb(null, randomUUID() + ".pdf"),
    }),
    limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 0 },
    fileFilter: (_req, file, cb) => {
      if (
        file.mimetype !== "application/pdf" ||
        !file.originalname.toLowerCase().endsWith(".pdf")
      )
        cb(new AppError(400, "Only PDF files are accepted."));
      else cb(null, true);
    },
  });
  const c = controllers(deps);
  const router = express.Router();
  router.get("/health", (_req, res) =>
    res.json({
      status: "ok",
      aiConfigured: (() => {
        try {
          deps.requireKey();
          return true;
        } catch {
          return false;
        }
      })(),
    }),
  );
  router.get("/documents", c.list);
  router.get("/documents/:id/status", c.status);
  router.post(
    "/documents/upload",
    rateLimit({ windowMs: 60000, limit: 5 }),
    (_req, _res, next) => {
      deps.requireKey();
      next();
    },
    upload.single("file"),
    c.upload,
  );
  router.post("/documents/:id/retry", c.retry);
  router.post("/chat", rateLimit({ windowMs: 60000, limit: 10 }), c.chat);
  app.use("/api", router);
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API route not found." }),
  );
  app.use(express.static(path.resolve("dist/client")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.resolve("dist/client/index.html")),
  );
  const errors: ErrorRequestHandler = (err, _req, res, _next) => {
    const status =
      err instanceof AppError
        ? err.status
        : err instanceof ZodError
          ? 400
          : err instanceof multer.MulterError
            ? 400
            : err.type === "entity.parse.failed"
              ? 400
              : err.type === "entity.too.large"
                ? 413
                : 502;
    const message =
      err instanceof AppError
        ? err.message
        : err instanceof ZodError
          ? "Invalid input. Check document ID and question."
          : err instanceof multer.MulterError
            ? err.code === "LIMIT_FILE_SIZE"
              ? "PDF must be 25 MB or smaller."
              : "Upload one PDF in the file field."
            : status === 400
              ? "Invalid JSON request."
              : status === 413
                ? "Request is too large."
                : "Service unavailable. Check the database or OpenAI connection and retry.";
    if (status >= 500)
      console.error("Request failed:", err.code ?? err.name ?? "service");
    if (!res.headersSent) res.status(status).json({ error: message });
  };
  app.use(errors);
  return app;
}
