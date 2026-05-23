# VoiceFlow Web MVP

极简、高效的语音输入编辑器比赛版。当前版本聚焦两条演示链路：

- 学生笔记：语音转写 → 清理语气词 → 自动标点 → 生成学习笔记
- 会议纪要：语音转写 → 清理语气词 → 自动标点 → 生成会议纪要

## 功能清单

- Web Speech API 实时中文转写，推荐 Chrome 或 Edge
- 原始文本可编辑，自动保存到 localStorage
- 语气词清理、基础自动标点、删除上一句
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

## 演示建议

1. 选择“学生笔记”，点击“演示文本”，生成学习笔记并导出 Markdown。
2. 切换“会议纪要”，点击“演示文本”，生成会议纪要并复制结果。
3. 使用 Chrome 点击“开始说话”，允许麦克风权限后进行实时转写。
