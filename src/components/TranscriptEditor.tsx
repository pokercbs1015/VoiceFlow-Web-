import { Download, Radio } from "lucide-react";

interface TranscriptEditorProps {
  value: string;
  interimText: string;
  isListening: boolean;
  onChange: (value: string) => void;
  onExportTxt: () => void;
  onExportMarkdown: () => void;
}

export function TranscriptEditor({
  value,
  interimText,
  isListening,
  onChange,
  onExportTxt,
  onExportMarkdown
}: TranscriptEditorProps) {
  return (
    <section className="panel transcript-panel" aria-label="原始转写文本">
      <header className="panel-header">
        <div>
          <p className="eyebrow">实时转写</p>
          <h2>原始文本</h2>
        </div>
        <div className="panel-actions">
          <button className="ghost-button" type="button" onClick={onExportTxt}>
            <Download size={18} />
            TXT
          </button>
          <button className="ghost-button" type="button" onClick={onExportMarkdown}>
            <Download size={18} />
            MD
          </button>
        </div>
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
