# VoiceFlow Web MVP

## 用户画像与核心痛点

- 在校学生：老师讲课节奏快，手动打字跟不上，容易遗漏重点。
- 职场白领：会议录音转文字后信息杂乱，需要手动梳理决策项、待办事项。

极简、高效的语音输入编辑器比赛版。当前版本聚焦两条演示链路：

- 学生笔记：语音转写 → 清理语气词 → 自动标点 → 生成学习笔记
- 会议纪要：语音转写 → 清理语气词 → 自动标点 → 生成会议纪要

## 功能清单

- Web Speech API 实时中文转写，推荐 Chrome 或 Edge
- 原始文本可编辑，自动保存到 localStorage
- 大模型语气词清理、基础自动标点、删除(撤销)本句
- 智能润色、学习笔记生成、会议纪要生成
- 复制结果，导出 TXT / Markdown
- 后端无 API Key 时自动使用本地演示整理逻辑

## 本地运行

安装依赖：

```bash
npm install
npm --prefix backend install
```

启动前后端：

```bash
npm run dev:all
```

默认地址：

- 前端：http://127.0.0.1:5173
- 后端：http://127.0.0.1:3001

## 可选 AI 配置

复制 `backend/.env.example` 为 `backend/.env`，填入兼容 Chat Completions 的模型接口：

```env
PORT=3001
AI_API_KEY=your_api_key
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4o-mini
```

不填写 `AI_API_KEY` 也能演示，后端会返回本地结构化结果。

## 本地 Qwen2.5:3B 配置

本项目支持通过 Ollama 调用本地 Qwen2.5:3B，用于生成学生笔记和会议纪要。

### 1. 安装 Ollama

请先在本机安装 Ollama。

### 2. 拉取模型

```bash
ollama pull qwen2.5:3b
```

### 3. 配置环境变量

```bash
cp backend/.env.example backend/.env
```

确认 `.env` 中包含：

```env
USE_LOCAL_QWEN=true
AUTO_START_OLLAMA=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b
```

### 4. 启动项目

```bash
npm install
npm --prefix backend install
npm run dev:all
```

### 5. 运行逻辑

生成学生笔记或会议纪要时，后端会优先调用本地 Qwen2.5:3B。

如果 Ollama 没有启动，后端会尝试自动执行：

```bash
ollama serve
```

如果本地模型不可用，系统会继续尝试云端 AI；如果云端 AI 也不可用，则使用本地规则 fallback，保证项目仍可运行和演示。

## 演示建议

1. 选择“学生笔记”，点击“演示文本”，生成学习笔记并导出 Markdown。
2. 切换“会议纪要”，点击“演示文本”，生成会议纪要并复制结果。
3. 使用 Chrome 点击“开始说话”，允许麦克风权限后进行实时转写。
