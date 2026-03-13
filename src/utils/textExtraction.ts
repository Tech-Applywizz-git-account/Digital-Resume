import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

// Initialize PDF Worker
const pdfjsVersion = pdfjsLib.version || "5.4.296";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

export const extractTextFromBuffer = async (buffer: ArrayBuffer, fileName: string): Promise<string> => {
  const fileExt = fileName.split(".").pop()?.toLowerCase();
  let text = "";
  
  if (fileExt === "pdf") {
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = (content.items as any[]).map((item: any) => item.str).join(" ");
      text += pageText + " ";
    }
  } else if (["docx", "doc"].includes(fileExt || "")) {
    const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
    text = value;
  }
  
  return text.replace(/\s+/g, " ").trim().slice(0, 10000);
};
