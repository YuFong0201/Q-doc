import { reflowPages } from '../core/pagination.js';

export default {
  id: 'char-bopomofo',
  name: '國字注音田字格',
  subjects: ['國語'],
  icon: '🀄',
  createContent() {
    return `
      <div>
        <div class="hanging-stem-row">
          <span class="hanging-num" contenteditable="true"><span class="auto-q-num">1</span>.</span>
          <div class="hanging-body" contenteditable="true">
            請寫出正確的國字或注音：
            <span class="tpl-inline-controls" contenteditable="false">
              <button type="button" class="mini-pill-btn btn-toggle-mode" data-mode="grid">⇄ 切換為括號</button>
              <button type="button" class="mini-pill-btn btn-add-tian">＋ 增加格子</button>
              <button type="button" class="mini-pill-btn btn-rem-tian">－ 減少格子</button>
            </span>
          </div>
        </div>
        <div class="bopo-grid-list mode-grid">
          ${createCharBoxHtml('', '貓')}
          ${createCharBoxHtml('狗', '')}
        </div>
      </div>
    `;
  },
  bindEvents(blockEl) {
    const list = blockEl.querySelector('.bopo-grid-list');
    const btnToggleMode = blockEl.querySelector('.btn-toggle-mode');
    const btnAdd = blockEl.querySelector('.btn-add-tian');
    const btnRem = blockEl.querySelector('.btn-rem-tian');

    const updateState = () => {
      btnRem.disabled = list.children.length <= 1;
    };

    // 切換田字格 / 括號模式
    btnToggleMode.addEventListener('click', () => {
      const isGrid = list.classList.contains('mode-grid');
      if (isGrid) {
        list.classList.remove('mode-grid');
        list.classList.add('mode-paren');
        btnToggleMode.dataset.mode = 'paren';
        btnToggleMode.textContent = '⇄ 切換為田字格';
      } else {
        list.classList.remove('mode-paren');
        list.classList.add('mode-grid');
        btnToggleMode.dataset.mode = 'grid';
        btnToggleMode.textContent = '⇄ 切換為括號';
      }
      reflowPages();
    });

    btnAdd.addEventListener('click', () => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = createCharBoxHtml('', '');
      list.appendChild(wrapper.firstElementChild);
      updateState();
      reflowPages();
    });

    btnRem.addEventListener('click', () => {
      if (list.children.length > 1) {
        list.lastElementChild.remove();
        updateState();
        reflowPages();
      }
    });

    updateState();
  }
};

/**
 * 建立國字＋純注音單元（支援田字格與括號雙模式）：
 * - .tian-grid：強制無注音字體（輸入國字出題，學生填注音）
 * - .bopo-only-box：套用 BpmfZihiOnly 字體（直接輸入國字即自動顯示純注音＋聲調，學生填國字）
 */
function createCharBoxHtml(charText, bopoCharText) {
  return `
    <div class="char-box-unit">
      <div class="tian-grid" contenteditable="true" title="輸入國字（題目顯示純國字，學生寫注音）">${charText}</div>
      <div class="bopo-side-wrap" title="直接輸入國字，自動顯示純注音（學生寫國字）">
        <span class="bopo-paren-mark" aria-hidden="true">（</span>
        <div class="bopo-only-box" contenteditable="true">${bopoCharText}</div>
        <span class="bopo-paren-mark" aria-hidden="true">）</span>
      </div>
    </div>
  `;
}