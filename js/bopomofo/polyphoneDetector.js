import { state, updateState } from '../state.js';
import { applyIVS, stripIVS } from './ivsConverter.js';
import { toggleSingleCharBopomofo } from './bopomofoEngine.js';

let activeTokenEl = null;

export async function initPolyphoneDetector() {
  const res = await fetch('assets/data/polyphones.json');
  state.polyphoneDict = await res.json();

  const pagesContainer = document.getElementById('pages-container');
  const popover = document.getElementById('polyphone-popover');
  const btnClose = document.getElementById('btn-close-popover');
  const btnScan = document.getElementById('btn-scan-polyphones');
  const chkEnableEdit = document.getElementById('chk-enable-polyphone-edit');
  const chkHighlight = document.getElementById('chk-highlight-polyphones');
  const btnToggleSingle = document.getElementById('btn-toggle-single-bopo');

  // 初始化開關狀態（預設關閉破音字點擊編輯）
  if (chkEnableEdit) {
    chkEnableEdit.checked = Boolean(state.polyphoneEditEnabled);
    pagesContainer.classList.toggle('polyphone-edit-active', chkEnableEdit.checked);

    chkEnableEdit.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      updateState('polyphoneEditEnabled', enabled);
      pagesContainer.classList.toggle('polyphone-edit-active', enabled);

      if (enabled) {
        // 開啟編輯模式時，順便掃描全卷剛打好的文字，讓所有新國字都能立即點擊編輯
        document.querySelectorAll('.blocks-container').forEach((box) => scanAndWrapChars(box));
      } else {
        popover.hidden = true;
      }
    });
  }

  // 切換是否顯示破音字黃色底色
  chkHighlight.addEventListener('change', (e) => {
    updateState('showPolyphoneHints', e.target.checked);
    document.querySelectorAll('.blocks-container').forEach((box) => {
      box.classList.toggle('show-polyphone-hints', e.target.checked);
    });
  });

  // 掃描全卷新增的文字
  btnScan.addEventListener('click', () => {
    document.querySelectorAll('.blocks-container').forEach((box) => scanAndWrapChars(box));
  });

  // 委派點擊事件：僅在「破音字點擊編輯」開啟時，點擊已標記國字才開啟迷你選單
  pagesContainer.addEventListener('click', (e) => {
    if (!state.polyphoneEditEnabled) {
      popover.hidden = true;
      return;
    }
    const token = e.target.closest('.char-token');
    if (!token) {
      popover.hidden = true;
      return;
    }
    openPopoverForToken(token);
  });

  // 單字隱藏/顯示注音按鈕
  btnToggleSingle.addEventListener('click', () => {
    if (!activeTokenEl) return;
    toggleSingleCharBopomofo(activeTokenEl);
    updateSingleButtonText(activeTokenEl);
  });

  btnClose.addEventListener('click', () => {
    popover.hidden = true;
  });
}

export function scanAndWrapChars(rootEl) {
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement && (
      node.parentElement.classList.contains('char-token') ||
      node.parentElement.closest('.tpl-inline-controls') ||
      node.parentElement.closest('.block-actions')
    )) continue;
    if (node.nodeValue.trim().length > 0) textNodes.push(node);
  }

  textNodes.forEach((textNode) => {
    const frag = document.createDocumentFragment();
    const chars = Array.from(textNode.nodeValue);

    chars.forEach((ch) => {
      const pure = stripIVS(ch);
      const isChinese = /[\u4E00-\u9FFF]/.test(pure);
      if (isChinese) {
        const span = document.createElement('span');
        span.className = 'char-token';
        span.dataset.baseChar = pure;
        span.dataset.ivsIndex = '0';
        if (state.polyphoneDict[pure]) {
          span.classList.add('is-polyphone');
          span.title = `破音字「${pure}」：開啟編輯模式後可點擊切換讀音`;
        }
        span.textContent = ch;
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(ch));
      }
    });

    textNode.parentNode.replaceChild(frag, textNode);
  });
}

function openPopoverForToken(tokenEl) {
  activeTokenEl = tokenEl;
  const popover = document.getElementById('polyphone-popover');
  const titleEl = document.getElementById('popover-char-title');
  const optionsEl = document.getElementById('popover-options');

  const baseChar = tokenEl.dataset.baseChar;
  const currentIvs = parseInt(tokenEl.dataset.ivsIndex || '0', 10);
  const readings = state.polyphoneDict[baseChar];

  titleEl.textContent = `「${baseChar}」字注音設定`;
  optionsEl.innerHTML = '';

  if (readings && readings.length > 0) {
    readings.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `reading-option-btn ${item.ivsIndex === currentIvs ? 'selected' : ''}`;
      btn.innerHTML = `
        <span class="reading-bopo">${item.bopomofo}</span>
        <span class="reading-ex">${item.example}</span>
      `;
      btn.addEventListener('click', () => {
        tokenEl.dataset.ivsIndex = item.ivsIndex;
        tokenEl.dataset.reading = item.bopomofo;
        tokenEl.textContent = applyIVS(baseChar, item.ivsIndex);
        tokenEl.classList.remove('hide-bopo');
        if (!state.bopomofoDefaultOn) tokenEl.classList.add('force-bopo');
        popover.hidden = true;
      });
      optionsEl.appendChild(btn);
    });
  } else {
    optionsEl.innerHTML = `<div style="font-size:0.82rem;color:#5a626a;padding:4px;">一般單音字，可切換下方注音顯示狀態。</div>`;
  }

  updateSingleButtonText(tokenEl);

  const rect = tokenEl.getBoundingClientRect();
  popover.hidden = false;
  popover.style.top = `${Math.min(window.innerHeight - 180, rect.bottom + 6)}px`;
  popover.style.left = `${Math.min(window.innerWidth - 220, Math.max(10, rect.left))}px`;
}

function updateSingleButtonText(tokenEl) {
  const btn = document.getElementById('btn-toggle-single-bopo');
  const isHidden = tokenEl.classList.contains('hide-bopo') || (!state.bopomofoDefaultOn && !tokenEl.classList.contains('force-bopo'));
  btn.textContent = isHidden ? '👁️ 顯示此字注音' : '🙈 隱藏此字注音';
}