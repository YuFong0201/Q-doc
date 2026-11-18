// 奇蹟編輯器 Q-doc 線上互動學習單模組
// 功能包含：
// 1. 匯出前「教師設定標準答案預覽視窗」（與學生實際看到畫面 100% 一致，可手動點選單選/多選/拖曳連連看設答案）
// 2. 一鍵匯出單一獨立、免網路可執行的「學生平板線上互動測驗 HTML」
// 3. 產生「學生平板掃描 QR Code」（將題目與答案壓縮編碼至 URL #quiz=...，免後端伺服器直接跨裝置作答）

const QR_SAFE_URL_LIMIT = 2400; // QR Code 掃描最穩定長度上限（字元數）

export function initQuizExporter() {
  const btnExportQuiz = document.getElementById('btn-export-interactive-quiz');
  if (!btnExportQuiz) return;

  btnExportQuiz.addEventListener('click', () => {
    const blocks = document.querySelectorAll('.paper-page .question-block');
    if (blocks.length === 0) {
      alert('目前考卷上還沒有任何題目，請先從左側插入題目後再匯出線上學習單！');
      return;
    }

    const quizModel = extractQuizModelFromPaper();
    const questionItems = quizModel.items.filter((it) => it.type !== 'section');
    if (questionItems.length === 0) {
      alert('本卷目前沒有可線上互動的題型（僅支援：選擇題、閱讀測驗、圈選題、連連看）。');
      return;
    }

    openTeacherAnswerSetupModal(quizModel);
  });
}

/**
 * 網頁啟動時檢查網址是否帶有 #quiz=...（學生掃描 QR Code 開啟）
 * 若是，則直接接管畫面並渲染全螢幕「學生線上互動學習單」
 */
export async function checkAndMountStudentModeFromUrl() {
  const hash = window.location.hash || '';
  if (!hash.startsWith('#quiz=')) return false;

  const encodedPayload = hash.slice('#quiz='.length).trim();
  if (!encodedPayload) return false;

  try {
    const quizModel = await decodeQuizPayloadFromUrl(encodedPayload);
    if (!quizModel || !Array.isArray(quizModel.items)) {
      throw new Error('無效的測驗資料格式');
    }

    // 隱藏載入遮罩並清空編輯器外殼，替換為全螢幕學生線上測驗介面
    document.title = `${quizModel.title || '線上互動測驗'}｜學生線上互動測驗`;
    document.body.className = 'student-quiz-standalone-body';
    document.body.innerHTML = buildStudentQuizBodyHtml(quizModel, false);

    // 注入學生測驗專屬樣式並啟動互動引擎
    injectQuizStyles(document.head);
    mountQuizRuntime(document.body, false);
    return true;
  } catch (err) {
    console.error('解析 QR Code 測驗連結失敗：', err);
    alert('無法讀取此線上學習單連結，可能網址不完整或已損毀。將為您開啟編輯器首頁。');
    history.replaceState(null, '', location.pathname + location.search);
    return false;
  }
}

/**
 * 第一步：從考卷畫布萃取結構化測驗資料模型（含預偵測紅字解答）
 */
function extractQuizModelFromPaper() {
  const docTitle = document.getElementById('doc-title-input')?.value?.trim() || '國小線上互動學習單';
  const blocks = Array.from(document.querySelectorAll('.paper-page .question-block'));
  const rawItems = [];

  blocks.forEach((block) => {
    const clone = cleanEditorBlock(block);

    // 1. 大題標題列
    if (clone.querySelector('.tpl-section-header')) {
      const titleText = clone.textContent.replace(/\s+/g, ' ').trim();
      if (titleText) {
        rawItems.push({ type: 'section', title: titleText });
      }
      return;
    }

    // 2. 閱讀測驗題組
    if (clone.querySelector('.reading-passage-box') || clone.querySelector('.reading-subq-item')) {
      const passageBox = clone.querySelector('.reading-passage-box');
      const passageHtml = passageBox ? passageBox.outerHTML : '';
      const subItems = Array.from(clone.querySelectorAll('.reading-subq-item'));

      if (subItems.length > 0) {
        const subQuestions = subItems.map((subItem) => {
          const subClone = subItem.cloneNode(true);
          const optItems = Array.from(subClone.querySelectorAll('.mc-opt-item'));
          let ansIdx = -1;
          const options = optItems.map((opt, idx) => {
            if (extractAndSanitizeAnswerKey(opt)) ansIdx = idx;
            return opt.innerHTML;
          });
          subClone.querySelectorAll('.reading-subq-options, .mc-options-grid').forEach((el) => el.remove());
          return {
            stemHtml: subClone.innerHTML,
            options,
            answer: ansIdx
          };
        });

        rawItems.push({
          type: 'reading',
          passageHtml,
          subQuestions
        });
        return;
      }
    }

    // 3. 連連看配對題
    if (clone.querySelector('.matching-columns')) {
      const leftBoxes = Array.from(clone.querySelectorAll('.matching-col.left .match-item-box'));
      const rightBoxes = Array.from(clone.querySelectorAll('.matching-col.right .match-item-box'));
      if (leftBoxes.length > 0 && rightBoxes.length > 0) {
        leftBoxes.forEach((el) => extractAndSanitizeAnswerKey(el));
        rightBoxes.forEach((el) => extractAndSanitizeAnswerKey(el));
        clone.querySelectorAll('.matching-columns').forEach((el) => el.remove());

        // 預設同列一對一配對（0->0, 1->1...），老師可在預覽畫面自由拖曳修改
        const pairCount = Math.min(leftBoxes.length, rightBoxes.length);
        const defaultPairs = {};
        for (let i = 0; i < pairCount; i++) {
          defaultPairs[i] = i;
        }

        rawItems.push({
          type: 'matching',
          stemHtml: clone.innerHTML,
          leftItems: leftBoxes.map((b) => b.innerHTML),
          rightItems: rightBoxes.map((b) => b.innerHTML),
          answers: defaultPairs
        });
        return;
      }
    }

    // 4. 圈選題（多選）
    if (clone.querySelector('.circle-items-wrap')) {
      const circleItems = Array.from(clone.querySelectorAll('.circle-option-item'));
      if (circleItems.length > 0) {
        const answers = [];
        const options = circleItems.map((item, idx) => {
          if (extractAndSanitizeAnswerKey(item)) answers.push(idx);
          return item.innerHTML;
        });
        clone.querySelectorAll('.circle-items-wrap').forEach((el) => el.remove());

        rawItems.push({
          type: 'multi-choice',
          stemHtml: clone.innerHTML,
          options,
          answers
        });
        return;
      }
    }

    // 5. 一般選擇題（單選）
    if (clone.querySelector('.mc-opt-item')) {
      const optItems = Array.from(clone.querySelectorAll('.mc-opt-item'));
      let ansIdx = -1;
      const options = optItems.map((opt, idx) => {
        if (extractAndSanitizeAnswerKey(opt)) ansIdx = idx;
        return opt.innerHTML;
      });
      clone.querySelectorAll('.mc-options-grid').forEach((el) => el.remove());

      rawItems.push({
        type: 'choice',
        stemHtml: clone.innerHTML,
        options,
        answer: ansIdx
      });
    }
  });

  // 過濾掉底下沒有任何可線上作答題目的孤兒大題標題
  const filteredItems = [];
  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    if (item.type === 'section') {
      const next = rawItems[i + 1];
      if (next && next.type !== 'section') {
        filteredItems.push(item);
      }
    } else {
      filteredItems.push(item);
    }
  }

  return {
    title: docTitle,
    items: filteredItems
  };
}

/**
 * 第二步：開啟「教師設定線上標準答案預覽視窗」（所見即所得，直接作答即設定答案）
 */
function openTeacherAnswerSetupModal(quizModel) {
  const existing = document.getElementById('teacher-quiz-setup-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'teacher-quiz-setup-overlay';
  overlay.className = 'tq-setup-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', '設定線上學習單標準答案與派發');

  overlay.innerHTML = `
    <div class="tq-setup-topbar">
      <div class="tq-topbar-left">
        <span class="tq-mode-badge">👩‍🏫 教師設定答案模式</span>
        <strong>請直接在下方學習單點選 / 連線設定標準答案</strong>
        <span class="tq-hint">（此畫面與學生平板看到的排版完全相同；未設答案的題目交卷時將自動略過計分）</span>
      </div>
      <div class="tq-topbar-actions">
        <button type="button" id="btn-tq-show-qr" class="tq-btn tq-btn-qr">📱 產生學生平板 QR Code</button>
        <button type="button" id="btn-tq-download-html" class="tq-btn tq-btn-primary">💾 下載離線測驗 HTML</button>
        <button type="button" id="btn-tq-close" class="tq-btn tq-btn-close">✕ 返回編輯</button>
      </div>
    </div>
    <div class="tq-setup-scroll-area" id="tq-preview-mount">
      ${buildStudentQuizBodyHtml(quizModel, true)}
    </div>
  `;

  injectQuizStyles(document.head);
  document.body.appendChild(overlay);

  const mountRoot = overlay.querySelector('#tq-preview-mount');
  mountQuizRuntime(mountRoot, true);

  // 關閉預覽設定視窗
  overlay.querySelector('#btn-tq-close').addEventListener('click', () => {
    overlay.remove();
  });

  // 按鈕 A：下載離線 HTML 檔
  overlay.querySelector('#btn-tq-download-html').addEventListener('click', () => {
    const finalizedModel = collectTeacherAnswersFromPreview(mountRoot, quizModel);
    const fullHtml = buildStandaloneOfflineHtml(finalizedModel);
    const safeTitle = finalizedModel.title.replace(/[\\/:*?"<>|]/g, '_');

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}_學生互動測驗.html`;
    a.click();
    URL.revokeObjectURL(url);

    const announcer = document.getElementById('a11y-announcer');
    if (announcer) {
      announcer.textContent = `已匯出學生線上學習單：${safeTitle}_學生互動測驗.html`;
    }
  });

  // 按鈕 B：產生學生平板掃描 QR Code
  overlay.querySelector('#btn-tq-show-qr').addEventListener('click', async () => {
    const finalizedModel = collectTeacherAnswersFromPreview(mountRoot, quizModel);
    await openQrCodeShareModal(finalizedModel);
  });
}

/**
 * 從教師預覽畫面收集剛才點選/連線的標準答案，寫回 quizModel
 */
function collectTeacherAnswersFromPreview(mountRoot, baseModel) {
  const clonedModel = JSON.parse(JSON.stringify(baseModel));
  const questionCards = Array.from(mountRoot.querySelectorAll('.quiz-card'));
  let cardCursor = 0;

  clonedModel.items.forEach((item) => {
    if (item.type === 'section') return;
    const card = questionCards[cardCursor++];
    if (!card) return;

    if (item.type === 'choice') {
      const checked = card.querySelector('input[type="radio"]:checked');
      item.answer = checked ? parseInt(checked.value, 10) : -1;
    } else if (item.type === 'reading') {
      const subBlocks = Array.from(card.querySelectorAll('.reading-sub-block'));
      item.subQuestions.forEach((sub, sIdx) => {
        const subEl = subBlocks[sIdx];
        if (!subEl) return;
        const checked = subEl.querySelector('input[type="radio"]:checked');
        sub.answer = checked ? parseInt(checked.value, 10) : -1;
      });
    } else if (item.type === 'multi-choice') {
      const checkedList = Array.from(card.querySelectorAll('input[type="checkbox"]:checked'))
        .map((el) => parseInt(el.value, 10))
        .sort((a, b) => a - b);
      item.answers = checkedList;
    } else if (item.type === 'matching') {
      const board = card.querySelector('.imatch-board');
      const state = board?._matchState;
      const pairsObj = {};
      if (state && state.connections) {
        state.connections.forEach((rightIdx, leftIdx) => {
          pairsObj[leftIdx] = rightIdx;
        });
      }
      item.answers = pairsObj;
    }
  });

  return clonedModel;
}

/**
 * 產生並顯示「學生平板 QR Code 投影視窗」
 */
async function openQrCodeShareModal(quizModel) {
  const existing = document.getElementById('qr-share-modal');
  if (existing) existing.remove();

  // 檢查是否在本機 file:// 開啟（手機平板無法透過 file:// 連線）
  const isLocalFile = window.location.protocol === 'file:';
  const baseUrl = window.location.href.split('#')[0];
  const encoded = await encodeQuizPayloadToUrl(quizModel);
  const shareUrl = `${baseUrl}#quiz=${encoded}`;
  const isTooLongForQr = shareUrl.length > QR_SAFE_URL_LIMIT;

  const modal = document.createElement('div');
  modal.id = 'qr-share-modal';
  modal.className = 'qr-modal-backdrop';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', '學生平板 QR Code 派發');

  let warningHtml = '';
  if (isLocalFile) {
    warningHtml = `
      <div class="qr-alert qr-alert-warn">
        ⚠️ 偵測到您目前以本機檔案（<code>file://</code>）開啟編輯器。學生平板無法直接掃描本機路徑，請將網站部署至 GitHub Pages 或學校伺服器後使用 QR Code，或改用「下載離線測驗 HTML」。
      </div>
    `;
  } else if (isTooLongForQr) {
    warningHtml = `
      <div class="qr-alert qr-alert-warn">
        ⚠️ 本份學習單資料量較大（共 ${shareUrl.length} 字元，可能包含高解析度插圖），單一 QR Code 密度過高會導致平板相機難以對焦掃描！<br/>
        建議改用上方「<strong>💾 下載離線測驗 HTML</strong>」透過 Google Classroom / AirDrop 傳送給學生，或複製下方連結貼到班級群組。
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="qr-modal-card">
      <div class="qr-modal-header">
        <h3>📱 學生平板掃描 QR Code 立即作答</h3>
        <button type="button" id="btn-close-qr-modal" class="qr-close-btn" aria-label="關閉">✕</button>
      </div>
      <div class="qr-modal-body">
        <p class="qr-modal-desc">請將此畫面投影至教室大螢幕，學生使用 iPad / 平板相機掃描即可直接進入「<strong>${escapeHtml(quizModel.title)}</strong>」作答！</p>
        ${warningHtml}
        <div id="qr-canvas-box" class="qr-canvas-box" ${isTooLongForQr ? 'style="display:none;"' : ''}>
          <div class="qr-loading-text">正在產生高解析 QR Code...</div>
        </div>
        <div class="qr-link-copy-row">
          <input type="text" id="qr-share-url-input" readonly value="${escapeHtml(shareUrl)}" />
          <button type="button" id="btn-copy-share-url" class="tq-btn tq-btn-primary">📋 複製測驗網址</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#btn-close-qr-modal').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  modal.querySelector('#btn-copy-share-url').addEventListener('click', async (e) => {
    const input = modal.querySelector('#qr-share-url-input');
    input.select();
    try {
      await navigator.clipboard.writeText(shareUrl);
      e.target.textContent = '✅ 已複製連結！';
    } catch {
      document.execCommand('copy');
      e.target.textContent = '✅ 已複製連結！';
    }
    setTimeout(() => {
      e.target.textContent = '📋 複製測驗網址';
    }, 2200);
  });

  if (!isTooLongForQr) {
    const qrBox = modal.querySelector('#qr-canvas-box');
    try {
      await ensureQrCodeLibraryLoaded();
      qrBox.innerHTML = '';
      // eslint-disable-next-line no-undef
      new QRCode(qrBox, {
        text: shareUrl,
        width: 280,
        height: 280,
        colorDark: '#222629',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.L
      });
    } catch {
      qrBox.innerHTML = '<div class="qr-alert qr-alert-warn">無法載入 QR Code 繪圖元件（可能處於離線狀態），請直接複製下方網址或改用「下載離線測驗 HTML」。</div>';
    }
  }
}

/**
 * 動態載入輕量 QRCode.js（僅在老師點擊產生 QR Code 時才載入）
 */
function ensureQrCodeLibraryLoaded() {
  if (window.QRCode) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('QRCode script load failed'));
    document.head.appendChild(script);
  });
}

/**
 * 將 quizModel 精簡序列化並壓縮編碼為 URL-safe Base64 字串
 */
async function encodeQuizPayloadToUrl(quizModel) {
  // 使用短鍵名縮減 JSON 體積
  const compact = {
    t: quizModel.title,
    i: quizModel.items.map((item) => {
      if (item.type === 'section') return { k: 's', t: item.title };
      if (item.type === 'choice') return { k: 'c', h: item.stemHtml, o: item.options, a: item.answer };
      if (item.type === 'multi-choice') return { k: 'm', h: item.stemHtml, o: item.options, a: item.answers };
      if (item.type === 'matching') {
        return { k: 'x', h: item.stemHtml, l: item.leftItems, r: item.rightItems, a: item.answers };
      }
      if (item.type === 'reading') {
        return {
          k: 'r',
          p: item.passageHtml,
          q: item.subQuestions.map((sq) => ({ h: sq.stemHtml, o: sq.options, a: sq.answer }))
        };
      }
      return null;
    }).filter(Boolean)
  };

  const jsonStr = JSON.stringify(compact);
  const rawBytes = new TextEncoder().encode(jsonStr);

  // 若瀏覽器支援原生 CompressionStream('deflate-raw')，大幅壓縮網址長度
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      writer.write(rawBytes);
      writer.close();
      const compressedBuf = await new Response(cs.readable).arrayBuffer();
      return 'z_' + bytesToBase64Url(new Uint8Array(compressedBuf));
    } catch {
      // 降級為未壓縮模式
    }
  }

  return 'u_' + bytesToBase64Url(rawBytes);
}

/**
 * 從 URL Hash 解壓縮並還原 quizModel
 */
async function decodeQuizPayloadFromUrl(encoded) {
  const mode = encoded.slice(0, 2);
  const b64 = encoded.slice(2);
  const bytes = base64UrlToBytes(b64);
  let jsonStr = '';

  if (mode === 'z_' && typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const decompressedBuf = await new Response(ds.readable).arrayBuffer();
    jsonStr = new TextDecoder().decode(decompressedBuf);
  } else {
    jsonStr = new TextDecoder().decode(bytes);
  }

  const compact = JSON.parse(jsonStr);
  return {
    title: compact.t || '國小線上互動學習單',
    items: (compact.i || []).map((it) => {
      if (it.k === 's') return { type: 'section', title: it.t };
      if (it.k === 'c') return { type: 'choice', stemHtml: it.h, options: it.o || [], answer: it.a ?? -1 };
      if (it.k === 'm') return { type: 'multi-choice', stemHtml: it.h, options: it.o || [], answers: it.a || [] };
      if (it.k === 'x') {
        return {
          type: 'matching',
          stemHtml: it.h,
          leftItems: it.l || [],
          rightItems: it.r || [],
          answers: it.a || {}
        };
      }
      if (it.k === 'r') {
        return {
          type: 'reading',
          passageHtml: it.p || '',
          subQuestions: (it.q || []).map((sq) => ({
            stemHtml: sq.h,
            options: sq.o || [],
            answer: sq.a ?? -1
          }))
        };
      }
      return null;
    }).filter(Boolean)
  };
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64Url) {
  let b64 = b64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 渲染學生學習單主體 HTML（同時供「教師設定答案預覽」與「學生實際作答」共用，確保 100% 一致）
 */
function buildStudentQuizBodyHtml(quizModel, isTeacherSetupMode) {
  const itemsHtml = quizModel.items.map((item, idx) => {
    if (item.type === 'section') {
      return `<h2 class="quiz-section-title">${escapeHtml(item.title)}</h2>`;
    }

    if (item.type === 'choice') {
      const optsHtml = item.options.map((optHtml, oIdx) => {
        const checkedAttr = isTeacherSetupMode && item.answer === oIdx ? 'checked' : '';
        return `
          <label class="quiz-opt-card">
            <input type="radio" name="q_${idx}" value="${oIdx}" ${checkedAttr} />
            <div class="quiz-opt-body">${optHtml}</div>
          </label>
        `;
      }).join('');

      return `
        <section class="quiz-card" data-q-type="choice" data-answer="${isTeacherSetupMode ? -1 : item.answer}">
          <div class="quiz-card-top">
            <span class="quiz-badge">選擇題</span>
            <button type="button" class="speak-btn" data-action="speak-card">🔊 聽題目</button>
          </div>
          <div class="quiz-stem">${item.stemHtml}</div>
          <div class="quiz-options-list">${optsHtml}</div>
          <div class="quiz-feedback" hidden></div>
        </section>
      `;
    }

    if (item.type === 'reading') {
      const subHtml = item.subQuestions.map((sq, sIdx) => {
        const optsHtml = sq.options.map((optHtml, oIdx) => {
          const checkedAttr = isTeacherSetupMode && sq.answer === oIdx ? 'checked' : '';
          return `
            <label class="quiz-opt-card">
              <input type="radio" name="q_${idx}_sub_${sIdx}" value="${oIdx}" ${checkedAttr} />
              <div class="quiz-opt-body">${optHtml}</div>
            </label>
          `;
        }).join('');

        return `
          <div class="reading-sub-block" data-sub-type="choice" data-answer="${isTeacherSetupMode ? -1 : sq.answer}">
            <div class="reading-sub-header">
              <div class="reading-sub-stem">${sq.stemHtml}</div>
              <button type="button" class="speak-btn speak-btn-sm" data-action="speak-sub">🔊 聽小題</button>
            </div>
            <div class="quiz-options-list">${optsHtml}</div>
            <div class="quiz-feedback" hidden></div>
          </div>
        `;
      }).join('');

      return `
        <section class="quiz-card" data-q-type="reading">
          <div class="quiz-card-top">
            <span class="quiz-badge badge-reading">閱讀測驗</span>
            <button type="button" class="speak-btn" data-action="speak-passage">🔊 聽短文</button>
          </div>
          <div class="quiz-reading-passage">${item.passageHtml}</div>
          <div class="quiz-reading-sublist">${subHtml}</div>
        </section>
      `;
    }

    if (item.type === 'multi-choice') {
      const ansSet = new Set(Array.isArray(item.answers) ? item.answers : []);
      const optsHtml = item.options.map((optHtml, oIdx) => {
        const checkedAttr = isTeacherSetupMode && ansSet.has(oIdx) ? 'checked' : '';
        return `
          <label class="quiz-opt-card quiz-multi-card">
            <input type="checkbox" name="q_${idx}" value="${oIdx}" ${checkedAttr} />
            <div class="quiz-opt-body">${optHtml}</div>
          </label>
        `;
      }).join('');

      return `
        <section class="quiz-card" data-q-type="multi-choice" data-answers="${isTeacherSetupMode ? '' : (item.answers || []).join(',')}">
          <div class="quiz-card-top">
            <span class="quiz-badge badge-multi">圈選題（可複選）</span>
            <button type="button" class="speak-btn" data-action="speak-card">🔊 聽題目</button>
          </div>
          <div class="quiz-stem">${item.stemHtml}</div>
          <div class="quiz-options-list">${optsHtml}</div>
          <div class="quiz-feedback" hidden></div>
        </section>
      `;
    }

    if (item.type === 'matching') {
      const leftRows = item.leftItems.map((html, i) => `
        <div class="imatch-row left">
          <div class="imatch-box">${html}</div>
          <button type="button" class="imatch-dot" data-side="left" data-idx="${i}" aria-label="左側第 ${i + 1} 項連線點"></button>
        </div>
      `).join('');

      const rightRows = item.rightItems.map((html, i) => `
        <div class="imatch-row right">
          <button type="button" class="imatch-dot" data-side="right" data-idx="${i}" aria-label="右側第 ${i + 1} 項連線點"></button>
          <div class="imatch-box">${html}</div>
        </div>
      `).join('');

      const presetPairsJson = escapeHtml(JSON.stringify(item.answers || {}));

      return `
        <section class="quiz-card" data-q-type="matching" data-answer-pairs="${isTeacherSetupMode ? '{}' : presetPairsJson}" data-initial-pairs="${isTeacherSetupMode ? presetPairsJson : '{}'}">
          <div class="quiz-card-top">
            <span class="quiz-badge badge-match">連連看（按住圓點拖曳連線）</span>
            <div style="display:flex; gap:8px;">
              <button type="button" class="clear-lines-btn" data-action="clear-lines">↺ 清除重連</button>
              <button type="button" class="speak-btn" data-action="speak-card">🔊 聽題目</button>
            </div>
          </div>
          <div class="quiz-stem">${item.stemHtml}</div>
          <div class="imatch-board">
            <div class="imatch-col left">${leftRows}</div>
            <div class="imatch-gap"></div>
            <div class="imatch-col right">${rightRows}</div>
            <svg class="imatch-svg"></svg>
          </div>
          <div class="quiz-feedback" hidden></div>
        </section>
      `;
    }

    return '';
  }).join('\n');

  const bottomSubmitSection = isTeacherSetupMode
    ? `<div class="submit-area"><div class="teacher-setup-footer-note">👆 以上為學生平板實際看到的互動畫面，確認標準答案設定完成後，請點擊右上角「產生學生平板 QR Code」或「下載離線測驗 HTML」。</div></div>`
    : `
      <div class="submit-area">
        <button type="button" class="submit-btn" data-action="grade-quiz">✅ 交卷並查看批改結果</button>
        <div class="result-banner" hidden></div>
      </div>
    `;

  return `
    <header class="quiz-header">
      <h1>${escapeHtml(quizModel.title)}</h1>
      <p>奇蹟編輯器 Q-doc 互動學習單｜支援平板觸控連線、點選作答與語音報讀</p>
    </header>
    <main class="quiz-container">
      <div class="student-info-bar">
        <input type="text" class="stu-class" placeholder="班級（例如：三年甲班）" ${isTeacherSetupMode ? 'disabled' : ''} />
        <input type="text" class="stu-seat" placeholder="座號" ${isTeacherSetupMode ? 'disabled' : ''} />
        <input type="text" class="stu-name" placeholder="學生姓名" ${isTeacherSetupMode ? 'disabled' : ''} />
      </div>
      ${itemsHtml}
      ${bottomSubmitSection}
    </main>
  `;
}

/**
 * 掛載學生作答／教師設定答案的互動事件（語音報讀、連連看拖曳畫線、自動批改）
 */
function mountQuizRuntime(rootEl, isTeacherSetupMode) {
  // 1. 語音報讀與按鈕委派
  rootEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'speak-card') {
      const card = btn.closest('.quiz-card');
      const clone = card.cloneNode(true);
      clone.querySelectorAll('.speak-btn, .clear-lines-btn, .quiz-badge, .quiz-feedback').forEach((el) => el.remove());
      speakText(clone.textContent.replace(/\s+/g, ' ').trim());
    } else if (action === 'speak-passage') {
      const passage = btn.closest('.quiz-card')?.querySelector('.quiz-reading-passage');
      if (passage) speakText(passage.textContent.replace(/\s+/g, ' ').trim());
    } else if (action === 'speak-sub') {
      const sub = btn.closest('.reading-sub-block');
      const clone = sub.cloneNode(true);
      clone.querySelectorAll('.speak-btn, .quiz-feedback').forEach((el) => el.remove());
      speakText(clone.textContent.replace(/\s+/g, ' ').trim());
    } else if (action === 'clear-lines') {
      const card = btn.closest('.quiz-card');
      const board = card?.querySelector('.imatch-board');
      if (board && board._matchState) {
        board._matchState.connections.clear();
        board._matchState.gradedColors = null;
        clearSelectedDot(board, board._matchState);
        const fb = card.querySelector('.quiz-feedback');
        if (fb) fb.hidden = true;
        renderMatchLines(board);
      }
    } else if (action === 'grade-quiz' && !isTeacherSetupMode) {
      gradeQuizInContainer(rootEl);
    }
  });

  // 2. 初始化所有連連看看板
  rootEl.querySelectorAll('.imatch-board').forEach((board) => {
    const card = board.closest('.quiz-card');
    const initialPairs = JSON.parse(card?.dataset.initialPairs || '{}');
    const connMap = new Map();
    Object.entries(initialPairs).forEach(([l, r]) => {
      connMap.set(Number(l), Number(r));
    });

    const state = {
      connections: connMap,
      draggingFrom: null,
      tempPoint: null,
      selectedDot: null,
      gradedColors: null
    };
    board._matchState = state;

    board.querySelectorAll('.imatch-dot').forEach((dot) => {
      dot.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const side = dot.dataset.side;
        const idx = parseInt(dot.dataset.idx, 10);
        const pos = getDotCenter(board, dot);

        if (state.selectedDot && state.selectedDot.side !== side) {
          const leftIdx = side === 'left' ? idx : state.selectedDot.idx;
          const rightIdx = side === 'right' ? idx : state.selectedDot.idx;
          setConnection(state, leftIdx, rightIdx);
          clearSelectedDot(board, state);
          renderMatchLines(board);
          return;
        }

        clearSelectedDot(board, state);
        dot.classList.add('is-active');
        state.selectedDot = { side, idx, el: dot };
        state.draggingFrom = { side, idx, x: pos.x, y: pos.y };
        state.tempPoint = { x: pos.x, y: pos.y };
        renderMatchLines(board);
      });
    });

    const onPointerMove = (e) => {
      if (!state.draggingFrom) return;
      const rect = board.getBoundingClientRect();
      state.tempPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      renderMatchLines(board);
    };

    const onPointerUp = (e) => {
      if (!state.draggingFrom) return;
      const targetEl = document.elementFromPoint(e.clientX, e.clientY);
      const targetDot = targetEl ? targetEl.closest('.imatch-dot') : null;

      if (targetDot && board.contains(targetDot)) {
        const targetSide = targetDot.dataset.side;
        const targetIdx = parseInt(targetDot.dataset.idx, 10);
        if (targetSide !== state.draggingFrom.side) {
          const leftIdx = targetSide === 'left' ? targetIdx : state.draggingFrom.idx;
          const rightIdx = targetSide === 'right' ? targetIdx : state.draggingFrom.idx;
          setConnection(state, leftIdx, rightIdx);
          clearSelectedDot(board, state);
        }
      }

      state.draggingFrom = null;
      state.tempPoint = null;
      renderMatchLines(board);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // 延遲一幀待版面穩定後繪製預設連線
    requestAnimationFrame(() => renderMatchLines(board));
  });

  window.addEventListener('resize', () => {
    rootEl.querySelectorAll('.imatch-board').forEach(renderMatchLines);
  });
}

function setConnection(state, leftIdx, rightIdx) {
  for (const [l, r] of state.connections.entries()) {
    if (r === rightIdx) state.connections.delete(l);
  }
  state.connections.set(leftIdx, rightIdx);
  state.gradedColors = null;
}

function clearSelectedDot(board, state) {
  board.querySelectorAll('.imatch-dot.is-active').forEach((d) => d.classList.remove('is-active'));
  state.selectedDot = null;
}

function getDotCenter(board, dot) {
  const bRect = board.getBoundingClientRect();
  const dRect = dot.getBoundingClientRect();
  return {
    x: dRect.left - bRect.left + dRect.width / 2,
    y: dRect.top - bRect.top + dRect.height / 2
  };
}

function renderMatchLines(board) {
  const state = board?._matchState;
  const svg = board?.querySelector('.imatch-svg');
  if (!state || !svg) return;

  board.querySelectorAll('.imatch-dot').forEach((d) => d.classList.remove('is-connected'));
  let linesSvg = '';

  state.connections.forEach((rightIdx, leftIdx) => {
    const lDot = board.querySelector(`.imatch-dot[data-side="left"][data-idx="${leftIdx}"]`);
    const rDot = board.querySelector(`.imatch-dot[data-side="right"][data-idx="${rightIdx}"]`);
    if (!lDot || !rDot) return;

    lDot.classList.add('is-connected');
    rDot.classList.add('is-connected');

    const p1 = getDotCenter(board, lDot);
    const p2 = getDotCenter(board, rDot);
    const strokeColor = state.gradedColors ? (state.gradedColors.get(leftIdx) || '#009FB7') : '#009FB7';

    linesSvg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${strokeColor}" stroke-width="4" stroke-linecap="round" />`;
  });

  if (state.draggingFrom && state.tempPoint) {
    linesSvg += `<line x1="${state.draggingFrom.x}" y1="${state.draggingFrom.y}" x2="${state.tempPoint.x}" y2="${state.tempPoint.y}" stroke="#FE4A49" stroke-width="3.5" stroke-dasharray="6,6" stroke-linecap="round" />`;
  }

  svg.innerHTML = linesSvg;
}

function speakText(text) {
  if (!('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-TW';
  window.speechSynthesis.speak(u);
}

function gradeQuizInContainer(rootEl) {
  let gradableCount = 0;
  let correctCount = 0;

  // (A) 一般選擇題
  rootEl.querySelectorAll('.quiz-card[data-q-type="choice"]').forEach((card) => {
    const fb = card.querySelector('.quiz-feedback');
    const ansIdx = parseInt(card.dataset.answer, 10);
    const selected = card.querySelector('input[type="radio"]:checked');
    if (ansIdx >= 0) {
      gradableCount++;
      fb.hidden = false;
      if (selected && parseInt(selected.value, 10) === ansIdx) {
        correctCount++;
        fb.className = 'quiz-feedback fb-correct';
        fb.textContent = '⭕ 答對了！太棒了！';
      } else {
        fb.className = 'quiz-feedback fb-wrong';
        const labels = ['(A)', '(B)', '(C)', '(D)', '(E)', '(F)'];
        fb.textContent = '❌ 再想一想！正確答案是 ' + (labels[ansIdx] || '');
      }
    }
  });

  // (B) 閱讀測驗各小題
  rootEl.querySelectorAll('.reading-sub-block[data-sub-type="choice"]').forEach((sub) => {
    const fb = sub.querySelector('.quiz-feedback');
    const ansIdx = parseInt(sub.dataset.answer, 10);
    const selected = sub.querySelector('input[type="radio"]:checked');
    if (ansIdx >= 0) {
      gradableCount++;
      fb.hidden = false;
      if (selected && parseInt(selected.value, 10) === ansIdx) {
        correctCount++;
        fb.className = 'quiz-feedback fb-correct';
        fb.textContent = '⭕ 答對了！';
      } else {
        fb.className = 'quiz-feedback fb-wrong';
        const labels = ['(A)', '(B)', '(C)', '(D)', '(E)', '(F)'];
        fb.textContent = '❌ 正確答案是 ' + (labels[ansIdx] || '');
      }
    }
  });

  // (C) 圈選題（多選）
  rootEl.querySelectorAll('.quiz-card[data-q-type="multi-choice"]').forEach((card) => {
    const fb = card.querySelector('.quiz-feedback');
    const rawAns = card.dataset.answers || '';
    const expected = rawAns ? rawAns.split(',').map(Number).sort((a, b) => a - b) : [];
    const checked = Array.from(card.querySelectorAll('input[type="checkbox"]:checked'))
      .map((el) => parseInt(el.value, 10))
      .sort((a, b) => a - b);

    if (expected.length > 0) {
      gradableCount++;
      fb.hidden = false;
      const isExact = expected.length === checked.length && expected.every((v, i) => v === checked[i]);
      if (isExact) {
        correctCount++;
        fb.className = 'quiz-feedback fb-correct';
        fb.textContent = '⭕ 全部圈選正確！太厲害了！';
      } else {
        fb.className = 'quiz-feedback fb-wrong';
        fb.textContent = '❌ 圈選不完全正確喔，請檢查是否漏選或多選！';
      }
    }
  });

  // (D) 連連看配對題（依據老師在預覽畫面設定的 answerPairs 批改）
  rootEl.querySelectorAll('.quiz-card[data-q-type="matching"]').forEach((card) => {
    const board = card.querySelector('.imatch-board');
    const state = board?._matchState;
    const fb = card.querySelector('.quiz-feedback');
    const answerPairs = JSON.parse(card.dataset.answerPairs || '{}');
    const expectedEntries = Object.entries(answerPairs);
    if (!state || expectedEntries.length === 0) return;

    gradableCount++;
    fb.hidden = false;
    state.gradedColors = new Map();
    let rightPairs = 0;

    expectedEntries.forEach(([lStr, rVal]) => {
      const lIdx = Number(lStr);
      const expectedR = Number(rVal);
      const studentR = state.connections.get(lIdx);
      if (studentR === expectedR) {
        rightPairs++;
        state.gradedColors.set(lIdx, '#16a34a');
      } else if (studentR !== undefined) {
        state.gradedColors.set(lIdx, '#dc2626');
      }
    });

    // 標示多連或連錯的線段為紅色
    state.connections.forEach((studentR, lIdx) => {
      if (!state.gradedColors.has(lIdx)) {
        state.gradedColors.set(lIdx, '#dc2626');
      }
    });

    renderMatchLines(board);

    if (rightPairs === expectedEntries.length && state.connections.size === expectedEntries.length) {
      correctCount++;
      fb.className = 'quiz-feedback fb-correct';
      fb.textContent = '⭕ 連連看全部配對正確！';
    } else {
      fb.className = 'quiz-feedback fb-wrong';
      fb.textContent = `❌ 目前連對 ${rightPairs} / ${expectedEntries.length} 組（綠線為正確、紅線請再檢查）`;
    }
  });

  const banner = rootEl.querySelector('.result-banner');
  const stuName = rootEl.querySelector('.stu-name')?.value?.trim() || '同學';
  if (banner) {
    banner.hidden = false;
    if (gradableCount > 0) {
      const score = Math.round((correctCount / gradableCount) * 100);
      banner.innerHTML = `🎉 <strong>${escapeHtml(stuName)}</strong> 已完成作答！<br/>自動批改得分：<strong>${score} 分</strong>（答對 ${correctCount} / ${gradableCount} 題）`;
    } else {
      banner.innerHTML = `🎉 <strong>${escapeHtml(stuName)}</strong> 已完成線上學習單作答！`;
    }
    banner.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * 產生單一獨立離線 HTML 檔案內容
 */
function buildStandaloneOfflineHtml(quizModel) {
  const bodyHtml = buildStudentQuizBodyHtml(quizModel, false);
  const cssText = getSharedQuizCssText();

  return `<!DOCTYPE html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(quizModel.title)}｜學生線上互動測驗</title>
  <style>${cssText}</style>
</head>
<body class="student-quiz-standalone-body">
  ${bodyHtml}
  <script>
    (${mountQuizRuntime.toString()})(document.body, false);
    ${setConnection.toString()}
    ${clearSelectedDot.toString()}
    ${getDotCenter.toString()}
    ${renderMatchLines.toString()}
    ${speakText.toString()}
    ${gradeQuizInContainer.toString()}
    function escapeHtml(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  </script>
</body>
</html>`;
}

function cleanEditorBlock(block) {
  const clone = block.cloneNode(true);
  clone.querySelectorAll(
    '.block-actions, .block-drag-handle, .tpl-inline-controls, .img-resize-toolbar, .subq-opt-controls, .opt-img-trigger, .opt-img-input, .ra-speak-block-btn'
  ).forEach((el) => el.remove());

  const origCanvases = Array.from(block.querySelectorAll('canvas'));
  const clonedCanvases = Array.from(clone.querySelectorAll('canvas'));
  origCanvases.forEach((origCanvas, idx) => {
    const clonedCanvas = clonedCanvases[idx];
    if (!clonedCanvas) return;
    try {
      const img = document.createElement('img');
      img.src = origCanvas.toDataURL('image/png');
      img.alt = '統計圖表';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      clonedCanvas.replaceWith(img);
    } catch {
      // 略過跨域限制
    }
  });

  return clone;
}

function extractAndSanitizeAnswerKey(containerEl) {
  let hasRed = false;
  if (
    containerEl.querySelector('.qdoc-answer-key') ||
    /#fe4a49|rgb\(254,\s*74,\s*73\)/i.test(containerEl.innerHTML)
  ) {
    hasRed = true;
  }

  containerEl.querySelectorAll('.qdoc-answer-key, [style*="color"]').forEach((el) => {
    const c = (el.style?.color || '').toLowerCase().replace(/\s+/g, '');
    if (el.classList.contains('qdoc-answer-key') || c === '#fe4a49' || c === 'rgb(254,74,73)') {
      el.style.color = 'inherit';
      el.style.fontWeight = 'normal';
    }
  });

  return hasRed;
}

function injectQuizStyles(headEl) {
  if (document.getElementById('qdoc-interactive-quiz-styles')) return;
  const style = document.createElement('style');
  style.id = 'qdoc-interactive-quiz-styles';
  style.textContent = getSharedQuizCssText();
  headEl.appendChild(style);
}

function getSharedQuizCssText() {
  return `
    html:has(body.student-quiz-standalone-body),
    body.student-quiz-standalone-body {
      height: auto !important;
      min-height: 100vh !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      display: block !important;
    }
    .student-quiz-standalone-body, .tq-setup-scroll-area {
      margin: 0;
      font-family: "Microsoft JhengHei", "PingFang TC", sans-serif;
      background: #f1f5f9;
      color: #222629;
      line-height: 1.75;
    }
    .tq-setup-overlay {
      position: fixed;
      inset: 0;
      z-index: 3000;
      background: #f1f5f9;
      display: flex;
      flex-direction: column;
    }
    .tq-setup-topbar {
      background: #1e293b;
      color: #ffffff;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      border-bottom: 3px solid #009FB7;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10;
    }
    .tq-topbar-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      font-size: 0.95rem;
    }
    .tq-mode-badge {
      background: #FE4A49;
      color: #ffffff;
      font-weight: 800;
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 0.85rem;
    }
    .tq-hint { color: #cbd5e1; font-size: 0.85rem; }
    .tq-topbar-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .tq-btn {
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font-weight: 700;
      font-size: 0.92rem;
      cursor: pointer;
    }
    .tq-btn-qr { background: #10b981; color: #ffffff; }
    .tq-btn-qr:hover { background: #059669; }
    .tq-btn-primary { background: #009FB7; color: #ffffff; }
    .tq-btn-primary:hover { background: #0284c7; }
    .tq-btn-close { background: #475569; color: #ffffff; }
    .tq-btn-close:hover { background: #334155; }
    .tq-setup-scroll-area {
      flex: 1;
      overflow-y: auto;
      padding-bottom: 40px;
    }
    .teacher-setup-footer-note {
      background: #e0f2fe;
      color: #0369a1;
      border: 1.5px solid #7dd3fc;
      border-radius: 10px;
      padding: 12px 16px;
      font-weight: 700;
      font-size: 0.95rem;
    }

    /* QR Code 投影彈窗 */
    .qr-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 4000;
      background: rgba(15, 23, 42, 0.78);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .qr-modal-card {
      background: #ffffff;
      border-radius: 16px;
      width: min(500px, 95vw);
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.35);
    }
    .qr-modal-header {
      background: #222629;
      color: #ffffff;
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .qr-modal-header h3 { margin: 0; font-size: 1.08rem; }
    .qr-close-btn { background: none; border: none; color: #ffffff; font-size: 1.2rem; cursor: pointer; }
    .qr-modal-body { padding: 20px; text-align: center; }
    .qr-modal-desc { margin: 0 0 14px; font-size: 0.96rem; color: #334155; }
    .qr-canvas-box {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: #ffffff;
      border: 3px solid #009FB7;
      border-radius: 14px;
      margin: 8px auto 16px;
      min-width: 280px;
      min-height: 280px;
    }
    .qr-alert {
      text-align: left;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.88rem;
      margin-bottom: 12px;
      line-height: 1.55;
    }
    .qr-alert-warn { background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; }
    .qr-link-copy-row {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .qr-link-copy-row input {
      flex: 1;
      padding: 8px 10px;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.85rem;
      color: #475569;
    }

    /* 學生學習單與題目卡片共用樣式 */
    .quiz-header {
      background: #222629;
      color: #ffffff;
      padding: 18px 20px;
      text-align: center;
      border-bottom: 4px solid #009FB7;
    }
    .quiz-header h1 { margin: 0 0 6px; font-size: 1.4rem; }
    .quiz-header p { margin: 0; font-size: 0.9rem; color: #cbd5e1; }
    .quiz-container {
      max-width: 840px;
      margin: 20px auto 60px;
      padding: 0 16px;
    }
    .student-info-bar {
      background: #ffffff;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 18px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .student-info-bar input {
      padding: 8px 12px;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      font-size: 1rem;
      flex: 1;
      min-width: 140px;
    }
    .quiz-section-title {
      color: #009FB7;
      border-left: 5px solid #009FB7;
      padding-left: 12px;
      margin: 24px 0 12px;
      font-size: 1.2rem;
    }
    .quiz-card {
      background: #ffffff;
      border-radius: 14px;
      padding: 18px 20px;
      margin-bottom: 18px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.06);
      border: 2px solid transparent;
    }
    .quiz-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .quiz-badge {
      background: #e0f2fe;
      color: #0369a1;
      font-weight: 700;
      font-size: 0.84rem;
      padding: 3px 11px;
      border-radius: 999px;
    }
    .badge-reading { background: #fef3c7; color: #92400e; }
    .badge-multi { background: #ede9fe; color: #5b21b6; }
    .badge-match { background: #ccfbf1; color: #115e59; }
    .speak-btn {
      background: #009FB7;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 6px 12px;
      font-weight: 700;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .speak-btn-sm { padding: 4px 10px; font-size: 0.82rem; flex-shrink: 0; }
    .clear-lines-btn {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 6px 12px;
      font-weight: 700;
      cursor: pointer;
      font-size: 0.88rem;
    }
    .clear-lines-btn:hover { border-color: #FE4A49; color: #FE4A49; }
    .quiz-stem { font-size: 1.15rem; margin-bottom: 12px; }
    .quiz-stem img, .quiz-opt-body img, .imatch-box img { max-width: 100%; height: auto; border-radius: 6px; }
    .mc-stem-row { display: flex; align-items: flex-start; gap: 6px; }
    .mc-prefix { flex-shrink: 0; white-space: nowrap; }
    .mc-bracket { display: inline-block; width: 2.6em; }
    .quiz-options-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
    }
    .quiz-opt-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border: 2px solid #e2e8f0;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.15s;
      font-size: 1.08rem;
      background: #ffffff;
      user-select: none;
    }
    .quiz-opt-card:hover { border-color: #009FB7; background: #f0f9ff; }
    .quiz-opt-card:has(input:checked) {
      border-color: #009FB7;
      background: #e0f2fe;
      font-weight: 700;
    }
    .quiz-opt-card input[type="radio"],
    .quiz-opt-card input[type="checkbox"] {
      width: 20px;
      height: 20px;
      accent-color: #009FB7;
      flex-shrink: 0;
    }
    .quiz-opt-body {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .reading-passage-box {
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 16px;
      font-size: 1.12rem;
      overflow: hidden;
    }
    .passage-wrap-img-box { float: right; margin: 2px 0 8px 14px; }
    .quiz-reading-sublist { display: flex; flex-direction: column; gap: 16px; }
    .reading-sub-block { border-top: 1.5px dashed #e2e8f0; padding-top: 14px; }
    .reading-sub-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 10px;
    }
    .reading-sub-stem { font-size: 1.1rem; font-weight: 600; }
    .imatch-board {
      position: relative;
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      margin: 12px auto;
      padding: 8px 4px;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    .imatch-col {
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      gap: 16px;
      width: 38%;
      z-index: 2;
    }
    .imatch-gap { width: 24%; min-width: 80px; }
    .imatch-row { display: flex; align-items: center; gap: 12px; }
    .imatch-row.left { justify-content: flex-end; }
    .imatch-row.right { justify-content: flex-start; }
    .imatch-box {
      border: 2px solid #cbd5e1;
      background: #f8fafc;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 1.08rem;
      font-weight: 600;
      min-height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      flex: 1;
    }
    .imatch-dot {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 3px solid #009FB7;
      background: #ffffff;
      cursor: crosshair;
      flex-shrink: 0;
      padding: 0;
      touch-action: none;
      transition: transform 0.12s, background-color 0.12s;
    }
    .imatch-dot:hover, .imatch-dot.is-active {
      background: #009FB7;
      transform: scale(1.22);
      box-shadow: 0 0 0 4px rgba(0, 159, 183, 0.25);
    }
    .imatch-dot.is-connected { background: #009FB7; }
    .imatch-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    }
    .quiz-feedback {
      margin-top: 12px;
      padding: 9px 14px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.96rem;
    }
    .fb-correct { background: #dcfce7; color: #166534; }
    .fb-wrong { background: #fee2e2; color: #991b1b; }
    .submit-area { text-align: center; margin-top: 28px; }
    .submit-btn {
      background: #FE4A49;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 14px 36px;
      font-size: 1.15rem;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(254, 74, 73, 0.35);
    }
    .result-banner {
      background: #222629;
      color: #ffffff;
      padding: 20px;
      border-radius: 14px;
      text-align: center;
      margin-top: 20px;
      font-size: 1.25rem;
      line-height: 1.8;
    }
  `;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}