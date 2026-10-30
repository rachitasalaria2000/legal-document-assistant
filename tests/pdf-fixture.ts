import { createRequire } from "node:module";
import { createWriteStream } from "node:fs";
const PDFDocument = createRequire(import.meta.url)("pdfkit");
export async function fixturePdf(file: string, pages: number, text = true) {
  const pdf = new PDFDocument({ autoFirstPage: false });
  const stream = createWriteStream(file);
  pdf.pipe(stream);
  for (let n = 1; n <= pages; n++) {
    pdf.addPage();
    if (text) {
      pdf.fontSize(16).text(`${n}. CONTRACT SECTION`);
      pdf.moveDown();
      pdf
        .fontSize(12)
        .text(
          `Page ${n}: All undisputed invoices are due within thirty days. Confidential information must be protected. Termination does not waive outstanding payment obligations. This is fictional test content.`,
        );
    }
  }
  pdf.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}
