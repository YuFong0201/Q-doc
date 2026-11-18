export async function loadFontsWithProgress(fontList) {
  const overlay = document.getElementById('loading-overlay');
  const fill = document.getElementById('progress-fill');
  const percentText = document.getElementById('progress-percent');
  const statusText = document.getElementById('loading-status');
  const barContainer = document.getElementById('progress-bar-container');

  const updateUI = (percent, msg) => {
    const clamped = Math.min(100, Math.max(0, Math.round(percent)));
    if (fill) fill.style.width = `${clamped}%`;
    if (percentText) percentText.textContent = `${clamped}%`;
    if (barContainer) barContainer.setAttribute('aria-valuenow', clamped);
    if (msg && statusText) statusText.textContent = msg;
  };

  const totalFonts = fontList.length;
  const weightPerFont = 100 / totalFonts;

  for (let i = 0; i < totalFonts; i++) {
    const { url, family, label } = fontList[i];
    const baseProgress = i * weightPerFont;

    try {
      updateUI(baseProgress + 2, `正在下載字體 (${i + 1}/${totalFonts})：${label}...`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`找不到字體檔案：${url}`);

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      const reader = response.body.getReader();

      let loadedBytes = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loadedBytes += value.length;

        if (totalBytes > 0) {
          const currentRatio = (loadedBytes / totalBytes) * (weightPerFont * 0.85);
          updateUI(baseProgress + currentRatio, `正在下載 (${i + 1}/${totalFonts})：${label}...`);
        }
      }

      updateUI(baseProgress + weightPerFont * 0.9, `正在註冊字型：${label}...`);
      const blob = new Blob(chunks, { type: 'font/ttf' });
      const blobUrl = URL.createObjectURL(blob);

      // 明確指定 style 與 weight，避免與 CSS 預設字重衝突
      const fontFace = new FontFace(family, `url(${blobUrl})`, {
        style: 'normal',
        weight: 'normal'
      });
      const loadedFace = await fontFace.load();
      document.fonts.add(loadedFace);

      updateUI((i + 1) * weightPerFont, `${label} 載入完成！`);
    } catch (err) {
      console.warn(`[Q-doc FontLoader] ${err.message}，此字體將使用備援字型。`);
      updateUI((i + 1) * weightPerFont, `已略過 ${label}（使用備援字體）`);
    }
  }

  // 等待瀏覽器字型引擎完全就緒後再關閉遮罩
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  updateUI(100, '所有字庫準備就緒，正在進入編輯器...');
  setTimeout(() => {
    if (overlay) overlay.classList.add('hidden');
  }, 300);
}