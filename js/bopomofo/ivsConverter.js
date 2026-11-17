/**
 * 字嗨注音字體使用 Unicode 變體選擇符 (Variation Selectors Supplement)
 * U+E0100 對應 index 0，U+E0101 對應 index 1，以此類推
 */
export function applyIVS(baseChar, ivsIndex) {
  const pureChar = stripIVS(baseChar);
  if (!ivsIndex || ivsIndex <= 0) {
    return pureChar;
  }
  const codePoint = 0xE0100 + (ivsIndex - 1);
  return pureChar + String.fromCodePoint(codePoint);
}

export function stripIVS(str) {
  // 移除 U+E0100 ~ U+E01EF 範圍的變體選擇符，還原純國字
  return str.replace(/[\u{E0100}-\u{E01EF}]/gu, '');
}