import { speakElement, stopSpeaking, setSpeechRate } from './speechEngine.js';
import { reflowPages } from '../core/pagination.js';

let isReadAloudActive = false;

export function initReadAloudMode() {
  const btnToggle = document.getElementById('btn-toggle-read-aloud');
  const raBar = document.getElementById('read-aloud-bar');
  const btnStop = document.getElementById('btn-ra-stop');
  const btnExit = document.getElementById('btn-ra-exit');
  const speedSelect = document.getElementById('select-ra-speed');
  const pagesContainer = document.getElementById('pages-container');

  if (!btnToggle || !raBar) return;

  // 預先觸發瀏覽器載入語音清單
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
  }

  btnToggle.addEventListener('click', () => {
    if (isReadAloudActive) {
      exitReadAloudMode();
    } else {
      enterReadAloudMode();
    }
  });

  btnExit.addEventListener('click', exitReadAloudMode);
  btnStop.addEventListener('click', stopSpeaking);
  speedSelect.addEventListener('change', (e) => setSpeechRate(e.target.value));

  // 報讀模式下的委派點擊朗讀（唸整題按鈕 / 單一選項 / 例題與段落）
  pagesContainer.addEventListener('click', (e) => {
    if (!isReadAloudActive) return;

    // 1. 點擊「🔊 唸整題」按鈕
    const speakBlockBtn = e.target.closest('.ra-speak-block-btn');
    if (speakBlockBtn) {
      e.preventDefault();
      e.stopPropagation();
      const block = speakBlockBtn.closest('.question-block');
      if (block) speakElement(block);
      return;
    }

    // 2. 點擊已標記的選項、題幹或例題區塊（優先取最內層的子區塊，避免整列一起亮起）
    const clickableTarget = e.target.closest('.ra-clickable-target');
    if (clickableTarget) {
      e.preventDefault();
      e.stopPropagation();
      speakElement(clickableTarget);
    }
  });
}

function enterReadAloudMode() {
  isReadAloudActive = true;
  document.body.classList.add('read-aloud-mode');
  document.getElementById('read-aloud-bar').hidden = false;

  const btnToggle = document.getElementById('btn-toggle-read-aloud');
  btnToggle.textContent = '✏️ 返回編輯模式';
  btnToggle.classList.add('active');

  // 暫時關閉 contenteditable 避免學生誤改題目或跳出虛擬鍵盤
  document.querySelectorAll('.paper-page [contenteditable="true"]').forEach((el) => {
    el.dataset.wasEditable = 'true';
    el.setAttribute('contenteditable', 'false');
  });

  // 為每題注入「🔊 唸整題」按鈕，並標記所有題型的可點擊朗讀子區塊
  document.querySelectorAll('.question-block').forEach((block) => {
    if (!block.querySelector('.ra-speak-block-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ra-speak-block-btn';
      btn.innerHTML = '🔊 唸整題';
      btn.setAttribute('aria-label', '朗讀整道題目');
      block.insertBefore(btn, block.firstChild);
    }

    // 涵蓋所有 12 種題型的題幹、選項、例題與子段落
    const targetSelectors = [
      '.tpl-section-header',      // 大題標題列
      '.mc-stem-row',             // 選擇題題幹
      '.mc-opt-item',             // 選擇題 / 閱讀測驗選項
      '.hanging-stem-row',        // 通用懸掛題幹（填充、簡答、圈選、短語、注音、應用題等）
      '.circle-option-item',      // 圈選題個別選項
      '.pattern-box',             // 短語練習 / 照樣造句例題列
      '.match-item-box',          // 連連看左右項目框
      '.vocab-tag-box',           // 造句練習詞彙框
      '.char-box-unit',           // 國字注音單元格
      '.passage-text',            // 閱讀測驗短文
      '.reading-subq-stem',       // 閱讀測驗子題題幹
      '.word-problem-area'        // 數學應用題作答區
    ].join(', ');

    block.querySelectorAll(targetSelectors).forEach((el) => {
      // 確認該元素內確實有可朗讀的文字（排除純空白作答框）
      if (el.textContent && el.textContent.trim().length > 0) {
        el.classList.add('ra-clickable-target');
      }
    });

    // 備援檢查：若某些自訂題型或簡答題還有直接放在 .block-body 下的純文字段落，也一併設為可點擊朗讀
    const bodyEl = block.querySelector('.block-body');
    if (bodyEl) {
      Array.from(bodyEl.children).forEach((child) => {
        if (
          !child.classList.contains('ra-clickable-target') &&
          !child.querySelector('.ra-clickable-target') &&
          !child.classList.contains('answer-lines-box') &&
          !child.classList.contains('chart-block-wrapper') &&
          child.textContent &&
          child.textContent.trim().length > 0
        ) {
          child.classList.add('ra-clickable-target');
        }
      });
    }
  });

  // 字體放大與注入按鈕後，立即重新計算分頁，確保超出第一頁的題目自動順移至下一頁
  requestAnimationFrame(() => {
    reflowPages();
  });
}

function exitReadAloudMode() {
  isReadAloudActive = false;
  stopSpeaking();
  document.body.classList.remove('read-aloud-mode');
  document.getElementById('read-aloud-bar').hidden = true;

  const btnToggle = document.getElementById('btn-toggle-read-aloud');
  btnToggle.textContent = '🔊 無障礙報讀模式';
  btnToggle.classList.remove('active');

  // 恢復所有可編輯區域
  document.querySelectorAll('.paper-page [data-was-editable="true"]').forEach((el) => {
    el.setAttribute('contenteditable', 'true');
    delete el.dataset.wasEditable;
  });

  // 移除報讀模式專用按鈕與高亮標記
  document.querySelectorAll('.ra-speak-block-btn').forEach((btn) => btn.remove());
  document.querySelectorAll('.ra-clickable-target').forEach((el) => {
    el.classList.remove('ra-clickable-target');
  });

  // 恢復原本字體大小後重新計算分頁並收合多餘的空白頁
  requestAnimationFrame(() => {
    reflowPages();
  });
}