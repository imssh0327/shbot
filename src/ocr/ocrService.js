// src/ocr/ocrService.js
const Tesseract = require("tesseract.js");

/**
 * 이미지에서 텍스트(OCR) 추출
 * @param {Buffer|String} input - Buffer 또는 URL
 * @returns {Promise<string>} 인식된 전체 텍스트
 */
async function extractText(input) {
  const { data } = await Tesseract.recognize(input, "eng", {
    // 옵션은 필요시 추후 조정
    logger: (m) => {
      // console.log(m); // 진행률 보고 싶으면 주석 해제
    },
  });

  return data.text || "";
}

/**
 * 전투 분석 숫자만 뽑는 예시 (숫자/점/쉼표 등)
 * @param {string} text
 * @returns {string[]} 숫자 후보 리스트
 */
function extractNumbers(text) {
  // 숫자, 소수점, 콤마만 남기는 간단 예시
  const matches = text.match(/[\d.,]+/g);
  if (!matches) return [];
  return matches;
}

async function extractNumbersFromImage(input) {
  const text = await extractText(input);
  const numbers = extractNumbers(text);
  return { text, numbers };
}

module.exports = {
  extractText,
  extractNumbers,
  extractNumbersFromImage,
};