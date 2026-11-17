// 即時總分計算器與滿分提醒面板

export function initScoreCalculator() {
  const pagesContainer = document.getElementById('pages-container');
  const badgeEl = document.getElementById('score-status-badge');
  if (!pagesContainer || !badgeEl) return;

  const recalculate = () => {
    const { totalScore, sectionCount } = calculateExamTotalScore();
    renderScoreBadge(badgeEl, totalScore, sectionCount);
  };

  // 監聽題目增刪、排序、與老師直接編輯文字
  const observer = new MutationObserver(() => recalculate());
  observer.observe(pagesContainer, {
    childList: true,
    subtree: true,
    characterData: true
  });

  pagesContainer.addEventListener('input', recalculate);
  recalculate();
}

function calculateExamTotalScore() {
  const blocks = Array.from(document.querySelectorAll('.paper-page .question-block'));
  let totalScore = 0;
  let sectionCount = 0;

  for (let i = 0; i < blocks.length; i++) {
    const headerEl = blocks[i].querySelector('.tpl-section-header');
    if (!headerEl) continue;

    sectionCount++;
    const text = headerEl.textContent || '';

    // 1. 優先匹配明確寫出的大題總分，例如：「共 20 分」、「共20分」、「（20分）」、「(25 分)」
    const explicitTotalMatch =
      text.match(/共\s*(\d+(?:\.\d+)?)\s*分/) ||
      text.match(/[（(]\s*(\d+(?:\.\d+)?)\s*分\s*[）)]/);

    if (explicitTotalMatch) {
      totalScore += parseFloat(explicitTotalMatch[1]) || 0;
      continue;
    }

    // 2. 若大題標題只寫「每題 X 分」，自動計算到下一個大題之前的小題數量
    const perQMatch = text.match(/每[題格小]\s*(\d+(?:\.\d+)?)\s*分/);
    if (perQMatch) {
      const perScore = parseFloat(perQMatch[1]) || 0;
      let subCount = 0;
      for (let j = i + 1; j < blocks.length; j++) {
        if (blocks[j].querySelector('.tpl-section-header')) break;
        if (blocks[j].querySelector('.auto-q-num')) {
          subCount++;
        }
      }
      totalScore += perScore * subCount;
    }
  }

  // 避免浮點數誤差
  totalScore = Math.round(totalScore * 10) / 10;
  return { totalScore, sectionCount };
}

function renderScoreBadge(badgeEl, totalScore, sectionCount) {
  badgeEl.classList.remove('is-perfect', 'is-warning', 'is-neutral');

  if (sectionCount === 0 && totalScore === 0) {
    badgeEl.classList.add('is-neutral');
    badgeEl.textContent = '📊 總分：0 分';
    badgeEl.title = '插入「大題標題列」並設定配分（如：共 20 分），系統將自動加總';
    return;
  }

  if (totalScore === 100) {
    badgeEl.classList.add('is-perfect');
    badgeEl.textContent = '✅ 總分：100 分（滿分）';
    badgeEl.title = '全卷配分剛好 100 分！';
  } else if (totalScore < 100) {
    const diff = Math.round((100 - totalScore) * 10) / 10;
    badgeEl.classList.add('is-warning');
    badgeEl.textContent = `⚠️ 總分：${totalScore} 分（差 ${diff} 分）`;
    badgeEl.title = `目前全卷配分為 ${totalScore} 分，尚差 ${diff} 分達 100 分`;
  } else {
    const over = Math.round((totalScore - 100) * 10) / 10;
    badgeEl.classList.add('is-warning');
    badgeEl.textContent = `⚠️ 總分：${totalScore} 分（多 ${over} 分）`;
    badgeEl.title = `目前全卷配分為 ${totalScore} 分，超過 100 分 ${over} 分`;
  }
}