import { state, updateState } from '../state.js';
import { applyIVS, stripIVS, extractIVSIndex } from './ivsConverter.js';
import { toggleSingleCharBopomofo } from './bopomofoEngine.js';

let activeTokenEl = null;

export async function initPolyphoneDetector() {
  try {
    const res = await fetch('assets/data/polyphones.json');
    if (res.ok) {
      state.polyphoneDict = await res.json();
    } else {
      console.error('載入 polyphones.json 失敗:', res.status);
      state.polyphoneDict = {};
    }
  } catch (err) {
    console.error('解析 polyphones.json 發生錯誤:', err);
    state.polyphoneDict = {};
  }

  const pagesContainer = document.getElementById('pages-container');
  const popover = document.getElementById('polyphone-popover');
  const btnClose = document.getElementById('btn-close-popover');
  const btnScan = document.getElementById('btn-scan-polyphones');
  const chkEnableEdit = document.getElementById('chk-enable-polyphone-edit');
  const chkHighlight = document.getElementById('chk-highlight-polyphones');
  const btnToggleSingle = document.getElementById('btn-toggle-single-bopo');

  if (!pagesContainer || !popover) return;

  // 切換破音字點擊編輯模式狀態
  const setPolyphoneEditMode = (enabled) => {
    updateState('polyphoneEditEnabled', enabled);
    pagesContainer.classList.toggle('polyphone-edit-active', enabled);

    if (enabled) {
      // 1. 先修復任何因先前打字而被塞入多字的異常 .char-token
      unwrapCorruptedTokens(pagesContainer);
      // 2. 掃描全卷所有純文字並精準包裹為單字 .char-token
      document.querySelectorAll('.blocks-container').forEach((box) => scanAndWrapChars(box));
      // 3. 暫時停用 contenteditable 避免點擊選字時產生游標或破壞 span 結構
      toggleEditableLock(pagesContainer, true);
    } else {
      popover.hidden = true;
      // 4. 恢復正常文字編輯，並將未套用特殊破音/隱藏的普通單字還原為純文字，避免打字時吞字
      toggleEditableLock(pagesContainer, false);
      unwrapPlainTokens(pagesContainer);
    }
  };

  if (chkEnableEdit) {
    chkEnableEdit.checked = Boolean(state.polyphoneEditEnabled);
    setPolyphoneEditMode(chkEnableEdit.checked);

    chkEnableEdit.addEventListener('change', (e) => {
      setPolyphoneEditMode(e.target.checked);
    });
  }

  // 切換是否顯示破音字黃色底色
  if (chkHighlight) {
    chkHighlight.addEventListener('change', (e) => {
      updateState('showPolyphoneHints', e.target.checked);
      document.querySelectorAll('.blocks-container').forEach((box) => {
        box.classList.toggle('show-polyphone-hints', e.target.checked);
      });
    });
  }

  // 手動掃描全卷新增的文字
  if (btnScan) {
    btnScan.addEventListener('click', () => {
      unwrapCorruptedTokens(pagesContainer);
      document.querySelectorAll('.blocks-container').forEach((box) => scanAndWrapChars(box));
    });
  }

  // 委派點擊事件：僅在「破音字點擊編輯」開啟時，點擊單一國字才開啟迷你選單
  pagesContainer.addEventListener('click', (e) => {
    if (!state.polyphoneEditEnabled) {
      popover.hidden = true;
      return;
    }

    // 若點擊到還沒被包裹的新字，即時掃描該區塊
    const block = e.target.closest('.question-block');
    if (block) {
      unwrapCorruptedTokens(block);
      scanAndWrapChars(block);
    }

    const token = e.target.closest('.char-token');
    if (!token) {
      popover.hidden = true;
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    openPopoverForToken(token);
  });

  // 單字隱藏/顯示注音按鈕
  if (btnToggleSingle) {
    btnToggleSingle.addEventListener('click', () => {
      if (!activeTokenEl) return;
      toggleSingleCharBopomofo(activeTokenEl);
      updateSingleButtonText(activeTokenEl);
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      popover.hidden = true;
    });
  }
}

/**
 * 暫時鎖定/解鎖畫布上的 contenteditable，防止破音字點選模式時瀏覽器把後續打字吞進 span 裡
 */
function toggleEditableLock(rootEl, lock) {
  if (lock) {
    rootEl.querySelectorAll('[contenteditable="true"]').forEach((el) => {
      el.dataset.wasEditable = 'true';
      el.setAttribute('contenteditable', 'false');
    });
  } else {
    rootEl.querySelectorAll('[data-was-editable="true"]').forEach((el) => {
      el.removeAttribute('data-was-editable');
      el.setAttribute('contenteditable', 'true');
    });
  }
}

/**
 * 檢查並拆解任何因為在 contenteditable 內換行/打字而被塞入超過 1 個字的異常 .char-token
 */
function unwrapCorruptedTokens(rootEl) {
  rootEl.querySelectorAll('.char-token').forEach((token) => {
    const pureText = stripIVS(token.textContent);
    if (Array.from(pureText).length !== 1 || token.querySelector('*')) {
      const parent = token.parentNode;
      if (!parent) return;
      while (token.firstChild) {
        parent.insertBefore(token.firstChild, token);
      }
      parent.removeChild(token);
    }
  });
  rootEl.normalize();
}

/**
 * 退出破音字點擊模式時，將未修改讀音且未隱藏注音的普通單字還原為純文字，確保打字換行不沾黏
 */
function unwrapPlainTokens(rootEl) {
  rootEl.querySelectorAll('.char-token').forEach((token) => {
    const ivs = parseInt(token.dataset.ivsIndex || '0', 10);
    const hasCustomStyle = token.classList.contains('hide-bopo') || token.classList.contains('force-bopo');
    if (ivs === 0 && !hasCustomStyle) {
      const textNode = document.createTextNode(token.textContent);
      token.parentNode?.replaceChild(textNode, token);
    }
  });
  rootEl.normalize();
}

export function scanAndWrapChars(rootEl) {
  if (!rootEl) return;
  unwrapCorruptedTokens(rootEl);

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

  const charClusterRegex = /([\u4E00-\u9FFF][\u{E0100}-\u{E01EF}]?)/gu;

  textNodes.forEach((textNode) => {
    const frag = document.createDocumentFragment();
    const parts = textNode.nodeValue.split(charClusterRegex);

    parts.forEach((part) => {
      if (!part) return;
      const pure = stripIVS(part);
      const isChinese = /^[\u4E00-\u9FFF]$/.test(pure);

      if (isChinese) {
        const existingIvs = extractIVSIndex(part);
        const span = document.createElement('span');
        span.className = 'char-token';
        span.dataset.baseChar = pure;
        span.dataset.ivsIndex = String(existingIvs);

        if (state.polyphoneDict && state.polyphoneDict[pure]) {
          span.classList.add('is-polyphone');
          span.title = `破音字「${pure}」：點擊可切換讀音`;
        }
        span.textContent = part;
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(part));
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

  // 永遠直接從當下 DOM 文字取得真實單字，避免 dataset 殘留舊字
  const baseChar = stripIVS(tokenEl.textContent).trim();
  tokenEl.dataset.baseChar = baseChar;

  const currentIvs = parseInt(tokenEl.dataset.ivsIndex || '0', 10);
  const readings = state.polyphoneDict ? state.polyphoneDict[baseChar] : null;

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
        tokenEl.dataset.baseChar = baseChar;
        tokenEl.dataset.ivsIndex = String(item.ivsIndex);
        tokenEl.dataset.reading = item.bopomofo;
        tokenEl.textContent = applyIVS(baseChar, item.ivsIndex);
        tokenEl.classList.remove('hide-bopo');
        if (!state.bopomofoDefaultOn) {
          tokenEl.classList.add('force-bopo');
        }
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
  btn.textContent = isHidden ? '顯示此字注音' : '隱藏此字注音';
}