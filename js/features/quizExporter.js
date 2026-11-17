// 一鍵匯出單一獨立、免網路可執行的「學生平板線上互動測驗 HTML」

export function initQuizExporter() {
  const btnExportQuiz = document.getElementById('btn-export-interactive-quiz');
  if (!btnExportQuiz) return;

  btnExportQuiz.addEventListener('click', () => {
    const htmlContent = buildInteractiveQuizHtml();
    const docTitle = document.getElementById('doc-title-input')?.value || '線上互動測驗';
    const safeTitle = docTitle.replace(/[\\/:*?"<>|]/g, '_');

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}_學生互動測驗.html`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function buildInteractiveQuizHtml() {
  const docTitle = document.getElementById('doc-title-input')?.value || '國小線上互動學習單';
  const blocks = Array.from(document.querySelectorAll('.paper-page .question-block'));

  const questionsHtml = blocks.map((block, index) => {
    const clone = block.cloneNode(true);
    // 移除編輯器專用控制列與拖曳把手
    clone.querySelectorAll('.block-actions, .block-drag-handle, .tpl-inline-controls, .img-resize-toolbar, .subq-opt-controls, .opt-img-trigger, .opt-img-input, .ra-speak-block-btn').forEach((el) => el.remove());

    // 若區塊內含 Chart.js Canvas，轉成靜態高解析圖片嵌入，確保離線測驗 100% 顯示圖表
    const origCanvas = block.querySelector('canvas');
    const clonedCanvas = clone.querySelector('canvas');
    if (origCanvas && clonedCanvas) {
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
    }

    // 偵測此題是否有老師標記的紅字標準解答（.qdoc-answer-key 或 style="color: #FE4A49"）
    let correctOptionIndex = -1;
    const optItems = Array.from(clone.querySelectorAll('.mc-opt-item'));

    if (optItems.length > 0) {
      optItems.forEach((opt, optIdx) => {
        const hasRed = opt.querySelector('.qdoc-answer-key') || /#fe4a49|rgb\(254,\s*74,\s*73\)/i.test(opt.innerHTML);
        if (hasRed) {
          correctOptionIndex = optIdx;
        }
        // 將選項內的紅字恢復為一般黑色，避免作答前直接洩漏答案
        opt.querySelectorAll('.qdoc-answer-key, [style*="color"]').forEach((el) => {
          el.style.color = 'inherit';
          el.style.fontWeight = 'normal';
        });
      });

      const optsButtonsHtml = optItems.map((opt, optIdx) => {
        const optHtml = opt.innerHTML;
        return `
          <label class="quiz-opt-card">
            <input type="radio" name="q_${index}" value="${optIdx}" />
            <div class="quiz-opt-body">${optHtml}</div>
          </label>
        `;
      }).join('');

      // 移除原本靜態選項網格，改為可點擊作答卡片
      const grid = clone.querySelector('.mc-options-grid, .reading-subq-options');
      if (grid) grid.remove();

      return `
        <section class="quiz-card" data-q-type="choice" data-answer="${correctOptionIndex}">
          <div class="quiz-card-top">
            <span class="quiz-badge">選擇題</span>
            <button type="button" class="speak-btn" onclick="speakCard(this)">🔊 聽題目</button>
          </div>
          <div class="quiz-stem">${clone.innerHTML}</div>
          <div class="quiz-options-list">${optsButtonsHtml}</div>
          <div class="quiz-feedback" hidden></div>
        </section>
      `;
    }

    // 若為大題標題列
    if (clone.querySelector('.tpl-section-header')) {
      return `<h2 class="quiz-section-title">${clone.textContent.trim()}</h2>`;
    }

    // 其餘題型（填充、簡答、圈選、造句、數學應用題等）：保留題目並附上學生作答輸入框
    const redAnswers = [];
    clone.querySelectorAll('.qdoc-answer-key, [style*="color"]').forEach((el) => {
      const c = (el.style?.color || '').toLowerCase().replace(/\s+/g, '');
      if (el.classList.contains('qdoc-answer-key') || c === '#fe4a49' || c === 'rgb(254,74,73)') {
        const ansTxt = el.textContent.trim();
        if (ansTxt) redAnswers.push(ansTxt);
        el.textContent = '（   ）';
        el.style.color = 'inherit';
      }
    });

    const expectedAns = redAnswers.join('、');
    return `
      <section class="quiz-card" data-q-type="text" data-answer-text="${escapeHtmlAttr(expectedAns)}">
        <div class="quiz-card-top">
          <span class="quiz-badge">作答題</span>
          <button type="button" class="speak-btn" onclick="speakCard(this)">🔊 聽題目</button>
        </div>
        <div class="quiz-stem">${clone.innerHTML}</div>
        <div class="quiz-input-wrap">
          <input type="text" class="quiz-text-input" placeholder="請在此輸入你的答案..." />
        </div>
        <div class="quiz-feedback" hidden></div>
      </section>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtmlAttr(docTitle)}｜學生線上互動測驗</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Microsoft JhengHei", "PingFang TC", sans-serif;
      background: #f1f5f9;
      color: #222629;
      line-height: 1.75;
    }
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
      max-width: 820px;
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
      margin-bottom: 16px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.06);
      border: 2px solid transparent;
    }
    .quiz-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .quiz-badge {
      background: #e0f2fe;
      color: #0369a1;
      font-weight: 700;
      font-size: 0.82rem;
      padding: 3px 10px;
      border-radius: 999px;
    }
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
    .quiz-stem { font-size: 1.15rem; margin-bottom: 12px; }
    .quiz-stem img { max-width: 100%; height: auto; border-radius: 8px; }
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
    }
    .quiz-opt-card:hover { border-color: #009FB7; background: #f0f9ff; }
    .quiz-opt-card input[type="radio"] { width: 20px; height: 20px; accent-color: #009FB7; }
    .quiz-text-input {
      width: 100%;
      padding: 10px 14px;
      font-size: 1.1rem;
      border: 2px solid #cbd5e1;
      border-radius: 10px;
    }
    .quiz-feedback {
      margin-top: 10px;
      padding: 8px 12px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.95rem;
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
    }
  </style>
</head>
<body>
  <header class="quiz-header">
    <h1>${escapeHtmlAttr(docTitle)}</h1>
    <p>奇蹟編輯器 Q-doc 互動學習單｜點選選項作答，點擊「🔊 聽題目」可語音報讀</p>
  </header>

  <main class="quiz-container">
    <div class="student-info-bar">
      <input type="text" id="stu-class" placeholder="班級（例如：三年甲班）" />
      <input type="text" id="stu-seat" placeholder="座號" />
      <input type="text" id="stu-name" placeholder="學生姓名" />
    </div>

    ${questionsHtml}

    <div class="submit-area">
      <button type="button" class="submit-btn" onclick="gradeQuiz()">✅ 交卷並查看批改結果</button>
      <div id="result-banner" class="result-banner" hidden></div>
    </div>
  </main>

  <script>
    function speakCard(btn) {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const card = btn.closest('.quiz-card');
      const clone = card.cloneNode(true);
      clone.querySelectorAll('.speak-btn, .quiz-badge, .quiz-feedback').forEach(el => el.remove());
      const text = clone.textContent.replace(/\\s+/g, ' ').trim();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-TW';
      window.speechSynthesis.speak(u);
    }

    function gradeQuiz() {
      const cards = document.querySelectorAll('.quiz-card');
      let gradableCount = 0;
      let correctCount = 0;

      cards.forEach((card) => {
        const fb = card.querySelector('.quiz-feedback');
        const qType = card.dataset.qType;

        if (qType === 'choice') {
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
        } else if (qType === 'text') {
          const expected = (card.dataset.answerText || '').trim();
          const userVal = (card.querySelector('.quiz-text-input')?.value || '').trim();
          if (expected) {
            gradableCount++;
            fb.hidden = false;
            if (userVal === expected) {
              correctCount++;
              fb.className = 'quiz-feedback fb-correct';
              fb.textContent = '⭕ 答對了！完全正確！';
            } else {
              fb.className = 'quiz-feedback fb-wrong';
              fb.textContent = '❌ 參考解答：' + expected;
            }
          }
        }
      });

      const banner = document.getElementById('result-banner');
      const stuName = document.getElementById('stu-name').value.trim() || '同學';
      banner.hidden = false;
      if (gradableCount > 0) {
        const score = Math.round((correctCount / gradableCount) * 100);
        banner.innerHTML = '🎉 <strong>' + stuName + '</strong> 已完成作答！<br/>自動批改得分：<strong>' + score + ' 分</strong>（答對 ' + correctCount + ' / ' + gradableCount + ' 題）';
      } else {
        banner.innerHTML = '🎉 <strong>' + stuName + '</strong> 已完成作答！（本卷為開放式練習題，請請老師檢閱）';
      }
      banner.scrollIntoView({ behavior: 'smooth' });
    }
  </script>
</body>
</html>`;
}

function escapeHtmlAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}