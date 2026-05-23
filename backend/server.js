require("dotenv").config();

const cors = require("cors");
const express = require("express");
const { buildMeetingPrompt } = require("./prompts/meetingPrompt");
const { buildStudentPrompt } = require("./prompts/studentPrompt");

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function cleanInput(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}

function splitSentences(text) {
  return cleanInput(text)
    .split(/(?<=[。！？!?；;])|[，,]\s*|\n+/u)
    .map((item) => item.trim())
    .filter((item) => item && !/^(首先|其次|然后|最后|所以|但是)[，,。！？!?]*$/.test(item));
}

function bulletList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function localStudentNote(text) {
  const sentences = splitSentences(text);
  const items = sentences.length ? sentences.slice(0, 5) : ["原始内容较少，请补充更多学习信息。"];
  const topic = sentences[0]?.replace(/[。！？!?]$/g, "") || "本次学习内容";

  return `# 学习笔记

## 一、学习主题
${topic}

## 二、核心知识点
${bulletList(items)}

## 三、重点内容
${bulletList(items.slice(0, 3))}

## 四、易错点 / 待复习
- 复述核心概念，确认能独立解释。
- 对不熟悉的术语补充例题或资料。

## 五、总结
本次内容已经整理为可复习笔记，建议继续补充例子、公式或课堂原话。`;
}

function localMeetingMinutes(text) {
  const sentences = splitSentences(text);
  const items = sentences.length ? sentences.slice(0, 5) : ["原始内容较少，请补充更多会议信息。"];
  const topic = sentences[0]?.replace(/[。！？!?]$/g, "") || "本次会议";

  return `# 会议纪要

## 一、会议主题
${topic}

## 二、会议摘要
${items[0]}

## 三、讨论内容
${bulletList(items)}

## 四、会议结论
- 已基于当前转写内容形成初步结论，建议会后确认细节。

## 五、待办事项
| 事项 | 负责人 | 截止时间 |
|---|---|---|
| 根据会议内容完善执行计划 | 未提及 | 未提及 |`;
}

async function callAi(prompt) {
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const apiUrl = process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "你是严谨、简洁的中文文本整理助手。"
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `AI request failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.output_text) {
    return data.output_text;
  }

  const chatContent = data.choices?.[0]?.message?.content;
  if (chatContent) {
    return chatContent;
  }

  const responseText = data.output?.[0]?.content?.[0]?.text;
  if (responseText) {
    return responseText;
  }

  throw new Error("AI response format is not supported");
}

async function generateWithFallback(prompt, fallback) {
  const aiResult = await callAi(prompt);
  return aiResult || fallback;
}

app.get("/api/health", (request, response) => {
  response.json({
    ok: true,
    ai: Boolean(process.env.AI_API_KEY)
  });
});

app.post("/api/generate-student-note", async (request, response) => {
  try {
    const text = cleanInput(request.body.text);

    if (!text) {
      response.status(400).json({ error: "text is required" });
      return;
    }

    const result = await generateWithFallback(buildStudentPrompt(text), localStudentNote(text));
    response.json({ result });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "failed to generate student note" });
  }
});

app.post("/api/generate-meeting-minutes", async (request, response) => {
  try {
    const text = cleanInput(request.body.text);

    if (!text) {
      response.status(400).json({ error: "text is required" });
      return;
    }

    const result = await generateWithFallback(buildMeetingPrompt(text), localMeetingMinutes(text));
    response.json({ result });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "failed to generate meeting minutes" });
  }
});

app.post("/api/polish", async (request, response) => {
  try {
    const text = cleanInput(request.body.text);

    if (!text) {
      response.status(400).json({ error: "text is required" });
      return;
    }

    const prompt = `你是一名中文语音转写文本修复助手。下面的内容来自实时语音识别，可能存在断句混乱、口头禅、重复表达、同音词误识别、词不达意、语序不顺、缺少标点等问题。

请在严格保留原意和关键信息的前提下，进行针对性润色：
1. 修正明显的语音识别错误、错别字、同音词误识别和不通顺句式。
2. 删除不影响含义的口头禅、停顿词和重复表达，例如“嗯”“呃”“然后呢”“那个”“就是说”。
3. 补充合适的标点和自然分段，让文本更清晰、连贯、适合直接复制使用。
4. 将过度口语化但含义明确的表达改写为自然书面语。
5. 不要扩写、脑补或添加原文没有的信息；不确定的内容保持原样或做最小改动。
6. 不要输出解释、标题、项目符号或修改说明，只输出润色后的正文。

原始内容：
${text}`;
    const fallback = text
      .replace(/嗯+|呃+|额+|啊+|那个|怎么说呢/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const result = await generateWithFallback(prompt, fallback.endsWith("。") ? fallback : `${fallback}。`);

    response.json({ result });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "failed to polish text" });
  }
});

app.listen(port, () => {
  console.log(`VoiceFlow backend listening on http://127.0.0.1:${port}`);
});
