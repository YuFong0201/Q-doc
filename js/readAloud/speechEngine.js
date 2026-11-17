// Web Speech API (zh-TW 台灣國語) 語音報讀與破音字讀音校準引擎

let currentHighlightEl = null;
let speechRate = 1.0;

export function setSpeechRate(rate) {
  speechRate = parseFloat(rate) || 1.0;
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  clearSpeakingHighlight();
}

export function clearSpeakingHighlight() {
  if (currentHighlightEl) {
    currentHighlightEl.classList.remove('ra-speaking-highlight');
    currentHighlightEl = null;
  }
}

/**
 * 將 DOM 區塊轉換為適合台灣國語語音引擎朗讀的純文字：
 * 1. 排除工具列按鈕與隱藏控制項
 * 2. 讀取老師設定的破音字讀音 (data-reading) 避免誤讀
 * 3. 將作答括號（ ）轉為自然的停頓語氣
 */
export function extractReadableText(rootEl) {
  const clone = rootEl.cloneNode(true);

  // 移除非題目文字的控制元件
  clone.querySelectorAll(
    '.ra-speak-block-btn, .tpl-inline-controls, .block-actions, .block-drag-handle, .opt-img-trigger, .img-resize-toolbar, .subq-opt-controls'
  ).forEach((el) => el.remove());

  // 破音字精準校準：若老師有指定讀音，替換為讀音標記供 TTS 參考
  clone.querySelectorAll('.char-token[data-reading]').forEach((token) => {
    const reading = token.dataset.reading;
    if (reading) {
      token.textContent = `${token.dataset.baseChar}（${reading}）`;
    }
  });

  // 針對「純注音框 (.bopo-only-box)」提示為注音題
  clone.querySelectorAll('.bopo-only-box').forEach((box) => {
    const txt = box.textContent.trim();
    if (txt) {
      box.textContent = `注音 ${txt} `;
    }
  });

  let text = clone.textContent || '';
  text = text
    .replace(/\s+/g, ' ')
    .replace(/（\s*）/g, '，括號，')
    .replace(/\(\s*\)/g, '，括號，')
    .replace(/_+/g, '，空格，')
    .trim();

  return text;
}

export function speakElement(targetEl) {
  if (!('speechSynthesis' in window)) {
    alert('您的瀏覽器不支援語音朗讀功能，建議使用 Chrome 或 Edge 瀏覽器。');
    return;
  }

  stopSpeaking();

  const text = extractReadableText(targetEl);
  if (!text) return;

  targetEl.classList.add('ra-speaking-highlight');
  currentHighlightEl = targetEl;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-TW';
  utterance.rate = speechRate;
  utterance.pitch = 1.0;

  // 優先挑選台灣國語女聲/自然語音
  const voices = window.speechSynthesis.getVoices();
  const twVoice = voices.find((v) => v.lang === 'zh-TW' && v.name.includes('Google'))
    || voices.find((v) => v.lang === 'zh-TW' || v.lang === 'zh_TW');
  if (twVoice) {
    utterance.voice = twVoice;
  }

  utterance.onend = () => clearSpeakingHighlight();
  utterance.onerror = () => clearSpeakingHighlight();

  window.speechSynthesis.speak(utterance);
}