import { readFile } from "node:fs/promises";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { TokenTextSplitter } from "@langchain/textsplitters";
import { AppError, type NewChunk } from "./types.js";
export interface PageText {
  page: number;
  text: string;
}
export async function extractPdf(filePath: string): Promise<PageText[]> {
  const bytes = new Uint8Array(await readFile(filePath));
  const task = getDocument({ data: bytes, useSystemFonts: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 150)
      throw new AppError(
        422,
        "Please upload a PDF with no more than 150 pages.",
      );
    const pages: PageText[] = [];
    let total = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) =>
          "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
        )
        .join("")
        .trim();
      total += text.length;
      if (total > 3_000_000)
        throw new AppError(
          422,
          "This PDF contains too much text for this POC.",
        );
      if (text.replace(/\s/g, "").length < 20) {
        const ops = await page.getOperatorList();
        if (
          ops.fnArray.some((op) =>
            [
              OPS.paintImageXObject,
              OPS.paintInlineImageXObject,
              OPS.paintImageXObjectRepeat,
            ].includes(op),
          )
        )
          throw new AppError(
            422,
            `OCR required on page ${n}: image-only content was detected. Upload a searchable PDF.`,
          );
      }
      pages.push({ page: n, text });
      page.cleanup();
    }
    // A blank cover is fine; an image-only or largely scanned document needs OCR.
    const empty = pages.filter(
      (p) => p.text.replace(/\s/g, "").length < 20,
    ).length;
    if (
      empty > Math.max(1, Math.floor(pages.length * 0.2)) ||
      pages.every((p) => p.text.length < 20)
    )
      throw new AppError(
        422,
        "OCR required: this PDF has pages without readable text. Upload a searchable PDF.",
      );
    return pages;
  } finally {
    await task.destroy();
  }
}
export async function chunkPages(pages: PageText[]): Promise<NewChunk[]> {
  const splitter = new TokenTextSplitter({
    encodingName: "cl100k_base",
    chunkSize: 650,
    chunkOverlap: 100,
  });
  const chunks: NewChunk[] = [];
  let heading = "Document";
  for (const page of pages) {
    // Keep sections and pages separate so a citation never points at the wrong page.
    const sections: { heading: string; lines: string[] }[] = [];
    for (const line of page.text
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)) {
      const isHeading =
        line.length < 140 &&
        (/^(?:\d+(?:\.\d+)*[.)]?\s+|(?:ARTICLE|SECTION|SCHEDULE)\s+)/i.test(
          line,
        ) ||
          /^[A-Z][A-Z\s,&-]{3,}$/.test(line));
      if (isHeading) {
        heading = line;
        sections.push({ heading, lines: [line] });
      } else {
        if (!sections.length) sections.push({ heading, lines: [] });
        sections[sections.length - 1].lines.push(line);
      }
    }
    for (const section of sections)
      for (const content of await splitter.splitText(
        section.lines.join("\n"),
      )) {
        if (content.trim())
          chunks.push({
            chunk_index: chunks.length,
            content,
            page_number: page.page,
            section_heading: section.heading,
          });
      }
  }
  if (!chunks.length)
    throw new AppError(422, "No readable clauses found. OCR may be required.");
  return chunks;
}
