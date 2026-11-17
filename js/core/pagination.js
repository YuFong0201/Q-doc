import { state } from '../state.js';

let isReflowing = false;

export function initPagination() {
  window.addEventListener('resize', () => reflowPages());
}

export function reflowPages() {
  if (isReflowing) return;
  isReflowing = true;

  try {
    const container = document.getElementById('pages-container');
    if (!container) return;

    let pages = Array.from(container.querySelectorAll('.paper-page'));
    const isTwoCols = state.columnLayout === '2';
    const dividerClass = `divider-${state.columnDivider || 'none'}`;

    pages.forEach((p) => {
      p.classList.remove('a4-portrait', 'a4-landscape', 'b4-portrait', 'b4-landscape');
      p.classList.add(state.paperSize);

      const box = p.querySelector('.blocks-container');
      if (box) {
        box.classList.remove('cols-1', 'cols-2', 'divider-none', 'divider-dashed', 'divider-solid');
        box.classList.add(`cols-${isTwoCols ? '2' : '1'}`);
        if (isTwoCols) box.classList.add(dividerClass);
      }
    });

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const blocksBox = page.querySelector('.blocks-container');
      const blocks = Array.from(blocksBox.querySelectorAll('.question-block'));

      // 預留底部與右側安全界線（扣除邊距與頁碼區 ≈ 76px / 54px）
      const pageRect = page.getBoundingClientRect();
      const maxBottom = pageRect.bottom - 76;
      const maxRight = pageRect.right - 54;

      for (let b = 0; b < blocks.length; b++) {
        const block = blocks[b];
        const blockRect = block.getBoundingClientRect();

        // 單欄模式檢查底部溢位；雙欄模式下若第 2 欄也滿了，多出題目會往右側產生第 3 欄或超出底部
        const isOverflowBottom = blockRect.bottom > maxBottom + 2;
        const isOverflowRight = isTwoCols && blockRect.right > maxRight + 4;

        if (b > 0 && (isOverflowBottom || isOverflowRight)) {
          let nextPage = pages[i + 1];
          if (!nextPage) {
            nextPage = createNewPage(i + 2);
            container.appendChild(nextPage);
            pages.push(nextPage);
          }
          const nextBlocksBox = nextPage.querySelector('.blocks-container');
          const overflowBlocks = blocks.slice(b);
          overflowBlocks.reverse().forEach((ov) => {
            nextBlocksBox.insertBefore(ov, nextBlocksBox.firstChild);
          });
          break;
        }
      }
    }

    pages = Array.from(container.querySelectorAll('.paper-page'));
    for (let i = pages.length - 1; i >= 1; i--) {
      const box = pages[i].querySelector('.blocks-container');
      if (box.children.length === 0) {
        pages[i].remove();
      } else {
        break;
      }
    }

    pages = Array.from(container.querySelectorAll('.paper-page'));
    pages.forEach((p, idx) => {
      p.dataset.page = idx + 1;
    });
  } finally {
    isReflowing = false;
  }
}

function createNewPage(pageNum) {
  const article = document.createElement('article');
  article.id = `page-${pageNum}`;
  article.className = `paper-page ${state.paperSize}`;
  article.dataset.page = pageNum;

  const isTwoCols = state.columnLayout === '2';
  const colClasses = isTwoCols ? `cols-2 divider-${state.columnDivider || 'none'}` : 'cols-1';

  const box = document.createElement('div');
  box.className = `blocks-container ${colClasses} ${state.bopomofoDefaultOn ? 'bopo-default-on' : 'bopo-default-off'} ${state.showPolyphoneHints ? 'show-polyphone-hints' : ''}`;
  article.appendChild(box);
  return article;
}