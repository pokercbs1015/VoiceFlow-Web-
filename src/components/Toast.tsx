import { X } from "lucide-react";
import type { ToastState } from "../types";

interface ToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  if (!toast) {
    return null;
  }

  return (
    <div className={`toast ${toast.type}`} role="status">
      <span>{toast.message}</span>
      <button type="button" title="关闭提示" onClick={onDismiss}>
        <X size={16} />
      </button>
    </div>
  );
}
