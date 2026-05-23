import { FilePlus2, Radio } from "lucide-react";

interface TranscriptEditorProps {
  value: string;
  interimText: string;
  isListening: boolean;
  onChange: (value: string) => void;
  onLoadDemo: () => void;
}

export function TranscriptEditor({
  value,
  interimText,
  isListening,
  onChange,
  onLoadDemo
}: TranscriptEditorProps) {
  return (
    <section className="panel transcript-panel" aria-label="原始转写文本">
      <header className="panel-header">
        <div>
          <p className="eyebrow">实时转写</p>
          <h2>原始文本</h2>
        </div>
        <button className="ghost-button" type="button" onClick={onLoadDemo}>
          <FilePlus2 size={18} />
          演示文本
        </button>
      </header>

      <div className="editor-wrap">
        <textarea
          aria-label="原始语音转写文本"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="点击下方“开始说话”后直接口述，也可以在这里手动输入或修改识别结果。"
        />

        {(interimText || isListening) && (
          <div className="interim-strip">
            <Radio size={16} />
            <span>{interimText || "正在等待语音输入..."}</span>
          </div>
        )}
      </div>
    </section>
  );
}
