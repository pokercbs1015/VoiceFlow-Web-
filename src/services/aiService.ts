import type { GeneratePayload, GenerateResponse } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function generateDocument({ mode, text, ignoreModeMismatch }: GeneratePayload) {
  const endpoint =
    mode === "student"
      ? "/api/generate-student-note"
      : "/api/generate-meeting-minutes";

  return postJson<GenerateResponse>(endpoint, { text, ignoreModeMismatch });
}

export async function polishText(text: string) {
  const data = await postJson<{ result: string }>("/api/polish", { text });
  return data.result;
}
