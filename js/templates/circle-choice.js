import { reflowPages } from '../core/pagination.js';
import { scanAndWrapChars } from '../bopomofo/polyphoneDetector.js';
import { bindOptionImageHandler } from '../features/imageHandler.js';

export default {
  id: 'circle-choice',
  name: '圈選題 / 勾選題',
  subjects: ['國語', '數學', '生活', '英語'],
  icon: '⭕',
  createContent() {
    return `
      <div>
        <div contenteditable="true">
          <span class="auto-q-num">1</span>. 請把正確的答案圈起來：
          <span class="tpl-inline-controls" contenteditable="false">
            <button type="button" class="mini-pill-btn btn-add-opt">＋ 增加選項</button>
            <button type="button" class="mini-pill-btn btn-rem-opt">－ 減少選項</button>
          </span>
        </div>
        <div class="circle-items-wrap">
          ${createCircleOptionHtml('選項一')}
          ${createCircleOptionHtml('選項二')}
          ${createCircleOptionHtml('選項三')}
        </div>
      </div>
    `;
  },
  bindEvents(blockEl) {
    const wrap = blockEl.querySelector('.circle-items-wrap');
    const btnAdd = blockEl.querySelector('.btn-add-opt');
    const btnRem = blockEl.querySelector('.btn-rem-opt');

    // 綁定既有選項的圖片上傳與放大縮小功能
    wrap.querySelectorAll('.circle-option-item').forEach((opt) => bindOptionImageHandler(opt, 85));

    const updateRemoveState = () => {
      btnRem.disabled = wrap.children.length <= 1;
    };

    btnAdd.addEventListener('click', () => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = createCircleOptionHtml(`選項${wrap.children.length + 1}`);
      const optEl = wrapper.firstElementChild;
      wrap.appendChild(optEl);
      scanAndWrapChars(optEl);
      bindOptionImageHandler(optEl, 85);
      updateRemoveState();
      reflowPages();
    });

    btnRem.addEventListener('click', () => {
      if (wrap.children.length > 1) {
        wrap.lastElementChild.remove();
        updateRemoveState();
        reflowPages();
      }
    });

    updateRemoveState();
  }
};

function createCircleOptionHtml(labelText) {
  return `
    <span class="circle-option-item">
      <span class="opt-text" contenteditable="true">${labelText}</span>
      <span class="opt-img-slot"></span>
      <button type="button" class="opt-img-trigger" title="上傳或更換此選項圖片" aria-label="上傳此選項圖片">🖼️</button>
      <input type="file" class="opt-img-input" accept="image/*" hidden />
    </span>
  `;
}