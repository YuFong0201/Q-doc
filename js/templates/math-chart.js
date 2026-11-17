import { reflowPages } from '../core/pagination.js';

// 輕量 Chart.js 數值直接繪製外掛（支援長條圖、橫向長條圖、多組堆疊長條圖、折線圖、圓餅圖）
const valueLabelPlugin = {
  id: 'qdocValueLabels',
  afterDatasetsDraw(chart) {
    const cfg = chart.config._qdocCfg;
    if (!cfg || !cfg.showValues) return;

    const { ctx } = chart;
    ctx.save();
    ctx.font = 'bold 12px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;

      meta.data.forEach((element, index) => {
        const val = dataset.data[index];
        if (val === null || val === undefined || val === 0) return;
        const pos = element.tooltipPosition();

        if (cfg.type === 'pie' || cfg.type === 'stackedBar') {
          ctx.fillStyle = '#ffffff';
          ctx.fillText(val, pos.x, pos.y);
        } else if (cfg.type === 'horizontalBar') {
          ctx.fillStyle = '#222629';
          ctx.textAlign = 'left';
          ctx.fillText(val, pos.x + 6, pos.y);
          ctx.textAlign = 'center';
        } else {
          ctx.fillStyle = '#222629';
          ctx.fillText(val, pos.x, pos.y - 10);
        }
      });
    });

    ctx.restore();
  }
};

export default {
  id: 'math-chart',
  name: '自訂統計圖表 (長條/折線/圓餅)',
  subjects: ['數學', '自然', '社會'],
  icon: '📊',
  createContent() {
    const chartId = 'chart-' + Date.now() + Math.floor(Math.random() * 100);
    return `
      <div>
        <div class="hanging-stem-row">
          <span class="hanging-num" contenteditable="true"><span class="auto-q-num">1</span>.</span>
          <div class="hanging-body" contenteditable="true">
            觀察下方的統計圖並回答問題：
            <span class="tpl-inline-controls" contenteditable="false">
              <button type="button" class="mini-pill-btn btn-edit-chart" data-target-chart="${chartId}">⚙️ 編輯圖表數據與類型</button>
            </span>
          </div>
        </div>
        <div class="chart-block-wrapper">
          <canvas id="${chartId}" height="190"></canvas>
        </div>
      </div>
    `;
  },
  bindEvents(blockEl, openChartModalCallback) {
    const canvas = blockEl.querySelector('canvas');
    const editBtn = blockEl.querySelector('.btn-edit-chart');

    const defaultConfig = {
      type: 'bar',
      title: '三年甲班最喜歡的水果統計圖',
      showValues: true,
      xLabel: '水果種類',
      yLabel: '人數 (人)',
      labels: ['蘋果', '香蕉', '橘子', '葡萄'],
      values: [12, 8, 10, 6],
      colors: ['#009FB7', '#FE4A49', '#222629', '#38bdf8'],
      // 堆疊長條圖專用多組長條預設資料
      stackedSeries: [
        { name: '男生', color: '#009FB7', values: [7, 5, 4, 3] },
        { name: '女生', color: '#FE4A49', values: [5, 3, 6, 3] }
      ]
    };

    renderChartOnCanvas(canvas, defaultConfig);

    editBtn.addEventListener('click', () => {
      openChartModalCallback(canvas._qdocConfig || defaultConfig, (newConfig) => {
        renderChartOnCanvas(canvas, newConfig);
      });
    });
  }
};

export function renderChartOnCanvas(canvas, cfg) {
  if (!window.Chart || !canvas) return;
  if (canvas._chartInstance) {
    canvas._chartInstance.destroy();
  }
  canvas._qdocConfig = cfg;

  const isPie = cfg.type === 'pie';
  const isHorizontal = cfg.type === 'horizontalBar';
  const isStacked = cfg.type === 'stackedBar';
  const actualChartType = isHorizontal || isStacked ? 'bar' : cfg.type;

  // 堆疊長條圖：支援多根長條 (cfg.labels)，每根長條由多層類別 (cfg.stackedSeries) 堆疊而成
  const datasets = isStacked
    ? (cfg.stackedSeries || []).map((series) => ({
        label: series.name,
        data: series.values,
        backgroundColor: series.color || '#009FB7',
        borderWidth: 1,
        borderColor: '#ffffff'
      }))
    : [{
        label: cfg.yLabel || '數值',
        data: cfg.values,
        backgroundColor: cfg.type === 'line' ? '#009FB7' : cfg.colors,
        borderColor: cfg.type === 'line' ? '#009FB7' : cfg.colors,
        borderWidth: 2,
        tension: 0.2
      }];

  const chartConfig = {
    type: actualChartType,
    data: {
      labels: cfg.labels,
      datasets
    },
    plugins: [valueLabelPlugin],
    options: {
      responsive: true,
      animation: false,
      indexAxis: isHorizontal ? 'y' : 'x',
      layout: {
        padding: { top: 18, right: 24 }
      },
      plugins: {
        legend: {
          display: isPie || isStacked
        },
        title: {
          display: true,
          text: cfg.title,
          font: { size: 15, family: 'Microsoft JhengHei' },
          color: '#222629'
        }
      },
      scales: isPie ? {} : {
        x: {
          stacked: isStacked,
          beginAtZero: true,
          title: {
            display: Boolean(cfg.xLabel),
            text: cfg.xLabel,
            font: { size: 12, weight: 'bold', family: 'Microsoft JhengHei' }
          }
        },
        y: {
          stacked: isStacked,
          beginAtZero: true,
          ticks: { stepSize: 2 },
          title: {
            display: Boolean(cfg.yLabel),
            text: cfg.yLabel,
            font: { size: 12, weight: 'bold', family: 'Microsoft JhengHei' }
          }
        }
      }
    }
  };

  chartConfig._qdocCfg = cfg;
  canvas._chartInstance = new window.Chart(canvas, chartConfig);
  requestAnimationFrame(() => reflowPages());
}