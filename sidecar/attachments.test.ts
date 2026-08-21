import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { prepareAttachments } from "./attachments";

describe("prepareAttachments", () => {
  it("routes file and pasted images through Cline's image channel without duplication", async () => {
    const imagePath = resolve("src-tauri/icons/32x32.png");
    const textPath = resolve("README.md");
    const result = await prepareAttachments("Review this context", [
      { name: "icon.png", path: imagePath },
      { name: "pasted.png", dataUrl: "data:image/png;base64,aW1hZ2U=" },
      { name: "README.md", path: textPath },
    ]);

    expect(result.userImages).toHaveLength(2);
    expect(result.userImages[0]).toMatch(/^data:image\/png;base64,/);
    expect(result.userFiles).toEqual([textPath]);
    expect(result.prompt).toBe("Review this context");
  });

  it("extracts Word and PDF binaries into model-readable text", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cline-chat-context-"));
    try {
      const docxPath = join(directory, "context.docx");
      const zip = new JSZip();
      zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
      zip.file("_rels/.rels", `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
      zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Word context works</w:t></w:r></w:p></w:body></w:document>`);
      await writeFile(docxPath, await zip.generateAsync({ type: "nodebuffer" }));

      const pdfPath = join(directory, "context.pdf");
      const stream = "BT /F1 12 Tf 72 720 Td (PDF context works) Tj ET";
      const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      ];
      let pdf = "%PDF-1.4\n";
      const offsets = [0];
      objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
      const xref = Buffer.byteLength(pdf);
      pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
      await writeFile(pdfPath, pdf);

      const result = await prepareAttachments("Review", [{ name: "context.docx", path: docxPath }, { name: "context.pdf", path: pdfPath }]);
      expect(result.userFiles).toEqual([]);
      expect(result.prompt).toContain("Word context works");
      expect(result.prompt).toContain("PDF context works");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
