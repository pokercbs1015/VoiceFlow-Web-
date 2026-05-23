import type { Mode } from "../types";

function download(content: string, extension: "txt" | "md", mode: Mode) {
  const mimeType =
    extension === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8";
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const label = mode === "student" ? "student-note" : "meeting-minutes";

  anchor.href = url;
  anchor.download = `voiceflow-${label}-${date}.${extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function exportTxt(content: string, mode: Mode) {
  download(content, "txt", mode);
}

export function exportMarkdown(content: string, mode: Mode) {
  download(content, "md", mode);
}
