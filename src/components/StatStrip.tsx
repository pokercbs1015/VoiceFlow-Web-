import { Activity, CheckCircle2, Clock3, WifiOff } from "lucide-react";
import type { Mode } from "../types";

interface StatStripProps {
  mode: Mode;
  transcript: string;
  isListening: boolean;
  isSupported: boolean;
}

export function StatStrip({ mode, transcript, isListening, isSupported }: StatStripProps) {
  const charCount = transcript.trim().length;
  const sentenceCount = transcript
    .split(/[。！？!?；;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean).length;

  return (
    <section className="stat-strip" aria-label="当前状态">
      <div>
        <CheckCircle2 size={18} />
        <span>{mode === "student" ? "学生笔记模式" : "会议纪要模式"}</span>
      </div>
      <div>
        <Activity size={18} />
        <span>{charCount} 字 / {sentenceCount} 句</span>
      </div>
      <div>
        <Clock3 size={18} />
        <span>{isListening ? "正在实时转写" : "待机"}</span>
      </div>
      <div className={isSupported ? "" : "warning"}>
        <WifiOff size={18} />
        <span>{isSupported ? "Chrome/Edge 可实时识别" : "当前浏览器不支持 Web Speech"}</span>
      </div>
    </section>
  );
}
