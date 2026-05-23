import type { Mode } from "../types";
import { addBasicPunctuation } from "./punctuation";
import { cleanFillerWords } from "./textCleaner";

function splitSentences(text: string) {
  return addBasicPunctuation(cleanFillerWords(text))
    .split(/(?<=[。！？!?；;])|\n+/)
    .map((item) => item.trim())
    .filter((item) => item && !/^(首先|其次|然后|最后|所以|但是)[，,。！？!?]*$/.test(item));
}

function pickItems(sentences: string[], count = 4) {
  const selected = sentences.slice(0, count);
  return selected.length > 0 ? selected : ["原文信息较少，请补充更多口述内容。"];
}

export function createLocalResult(mode: Mode, text: string) {
  return mode === "student" ? createStudentNote(text) : createMeetingMinutes(text);
}

export function createStudentNote(text: string) {
  const sentences = splitSentences(text);
  const items = pickItems(sentences);
  const topic = sentences[0]?.replace(/[。！？!?]$/g, "") || "本次学习内容";

  return `# 学习笔记

## 一、学习主题
${topic}

## 二、核心知识点
${items.map((item) => `- ${item}`).join("\n")}

## 三、重点内容
${items.slice(0, 3).map((item) => `- ${item}`).join("\n")}

## 四、易错点 / 待复习
- 对关键概念再做一次复述，确认能用自己的话解释。
- 标记仍然不熟悉的术语，课后补充例题或资料。

## 五、总结
本次内容已经整理为可复习笔记，建议继续补充例子、公式或课堂原话。`;
}

export function createMeetingMinutes(text: string) {
  const sentences = splitSentences(text);
  const items = pickItems(sentences);
  const topic = sentences[0]?.replace(/[。！？!?]$/g, "") || "本次会议";

  return `# 会议纪要

## 一、会议主题
${topic}

## 二、会议摘要
${items[0]}

## 三、讨论内容
${items.map((item) => `- ${item}`).join("\n")}

## 四、会议结论
- 已根据当前转写内容形成初步结论，建议会后确认负责人和时间节点。

## 五、待办事项
| 事项 | 负责人 | 截止时间 |
|---|---|---|
| 根据会议内容完善执行计划 | 未提及 | 未提及 |`;
}

export function getDemoText(mode: Mode) {
  if (mode === "student") {
    return "嗯 今天我们学习了函数单调性，那个重点是导数和单调区间的关系，如果导数大于零函数通常是递增的，如果导数小于零函数通常是递减的，然后需要注意定义域不能丢。";
  }

  return "今天产品评审主要讨论语音输入编辑器的比赛版本，首先要保证实时转写和文本编辑稳定，其次要完成学生笔记和会议纪要两个场景，最后周日前准备演示脚本和导出功能。";
}
