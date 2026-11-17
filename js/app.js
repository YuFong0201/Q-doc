import { loadFontsWithProgress } from './core/fontLoader.js';
import { initPaperManager } from './core/paperManager.js';
import { initHeaderManager } from './core/headerManager.js';
import { initTextEditor } from './core/textEditor.js';
import { initPolyphoneDetector } from './bopomofo/polyphoneDetector.js';
import { initBlockManager } from './core/blockManager.js';
import { initPagination } from './core/pagination.js';
import { initReadAloudMode } from './readAloud/readAloudUI.js';
import { initAnswerKeyToggle } from './features/answerKeyToggle.js';
import { initScoreCalculator } from './features/scoreCalculator.js';
import { initCanvasImageDrop } from './features/imageHandler.js';
import { initStorageManager, clearAutosaveDB } from './features/storage.js';
import { initVocabChecker } from './features/vocabChecker.js';
import { initQuizExporter } from './features/quizExporter.js';

async function bootstrap() {
  // 1. 依序串流載入字嗨注音字體並更新湖水藍進度條
  await loadFontsWithProgress([
    {
      url: 'assets/fonts/BpmfZihiKaiStd-Regular.ttf',
      family: 'BpmfZihiKaiStd',
      label: '字嗨注音標楷'
    },
    {
      url: 'assets/fonts/BpmfZihiSans-Regular.ttf',
      family: 'BpmfZihiSansRegular',
      label: '字嗨注音黑體 (標準)'
    },
    {
      url: 'assets/fonts/BpmfZihiSans-Bold.ttf',
      family: 'BpmfZihiSansBold',
      label: '字嗨注音黑體 (粗體)'
    },
    {
      url: 'assets/fonts/BpmfZihiOnly-R.ttf',
      family: 'BpmfZihiOnly',
      label: '字嗨純注音'
    }
  ]);

  // 2. 初始化頂部 Ribbon 分頁切換
  initTabs();

  // 3. 初始化核心、破音字引擎、題型積木庫與自動分頁器
  initPaperManager();
  initHeaderManager();
  initTextEditor();
  await initPolyphoneDetector();
  initBlockManager();
  initPagination();

  // 4. 初始化第三階段：無障礙報讀模式、教師解答切換、即時總分計算器與圖片拖曳壓縮
  initReadAloudMode();
  initAnswerKeyToggle();
  initScoreCalculator();
  initCanvasImageDrop();

  // 5. 初始化第四階段：IndexedDB 自動存檔、專案匯出匯入、生難字檢查與互動測驗匯出
  await initStorageManager();
  initVocabChecker();
  initQuizExporter();

  // 6. 註冊 PWA Service Worker（支援離線安裝與教室無網路使用）
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // 7. 綁定清空重來與列印按鈕
  document.getElementById('btn-clear-paper').addEventListener('click', async () => {
    if (confirm('確定要清空目前考卷上的所有題目嗎？（此動作也會清除本機暫存檔）')) {
      const container = document.getElementById('pages-container');
      container.querySelectorAll('.paper-page:not(#page-1)').forEach((p) => p.remove());
      document.querySelector('#page-1 .blocks-container').innerHTML = '';
      await clearAutosaveDB();
    }
  });

  document.getElementById('btn-print').addEventListener('click', () => {
    window.print();
  });
}

function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.ribbon-panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      panels.forEach((p) => (p.hidden = true));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const targetId = tab.getAttribute('data-tab');
      document.getElementById(targetId).hidden = false;
    });
  });
}

document.addEventListener('DOMContentLoaded', bootstrap);