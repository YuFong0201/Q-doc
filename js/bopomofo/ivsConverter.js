/**
 * 字嗨注音字體 (BpmfZihi) Unicode 變體選擇符 (IVS) 實際碼表規範：
 * - 無變體選擇符 (ivsIndex === 0)：預設常用讀音
 * - U+E01E0 (0xE01E0)：字嗨專用「純國字（隱藏注音）」變體
 * - U+E01E1 (0xE01E1)：第 1 個破音讀音 (ivsIndex === 1)
 * - U+E01E2 (0xE01E2)：第 2 個破音讀音 (ivsIndex === 2)
 * - U+E01E3 (0xE01E3)：第 3 個破音讀音 (ivsIndex === 3)
 * 因此第 idx 個破音的碼位為：0xE01E0 + idx
 */
const BPMF_IVS_BASE = 0xE01E0;

export function applyIVS(baseChar, ivsIndex) {
  const pureChar = stripIVS(baseChar);
  const idx = Number(ivsIndex) || 0;
  if (idx <= 0) {
    return pureChar;
  }
  const codePoint = BPMF_IVS_BASE + idx;
  return pureChar + String.fromCodePoint(codePoint);
}

export function stripIVS(str) {
  // 移除 U+E0100 ~ U+E01EF 範圍的變體選擇符，還原純國字
  return String(str).replace(/[\u{E0100}-\u{E01EF}]/gu, '');
}

export function extractIVSIndex(charWithIvs) {
  const codePoints = Array.from(String(charWithIvs)).map((c) => c.codePointAt(0));
  if (codePoints.length >= 2) {
    const vs = codePoints[1];
    if (vs > BPMF_IVS_BASE && vs <= 0xE01EF) {
      return vs - BPMF_IVS_BASE;
    }
  }
  return 0;
}