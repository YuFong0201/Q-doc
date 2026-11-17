import { reflowPages } from '../core/pagination.js';
import { renumberBlocks } from '../core/blockManager.js';

/**
 * 利用 Canvas 將本機圖片等比例縮放壓縮為輕量 Base64，確保離線存檔與匯出流暢不卡頓
 * @param {File} file 圖片檔案
 * @param {number} maxDimension 最大寬或高限制 (px)
 * @param {number} quality JPEG 壓縮品質 (0~1)
 * @returns {Promise<string>} 壓縮後的 DataURL
 */
export function compressImageFile(file, maxDimension = 900, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('圖片讀取失敗'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => resolve(ev.target.result); // 若為特殊格式則退回原圖
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // PNG 保留透明背景（適合幾何圖形與去背插畫），其餘轉 JPEG 高效壓縮
        const isPng = file.type === 'image/png';
        const outputType = isPng ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(outputType, quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * 綁定選項圖片上傳、Canvas 壓縮、放大/縮小與移除功能
 * @param {HTMLElement} containerEl 包含 .opt-img-trigger, .opt-img-input, .opt-img-slot 的選項容器
 * @param {number} defaultWidth 預設圖片寬度 (px)
 */
export function bindOptionImageHandler(containerEl, defaultWidth = 85) {
  const trigger = containerEl.querySelector('.opt-img-trigger');
  const fileInput = containerEl.querySelector('.opt-img-input');
  const imgSlot = containerEl.querySelector('.opt-img-slot');

  if (!trigger || !fileInput || !imgSlot) return;

  trigger.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const compressedDataUrl = await compressImageFile(file, 600, 0.85);
    renderResizableImage(imgSlot, compressedDataUrl, defaultWidth);
    reflowPages();
    fileInput.value = '';
  });
}

/**
 * 初始化考卷畫布的「外部圖片拖曳直接上傳」功能（拖曳電腦圖片檔進考卷自動建立附圖題塊）
 */
export function initCanvasImageDrop() {
  const pagesContainer = document.getElementById('pages-container');
  if (!pagesContainer || pagesContainer._imgDropInit) return;
  pagesContainer._imgDropInit = true;

  pagesContainer.addEventListener('dragover', (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  pagesContainer.addEventListener('drop', async (e) => {
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    e.preventDefault();
    e.stopPropagation();

    const targetPage = e.target.closest('.paper-page') || document.querySelector('.paper-page:last-child');
    const blocksBox = targetPage?.querySelector('.blocks-container');
    if (!blocksBox) return;

    for (const file of imageFiles) {
      const dataUrl = await compressImageFile(file, 960, 0.85);
      const block = createDroppedImageBlock(dataUrl);
      blocksBox.appendChild(block);
    }

    renumberBlocks();
    reflowPages();
  });
}

function createDroppedImageBlock(src) {
  const block = document.createElement('div');
  block.className = 'question-block';
  block.dataset.templateId = 'dropped-image';
  block.innerHTML = `
    <div class="block-drag-handle" title="按住上下拖曳調整順序" aria-label="拖曳排序">⋮⋮</div>
    <div class="block-actions">
      <div class="block-custom-controls" style="display:none;"></div>
      <div class="block-sys-controls">
        <button type="button" class="block-act-btn dup" title="複製此區塊">複製</button>
        <button type="button" class="block-act-btn del" title="刪除此區塊">刪除</button>
      </div>
    </div>
    <div class="block-body" style="text-align: center;">
      <div class="opt-img-preview" contenteditable="false" style="margin: 4px auto;">
        <img src="${src}" alt="考卷插圖" style="width: 240px; height: auto; border: 1px solid #cbd5e1;" />
        <span class="img-resize-toolbar">
          <button type="button" class="img-ctrl-btn zoom-in" title="放大圖片">＋</button>
          <button type="button" class="img-ctrl-btn zoom-out" title="縮小圖片">－</button>
          <button type="button" class="img-ctrl-btn img-del" title="移除圖片">✕</button>
        </span>
      </div>
      <div contenteditable="true" style="font-size: 0.9em; color: #5a626a; margin-top: 4px;">（點擊可編輯圖說，或直接刪除圖說）</div>
    </div>
  `;

  const img = block.querySelector('img');
  block.querySelector('.zoom-in').addEventListener('click', () => {
    img.style.width = `${Math.min(560, (img.offsetWidth || 240) + 30)}px`;
    reflowPages();
  });
  block.querySelector('.zoom-out').addEventListener('click', () => {
    img.style.width = `${Math.max(80, (img.offsetWidth || 240) - 30)}px`;
    reflowPages();
  });
  block.querySelector('.img-del').addEventListener('click', () => {
    block.remove();
    renumberBlocks();
    reflowPages();
  });

  block.querySelector('.dup').addEventListener('click', () => {
    const clone = createDroppedImageBlock(img.src);
    clone.querySelector('img').style.width = img.style.width;
    block.after(clone);
    renumberBlocks();
    reflowPages();
  });

  block.querySelector('.del').addEventListener('click', () => {
    block.remove();
    renumberBlocks();
    reflowPages();
  });

  return block;
}

function renderResizableImage(imgSlot, src, initialWidth) {
  imgSlot.innerHTML = `
    <span class="opt-img-preview" contenteditable="false">
      <img src="${src}" alt="選項圖片" style="width: ${initialWidth}px; height: auto;" />
      <span class="img-resize-toolbar">
        <button type="button" class="img-ctrl-btn zoom-in" title="放大圖片">＋</button>
        <button type="button" class="img-ctrl-btn zoom-out" title="縮小圖片">－</button>
        <button type="button" class="img-ctrl-btn img-del" title="移除圖片">✕</button>
      </span>
    </span>
  `;

  const img = imgSlot.querySelector('img');
  const btnIn = imgSlot.querySelector('.zoom-in');
  const btnOut = imgSlot.querySelector('.zoom-out');
  const btnDel = imgSlot.querySelector('.img-del');

  const step = 15;
  const minW = 35;
  const maxW = 280;

  btnIn.addEventListener('click', (e) => {
    e.stopPropagation();
    const curW = img.offsetWidth || initialWidth;
    img.style.width = `${Math.min(maxW, curW + step)}px`;
    reflowPages();
  });

  btnOut.addEventListener('click', (e) => {
    e.stopPropagation();
    const curW = img.offsetWidth || initialWidth;
    img.style.width = `${Math.max(minW, curW - step)}px`;
    reflowPages();
  });

  btnDel.addEventListener('click', (e) => {
    e.stopPropagation();
    imgSlot.innerHTML = '';
    reflowPages();
  });
}