export type Mode = "student" | "meeting";

export type ToastType = "info" | "success" | "warning" | "error";
export type GenerateProvider = "local_qwen" | "cloud_ai" | "local_fallback" | "mode_mismatch";
export type GenerateWarning =
  | "MODE_MISMATCH"
  | "TEXT_TOO_SHORT"
  | "TEXT_TOO_LONG"
  | "TEXT_LONG";

export interface ToastState {
  message: string;
  type: ToastType;
}

export interface GeneratePayload {
  mode: Mode;
  text: string;
  ignoreModeMismatch?: boolean;
}

export interface GenerateResponse {
  result: string;
  provider?: GenerateProvider;
  warning?: GenerateWarning;
  suggestedMode?: Mode;
}
