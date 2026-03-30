import * as pdfjsLib from "pdfjs-dist";

export async function extractPdfLinks(arrayBuffer: ArrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let links = {
    linkedin: '',
    github: ''
  };

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const annotations = await page.getAnnotations();

    annotations.forEach((ann: any) => {
      const url = ann?.url || ann?.a?.uri;
      if (!url) return;

      if (url.includes("linkedin.com")) {
        links.linkedin = url;
      }

      if (url.includes("github.com")) {
        links.github = url;
      }
    });
  }

  return links;
}
