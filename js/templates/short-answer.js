import { reflowPages } from '../core/pagination.js';

export default {
  id: 'short-answer',
  name: '簡答題 / 問答題',
  subjects: ['國語', '數學', '英語', '自然', '社會', '生活'],
  icon: '📝',
  createContent() {
    return `
      <div>
        <div contenteditable="true">
          <span class="auto-q-num">1</span>. 請在此輸入簡答題題目內容：
          <span class="tpl-inline-controls" contenteditable="false">
            <button type="button" class="mini-pill-btn btn-add-line">＋ 新增底線</button>
            <button type="button" class="mini-pill-btn btn-remove-line">－ 減少底線</button>
          </span>
        </div>
        <div class="answer-lines-box">
          <div class="writing-line"></div>
          <div class="writing-line"></div>
        </div>
      </div>
    `;
  },
  bindEvents(blockEl) {
    const linesBox = blockEl.querySelector('.answer-lines-box');
    const btnAdd = blockEl.querySelector('.btn-add-line');
    const btnRemove = blockEl.querySelector('.btn-remove-line');

    const updateRemoveState = () => {
      btnRemove.disabled = linesBox.children.length <= 1;
    };

    btnAdd.addEventListener('click', () => {
      const line = document.createElement('div');
      line.className = 'writing-line';
      linesBox.appendChild(line);
      updateRemoveState();
      reflowPages();
    });

    btnRemove.addEventListener('click', () => {
      if (linesBox.children.length > 1) {
        linesBox.lastElementChild.remove();
        updateRemoveState();
        reflowPages();
      }
    });

    updateRemoveState();
  }
};