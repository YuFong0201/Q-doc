import { updateState } from '../state.js';

export function initAnswerKeyToggle() {
  const btnMarkRed = document.getElementById('btn-mark-answer-key');
  const chkHideAnswers = document.getElementById('chk-hide-answer-key');

  if (!btnMarkRed || !chkHideAnswers) return;

  // 1. 一鍵將反白選取的文字標記為「珊瑚紅 (#FE4A49) 標準解答」
  btnMarkRed.addEventListener('click', () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      alert('請先在考卷上反白選取要設為「標準解答」的文字或答案！');
      return;
    }

    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.className = 'qdoc-answer-key';
    span.style.color = '#FE4A49';
    span.style.fontWeight = 'bold';

    try {
      range.surroundContents(span);
    } catch {
      // 若跨節點反白，改用 execCommand 套用標準珊瑚紅並自動轉換標籤
      document.execCommand('foreColor', false, '#FE4A49');
      document.execCommand('bold', false, null);
    }
    sel.removeAllRanges();
  });

  // 2. 切換「教師解答卷」vs「學生空白卷（隱藏紅字解答）」
  chkHideAnswers.addEventListener('change', (e) => {
    const hideAnswers = e.target.checked;
    updateState('hideAnswerKey', hideAnswers);

    // 同時掃描老師手動用文字顏色調色盤選取的紅色解答 (#FE4A49 / rgb(254, 74, 73))
    document.querySelectorAll('.paper-page [style*="color"]').forEach((el) => {
      const c = (el.style.color || '').toLowerCase().replace(/\s+/g, '');
      if (c === '#fe4a49' || c === 'rgb(254,74,73)') {
        el.classList.add('qdoc-answer-key');
      }
    });

    document.body.classList.toggle('student-blank-mode', hideAnswers);
  });
}