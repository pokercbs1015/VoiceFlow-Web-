function buildMeetingPrompt(text) {
  return `你是一个会议纪要整理助手。
请把下面的语音转写内容整理成正式会议纪要。

要求：
1. 保留原意，不要编造事实。
2. 如果没有提到负责人或截止时间，写“未提及”。
3. 输出会议主题、会议摘要、讨论内容、会议结论、待办事项。
4. 待办事项使用 Markdown 表格。
5. 语言简洁、正式。

原始内容：
${text}`;
}

module.exports = { buildMeetingPrompt };
