import { state, updateState } from '../state.js';
import { reflowPages } from './pagination.js';

export function initPaperManager() {
  const sizeSelect = document.getElementById('select-paper-size');
  const colSelect = document.getElementById('select-column-layout');
  const dividerSelect = document.getElementById('select-column-divider');

  // 1. 切換 A4/B4 直向與橫向
  if (sizeSelect) {
    sizeSelect.addEventListener('change', (e) => {
      const newSize = e.target.value;
      updateState('paperSize', newSize);

      document.querySelectorAll('.paper-page').forEach((p) => {
        p.classList.remove('a4-portrait', 'a4-landscape', 'b4-portrait', 'b4-landscape');
        p.classList.add(newSize);
      });

      updateDynamicPrintPage();
      reflowPages();
    });
  }

  // 2. 切換單欄 / 雙欄（並自動控制分隔線選單的啟用/反白狀態）
  if (colSelect) {
    colSelect.addEventListener('change', (e) => {
      const cols = e.target.value === '2' ? '2' : '1';
      updateState('columnLayout', cols);

      if (dividerSelect) {
        dividerSelect.disabled = cols !== '2';
      }

      applyColumnClassesToAllPages();
      reflowPages();
    });
  }

  // 3. 切換雙欄中央垂直分隔線（留白 / 虛線 / 實線）
  if (dividerSelect) {
    dividerSelect.addEventListener('change', (e) => {
      const validDividers = ['none', 'dashed', 'solid'];
      const divider = validDividers.includes(e.target.value) ? e.target.value : 'none';
      updateState('columnDivider', divider);

      applyColumnClassesToAllPages();
    });
  }

  // 初始化套用狀態
  if (dividerSelect) {
    dividerSelect.disabled = state.columnLayout !== '2';
  }
  applyColumnClassesToAllPages();
  updateDynamicPrintPage();
}

// 將目前的欄數與分隔線樣式套用至所有頁面的 .blocks-container
export function applyColumnClassesToAllPages() {
  const cols = state.columnLayout === '2' ? '2' : '1';
  const divider = ['none', 'dashed', 'solid'].includes(state.columnDivider) ? state.columnDivider : 'none';

  document.querySelectorAll('.paper-page .blocks-container').forEach((box) => {
    box.classList.remove('cols-1', 'cols-2', 'divider-none', 'divider-dashed', 'divider-solid');
    box.classList.add(`cols-${cols}`);
    if (cols === '2') {
      box.classList.add(`divider-${divider}`);
    }
  });
}

// 同步更新列印時的 @page 紙張大小與方向
function updateDynamicPrintPage() {
  const styleTag = document.getElementById('dynamic-page-style');
  if (!styleTag) return;

  const isB4 = state.paperSize.startsWith('b4');
  const isLandscape = state.paperSize.endsWith('-landscape');
  const sizeStr = isB4 ? 'B4' : 'A4';
  const orientStr = isLandscape ? 'landscape' : 'portrait';
  styleTag.textContent = `@page { size: ${sizeStr} ${orientStr}; margin: 0; }`;
}