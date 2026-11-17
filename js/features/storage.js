import { state } from '../state.js';
import { TEMPLATE_REGISTRY } from '../templates/index.js';
import { renderChartOnCanvas } from '../templates/math-chart.js';
import { reflowPages } from '../core/pagination.js';
import { renumberBlocks, refreshAllPagesInteraction, openChartModal } from '../core/blockManager.js';

const DB_NAME = 'QDocEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'autosave_docs';
const AUTOSAVE_KEY = 'current_workspace';

let isDirty = false;
let isSaving = false;
let autosaveTimer = null;

/**
 * 初始化 IndexedDB 自動存檔（每 5 秒檢查並背景寫入）、存檔狀態圖標，以及 .json 匯出／匯入
 */
export async function initStorageManager() {
  const statusEl = document.getElementById('save-status-indicator');
  const titleInput = document.getElementById('doc-title-input');
  const pagesContainer = document.getElementById('pages-container');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnImportJson = document.getElementById('btn-import-json');
  const fileImportInput = document.getElementById('file-import-json');

  // 1. 啟動時檢查 IndexedDB 是否有上次未清空的自動存檔，若有則無痛還原
  try {
    const savedSnapshot = await loadSnapshotFromDB();
    if (savedSnapshot && Array.isArray(savedSnapshot.blocks) && savedSnapshot.blocks.length > 0) {
      applySnapshotToWorkspace(savedSnapshot);
      setSaveStatus('saved', savedSnapshot.savedAt);
    } else {
      setSaveStatus('saved');
    }
  } catch (err) {
    console.warn('IndexedDB 讀取略過：', err);
    setSaveStatus('unsaved');
  }

  // 2. 標記「尚未存檔」的監聽器（任何輸入、增刪題目、下拉選單調整皆觸發）
  const markDirty = () => {
    if (!isDirty) {
      isDirty = true;
      setSaveStatus('unsaved');
    }
  };

  if (titleInput) titleInput.addEventListener('input', markDirty);
  if (pagesContainer) {
    pagesContainer.addEventListener('input', markDirty);
    const observer = new MutationObserver(() => markDirty());
    observer.observe(pagesContainer, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  }

  [
    'select-font-family',
    'select-font-size',
    'select-line-height',
    'select-paper-size',
    'select-column-layout',
    'select-column-divider',
    'select-header-template'
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', markDirty);
  });

  // 3. 點擊存檔狀態小圖標可立即手動觸發存檔
  if (statusEl) {
    statusEl.addEventListener('click', () => {
      performAutosave(true);
    });
  }

  // 4. 每 5 秒自動檢查若有未存檔變更，則背景寫入 IndexedDB
  autosaveTimer = setInterval(() => {
    if (isDirty && !isSaving) {
      performAutosave(false);
    }
  }, 5000);

  // 5. 匯出 .json 專案檔（檔名格式：(目前考卷名稱)_(年年年年月月日日).json）
  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      const snapshot = collectWorkspaceSnapshot();
      const jsonStr = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const rawTitle = (snapshot.docTitle || '未命名學習單與考卷').trim() || '未命名學習單與考卷';
      const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '_');
      const dateStr = formatDateYYYYMMDD();

      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeTitle}_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);

      performAutosave(true);
    });
  }

  // 6. 匯入 .json 專案檔
  if (btnImportJson && fileImportInput) {
    btnImportJson.addEventListener('click', () => fileImportInput.click());
    fileImportInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          if (!parsed || !Array.isArray(parsed.blocks)) {
            alert('檔案格式不符，請選擇由奇蹟編輯器 (Q-doc) 匯出的 .json 專案檔！');
            return;
          }
          if (confirm('匯入專案將會覆蓋目前畫布上的考卷內容，確定要匯入嗎？')) {
            applySnapshotToWorkspace(parsed);
            performAutosave(true);
          }
        } catch {
          alert('JSON 檔案解析失敗，請確認檔案是否損毀。');
        }
      };
      reader.readAsText(file);
      fileImportInput.value = '';
    });
  }
}

async function performAutosave(force = false) {
  if (!force && !isDirty) return;
  isSaving = true;
  setSaveStatus('saving');

  try {
    const snapshot = collectWorkspaceSnapshot();
    await saveSnapshotToDB(snapshot);
    isDirty = false;
    setSaveStatus('saved', snapshot.savedAt);
  } catch (err) {
    console.error('自動存檔失敗：', err);
    setSaveStatus('unsaved');
  } finally {
    isSaving = false;
  }
}

function setSaveStatus(status, timestampStr) {
  const statusEl = document.getElementById('save-status-indicator');
  if (!statusEl) return;

  statusEl.classList.remove('status-unsaved', 'status-saving', 'status-saved');

  if (status === 'unsaved') {
    statusEl.classList.add('status-unsaved');
    statusEl.innerHTML = '<span class="save-dot"></span> 尚未存檔';
    statusEl.title = '有尚未儲存的變更（系統將於 5 秒內自動存檔，或點擊此處立即儲存）';
  } else if (status === 'saving') {
    statusEl.classList.add('status-saving');
    statusEl.innerHTML = '<span class="save-spinner">↻</span> 存檔中...';
    statusEl.title = '正在將考卷寫入本機離線資料庫...';
  } else {
    statusEl.classList.add('status-saved');
    const timeLabel = timestampStr || formatNowTime();
    statusEl.innerHTML = `<span class="save-dot"></span> 已存檔 ${timeLabel}`;
    statusEl.title = `已自動儲存於本機瀏覽器（最後更新：${timeLabel}）`;
  }
}

function formatNowTime() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDateYYYYMMDD() {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/**
 * 收集目前整份考卷的完整狀態與題目卡片資料
 */
export function collectWorkspaceSnapshot() {
  const docTitle = document.getElementById('doc-title-input')?.value || '未命名學習單與考卷';
  const headerHtml = document.getElementById('exam-header-slot')?.innerHTML || '';
  const fontSize = document.getElementById('select-font-size')?.value || '14pt';
  const lineHeight = document.getElementById('select-line-height')?.value || '1.8';

  const blocks = Array.from(document.querySelectorAll('.paper-page .question-block')).map((block) => {
    const bodyEl = block.querySelector('.block-body');
    const canvasEl = block.querySelector('canvas');
    return {
      templateId: block.dataset.templateId || 'fill-in-blank',
      bodyHtml: bodyEl ? bodyEl.innerHTML : '',
      chartConfig: canvasEl && canvasEl._qdocConfig ? canvasEl._qdocConfig : null
    };
  });

  return {
    version: '1.0',
    savedAt: formatNowTime(),
    docTitle,
    settings: {
      paperSize: state.paperSize,
      columnLayout: state.columnLayout || '1',
      columnDivider: state.columnDivider || 'none',
      headerTemplate: state.headerTemplate,
      fontFamily: state.fontFamily,
      fontSize,
      lineHeight
    },
    headerHtml,
    blocks
  };
}

/**
 * 將專案快照還原回畫布，並重新綁定所有題型按鈕、拖曳、圖片縮放與圖表渲染
 */
export function applySnapshotToWorkspace(snapshot) {
  const titleInput = document.getElementById('doc-title-input');
  if (titleInput && snapshot.docTitle) {
    titleInput.value = snapshot.docTitle;
  }

  // 還原工具列下拉選單設定
  const s = snapshot.settings || {};
  if (s.paperSize) {
    const paperSel = document.getElementById('select-paper-size');
    if (paperSel) {
      paperSel.value = s.paperSize;
      paperSel.dispatchEvent(new Event('change'));
    }
  }

  const colSel = document.getElementById('select-column-layout');
  if (colSel) {
    colSel.value = s.columnLayout === '2' ? '2' : '1';
    colSel.dispatchEvent(new Event('change'));
  }

  const divSel = document.getElementById('select-column-divider');
  if (divSel) {
    divSel.value = ['none', 'dashed', 'solid'].includes(s.columnDivider) ? s.columnDivider : 'none';
    divSel.dispatchEvent(new Event('change'));
  }

  if (s.headerTemplate) {
    const hdrSel = document.getElementById('select-header-template');
    if (hdrSel) {
      hdrSel.value = s.headerTemplate;
      hdrSel.dispatchEvent(new Event('change'));
    }
  }
  if (typeof snapshot.headerHtml === 'string') {
    const headerSlot = document.getElementById('exam-header-slot');
    if (headerSlot) headerSlot.innerHTML = snapshot.headerHtml;
  }
  if (s.fontFamily) {
    const fontSel = document.getElementById('select-font-family');
    if (fontSel) {
      fontSel.value = s.fontFamily;
      fontSel.dispatchEvent(new Event('change'));
    }
  }
  if (s.fontSize) {
    const sizeSel = document.getElementById('select-font-size');
    if (sizeSel) {
      sizeSel.value = s.fontSize;
      sizeSel.dispatchEvent(new Event('change'));
    }
  }
  if (s.lineHeight) {
    const lhSel = document.getElementById('select-line-height');
    if (lhSel) {
      lhSel.value = s.lineHeight;
      lhSel.dispatchEvent(new Event('change'));
    }
  }

  // 清空現有頁面並將所有題目放入第一頁，再由 reflowPages() 自動精準分頁
  const container = document.getElementById('pages-container');
  container.querySelectorAll('.paper-page:not(#page-1)').forEach((p) => p.remove());
  const firstBox = document.querySelector('#page-1 .blocks-container');
  firstBox.innerHTML = '';

  snapshot.blocks.forEach((item) => {
    const tpl = TEMPLATE_REGISTRY.find((t) => t.id === item.templateId);
    const block = document.createElement('div');
    block.className = 'question-block';
    block.dataset.templateId = item.templateId;
    block.innerHTML = `
      <div class="block-drag-handle" title="按住上下拖曳調整題目順序" aria-label="拖曳排序">⋮⋮</div>
      <div class="block-actions">
        <div class="block-custom-controls"></div>
        <div class="block-sys-controls">
          <button type="button" class="block-act-btn dup" title="複製此題">複製</button>
          <button type="button" class="block-act-btn del" title="刪除此題">刪除</button>
        </div>
      </div>
      <div class="block-body">${item.bodyHtml}</div>
    `;

    // 若存檔時 .tpl-inline-controls 已被移動到 .block-custom-controls，需補回按鈕列
    const customSlot = block.querySelector('.block-custom-controls');
    const inlineControls = block.querySelectorAll('.block-body .tpl-inline-controls');
    if (inlineControls.length > 0) {
      inlineControls.forEach((ctrl) => customSlot.appendChild(ctrl));
    } else if (tpl) {
      // 從原始模板擷取控制按鈕列還原至右上角
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = tpl.createContent();
      const origCtrls = tempDiv.querySelectorAll('.tpl-inline-controls');
      if (origCtrls.length > 0) {
        origCtrls.forEach((ctrl) => customSlot.appendChild(ctrl));
      } else {
        customSlot.style.display = 'none';
      }
    } else {
      customSlot.style.display = 'none';
    }

    // 綁定複製與刪除
    block.querySelector('.dup').addEventListener('click', () => {
      const cloned = block.cloneNode(true);
      block.after(cloned);
      rebindRestoredBlockEvents(cloned, tpl, item.chartConfig);
      renumberBlocks();
      reflowPages();
      refreshAllPagesInteraction();
    });

    block.querySelector('.del').addEventListener('click', () => {
      block.remove();
      renumberBlocks();
      reflowPages();
    });

    firstBox.appendChild(block);
    rebindRestoredBlockEvents(block, tpl, item.chartConfig);
  });

  renumberBlocks();
  reflowPages();
  refreshAllPagesInteraction();
  isDirty = false;
}

function rebindRestoredBlockEvents(block, tpl, savedChartConfig) {
  if (tpl && tpl.bindEvents) {
    // 若為統計圖表，先綁定事件再套用儲存的圖表數據重繪
    tpl.bindEvents(block, openChartModal);
    if (savedChartConfig) {
      const canvas = block.querySelector('canvas');
      if (canvas) renderChartOnCanvas(canvas, savedChartConfig);
    }
  }

  // 重新綁定已存在的圖片放大／縮小／刪除按鈕
  block.querySelectorAll('.opt-img-preview, .passage-wrap-img-box').forEach((previewBox) => {
    const img = previewBox.querySelector('img');
    const btnIn = previewBox.querySelector('.zoom-in');
    const btnOut = previewBox.querySelector('.zoom-out');
    const btnDel = previewBox.querySelector('.img-del');
    if (!img) return;

    if (btnIn) {
      btnIn.addEventListener('click', (e) => {
        e.stopPropagation();
        img.style.width = `${Math.min(560, (img.offsetWidth || 120) + 20)}px`;
        reflowPages();
      });
    }
    if (btnOut) {
      btnOut.addEventListener('click', (e) => {
        e.stopPropagation();
        img.style.width = `${Math.max(40, (img.offsetWidth || 120) - 20)}px`;
        reflowPages();
      });
    }
    if (btnDel) {
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        if (previewBox.classList.contains('passage-wrap-img-box')) {
          previewBox.parentElement.innerHTML = '';
        } else {
          previewBox.remove();
        }
        reflowPages();
      });
    }
  });
}

/* --- 原生 IndexedDB 輕量封裝 --- */
function openQDocDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('瀏覽器不支援 IndexedDB'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveSnapshotToDB(data) {
  const db = await openQDocDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, AUTOSAVE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadSnapshotFromDB() {
  const db = await openQDocDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(AUTOSAVE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearAutosaveDB() {
  const db = await openQDocDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(AUTOSAVE_KEY);
    tx.oncomplete = () => {
      isDirty = false;
      setSaveStatus('saved');
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}