require("dotenv").config();

const cors = require("cors");
const express = require("express");
const { spawn } = require("node:child_process");

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

let ollamaProcess = null;
const STUDENT_MODE_WARNING = "当前内容更像课堂学习内容，建议切换到“学生笔记模式”生成。";
const MEETING_MODE_WARNING = "当前内容更像会议讨论内容，建议切换到“会议纪要模式”生成。";
const LONG_TEXT_WARNING = "文本较长，生成可能较慢，请耐心等待。";
const TOO_LONG_TEXT_WARNING = "文本较长，建议分段生成，以保证整理质量。";
const TOO_SHORT_TEXT_WARNING = "当前内容太短，建议补充更多信息后再生成。";
const LOCAL_QWEN_TIMEOUT_MS = 60000;
const OLLAMA_HEALTH_TIMEOUT_MS = 3000;
const STUDENT_SECTIONS = [
  "# 学习笔记",
  "## 一、学习主题",
  "## 二、核心知识点",
  "## 三、重点内容",
  "## 四、易错点 / 待复习",
  "## 五、总结"
];
const MEETING_SECTIONS = [
  "# 会议纪要",
  "## 一、会议主题",
  "## 二、会议摘要",
  "## 三、讨论内容",
  "## 四、会议结论",
  "## 五、待办事项"
];

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

function validateInputText(text) {
  const content = String(text || "").trim();

  if (!content) {
    return {
      result: "请输入或语音生成内容后再生成。",
      warning: "TEXT_TOO_SHORT"
    };
  }

  if (content.length < 20) {
    return {
      result: TOO_SHORT_TEXT_WARNING,
      warning: "TEXT_TOO_SHORT"
    };
  }

  if (content.length > 6000) {
    return {
      result: TOO_LONG_TEXT_WARNING,
      warning: "TEXT_TOO_LONG"
    };
  }

  if (content.length > 3000) {
    return {
      result: LONG_TEXT_WARNING,
      warning: "TEXT_LONG"
    };
  }

  return null;
}

function pickStudentReviewItems(items) {
  const reviewKeywords = ["易错", "注意", "不要忘记", "容易丢分", "课后", "作业", "练习册", "页码", "页", "错题本", "整理", "复习", "需要继续"];
  return items.filter((item) => reviewKeywords.some((keyword) => item.includes(keyword)));
}

function detectContentType(text) {
  const content = String(text || "");
  const studyKeywords = [
    "同学们",
    "老师",
    "这节课",
    "今天我们来学习",
    "今天学习",
    "学习了",
    "复习了",
    "课后",
    "作业",
    "练习册",
    "错题本",
    "知识点",
    "考试",
    "函数",
    "导数",
    "定义域"
  ];
  const meetingKeywords = [
    "会议",
    "讨论",
    "项目",
    "进度",
    "负责人",
    "负责",
    "截止时间",
    "决定",
    "同步会",
    "待办",
    "需求",
    "开发",
    "测试",
    "接口",
    "文档",
    "演示"
  ];

  const studyScore = studyKeywords.filter((keyword) => content.includes(keyword)).length;
  const meetingScore = meetingKeywords.filter((keyword) => content.includes(keyword)).length;

  if (studyScore >= 3 && meetingScore <= 1) {
    return "student";
  }

  if (meetingScore >= 3 && studyScore <= 2) {
    return "meeting";
  }

  return "unknown";
}

function buildStudentPrompt(text) {
  return `你是一个严谨的学习笔记整理助手。
你的任务是把“语音转写文本”整理成适合学生复习的 Markdown 学习笔记。

请严格遵守以下规则：

1. 只能根据原文内容整理，不要编造原文没有提到的知识点。
2. 不要自行扩展课外知识，不要添加原文没有出现的例子。
3. 如果某个部分原文没有明确提到，写“未提及”。
4. 必须使用 Markdown 格式。
5. 第一行必须是：# 学习笔记
6. 必须严格按照下面结构输出，不要改变标题名称：

# 学习笔记

## 一、学习主题
用一句话概括本节课或本次学习的主题。

## 二、核心知识点
提取原文中出现的主要概念、定义、公式、结论或知识点。
如果原文中有“包括、主要有、首先、其次、第三、结论、概念、公式、方法”等内容，应优先放在这里。

## 三、重点内容
提取老师强调的重点、解题步骤、判断方法、学习方法或考试常考内容。
如果原文中出现“重点是、关键是、一定要、需要掌握、考试中经常、步骤是”等内容，应优先放在这里。

## 四、易错点 / 待复习
提取原文中的易错点、注意事项、课后任务和待复习内容。
如果原文中出现“易错、注意、不要忘记、容易丢分、课后、作业、练习册、页码、错题本、整理、复习、需要继续”等内容，必须放在这里，不得省略。

## 五、总结
用 1 到 2 句话总结本次学习内容和复习重点。

输入类型判断：
- 如果原文明显是项目会议、进度同步、待办安排、负责人分工或会议讨论，而不是课堂学习内容，请不要生成学习笔记。
- 此时只输出：${MEETING_MODE_WARNING}
- 不要继续输出学习笔记结构。

输出要求：
- 只输出 Markdown 学习笔记。
- 不要输出解释说明。
- 不要输出“以下是整理结果”等开头。
- 不要在结尾添加额外说明。
- 内容要简洁、清楚，适合学生复习。
- 保留原文中的关键表达，例如页码、题目范围、课后任务。
- 必须保留原文中的数字、页码、日期、时间、模型名称、项目名称，不要随意改写。

语音转写文本：
${text}`;
}

function buildMeetingPrompt(text) {
  return `你是一个严谨的会议纪要整理助手。
你的任务是把“语音转写文本”整理成正式 Markdown 会议纪要。

请严格遵守以下规则：

1. 只能根据原文内容整理，不要编造事实。
2. 不要虚构负责人、截止时间、会议时间、会议结论或待办事项。
3. 如果负责人、截止时间、会议时间没有明确提到，必须写“未提及”。
4. 会议主题要尽量包含项目名称、产品名称或核心讨论对象，不要过于笼统。
5. 必须使用 Markdown 格式。
6. 第一行必须是：# 会议纪要
7. 必须严格按照下面结构输出，不要改变标题名称：

# 会议纪要

## 一、会议主题
用一句话概括会议主题。
如果原文中出现项目名、产品名、系统名或核心讨论对象，会议主题中必须保留。

## 二、会议摘要
用 1 到 3 句话概括会议主要内容。
只总结原文提到的信息，不要添加新内容。

## 三、讨论内容
整理会议中讨论的问题、进度、方案、风险和注意事项。
如果原文中出现“讨论、问题、进度、方案、开发、测试、接口、模型、功能、风险”等内容，应放在这里。

## 四、会议结论
整理会议已经决定的事项。
如果原文中出现“决定、确定、统一、最终、要求、需要完成”等内容，应放在这里。
不要把未决定的内容写成结论。

## 五、待办事项
必须使用 Markdown 表格，格式如下：

| 事项 | 负责人 | 截止时间 |
|---|---|---|

待办事项提取规则：
- 如果原文中出现“负责、完成、跟进、测试、检查、整理、提交、修复、准备”等内容，应提取为待办事项。
- 负责人必须来自原文，不能猜测。
- 截止时间必须保留原文表达，例如“今天晚上十点”“明天上午十点”“五月二十五号上午”，不要改写成“当晚”“次日”等模糊表达。
- 如果没有负责人，写“未提及”。
- 如果没有截止时间，写“未提及”。

输入类型判断：
- 如果原文明显是课堂讲解、学生学习内容、老师授课、课后作业或知识点讲解，而不是会议讨论，请不要生成会议纪要。
- 此时只输出：${STUDENT_MODE_WARNING}
- 不要继续输出会议纪要结构。

输出要求：
- 只输出 Markdown 会议纪要。
- 不要输出解释说明。
- 不要输出“以下是会议纪要”等开头。
- 不要输出分隔线，例如 ---。
- 不要输出“结束会议纪要”“会议结束”“以上为会议纪要”等结束语。
- 待办事项表格输出完成后立即停止。
- 最后一行必须是待办事项表格中的最后一条数据。
- 不要在表格后添加任何额外说明。
- 语言简洁、正式。
- 必须保留原文中的数字、页码、日期、时间、模型名称、项目名称，不要随意改写。

语音转写文本：
${text}`;
}

function localStudentNote(text) {
  const sentences = splitSentences(text);
  const items = sentences.length ? sentences.slice(0, 5) : ["原始内容较少，请补充更多学习信息。"];
  const reviewItems = pickStudentReviewItems(sentences);
  const topic = sentences[0]?.replace(/[。！？!?]$/g, "") || "本次学习内容";

  return `# 学习笔记

## 一、学习主题
${topic}

## 二、核心知识点
${bulletList(items)}

## 三、重点内容
${bulletList(items.slice(0, 3))}

## 四、易错点 / 待复习
${reviewItems.length ? bulletList(reviewItems) : "- 未提及"}

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

function stripMarkdownFence(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:markdown)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function cleanCommonOutput(text) {
  return stripMarkdownFence(text)
    .replace(/^以下是.*?[:：]\s*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeStudentNoteOutput(text) {
  let result = cleanCommonOutput(text);

  if (result === MEETING_MODE_WARNING) {
    return result;
  }

  if (!result.startsWith("# 学习笔记")) {
    result = result.replace(/^学习笔记\s*/i, "").trim();
    result = `# 学习笔记\n\n${result}`;
  }

  return result.trim();
}

function cleanMeetingOutput(text) {
  let result = cleanCommonOutput(text)
    .replace(/\n---\s*\n?(结束会议纪要。?|会议结束。?|以上为会议纪要。?)?\s*$/g, "")
    .replace(/\n?(结束会议纪要。?|会议结束。?|以上为会议纪要。?)\s*$/g, "")
    .trim();

  const lines = result.split(/\r?\n/);
  const todoIndex = lines.findIndex((line) => line.trim() === "## 五、待办事项");

  if (todoIndex !== -1) {
    let lastTableLine = -1;

    for (let i = todoIndex + 1; i < lines.length; i += 1) {
      if (/^\s*\|.*\|\s*$/.test(lines[i])) {
        lastTableLine = i;
      }
    }

    if (lastTableLine !== -1 && lastTableLine < lines.length - 1) {
      result = lines.slice(0, lastTableLine + 1).join("\n").trim();
    }
  }

  return result;
}

function normalizeMeetingOutput(text) {
  let result = cleanMeetingOutput(text);

  if (result === STUDENT_MODE_WARNING) {
    return result;
  }

  if (!result.startsWith("# 会议纪要")) {
    result = result.replace(/^会议纪要\s*/i, "").trim();
    result = `# 会议纪要\n\n${result}`;
  }

  return result.trim();
}

function hasRequiredSections(text, sections) {
  return sections.every((section) => text.includes(section));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = LOCAL_QWEN_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOllamaTags(timeoutMs = OLLAMA_HEALTH_TIMEOUT_MS) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const response = await fetchWithTimeout(`${baseUrl}/api/tags`, { method: "GET" }, timeoutMs);

  if (!response.ok) {
    throw new Error(`Ollama tags request failed: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data.models) ? data.models : [];
}

function hasOllamaModel(models, modelName) {
  return models.some((item) => item.name === modelName || item.model === modelName);
}

async function getLocalModelStatus() {
  const model = process.env.OLLAMA_MODEL || "qwen2.5:3b";

  try {
    const models = await fetchOllamaTags();
    return {
      ollamaRunning: true,
      model,
      modelAvailable: hasOllamaModel(models, model)
    };
  } catch {
    return {
      ollamaRunning: false,
      model,
      modelAvailable: false
    };
  }
}

async function isOllamaRunning() {
  try {
    await fetchOllamaTags();
    return true;
  } catch {
    return false;
  }
}

function startOllamaServer() {
  if (process.env.AUTO_START_OLLAMA !== "true") {
    return;
  }

  if (ollamaProcess) {
    return;
  }

  console.log("[Ollama] 未检测到服务，正在尝试启动 ollama serve...");

  try {
    ollamaProcess = spawn("ollama", ["serve"], {
      detached: true,
      stdio: "ignore"
    });

    ollamaProcess.on("error", (error) => {
      console.warn("[Ollama] 自动启动 ollama serve 失败：", error.message);
      ollamaProcess = null;
    });

    ollamaProcess.on("exit", () => {
      ollamaProcess = null;
    });

    ollamaProcess.unref();
  } catch (error) {
    console.warn("[Ollama] 自动启动 ollama serve 失败：", error.message);
    ollamaProcess = null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForOllamaReady(maxRetries = 12, intervalMs = 500) {
  for (let i = 0; i < maxRetries; i += 1) {
    const running = await isOllamaRunning();

    if (running) {
      return true;
    }

    await sleep(intervalMs);
  }

  return false;
}

async function ensureOllamaReady() {
  console.log("[Ollama] checking service...");
  const alreadyRunning = await isOllamaRunning();

  if (alreadyRunning) {
    console.log("[Ollama] 服务已启动。");
    return true;
  }

  startOllamaServer();

  const ready = await waitForOllamaReady();

  if (!ready) {
    console.warn("[Ollama] 自动启动失败，将尝试其他生成方式。");
    return false;
  }

  console.log("[Ollama] 服务自动启动成功。");
  return true;
}

async function callLocalQwen(prompt) {
  if (process.env.USE_LOCAL_QWEN !== "true") {
    return null;
  }

  const ollamaReady = await ensureOllamaReady();

  if (!ollamaReady) {
    return null;
  }

  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "qwen2.5:3b";
  const models = await fetchOllamaTags();

  if (!hasOllamaModel(models, model)) {
    throw new Error(`本地未检测到 ${model}，请先执行：ollama pull ${model}`);
  }

  console.log(`[Qwen] generating with ${model}...`);

  const response = await fetchWithTimeout(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: {
        temperature: 0.2,
        top_p: 0.8,
        num_ctx: 8192,
        num_predict: 1200
      }
    })
  }, LOCAL_QWEN_TIMEOUT_MS);

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Local Qwen request failed: ${response.status}`);
  }

  const data = await response.json();

  console.log("[Qwen] success.");
  return data.response || null;
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
  try {
    const localResult = await callLocalQwen(prompt);

    if (localResult) {
      console.log("[Generate] 使用本地 Qwen2.5:3B 生成。");
      console.log("[Generate] provider=local_qwen");
      return {
        result: localResult,
        provider: "local_qwen"
      };
    }
  } catch (error) {
    console.warn("[Generate] 本地 Qwen 调用失败：", error.message);
  }

  try {
    const aiResult = await callAi(prompt);

    if (aiResult) {
      console.log("[Generate] 使用云端 AI 生成。");
      console.log("[Generate] provider=cloud_ai");
      return {
        result: aiResult,
        provider: "cloud_ai"
      };
    }
  } catch (error) {
    console.warn("[Generate] 云端 AI 调用失败：", error.message);
  }

  console.warn("[Generate] 使用本地规则 fallback 生成。");
  console.log("[Generate] provider=local_fallback");
  return {
    result: fallback,
    provider: "local_fallback"
  };
}

async function generateCloudWithFallback(prompt, fallback) {
  try {
    const aiResult = await callAi(prompt);

    if (aiResult) {
      console.log("[Generate] 使用云端 AI 生成。");
      return aiResult;
    }
  } catch (error) {
    console.warn("[Generate] 云端 AI 调用失败：", error.message);
  }

  console.warn("[Generate] 使用本地规则 fallback 生成。");
  return fallback;
}

function finalizeStudentGeneration(generation, fallback, inputWarning) {
  const normalized = normalizeStudentNoteOutput(generation.result);

  if (normalized === MEETING_MODE_WARNING) {
    return {
      result: normalized,
      provider: "mode_mismatch",
      warning: "MODE_MISMATCH",
      suggestedMode: "meeting"
    };
  }

  if (!hasRequiredSections(normalized, STUDENT_SECTIONS)) {
    console.warn("[Generate] 学生笔记结构不完整，已切换到本地规则 fallback。");
    return {
      result: normalizeStudentNoteOutput(fallback),
      provider: "local_fallback",
      warning: inputWarning
    };
  }

  return {
    result: normalized,
    provider: generation.provider,
    warning: inputWarning
  };
}

function finalizeMeetingGeneration(generation, fallback, inputWarning) {
  const normalized = normalizeMeetingOutput(generation.result);

  if (normalized === STUDENT_MODE_WARNING) {
    return {
      result: normalized,
      provider: "mode_mismatch",
      warning: "MODE_MISMATCH",
      suggestedMode: "student"
    };
  }

  if (!hasRequiredSections(normalized, MEETING_SECTIONS)) {
    console.warn("[Generate] 会议纪要结构不完整，已切换到本地规则 fallback。");
    return {
      result: normalizeMeetingOutput(fallback),
      provider: "local_fallback",
      warning: inputWarning
    };
  }

  return {
    result: normalized,
    provider: generation.provider,
    warning: inputWarning
  };
}

app.get("/api/health", (request, response) => {
  response.json({
    ok: true,
    ai: Boolean(process.env.AI_API_KEY)
  });
});

app.get("/api/local-model/status", async (request, response) => {
  const status = await getLocalModelStatus();
  response.json(status);
});

app.post("/api/generate-student-note", async (request, response) => {
  try {
    const text = cleanInput(request.body.text);
    const inputValidation = validateInputText(text);

    if (inputValidation && inputValidation.warning !== "TEXT_LONG") {
      response.json(inputValidation);
      return;
    }

    const ignoreModeMismatch = request.body.ignoreModeMismatch === true;
    const detectedType = detectContentType(text);

    if (!ignoreModeMismatch && detectedType === "meeting") {
      response.json({
        result: MEETING_MODE_WARNING,
        provider: "mode_mismatch",
        warning: "MODE_MISMATCH",
        suggestedMode: "meeting"
      });
      return;
    }

    const fallback = localStudentNote(text);
    const generation = await generateWithFallback(buildStudentPrompt(text), fallback);
    response.json(finalizeStudentGeneration(generation, fallback, inputValidation?.warning));
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "failed to generate student note" });
  }
});

app.post("/api/generate-meeting-minutes", async (request, response) => {
  try {
    const text = cleanInput(request.body.text);
    const inputValidation = validateInputText(text);

    if (inputValidation && inputValidation.warning !== "TEXT_LONG") {
      response.json(inputValidation);
      return;
    }

    const ignoreModeMismatch = request.body.ignoreModeMismatch === true;
    const detectedType = detectContentType(text);

    if (!ignoreModeMismatch && detectedType === "student") {
      response.json({
        result: STUDENT_MODE_WARNING,
        provider: "mode_mismatch",
        warning: "MODE_MISMATCH",
        suggestedMode: "student"
      });
      return;
    }

    const fallback = localMeetingMinutes(text);
    const generation = await generateWithFallback(buildMeetingPrompt(text), fallback);
    response.json(finalizeMeetingGeneration(generation, fallback, inputValidation?.warning));
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

    const prompt = `请在不改变原意的前提下，把下面的语音转写内容整理得更清晰、自然、适合直接复制使用。只输出整理后的正文。

原始内容：
${text}`;
    const fallback = text
      .replace(/嗯+|呃+|额+|啊+|那个|怎么说呢/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const result = await generateCloudWithFallback(prompt, fallback.endsWith("。") ? fallback : `${fallback}。`);

    response.json({ result });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "failed to polish text" });
  }
});

app.listen(port, () => {
  console.log(`VoiceFlow backend listening on http://127.0.0.1:${port}`);
});
