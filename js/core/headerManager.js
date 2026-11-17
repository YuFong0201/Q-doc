import { updateState } from '../state.js';

const HEADER_TEMPLATES = {
  exam: `
    <h2 class="hdr-title" contenteditable="true">○○國民小學 115學年度 第1學期 期中評量 國語科試卷</h2>
    <div class="hdr-meta-row">
      <span>＿＿年＿＿班 ＿＿號 姓名：＿＿＿＿＿＿</span>
      <span>家長簽名：＿＿＿＿＿＿</span>
      <span class="hdr-score-box">分</span>
    </div>
  `,
  quiz: `
    <h2 class="hdr-title" contenteditable="true">國語科 隨堂小考練習卷</h2>
    <div class="hdr-meta-row">
      <span>班級：＿＿＿ 座號：＿＿＿ 姓名：＿＿＿＿＿＿</span>
      <span class="hdr-score-box">分</span>
    </div>
  `,
  worksheet: `
    <div class="hdr-worksheet-box">
      <h2 class="hdr-title" contenteditable="true">★ 素養導向學習單：生活中的文字觀察 ★</h2>
      <div class="hdr-meta-row">
        <span>＿＿年＿＿班 姓名：＿＿＿＿＿＿</span>
        <span>日期：＿＿月＿＿日</span>
      </div>
    </div>
  `,
  none: ``
};

export function initHeaderManager() {
  const select = document.getElementById('select-header-template');
  const slot = document.getElementById('exam-header-slot');
  if (!select || !slot) return;

  const renderHeader = (type) => {
    updateState('headerTemplate', type);
    slot.innerHTML = HEADER_TEMPLATES[type] || '';
  };

  select.addEventListener('change', (e) => renderHeader(e.target.value));
  renderHeader('exam'); // 預設套用正式段考卷
}