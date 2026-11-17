export default {
  id: 'word-problem',
  name: '數學應用題',
  subjects: ['數學'],
  icon: '🧮',
  createContent() {
    return `
      <div>
        <div contenteditable="true">
          <span class="auto-q-num">1</span>. 老師有 120 份作業要改，每一分鐘能改3份，請問幾分鐘內可以改完？
        </div>
        <div class="word-problem-area">
          <div class="word-problem-ans" contenteditable="true">答：（   ）盒</div>
        </div>
      </div>
    `;
  }
};