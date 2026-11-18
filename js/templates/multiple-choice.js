import { bindOptionImageHandler } from '../features/imageHandler.js';

export default {
  id: 'multiple-choice',
  name: '選擇題 (1/2/4欄)',
  subjects: ['國語', '數學', '英語', '自然', '社會', '生活'],
  icon: '🔘',
  createContent() {
    const labels = ['(A)', '(B)', '(C)', '(D)'];
    const optionsHtml = labels
      .map(
        (lbl) => `
        <div class="mc-opt-item">
          <span class="mc-opt-label" contenteditable="true">${lbl}</span>
          <div class="mc-opt-content">
            <span class="opt-text" contenteditable="true"> </span>
            <span class="opt-img-slot"></span>
            <button type="button" class="opt-img-trigger" title="上傳或更換此選項圖片" aria-label="上傳此選項圖片">🖼️</button>
            <input type="file" class="opt-img-input" accept="image/*" hidden />
          </div>
        </div>
      `
      )
      .join('');

    return `
      <div class="tpl-mc">
        <div class="mc-stem-row">
          <span class="mc-prefix" contenteditable="true"><span class="mc-bracket">（ ）</span><span class="auto-q-num">1</span>.</span>
          <div class="mc-stem-text" contenteditable="true">
            題目內容?
            <span class="tpl-inline-controls" contenteditable="false">
              <button type="button" class="mini-pill-btn" data-mc-cols="4">4欄橫排</button>
              <button type="button" class="mini-pill-btn" data-mc-cols="2">2欄並排</button>
              <button type="button" class="mini-pill-btn" data-mc-cols="1">1欄直排</button>
            </span>
          </div>
        </div>
        <div class="mc-options-grid cols-4">
          ${optionsHtml}
        </div>
      </div>
    `;
  },
  bindEvents(blockEl) {
    const grid = blockEl.querySelector('.mc-options-grid');
    blockEl.querySelectorAll('[data-mc-cols]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cols = btn.getAttribute('data-mc-cols');
        grid.className = `mc-options-grid cols-${cols}`;
      });
    });

    blockEl.querySelectorAll('.mc-opt-item').forEach((optEl) => {
      bindOptionImageHandler(optEl, 80);
    });
  }
};