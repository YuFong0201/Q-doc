import { reflowPages } from '../core/pagination.js';
import { scanAndWrapChars } from '../bopomofo/polyphoneDetector.js';
import { bindOptionImageHandler } from '../features/imageHandler.js';

export default {
  id: 'matching',
  name: '連連看配對題',
  subjects: ['國語', '數學', '英語', '自然', '社會', '生活'],
  icon: '🔗',
  createContent() {
    return `
      <div>
        <div contenteditable="true">
          <span class="auto-q-num">1</span>. 請將左右兩邊相關的項目連起來：
          <span class="tpl-inline-controls" contenteditable="false">
            <button type="button" class="mini-pill-btn btn-left-add">＋左側增加</button>
            <button type="button" class="mini-pill-btn btn-left-rem">－左側減少</button>
            <button type="button" class="mini-pill-btn btn-right-add">＋右側增加</button>
            <button type="button" class="mini-pill-btn btn-right-rem">－右側減少</button>
          </span>
        </div>
        <div class="matching-columns">
          <div class="matching-col left">
            ${createMatchRowHtml('left', 1)}
            ${createMatchRowHtml('left', 2)}
            ${createMatchRowHtml('left', 3)}
          </div>
          <div class="matching-col right">
            ${createMatchRowHtml('right', 1)}
            ${createMatchRowHtml('right', 2)}
            ${createMatchRowHtml('right', 3)}
          </div>
        </div>
      </div>
    `;
  },
  bindEvents(blockEl) {
    const leftCol = blockEl.querySelector('.matching-col.left');
    const rightCol = blockEl.querySelector('.matching-col.right');
    const btnLAdd = blockEl.querySelector('.btn-left-add');
    const btnLRem = blockEl.querySelector('.btn-left-rem');
    const btnRAdd = blockEl.querySelector('.btn-right-add');
    const btnRRem = blockEl.querySelector('.btn-right-rem');

    // 綁定既有項目的圖片上傳與放大縮小功能
    blockEl.querySelectorAll('.match-node-row').forEach((row) => bindOptionImageHandler(row, 75));

    const updateButtons = () => {
      btnLRem.disabled = leftCol.children.length <= 1;
      btnRRem.disabled = rightCol.children.length <= 1;
    };

    btnLAdd.addEventListener('click', () => {
      const idx = leftCol.children.length + 1;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = createMatchRowHtml('left', idx);
      const row = wrapper.firstElementChild;
      leftCol.appendChild(row);
      scanAndWrapChars(row);
      bindOptionImageHandler(row, 75);
      updateButtons();
      reflowPages();
    });

    btnLRem.addEventListener('click', () => {
      if (leftCol.children.length > 1) {
        leftCol.lastElementChild.remove();
        updateButtons();
        reflowPages();
      }
    });

    btnRAdd.addEventListener('click', () => {
      const idx = rightCol.children.length + 1;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = createMatchRowHtml('right', idx);
      const row = wrapper.firstElementChild;
      rightCol.appendChild(row);
      scanAndWrapChars(row);
      bindOptionImageHandler(row, 75);
      updateButtons();
      reflowPages();
    });

    btnRRem.addEventListener('click', () => {
      if (rightCol.children.length > 1) {
        rightCol.lastElementChild.remove();
        updateButtons();
        reflowPages();
      }
    });

    updateButtons();
  }
};

function createMatchRowHtml(side, idx) {
  const label = side === 'left' ? `左側項目 ${idx}` : `右側項目 ${idx}`;
  const boxHtml = `
    <div class="match-item-box">
      <span class="opt-text" contenteditable="true">${label}</span>
      <span class="opt-img-slot"></span>
      <button type="button" class="opt-img-trigger" title="上傳或更換此項目圖片" aria-label="上傳此項目圖片">🖼️</button>
      <input type="file" class="opt-img-input" accept="image/*" hidden />
    </div>
  `;
  return side === 'left'
    ? `<div class="match-node-row">${boxHtml}<span class="match-dot">●</span></div>`
    : `<div class="match-node-row"><span class="match-dot">●</span>${boxHtml}</div>`;
}