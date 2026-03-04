import fs from "fs";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export async function extractCVText(filePath: string, ext: string): Promise<string> {
  const normalized = ext.toLowerCase().replace(/^\./, "");

  if (normalized === "pdf") {
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text.trim().slice(0, 5000);
  }

  if (normalized === "docx" || normalized === "doc") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.trim().slice(0, 5000);
  }

  return fs.readFileSync(filePath, "utf-8").trim().slice(0, 5000);
}
