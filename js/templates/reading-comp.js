import { reflowPages } from '../core/pagination.js';
import { scanAndWrapChars } from '../bopomofo/polyphoneDetector.js';
import { bindOptionImageHandler } from '../features/imageHandler.js';

const OPTION_LETTERS = ['(A)', '(B)', '(C)', '(D)', '(E)', '(F)'];

export default {
  id: 'reading-comp',
  name: '閱讀測驗題組',
  subjects: ['國語', '英語', '社會'],
  icon: '📖',
  createContent() {
    return `
      <div>
        <span class="tpl-inline-controls" contenteditable="false">
          <button type="button" class="mini-pill-btn btn-passage-img">🖼️ 短文插圖</button>
          <button type="button" class="mini-pill-btn btn-add-subq">＋ 新增子題</button>
          <button type="button" class="mini-pill-btn btn-rem-subq">－ 減少子題</button>
          <input type="file" class="passage-img-input" accept="image/*" hidden />
        </span>

        <div class="reading-passage-box">
          <div class="passage-img-float-slot" contenteditable="false"></div>
          <div class="passage-text" contenteditable="true">
            <strong>【閱讀短文】</strong>請在此輸入或貼上閱讀文章內容，若有上傳插圖，文字會自動採「文字繞圖」方式緊密圍繞圖片排版。
          </div>
          <div style="clear: both;"></div>
        </div>

        <div class="reading-sub-questions">
          ${createReadingSubQHtml(1, '根據上文，下列敘述何者正確？')}
          ${createReadingSubQHtml(2, '文章的主旨主要是想告訴我們什麼道理？')}
        </div>
      </div>
    `;
  },
  bindEvents(blockEl) {
    const subWrap = blockEl.querySelector('.reading-sub-questions');
    const btnAddQ = blockEl.querySelector('.btn-add-subq');
    const btnRemQ = blockEl.querySelector('.btn-rem-subq');
    const btnPassageImg = blockEl.querySelector('.btn-passage-img');
    const passageFileInput = blockEl.querySelector('.passage-img-input');
    const passageImgSlot = blockEl.querySelector('.passage-img-float-slot');

    // 綁定短文文字繞圖上傳與縮放
    btnPassageImg.addEventListener('click', () => passageFileInput.click());
    passageFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        renderPassageWrapImage(passageImgSlot, ev.target.result);
        reflowPages();
      };
      reader.readAsDataURL(file);
      passageFileInput.value = '';
    });

    // 綁定既有子題事件
    subWrap.querySelectorAll('.reading-subq-item').forEach(bindSubQuestionEvents);

    const updateSubQButtons = () => {
      btnRemQ.disabled = subWrap.children.length <= 1;
      renumberSubQuestions(subWrap);
    };

    btnAddQ.addEventListener('click', () => {
      const nextIdx = subWrap.children.length + 1;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = createReadingSubQHtml(nextIdx, '請輸入閱讀子題題目內容？');
      const item = wrapper.firstElementChild;
      subWrap.appendChild(item);
      scanAndWrapChars(item);
      bindSubQuestionEvents(item);
      updateSubQButtons();
      reflowPages();
    });

    btnRemQ.addEventListener('click', () => {
      if (subWrap.children.length > 1) {
        subWrap.lastElementChild.remove();
        updateSubQButtons();
        reflowPages();
      }
    });

    updateSubQButtons();
  }
};

function createReadingSubQHtml(num, stemText) {
  return `
    <div class="reading-subq-item">
      <div class="reading-subq-stem">
        <span class="mc-prefix" contenteditable="true">（ ）<span class="subq-num">${num}</span>.</span>
        <div class="mc-stem-text" contenteditable="true">${stemText}</div>
        <div class="subq-opt-controls" contenteditable="false">
          <button type="button" class="mini-pill-btn btn-subq-add-opt" title="新增選項">＋選項</button>
          <button type="button" class="mini-pill-btn btn-subq-rem-opt" title="減少選項">－選項</button>
        </div>
      </div>
      <div class="reading-subq-options">
        ${createReadingOptionHtml('(A)', '選項一')}
        ${createReadingOptionHtml('(B)', '選項二')}
        ${createReadingOptionHtml('(C)', '選項三')}
      </div>
    </div>
  `;
}

function createReadingOptionHtml(label, text) {
  return `
    <div class="mc-opt-item">
      <span class="mc-opt-label" contenteditable="true">${label}</span>
      <div class="mc-opt-content">
        <span class="opt-text" contenteditable="true">${text}</span>
        <span class="opt-img-slot"></span>
        <button type="button" class="opt-img-trigger" title="上傳或更換此選項圖片" aria-label="上傳此選項圖片">🖼️</button>
        <input type="file" class="opt-img-input" accept="image/*" hidden />
      </div>
    </div>
  `;
}

function bindSubQuestionEvents(subqEl) {
  const optsGrid = subqEl.querySelector('.reading-subq-options');
  const btnAddOpt = subqEl.querySelector('.btn-subq-add-opt');
  const btnRemOpt = subqEl.querySelector('.btn-subq-rem-opt');

  optsGrid.querySelectorAll('.mc-opt-item').forEach((opt) => bindOptionImageHandler(opt, 75));

  const updateOptBtns = () => {
    btnRemOpt.disabled = optsGrid.children.length <= 2;
    btnAddOpt.disabled = optsGrid.children.length >= OPTION_LETTERS.length;
  };

  btnAddOpt.addEventListener('click', () => {
    const idx = optsGrid.children.length;
    if (idx >= OPTION_LETTERS.length) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = createReadingOptionHtml(OPTION_LETTERS[idx], `選項${idx + 1}`);
    const optEl = wrapper.firstElementChild;
    optsGrid.appendChild(optEl);
    scanAndWrapChars(optEl);
    bindOptionImageHandler(optEl, 75);
    updateOptBtns();
    reflowPages();
  });

  btnRemOpt.addEventListener('click', () => {
    if (optsGrid.children.length > 2) {
      optsGrid.lastElementChild.remove();
      updateOptBtns();
      reflowPages();
    }
  });

  updateOptBtns();
}

function renumberSubQuestions(subWrap) {
  subWrap.querySelectorAll('.subq-num').forEach((el, idx) => {
    el.textContent = idx + 1;
  });
}

function renderPassageWrapImage(slot, src) {
  slot.innerHTML = `
    <div class="passage-wrap-img-box">
      <img src="${src}" alt="閱讀短文插圖" style="width: 140px; height: auto;" />
      <span class="img-resize-toolbar">
        <button type="button" class="img-ctrl-btn zoom-in" title="放大插圖">＋</button>
        <button type="button" class="img-ctrl-btn zoom-out" title="縮小插圖">－</button>
        <button type="button" class="img-ctrl-btn img-del" title="移除插圖">✕</button>
      </span>
    </div>
  `;

  const img = slot.querySelector('img');
  slot.querySelector('.zoom-in').addEventListener('click', () => {
    img.style.width = `${Math.min(280, (img.offsetWidth || 140) + 20)}px`;
    reflowPages();
  });
  slot.querySelector('.zoom-out').addEventListener('click', () => {
    img.style.width = `${Math.max(60, (img.offsetWidth || 140) - 20)}px`;
    reflowPages();
  });
  slot.querySelector('.img-del').addEventListener('click', () => {
    slot.innerHTML = '';
    reflowPages();
  });
}