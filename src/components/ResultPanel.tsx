import { ClipboardCopy, Download, Loader2 } from "lucide-react";
import type { Mode } from "../types";

interface ResultPanelProps {
  mode: Mode;
  value: string;
  isLoading: boolean;
  onCopy: () => void;
  onExportMarkdown: () => void;
}

export function ResultPanel({
  mode,
  value,
  isLoading,
  onCopy,
  onExportMarkdown
}: ResultPanelProps) {
  return (
    <section className="panel result-panel" aria-label="整理结果">
      <header className="panel-header">
        <div>
          <p className="eyebrow">{mode === "student" ? "学习笔记" : "会议纪要"}</p>
          <h2>结构化结果</h2>
        </div>
        <div className="panel-actions">
          <button type="button" title="复制结果" onClick={onCopy}>
            <ClipboardCopy size={18} />
          </button>
          <button type="button" title="导出 Markdown" onClick={onExportMarkdown}>
            <Download size={18} />
          </button>
        </div>
      </header>

      <div className="result-body">
        {isLoading ? (
          <div className="loading-state">
            <Loader2 size={24} />
            <span>正在整理内容</span>
          </div>
        ) : value.trim() ? (
          <pre>{value}</pre>
        ) : (
          <div className="empty-state">
            <p>{mode === "student" ? "生成后的学习笔记会显示在这里。" : "生成后的会议纪要会显示在这里。"}</p>
          </div>
        )}
      </div>
    </section>
  );
}
