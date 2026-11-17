export default {
  id: 'sentence-making',
  name: '造句練習書寫格',
  subjects: ['國語'],
  icon: '✍️',
  createContent() {
    return `
      <div>
        <div contenteditable="true">
          <span class="auto-q-num">1</span>. <span class="vocab-tag-box">不但……而且……</span>
        </div>
        <div class="answer-lines-box">
          <div class="writing-line"></div>
          <div class="writing-line"></div>
        </div>
      </div>
    `;
  }
};