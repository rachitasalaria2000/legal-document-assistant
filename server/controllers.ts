import type { Request, Response } from "express";
import { readFile, unlink } from "node:fs/promises";
import { z } from "zod";
import { AppError, type Store, type Answer } from "./types.js";
const idSchema = z.coerce.number().int().positive().max(4294967295);
export interface Dependencies {
  store: Store;
  enqueue: (id: number) => void;
  modelName: string;
  requireKey: () => void;
  answer: (
    id: number,
    filename: string,
    question: string,
    signal: AbortSignal,
  ) => Promise<Answer>;
}
export function controllers(deps: Dependencies) {
  return {
    list: async (_req: Request, res: Response) => {
      res.json(await deps.store.list());
    },
    status: async (req: Request, res: Response) => {
      const doc = await deps.store.get(idSchema.parse(req.params.id));
      if (!doc) throw new AppError(404, "Document not found.");
      const { file_path, ...publicDoc } = doc;
      res.json(publicDoc);
    },
    upload: async (req: Request, res: Response) => {
      if (!req.file) throw new AppError(400, "Select a PDF file.");
      try {
        const bytes = await readFile(req.file.path);
        if (!bytes.subarray(0, 1024).includes(Buffer.from("%PDF-")))
          throw new AppError(400, "The uploaded file is not a PDF.");
        const filename = req.file.originalname
          .replace(/[^a-zA-Z0-9 ._()-]/g, "_")
          .slice(0, 200);
        const id = await deps.store.create(
          filename,
          req.file.path,
          deps.modelName,
        );
        deps.enqueue(id);
        res.status(202).json({ id, status: "queued" });
      } catch (e) {
        await unlink(req.file.path).catch(() => {});
        throw e;
      }
    },
    retry: async (req: Request, res: Response) => {
      deps.requireKey();
      const id = idSchema.parse(req.params.id);
      const doc = await deps.store.get(id);
      if (!doc) throw new AppError(404, "Document not found.");
      if (doc.status !== "failed")
        throw new AppError(
          409,
          "Only failed processing can be retried. Upload a searchable PDF if OCR is required.",
        );
      await deps.store.update(id, "queued");
      deps.enqueue(id);
      res.status(202).json({ id, status: "queued" });
    },
    chat: async (req: Request, res: Response) => {
      const { documentId, question } = z
        .object({
          documentId: idSchema,
          question: z.string().trim().min(1).max(2000),
        })
        .strict()
        .parse(req.body);
      const doc = await deps.store.get(documentId);
      if (!doc) throw new AppError(404, "Document not found.");
      if (doc.status !== "ready")
        throw new AppError(409, "Wait until the document is ready.");
      deps.requireKey();
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 90000);
      const disconnect = () => {
        if (!res.writableEnded) abort.abort();
      };
      res.on("close", disconnect);
      try {
        const answer = await deps.answer(
          documentId,
          doc.filename,
          question,
          abort.signal,
        );
        if (abort.signal.aborted)
          throw new AppError(504, "The answer took too long. Please retry.");
        await deps.store.saveChat(documentId, question, answer.answer);
        res.json(answer);
      } catch (e) {
        if (abort.signal.aborted)
          throw new AppError(504, "The answer timed out. Please retry.");
        throw e;
      } finally {
        clearTimeout(timer);
        res.off("close", disconnect);
      }
    },
  };
}
