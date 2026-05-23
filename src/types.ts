export type Mode = "student" | "meeting";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastState {
  message: string;
  type: ToastType;
}

export interface GeneratePayload {
  mode: Mode;
  text: string;
}
