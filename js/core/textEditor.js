import { updateState } from '../state.js';
import { reflowPages } from './pagination.js';

const FONT_CONFIG_MAP = {
  BpmfZihiKaiStd: {
    hasBopomofo: true,
    bopoFont: '"BpmfZihiKaiStd", "DFKai-SB", "標楷體", serif',
    plainFont: '"DFKai-SB", "標楷體", "Noto Serif TC", serif'
  },
  BpmfZihiSansRegular: {
    hasBopomofo: true,
    bopoFont: '"BpmfZihiSansRegular", "Microsoft JhengHei", "PingFang TC", sans-serif',
    plainFont: '"Microsoft JhengHei", "PingFang TC", sans-serif'
  },
  BpmfZihiSansBold: {
    hasBopomofo: true,
    bopoFont: '"BpmfZihiSansBold", "Microsoft JhengHei", "PingFang TC", sans-serif',
    plainFont: '"Microsoft JhengHei", "PingFang TC", sans-serif'
  },
  DFKaiPlain: {
    hasBopomofo: false,
    // 當全卷為無注音標楷體時，若老師針對單一破音字或生字開啟注音，預設使用字嗨注音標楷呈現
    bopoFont: '"BpmfZihiKaiStd", "DFKai-SB", "標楷體", serif',
    plainFont: '"DFKai-SB", "標楷體", "Noto Serif TC", serif'
  }
};

export function initTextEditor() {
  const fontFamilySelect = document.getElementById('select-font-family');
  const fontSizeSelect = document.getElementById('select-font-size');
  const lineHeightSelect = document.getElementById('select-line-height');
  const colorInput = document.getElementById('input-text-color');

  // 取得所有頁面的題目容器（包含第 1 頁與動態新增的第 2、3... 頁）
  const getAllPageContainers = () => document.querySelectorAll('.paper-page .blocks-container');

  // 初始化 CSS 變數，確保所有現存與未來新增的分頁統一繼承
  if (fontSizeSelect?.value) {
    document.documentElement.style.setProperty('--paper-font-size', fontSizeSelect.value);
  }
  if (lineHeightSelect?.value) {
    document.documentElement.style.setProperty('--paper-line-height', lineHeightSelect.value);
  }

  const applyFontSelection = (selectedFont, shouldReflow = true) => {
    const config = FONT_CONFIG_MAP[selectedFont];
    if (!config) return;

    document.documentElement.style.setProperty('--active-bopomofo-font', config.bopoFont);
    document.documentElement.style.setProperty('--font-plain', config.plainFont);

    getAllPageContainers().forEach((container) => {
      container.classList.toggle('bopo-default-on', config.hasBopomofo);
      container.classList.toggle('bopo-default-off', !config.hasBopomofo);

      // 清除因複製貼上或富文本編輯殘留的內聯 font-family，確保全卷字體切換 100% 生效
      container.querySelectorAll('[style*="font-family"]').forEach((el) => {
        el.style.removeProperty('font-family');
      });
      container.querySelectorAll('font[face]').forEach((fontEl) => {
        fontEl.removeAttribute('face');
      });

      // 若切回無注音模式，已手動選過破音讀音的字仍自動維持強制顯示注音
      container.querySelectorAll('.char-token').forEach((token) => {
        const ivs = parseInt(token.dataset.ivsIndex || '0', 10);
        if (!config.hasBopomofo && ivs > 0 && !token.classList.contains('hide-bopo')) {
          token.classList.add('force-bopo');
        }
      });
    });

    updateState('bopomofoDefaultOn', config.hasBopomofo);
    updateState('fontFamily', selectedFont);
    if (shouldReflow) reflowPages();
  };

  // 啟動時立即同步一次預設字體狀態
  if (fontFamilySelect?.value) {
    applyFontSelection(fontFamilySelect.value, false);
  }

  // 切換字體（含三款注音字體與無注音標楷體）
  if (fontFamilySelect) {
    fontFamilySelect.addEventListener('change', (e) => {
      applyFontSelection(e.target.value, true);
    });
  }

  // 粗體、斜體、底線、對齊指令
  document.querySelectorAll('[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      document.execCommand(cmd, false, null);
    });
  });

  // 調整字體大小（同步套用至全卷所有頁面並重新計算分頁）
  if (fontSizeSelect) {
    fontSizeSelect.addEventListener('change', (e) => {
      const newSize = e.target.value;
      document.documentElement.style.setProperty('--paper-font-size', newSize);
      getAllPageContainers().forEach((container) => {
        container.style.fontSize = newSize;
      });
      reflowPages();
    });
  }

  // 調整行距（同步套用至全卷所有頁面並重新計算分頁）
  if (lineHeightSelect) {
    lineHeightSelect.addEventListener('change', (e) => {
      const newLineHeight = e.target.value;
      document.documentElement.style.setProperty('--paper-line-height', newLineHeight);
      getAllPageContainers().forEach((container) => {
        container.style.lineHeight = newLineHeight;
      });
      reflowPages();
    });
  }

  // 調整選取文字顏色
  if (colorInput) {
    colorInput.addEventListener('input', (e) => {
      document.execCommand('foreColor', false, e.target.value);
    });
  }
}