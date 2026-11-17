import { TEMPLATE_REGISTRY } from '../templates/index.js';
import { scanAndWrapChars } from '../bopomofo/polyphoneDetector.js';
import { reflowPages } from './pagination.js';

const CHINESE_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const DEFAULT_PALETTE = ['#009FB7', '#FE4A49', '#222629', '#38bdf8', '#f59e0b', '#10b981', '#8b5cf6'];
let draggedTemplateId = null;
let dropIndicator = null;

export function initBlockManager() {
  dropIndicator = document.createElement('div');
  dropIndicator.className = 'drop-indicator-line';

  renderTemplateSidebar('全部');
  initSubjectFilters();
  setupPageDropZone(document.querySelector('#page-1 .blocks-container'));
  initSortableOnContainer(document.querySelector('#page-1 .blocks-container'));
  initChartModal();
}

function initSubjectFilters() {
  const filterBar = document.getElementById('subject-filter-bar');
  filterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.subject-tag');
    if (!btn) return;
    filterBar.querySelectorAll('.subject-tag').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    renderTemplateSidebar(btn.dataset.subject);
  });
}

function renderTemplateSidebar(selectedSubject) {
  const listEl = document.getElementById('template-list');
  listEl.innerHTML = '';

  const filtered = selectedSubject === '全部'
    ? TEMPLATE_REGISTRY
    : TEMPLATE_REGISTRY.filter((tpl) => tpl.subjects.includes(selectedSubject));

  filtered.forEach((tpl) => {
    const card = document.createElement('div');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('draggable', 'true');
    card.className = 'tpl-card-btn';
    card.dataset.templateId = tpl.id;
    card.title = '點擊插入考卷，或直接按住拖曳至考卷指定位置';
    card.innerHTML = `
      <span class="tpl-icon">${tpl.icon}</span>
      <span class="tpl-info">
        <span class="tpl-name">${tpl.name}</span>
        <span class="tpl-tags-mini">${tpl.subjects.join(' · ')}</span>
      </span>
    `;

    card.addEventListener('click', () => {
      insertTemplateBlock(tpl);
    });

    card.addEventListener('dragstart', (e) => {
      draggedTemplateId = tpl.id;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', tpl.id);
      card.style.opacity = '0.5';
    });

    card.addEventListener('dragend', () => {
      draggedTemplateId = null;
      card.style.opacity = '1';
      removeDropIndicator();
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        insertTemplateBlock(tpl);
      }
    });

    listEl.appendChild(card);
  });
}

function setupPageDropZone(container) {
  if (!container || container._dropZoneInit) return;
  container._dropZoneInit = true;

  container.addEventListener('dragover', (e) => {
    if (!draggedTemplateId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    container.classList.add('drag-over-active');

    const afterElement = getDragAfterElement(container, e.clientY);
    if (afterElement == null) {
      container.appendChild(dropIndicator);
    } else {
      container.insertBefore(dropIndicator, afterElement);
    }
  });

  container.addEventListener('dragleave', (e) => {
    if (!container.contains(e.relatedTarget)) {
      container.classList.remove('drag-over-active');
      removeDropIndicator();
    }
  });

  container.addEventListener('drop', (e) => {
    if (!draggedTemplateId) return;
    e.preventDefault();
    container.classList.remove('drag-over-active');

    const tpl = TEMPLATE_REGISTRY.find((t) => t.id === draggedTemplateId);
    if (tpl) {
      const newBlock = createQuestionBlockElement(tpl);
      if (dropIndicator.parentNode === container) {
        container.insertBefore(newBlock, dropIndicator);
      } else {
        container.appendChild(newBlock);
      }
      scanAndWrapChars(newBlock);
      renumberBlocks();
      reflowPages();
      refreshAllPagesInteraction();
    }

    removeDropIndicator();
    draggedTemplateId = null;
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.question-block')];
  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

function removeDropIndicator() {
  if (dropIndicator && dropIndicator.parentNode) {
    dropIndicator.parentNode.removeChild(dropIndicator);
  }
}

// 建立標準題型卡片 DOM，並自動將題型調整按鈕整併至右上角「複製 / 刪除」左側
function createQuestionBlockElement(tpl) {
  const block = document.createElement('div');
  block.className = 'question-block';
  block.dataset.templateId = tpl.id;
  block.innerHTML = `
    <div class="block-drag-handle" title="按住上下拖曳調整題目順序" aria-label="拖曳排序">⋮⋮</div>
    <div class="block-actions">
      <div class="block-custom-controls"></div>
      <div class="block-sys-controls">
        <button type="button" class="block-act-btn dup" title="複製此題">複製</button>
        <button type="button" class="block-act-btn del" title="刪除此題">刪除</button>
      </div>
    </div>
    <div class="block-body">${tpl.createContent()}</div>
  `;

  // 將模板內部的微調按鈕（.tpl-inline-controls）統一整併到右上角浮動列左側並加上視覺區隔
  const customSlot = block.querySelector('.block-custom-controls');
  const inlineControls = block.querySelectorAll('.block-body .tpl-inline-controls');
  if (inlineControls.length > 0) {
    inlineControls.forEach((ctrl) => {
      customSlot.appendChild(ctrl);
    });
  } else {
    customSlot.style.display = 'none';
  }

  block.querySelector('.dup').addEventListener('click', () => {
    const cloneEl = createQuestionBlockElement(tpl);
    block.after(cloneEl);
    scanAndWrapChars(cloneEl);
    renumberBlocks();
    reflowPages();
    refreshAllPagesInteraction();
  });

  block.querySelector('.del').addEventListener('click', () => {
    block.remove();
    renumberBlocks();
    reflowPages();
  });

  if (tpl.bindEvents) {
    tpl.bindEvents(block, openChartModal);
  }

  return block;
}

function insertTemplateBlock(tpl) {
  const pages = document.querySelectorAll('.paper-page');
  const lastPageBox = pages[pages.length - 1].querySelector('.blocks-container');

  const block = createQuestionBlockElement(tpl);
  lastPageBox.appendChild(block);

  scanAndWrapChars(block);
  renumberBlocks();
  reflowPages();
  refreshAllPagesInteraction();
}

export function refreshAllPagesInteraction() {
  document.querySelectorAll('.blocks-container').forEach((box) => {
    setupPageDropZone(box);
    initSortableOnContainer(box);
  });
}

function initSortableOnContainer(container) {
  if (!window.Sortable || !container || container._sortableInit) return;
  container._sortableInit = true;

  new window.Sortable(container, {
    group: 'qdoc-internal-sort',
    handle: '.block-drag-handle',
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: () => {
      renumberBlocks();
      reflowPages();
    }
  });
}

// 自動重新編排全卷大題號（一、二、三）與小題號（1, 2, 3）
export function renumberBlocks() {
  let sectionIdx = 0;
  let qIdx = 0;

  document.querySelectorAll('.question-block').forEach((block) => {
    const secEl = block.querySelector('.auto-section-num');
    if (secEl) {
      secEl.textContent = CHINESE_NUMS[sectionIdx] || (sectionIdx + 1);
      sectionIdx++;
      qIdx = 0;
    }
    const qEl = block.querySelector('.auto-q-num');
    if (qEl) {
      qIdx++;
      qEl.textContent = qIdx;
    }
  });
}

/* --- 數學統計圖表彈窗控制 --- */
let currentChartSaveCallback = null;
let editingChartConfig = null;

function initChartModal() {
  const modal = document.getElementById('chart-modal');
  const typeSelect = document.getElementById('chart-type-select');
  const btnAddSeries = document.getElementById('btn-add-stacked-series');

  document.getElementById('btn-close-chart-modal').addEventListener('click', () => (modal.hidden = true));

  // 切換圖表類型時，即時切換一般資料表 vs 多組堆疊長條資料表
  typeSelect.addEventListener('change', () => {
    syncModalInputsToConfig();
    editingChartConfig.type = typeSelect.value;
    renderChartModalTable(editingChartConfig);
  });

  // 新增一列（長條項目）
  document.getElementById('btn-add-chart-row').addEventListener('click', () => {
    syncModalInputsToConfig();
    const idx = editingChartConfig.labels.length;
    editingChartConfig.labels.push(`項目${idx + 1}`);
    editingChartConfig.values.push(5);
    editingChartConfig.colors.push(DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length]);
    (editingChartConfig.stackedSeries || []).forEach((s) => s.values.push(4));
    renderChartModalTable(editingChartConfig);
  });

  // 新增堆疊分層（直欄，例如第三組類別）
  btnAddSeries.addEventListener('click', () => {
    syncModalInputsToConfig();
    const sIdx = editingChartConfig.stackedSeries.length;
    editingChartConfig.stackedSeries.push({
      name: `分層${sIdx + 1}`,
      color: DEFAULT_PALETTE[sIdx % DEFAULT_PALETTE.length],
      values: editingChartConfig.labels.map(() => 4)
    });
    renderChartModalTable(editingChartConfig);
  });

  document.getElementById('btn-save-chart').addEventListener('click', () => {
    syncModalInputsToConfig();
    if (currentChartSaveCallback) {
      currentChartSaveCallback({ ...editingChartConfig });
    }
    modal.hidden = true;
    requestAnimationFrame(() => reflowPages());
  });
}

export function openChartModal(config, onSave) {
  currentChartSaveCallback = onSave;
  // 深拷貝設定避免未儲存前污染原圖表
  editingChartConfig = {
    type: config.type || 'bar',
    title: config.title || '',
    showValues: config.showValues !== false,
    xLabel: config.xLabel || '',
    yLabel: config.yLabel || '',
    labels: [...(config.labels || ['項目1', '項目2'])],
    values: [...(config.values || [10, 8])],
    colors: [...(config.colors || ['#009FB7', '#FE4A49'])],
    stackedSeries: (config.stackedSeries && config.stackedSeries.length > 0
      ? config.stackedSeries
      : [
          { name: '男生', color: '#009FB7', values: (config.labels || ['項目1', '項目2']).map(() => 6) },
          { name: '女生', color: '#FE4A49', values: (config.labels || ['項目1', '項目2']).map(() => 5) }
        ]
    ).map((s) => ({ ...s, values: [...s.values] }))
  };

  document.getElementById('chart-title-input').value = editingChartConfig.title;
  document.getElementById('chart-type-select').value = editingChartConfig.type;
  document.getElementById('chart-show-values').checked = editingChartConfig.showValues;
  document.getElementById('chart-x-label').value = editingChartConfig.xLabel;
  document.getElementById('chart-y-label').value = editingChartConfig.yLabel;

  renderChartModalTable(editingChartConfig);
  document.getElementById('chart-modal').hidden = false;
}

function renderChartModalTable(cfg) {
  const thead = document.getElementById('chart-data-thead');
  const tbody = document.getElementById('chart-data-tbody');
  const btnAddSeries = document.getElementById('btn-add-stacked-series');
  const isStacked = cfg.type === 'stackedBar';

  btnAddSeries.hidden = !isStacked;
  thead.innerHTML = '';
  tbody.innerHTML = '';

  if (isStacked) {
    // 堆疊長條圖：第一欄為橫軸長條名稱，後面每一欄為一個堆疊分層（含名稱、顏色與刪除分層鈕）
    const headTr = document.createElement('tr');
    headTr.innerHTML = `<th style="min-width:105px;">長條名稱 (X軸)</th>`;
    cfg.stackedSeries.forEach((series, sIdx) => {
      const th = document.createElement('th');
      th.style.minWidth = '115px';
      th.innerHTML = `
        <div style="display:flex; align-items:center; gap:4px;">
          <input type="text" class="series-name-input" data-sidx="${sIdx}" value="${series.name}" style="width:65px;" title="堆疊分層名稱" />
          <input type="color" class="series-color-input" data-sidx="${sIdx}" value="${series.color}" style="width:24px; height:24px; padding:0; border:none; cursor:pointer;" title="分層顏色" />
          ${cfg.stackedSeries.length > 1 ? `<button type="button" class="mini-pill-btn btn-del-series" data-sidx="${sIdx}" title="刪除此分層" style="padding:1px 4px;">✕</button>` : ''}
        </div>
      `;
      headTr.appendChild(th);
    });
    headTr.innerHTML += `<th style="width:55px; text-align:center;">操作</th>`;
    thead.appendChild(headTr);

    // 綁定刪除分層事件
    thead.querySelectorAll('.btn-del-series').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncModalInputsToConfig();
        const sIdx = Number(btn.dataset.sidx);
        cfg.stackedSeries.splice(sIdx, 1);
        renderChartModalTable(cfg);
      });
    });

    // 渲染每一根長條（橫列）
    cfg.labels.forEach((lbl, rIdx) => {
      const tr = document.createElement('tr');
      let rowHtml = `<td><input type="text" class="row-label-input" value="${lbl}" /></td>`;
      cfg.stackedSeries.forEach((series, sIdx) => {
        const val = series.values[rIdx] ?? 0;
        rowHtml += `<td><input type="number" class="series-val-input" data-sidx="${sIdx}" value="${val}" /></td>`;
      });
      rowHtml += `<td style="text-align:center;"><button type="button" class="mini-pill-btn btn-del-row">刪除</button></td>`;
      tr.innerHTML = rowHtml;

      tr.querySelector('.btn-del-row').addEventListener('click', () => {
        if (cfg.labels.length <= 1) return;
        syncModalInputsToConfig();
        cfg.labels.splice(rIdx, 1);
        cfg.values.splice(rIdx, 1);
        cfg.colors.splice(rIdx, 1);
        cfg.stackedSeries.forEach((s) => s.values.splice(rIdx, 1));
        renderChartModalTable(cfg);
      });
      tbody.appendChild(tr);
    });
  } else {
    // 一般圖表（直立長條、橫向長條、折線、圓餅）
    thead.innerHTML = `
      <tr>
        <th>項目名稱</th>
        <th style="width: 90px;">數值</th>
        <th style="width: 60px; text-align:center;">顏色</th>
        <th style="width: 65px; text-align:center;">操作</th>
      </tr>
    `;

    cfg.labels.forEach((lbl, idx) => {
      const color = cfg.colors[idx] || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="row-label-input" value="${lbl}" /></td>
        <td><input type="number" class="row-val-input" value="${cfg.values[idx] ?? 0}" /></td>
        <td style="text-align:center;"><input type="color" class="row-color-input" value="${color}" style="width:36px; height:26px; padding:0; border:none; cursor:pointer;" /></td>
        <td style="text-align:center;"><button type="button" class="mini-pill-btn btn-del-row">刪除</button></td>
      `;
      tr.querySelector('.btn-del-row').addEventListener('click', () => {
        if (cfg.labels.length <= 1) return;
        syncModalInputsToConfig();
        cfg.labels.splice(idx, 1);
        cfg.values.splice(idx, 1);
        cfg.colors.splice(idx, 1);
        cfg.stackedSeries.forEach((s) => s.values.splice(idx, 1));
        renderChartModalTable(cfg);
      });
      tbody.appendChild(tr);
    });
  }
}

function syncModalInputsToConfig() {
  if (!editingChartConfig) return;
  editingChartConfig.title = document.getElementById('chart-title-input').value;
  editingChartConfig.type = document.getElementById('chart-type-select').value;
  editingChartConfig.showValues = document.getElementById('chart-show-values').checked;
  editingChartConfig.xLabel = document.getElementById('chart-x-label').value.trim();
  editingChartConfig.yLabel = document.getElementById('chart-y-label').value.trim();

  const tbody = document.getElementById('chart-data-tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (rows.length === 0) return;

  if (tbody.querySelector('.series-val-input')) {
    // 讀取堆疊表格輸入值
    document.querySelectorAll('#chart-data-thead .series-name-input').forEach((inp) => {
      const sIdx = Number(inp.dataset.sidx);
      if (editingChartConfig.stackedSeries[sIdx]) {
        editingChartConfig.stackedSeries[sIdx].name = inp.value.trim() || `分層${sIdx + 1}`;
      }
    });
    document.querySelectorAll('#chart-data-thead .series-color-input').forEach((inp) => {
      const sIdx = Number(inp.dataset.sidx);
      if (editingChartConfig.stackedSeries[sIdx]) {
        editingChartConfig.stackedSeries[sIdx].color = inp.value;
      }
    });

    const newLabels = [];
    editingChartConfig.stackedSeries.forEach((s) => (s.values = []));

    rows.forEach((tr) => {
      const lbl = tr.querySelector('.row-label-input')?.value.trim() || '未命名';
      newLabels.push(lbl);
      tr.querySelectorAll('.series-val-input').forEach((valInp) => {
        const sIdx = Number(valInp.dataset.sidx);
        if (editingChartConfig.stackedSeries[sIdx]) {
          editingChartConfig.stackedSeries[sIdx].values.push(parseFloat(valInp.value) || 0);
        }
      });
    });

    editingChartConfig.labels = newLabels;
    // 同步維持一般 values 陣列長度一致
    editingChartConfig.values = newLabels.map((_, i) => editingChartConfig.values[i] ?? 5);
    editingChartConfig.colors = newLabels.map((_, i) => editingChartConfig.colors[i] || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]);
  } else {
    // 讀取一般圖表輸入值
    const newLabels = [];
    const newValues = [];
    const newColors = [];
    rows.forEach((tr, idx) => {
      const lbl = tr.querySelector('.row-label-input')?.value.trim() || '未命名';
      const val = parseFloat(tr.querySelector('.row-val-input')?.value) || 0;
      const col = tr.querySelector('.row-color-input')?.value || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];
      newLabels.push(lbl);
      newValues.push(val);
      newColors.push(col);
    });
    editingChartConfig.labels = newLabels;
    editingChartConfig.values = newValues;
    editingChartConfig.colors = newColors;
    editingChartConfig.stackedSeries.forEach((s) => {
      s.values = newLabels.map((_, i) => s.values[i] ?? 5);
    });
  }
}