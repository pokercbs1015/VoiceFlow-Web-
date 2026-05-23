import { addBasicPunctuation } from "./punctuation";

const fillerPatterns = [
  { pattern: /(^|[，,。\s])(嗯+|呃+|额+|啊+|唔+|呃呃+)(?=[，,。\s]|$)/g, replacement: "$1" },
  { pattern: /怎么说呢/g, replacement: "" },
  { pattern: /怎么讲呢/g, replacement: "" },
  { pattern: /就是说/g, replacement: "" },
  { pattern: /那个/g, replacement: "" },
  { pattern: /这个这个/g, replacement: "这个" },
  { pattern: /就是就是/g, replacement: "就是" },
  { pattern: /然后然后/g, replacement: "然后" },
  { pattern: /哎呀/g, replacement: "" }
];

export function cleanFillerWords(text: string) {
  let result = text;

  fillerPatterns.forEach(({ pattern, replacement }) => {
    result = result.replace(pattern, replacement);
  });

  return result
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/，{2,}/g, "，")
    .replace(/。{2,}/g, "。")
    .replace(/\s+([，。！？])/g, "$1")
    .trim();
}

export function removeLastSentence(text: string) {
  const trimmed = text.trimEnd();

  if (!trimmed) {
    return "";
  }

  const parts = trimmed.match(/[^。！？!?；;\n]+[。！？!?；;\n]?/g) ?? [];
  parts.pop();
  return parts.join("").trimEnd();
}

export function appendDictationText(current: string, incoming: string) {
  const normalized = addBasicPunctuation(cleanFillerWords(incoming));

  if (!normalized) {
    return current;
  }

  return current.trim() ? `${current.trimEnd()}\n${normalized}` : normalized;
}

export function runVoiceCommand(incoming: string, current: string) {
  const command = incoming.replace(/[，。！？!?\s]/g, "");

  if (["换行", "另起一行", "新的一行"].includes(command)) {
    return {
      handled: true,
      text: current.trimEnd() ? `${current.trimEnd()}\n` : "",
      message: "已换行。"
    };
  }

  if (["删除上一句", "删掉上一句", "撤销上一句"].includes(command)) {
    return {
      handled: true,
      text: removeLastSentence(current),
      message: "已删除上一句。"
    };
  }

  if (["清空", "清空文本", "全部清空"].includes(command)) {
    return {
      handled: true,
      text: "",
      message: "已清空文本。"
    };
  }

  return {
    handled: false,
    text: current,
    message: ""
  };
}
