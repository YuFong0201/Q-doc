import { reflowPages } from '../core/pagination.js';

const MIN_SLOTS = 1;
const MAX_SLOTS = 5;

export default {
  id: 'phrase-pattern',
  name: '短語練習 / 照樣造句',
  subjects: ['國語'],
  icon: '💬',
  createContent() {
    return `
      <div>
        <div class="tpl-inline-controls">
          <button type="button" class="mini-pill-btn btn-add-slot" title="增加一個作答空格與連接詞">＋ 新增空格</button>
          <button type="button" class="mini-pill-btn btn-remove-slot" title="減少最後一個作答空格">－ 減少空格</button>
        </div>
        <div class="hanging-stem-row">
          <span class="hanging-num" contenteditable="true"><span class="auto-q-num">1</span>.</span>
          <div class="hanging-body" contenteditable="true">照樣寫短語：</div>
        </div>
        <div class="pattern-box">
          <span contenteditable="true">例題：（ 疲憊 ）的（ 老師 ）</span>
          <span class="pattern-arrow" aria-hidden="true">➔</span>
          <span class="pattern-slot" contenteditable="true">  </span><span class="pattern-connector" contenteditable="true">的</span><span class="pattern-slot" contenteditable="true">  </span>
        </div>
      </div>
    `;
  },
  bindEvents(block) {
    const btnAdd = block.querySelector('.btn-add-slot');
    const btnRemove = block.querySelector('.btn-remove-slot');
    const patternBox = block.querySelector('.pattern-box');

    if (!btnAdd || !btnRemove || !patternBox) return;

    const getSlots = () => Array.from(patternBox.querySelectorAll('.pattern-slot'));

    const updateButtonStates = () => {
      const count = getSlots().length;
      btnAdd.disabled = count >= MAX_SLOTS;
      btnRemove.disabled = count <= MIN_SLOTS;
    };

    btnAdd.addEventListener('click', () => {
      const slots = getSlots();
      if (slots.length >= MAX_SLOTS) return;

      const connector = document.createElement('span');
      connector.className = 'pattern-connector';
      connector.contentEditable = 'true';
      connector.textContent = '的';

      const newSlot = document.createElement('span');
      newSlot.className = 'pattern-slot';
      newSlot.contentEditable = 'true';
      newSlot.textContent = '  ';

      patternBox.appendChild(connector);
      patternBox.appendChild(newSlot);

      updateButtonStates();
      reflowPages();
    });

    // 減少最後一個作答方框（並一併移除其前置連接詞）
    btnRemove.addEventListener('click', () => {
      const slots = getSlots();
      if (slots.length <= MIN_SLOTS) return;

      const lastSlot = slots[slots.length - 1];
      const prevEl = lastSlot.previousElementSibling;

      // 若前一個元素是連接詞（例如「的」），則一併移除，避免尾端多出孤立連接詞
      if (prevEl && prevEl.classList.contains('pattern-connector')) {
        prevEl.remove();
      }
      lastSlot.remove();

      updateButtonStates();
      reflowPages();
    });

    // 初始化按鈕啟用／停用狀態
    updateButtonStates();
  }
};