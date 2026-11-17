export default {
  id: 'header-section',
  name: '大題標題列',
  subjects: ['國語', '數學', '英語', '自然', '社會', '生活'],
  icon: '📌',
  createContent() {
    return `
      <div class="tpl-section-header" contenteditable="true">
        <span class="auto-section-num">一</span>、大題名稱（每題 2 分，共 20 分）
      </div>
    `;
  }
};