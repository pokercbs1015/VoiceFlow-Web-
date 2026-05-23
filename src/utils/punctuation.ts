export function addBasicPunctuation(text: string) {
  let result = text
    .replace(/\s+/g, " ")
    .replace(/[，,]\s*/g, "，")
    .replace(/[。]\s*/g, "。")
    .replace(/[？?]\s*/g, "？")
    .replace(/[！!]\s*/g, "！")
    .trim();

  if (!result) {
    return "";
  }

  result = result
    .replace(/(首先)(?![，,])/g, "$1，")
    .replace(/(其次)(?![，,])/g, "$1，")
    .replace(/(然后)(?![，,])/g, "$1，")
    .replace(/(最后)(?![，,])/g, "$1，")
    .replace(/(但是)(?![，,])/g, "$1，")
    .replace(/(所以)(?![，,])/g, "$1，")
    .replace(/吗(?![？?])/g, "吗？")
    .replace(/呢(?![？?])/g, "呢？");

  if (!/[。！？.!?]$/.test(result)) {
    result += "。";
  }

  return result;
}
