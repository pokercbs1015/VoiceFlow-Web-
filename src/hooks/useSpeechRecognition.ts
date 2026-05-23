import { useEffect, useRef, useState } from "react";

interface UseSpeechRecognitionOptions {
  onFinalTranscript: (text: string) => void;
  onError: (message: string) => void;
}

function getSpeechRecognition() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

function mapSpeechError(error: string) {
  const errorMap: Record<string, string> = {
    "not-allowed": "麦克风权限被拒绝，请在浏览器地址栏允许麦克风。",
    "audio-capture": "没有检测到可用麦克风。",
    network: "语音识别网络异常，请稍后重试。",
    "no-speech": "没有检测到语音，可以靠近麦克风再试一次。",
    aborted: "语音识别已取消。"
  };

  return errorMap[error] ?? `语音识别失败：${error}`;
}

export function useSpeechRecognition({
  onFinalTranscript,
  onError
}: UseSpeechRecognitionOptions) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const callbacksRef = useRef({ onFinalTranscript, onError });
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const isSupported = Boolean(getSpeechRecognition());

  useEffect(() => {
    callbacksRef.current = { onFinalTranscript, onError };
  }, [onError, onFinalTranscript]);

  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      return undefined;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "zh-CN";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalText = "";
      let currentInterim = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";

        if (result.isFinal) {
          finalText += transcript;
        } else {
          currentInterim += transcript;
        }
      }

      if (finalText.trim()) {
        callbacksRef.current.onFinalTranscript(finalText);
      }

      setInterimText(currentInterim.trim());
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      callbacksRef.current.onError(mapSpeechError(event.error));
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  const start = () => {
    const recognition = recognitionRef.current;

    if (!recognition) {
      callbacksRef.current.onError("当前浏览器不支持语音识别，请使用 Chrome 或 Edge。");
      return;
    }

    try {
      recognition.start();
      setIsListening(true);
    } catch (error) {
      callbacksRef.current.onError("语音识别已经在运行，请稍后再试。");
    }
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimText("");
  };

  const resetInterim = () => {
    setInterimText("");
  };

  return {
    isListening,
    interimText,
    isSupported,
    start,
    stop,
    resetInterim
  };
}
