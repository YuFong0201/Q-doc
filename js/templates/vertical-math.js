import { reflowPages } from '../core/pagination.js';

const OPERATORS = ['+', '-', '×'];

export default {
  id: 'vertical-math',
  name: '直式計算對齊格',
  subjects: ['數學'],
  icon: '➕',
  createContent() {
    return `
      <div>
        <div class="hanging-stem-row">
          <span class="hanging-num" contenteditable="true"><span class="auto-q-num">1</span>.</span>
          <div class="hanging-body" contenteditable="true">
            請用直式算算看：
            <span class="tpl-inline-controls" contenteditable="false">
              <button type="button" class="mini-pill-btn btn-add-vmath">＋ 增加算式</button>
              <button type="button" class="mini-pill-btn btn-rem-vmath">－ 減少算式</button>
            </span>
          </div>
        </div>
        <div class="vmath-grid">
          ${createVMathItemHtml('348', '+', '275')}
        </div>
      </div>
    `;
  },
  bindEvents(blockEl) {
    const grid = blockEl.querySelector('.vmath-grid');
    const btnAdd = blockEl.querySelector('.btn-add-vmath');
    const btnRem = blockEl.querySelector('.btn-rem-vmath');

    grid.querySelectorAll('.vmath-item').forEach(bindOperatorCycle);

    const updateButtons = () => {
      btnRem.disabled = grid.children.length <= 1;
    };

    btnAdd.addEventListener('click', () => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = createVMathItemHtml('125', '+', '48');
      const item = wrapper.firstElementChild;
      grid.appendChild(item);
      bindOperatorCycle(item);
      updateButtons();
      reflowPages();
    });

    btnRem.addEventListener('click', () => {
      if (grid.children.length > 1) {
        grid.lastElementChild.remove();
        updateButtons();
        reflowPages();
      }
    });

    updateButtons();
  }
};

function createVMathItemHtml(topNum, op, bottomNum) {
  return `
    <div class="vmath-item">
      <div class="vmath-num" contenteditable="true">${topNum}</div>
      <div class="vmath-line">
        <button type="button" class="vmath-op-btn" contenteditable="false" title="點擊切換 ＋ / － / × 運算符號">${op}</button>
        <span class="vmath-num" contenteditable="true">${bottomNum}</span>
      </div>
    </div>
  `;
}

function bindOperatorCycle(itemEl) {
  const opBtn = itemEl.querySelector('.vmath-op-btn');
  if (!opBtn) return;
  opBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const cur = opBtn.textContent.trim();
    const nextIdx = (OPERATORS.indexOf(cur) + 1) % OPERATORS.length;
    opBtn.textContent = OPERATORS[nextIdx];
  });
}