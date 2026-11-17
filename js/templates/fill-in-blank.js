import { reflowPages } from '../core/pagination.js';

export default {
  id: 'fill-in-blank',
  name: '空白(填充題、改錯字)',
  subjects: ['國語', '數學', '英語', '自然', '社會', '生活'],
  icon: '✏️',
  createContent() {
    return `
      <div>
        <div class="hanging-stem-row">
          <span class="hanging-num" contenteditable="true"><span class="auto-q-num">1</span>.</span>
          <div class="hanging-body" contenteditable="true">
            請在此輸入題目內容
            <span class="tpl-inline-controls" contenteditable="false">
              <button type="button" class="mini-pill-btn btn-blank-img">🖼️ 插入圖片</button>
              <input type="file" class="blank-img-input" accept="image/*" hidden />
            </span>
          </div>
        </div>
        <div class="blank-img-area" contenteditable="false" style="padding-left: 1.6em;"></div>
      </div>
    `;
  },
  bindEvents(blockEl) {
    const btnImg = blockEl.querySelector('.btn-blank-img');
    const fileInput = blockEl.querySelector('.blank-img-input');
    const imgArea = blockEl.querySelector('.blank-img-area');

    btnImg.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        appendResizableBlankImage(imgArea, ev.target.result);
        reflowPages();
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });
  }
};

function appendResizableBlankImage(container, src) {
  const box = document.createElement('div');
  box.className = 'opt-img-preview';
  box.style.margin = '8px 10px 4px 0';
  box.innerHTML = `
    <img src="${src}" alt="題目附圖" style="width: 180px; height: auto; border: 1px solid #cbd5e1;" />
    <span class="img-resize-toolbar">
      <button type="button" class="img-ctrl-btn zoom-in" title="放大圖片">＋</button>
      <button type="button" class="img-ctrl-btn zoom-out" title="縮小圖片">－</button>
      <button type="button" class="img-ctrl-btn img-del" title="移除圖片">✕</button>
    </span>
  `;

  const img = box.querySelector('img');
  box.querySelector('.zoom-in').addEventListener('click', () => {
    img.style.width = `${Math.min(480, (img.offsetWidth || 180) + 25)}px`;
    reflowPages();
  });
  box.querySelector('.zoom-out').addEventListener('click', () => {
    img.style.width = `${Math.max(60, (img.offsetWidth || 180) - 25)}px`;
    reflowPages();
  });
  box.querySelector('.img-del').addEventListener('click', () => {
    box.remove();
    reflowPages();
  });

  container.appendChild(box);
}