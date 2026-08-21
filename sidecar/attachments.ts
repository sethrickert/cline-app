import { readFile } from "node:fs/promises";
import { extname } from "node:path";

type Json = Record<string, unknown>;

const imageMimes: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
};

async function extractPdf(path: string) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await getDocument({ data: new Uint8Array(await readFile(path)), useWorkerFetch: false }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
  }
  return pages.join("\n\n");
}

export async function prepareAttachments(prompt: string, value: unknown) {
  const attachments = Array.isArray(value) ? value as Json[] : [];
  const userImages: string[] = [];
  const userFiles: string[] = [];
  const extracted: string[] = [];
  for (const attachment of attachments) {
    const path = typeof attachment.path === "string" ? attachment.path : "";
    const extension = extname(path || String(attachment.name ?? "")).toLowerCase();
    const dataUrl = typeof attachment.dataUrl === "string" ? attachment.dataUrl : "";
    if (dataUrl.startsWith("data:image/")) { userImages.push(dataUrl); continue; }
    if (imageMimes[extension] && path) {
      userImages.push(`data:${imageMimes[extension]};base64,${(await readFile(path)).toString("base64")}`);
      continue;
    }
    if (extension === ".docx" && path) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ path });
      extracted.push(`Context from ${attachment.name ?? path}:\n${result.value.slice(0, 600_000)}`);
      continue;
    }
    if (extension === ".pdf" && path) {
      extracted.push(`Context from ${attachment.name ?? path}:\n${(await extractPdf(path)).slice(0, 600_000)}`);
      continue;
    }
    if (path) userFiles.push(path);
  }
  return { prompt: [prompt, ...extracted].filter(Boolean).join("\n\n---\n\n"), userImages, userFiles };
}
