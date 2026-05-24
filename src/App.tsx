import {
  ClipboardCopy,
  Mic,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Undo2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ModeSelector } from "./components/ModeSelector";
import { ResultPanel } from "./components/ResultPanel";
import { StatStrip } from "./components/StatStrip";
import { Toast } from "./components/Toast";
import { TranscriptEditor } from "./components/TranscriptEditor";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { generateDocument, polishText } from "./services/aiService";
import type { GenerateProvider, GenerateWarning, Mode, ToastState } from "./types";
import { copyText } from "./utils/copy";
import { exportMarkdown, exportTxt } from "./utils/exportFile";
import { createLocalResult } from "./utils/localFormatter";
import { addBasicPunctuation } from "./utils/punctuation";
import {
  appendDictationText,
  cleanFillerWords,
  removeLastSentence,
  runVoiceCommand
} from "./utils/textCleaner";

const TRANSCRIPT_KEY = "voiceflow.transcript";
const RESULT_KEY = "voiceflow.result";
const MODE_KEY = "voiceflow.mode";
const PROVIDER_KEY = "voiceflow.provider";

function getModeLabel(mode: Mode) {
  return mode === "student" ? "学生笔记模式" : "会议纪要模式";
}

function readInitialProvider(): GenerateProvider | null {
  const saved = readLocalStorage(PROVIDER_KEY);
  return saved === "local_qwen" || saved === "cloud_ai" || saved === "local_fallback" || saved === "mode_mismatch"
    ? saved
    : null;
}

function getWarningMessage(warning?: GenerateWarning, result?: string) {
  if (warning === "TEXT_LONG") {
    return "文本较长，生成可能稍慢。";
  }

  if (warning === "TEXT_TOO_LONG" || warning === "TEXT_TOO_SHORT") {
    return result || "请调整输入内容后再生成。";
  }

  return "";
}

function readLocalStorage(key: string) {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(key) ?? "";
}

function readInitialMode(): Mode {
  const saved = readLocalStorage(MODE_KEY);
  return saved === "meeting" ? "meeting" : "student";
}

export default function App() {
  const [mode, setMode] = useState<Mode>(readInitialMode);
  const [transcript, setTranscript] = useState(() => readLocalStorage(TRANSCRIPT_KEY));
  const [result, setResult] = useState(() => readLocalStorage(RESULT_KEY));
  const [resultProvider, setResultProvider] = useState<GenerateProvider | null>(readInitialProvider);
  const [deleteUndoSnapshot, setDeleteUndoSnapshot] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);

  const showToast = (message: string, type: ToastState["type"] = "info") => {
    setToast({ message, type });
  };

  const {
    isListening,
    interimText,
    isSupported,
    start,
    stop,
    resetInterim
  } = useSpeechRecognition({
    onFinalTranscript: (text) => {
      setTranscript((current) => {
        const commandResult = runVoiceCommand(text, current);

        if (commandResult.handled) {
          setDeleteUndoSnapshot(commandResult.message === "已删除上一句。" ? current : null);
          showToast(commandResult.message, "success");
          return commandResult.text;
        }

        setDeleteUndoSnapshot(null);
        return appendDictationText(current, text);
      });
    },
    onError: (message) => showToast(message, "error")
  });

  useEffect(() => {
    window.localStorage.setItem(TRANSCRIPT_KEY, transcript);
  }, [transcript]);

  useEffect(() => {
    window.localStorage.setItem(RESULT_KEY, result);
  }, [result]);

  useEffect(() => {
    if (resultProvider) {
      window.localStorage.setItem(PROVIDER_KEY, resultProvider);
    } else {
      window.localStorage.removeItem(PROVIDER_KEY);
    }
  }, [resultProvider]);

  useEffect(() => {
    window.localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const cleanedPreview = useMemo(() => {
    if (!transcript.trim()) {
      return "";
    }

    return addBasicPunctuation(cleanFillerWords(transcript));
  }, [transcript]);

  const handleToggleListening = () => {
    if (!isSupported) {
      showToast("当前浏览器不支持语音识别，请使用 Chrome 或 Edge 演示。", "error");
      return;
    }

    if (isListening) {
      stop();
      showToast("已停止录音。", "success");
      return;
    }

    start();
    showToast("开始实时转写，请直接说话。", "info");
  };

  const handleGenerate = async () => {
    const sourceText = cleanedPreview || transcript.trim();
    const currentMode = mode;
    let generationMode = currentMode;

    if (!sourceText) {
      showToast("请先输入或转写一段内容。", "warning");
      return;
    }

    setIsGenerating(true);

    try {
      const generated = await generateDocument({ mode: currentMode, text: sourceText });

      if (generated.warning === "MODE_MISMATCH" && generated.suggestedMode) {
        const shouldSwitch = window.confirm(`${generated.result}\n\n点击“确定”切换到${getModeLabel(generated.suggestedMode)}。\n点击“取消”继续使用${getModeLabel(currentMode)}生成。`);

        if (shouldSwitch) {
          generationMode = generated.suggestedMode;
          setMode(generationMode);
          setResult("");
          setResultProvider(null);
          showToast(`已切换到${getModeLabel(generationMode)}，正在生成。`, "info");

          const switched = await generateDocument({
            mode: generationMode,
            text: sourceText
          });
          setResult(switched.result);
          setResultProvider(switched.provider ?? null);
          if (switched.warning) {
            showToast(getWarningMessage(switched.warning, switched.result) || "生成完成，但请检查提示信息。", "warning");
            return;
          }
          showToast(generationMode === "student" ? "学习笔记已生成。" : "会议纪要已生成。", "success");
          return;
        }

        const forced = await generateDocument({
          mode: currentMode,
          text: sourceText,
          ignoreModeMismatch: true
        });
        setResult(forced.result);
        setResultProvider(forced.provider ?? null);
        if (forced.warning) {
          showToast(getWarningMessage(forced.warning, forced.result) || "生成完成，但请检查提示信息。", "warning");
          return;
        }
        showToast(currentMode === "student" ? "学习笔记已生成。" : "会议纪要已生成。", "success");
        return;
      }

      setResult(generated.result);
      setResultProvider(generated.provider ?? null);
      if (generated.warning) {
        showToast(getWarningMessage(generated.warning, generated.result) || "生成完成，但请检查提示信息。", "warning");
        return;
      }
      showToast(currentMode === "student" ? "学习笔记已生成。" : "会议纪要已生成。", "success");
    } catch (error) {
      const fallback = createLocalResult(generationMode, sourceText);
      setResult(fallback);
      setResultProvider("local_fallback");
      showToast("后端暂不可用，已使用本地演示整理。", "warning");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePolish = async () => {
    const sourceText = transcript.trim();

    if (!sourceText) {
      showToast("请先输入或转写一段内容。", "warning");
      return;
    }

    setIsPolishing(true);

    try {
      const polished = await polishText(sourceText);
      setDeleteUndoSnapshot(null);
      setTranscript(polished);
      showToast("文本已润色。", "success");
    } catch (error) {
      setDeleteUndoSnapshot(null);
      setTranscript(addBasicPunctuation(cleanFillerWords(sourceText)));
      showToast("后端暂不可用，已完成本地清理。", "warning");
    } finally {
      setIsPolishing(false);
    }
  };

  const handleCopy = async () => {
    const content = result.trim() || transcript.trim();

    if (!content) {
      showToast("暂无内容可复制。", "warning");
      return;
    }

    try {
      await copyText(content);
      showToast("已复制到剪贴板。", "success");
    } catch (error) {
      showToast("复制失败，请手动选择文本复制。", "error");
    }
  };

  const handleExport = (type: "txt" | "md") => {
    const content = result.trim() || transcript.trim();

    if (!content) {
      showToast("暂无内容可导出。", "warning");
      return;
    }

    if (type === "txt") {
      exportTxt(content, mode);
    } else {
      exportMarkdown(content, mode);
    }

    showToast(`已导出 ${type.toUpperCase()} 文件。`, "success");
  };

  const handleTranscriptChange = (value: string) => {
    setDeleteUndoSnapshot(null);
    setTranscript(value);
  };

  const handleUndoDelete = () => {
    if (!deleteUndoSnapshot) {
      return;
    }

    setTranscript(deleteUndoSnapshot);
    setDeleteUndoSnapshot(null);
    showToast("已撤销删除。", "success");
  };

  const handleDeleteLast = () => {
    if (!transcript.trim()) {
      showToast("当前没有可删除的句子。", "warning");
      return;
    }

    setTranscript(removeLastSentence(transcript));
    showToast("已删除该句。", "success");
  };

  const handleClear = () => {
    const confirmed = window.confirm("确定要清空当前内容和生成结果吗？");

    if (!confirmed) {
      return;
    }

    setDeleteUndoSnapshot(null);
    setTranscript("");
    setResult("");
    setResultProvider(null);
    resetInterim();
    showToast("已清空当前内容。", "success");
  };

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="VoiceFlow 控制栏">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            VF
          </div>
          <div>
            <h1>VoiceFlow Web</h1>
            <p>语音输入编辑器</p>
          </div>
        </div>

        <ModeSelector mode={mode} onChange={setMode} />
      </section>

      <StatStrip
        mode={mode}
        transcript={transcript}
        isListening={isListening}
        isSupported={isSupported}
      />

      <section className="workspace" aria-label="语音输入编辑工作区">
        <TranscriptEditor
          value={transcript}
          interimText={interimText}
          isListening={isListening}
          onChange={handleTranscriptChange}
          onExportTxt={() => handleExport("txt")}
          onExportMarkdown={() => handleExport("md")}
        />

        <ResultPanel
          mode={mode}
          value={result}
          provider={resultProvider}
          isLoading={isGenerating}
          onCopy={handleCopy}
          onExportMarkdown={() => handleExport("md")}
        />
      </section>

      <section className="command-bar" aria-label="编辑操作">
        <button
          className={`primary-action ${isListening ? "recording" : ""}`}
          type="button"
          onClick={handleToggleListening}
        >
          {isListening ? <Square size={20} /> : <Mic size={20} />}
          {isListening ? "停止转写" : "开始说话"}
        </button>

        <button type="button" onClick={handlePolish} disabled={isPolishing}>
          <Sparkles size={18} />
          {isPolishing ? "润色中" : "智能润色"}
        </button>

        <button className="accent-action" type="button" onClick={handleGenerate} disabled={isGenerating}>
          <Sparkles size={18} />
          {isGenerating ? "整理中" : mode === "student" ? "生成学习笔记" : "生成会议纪要"}
        </button>

        <button type="button" onClick={handleDeleteLast}>
          <RotateCcw size={18} />
          删除该句
        </button>

        <button type="button" onClick={handleUndoDelete} disabled={!deleteUndoSnapshot}>
          <Undo2 size={18} />
          撤销删除
        </button>

        <button type="button" onClick={handleCopy}>
          <ClipboardCopy size={18} />
          复制
        </button>

        <button className="danger-action" type="button" onClick={handleClear}>
          <Trash2 size={18} />
          清空
        </button>
      </section>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}
