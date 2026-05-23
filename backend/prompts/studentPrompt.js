function buildStudentPrompt(text) {
  return `你是一个学习笔记整理助手。
请把下面的语音转写内容整理成适合学生复习的学习笔记。

要求：
1. 保留原意，不要编造内容。
2. 自动添加标题。
3. 提取核心知识点。
4. 提取重点内容。
5. 提取易错点或待复习问题。
6. 使用 Markdown 格式。
7. 语言简洁清晰。

原始内容：
${text}`;
}

module.exports = { buildStudentPrompt };
