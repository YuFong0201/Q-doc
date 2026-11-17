import { scanAndWrapChars } from '../bopomofo/polyphoneDetector.js';

/**
 * 國小低年級（一、二年級）高頻基礎常用字庫（約 750 字）
 * 依據：
 * 1. 字頻總表前 750 名核心字（累積文本覆蓋率達 80%）
 * 2. 國教院《臺灣華語文能力基準（TBCL）》基礎級字表與低年級生活語境篩選（剔除成人政經抽象字）
 */
const GRADE12_RAW = [
  // 數字、量詞與順序
  '一二三四五六七八九十百千萬零兩半雙對第幾多少大小長短高低胖瘦輕重厚薄寬窄深淺遠近',
  // 方位、空間與時間
  '上下左右前後裡外內中旁間邊角頂底對面東南方西北天地空宇宙世界國鄉村城市街道路橋巷',
  '年月日週星期時分秒今明昨早晚午夜春夏秋冬節假日歲久剛才正已經常有時偶爾永遠先後',
  // 代詞、虛詞、連詞與常用動詞/副詞（高頻句構核心）
  '的了在是有我你他她它們這那哪誰什麼怎麼為什麼因為所以但如果雖然就也還又再都只很太',
  '更最非常真正在將把被向從到往離跟和與同或且呢嗎吧啊呀哦哇唉嘛啦咯喔之而於以對為',
  '不沒無非別未要會能可可以應該必須願意敢肯讓給使叫請幫問答告訴說講談話語言字詞句文',
  '看望見盯瞧聽聞吃喝咬吞吹吸吐笑哭喊叫唱跳跑走步爬飛游站立坐躺睡醒夢穿戴脫洗刷擦',
  '拿抓握抱背扛推拉舉抬放擺丟扔掉撿拾收送寄買賣付找換借還開關鎖敲打拍摸指畫寫讀學',
  '教練習考算計想思考記忘懂明白知道認識覺得以為希望喜歡愛怕驚嚇生氣難過傷心快樂高興',
  '變成為做當作辦成成功失敗開始結束完成繼續停止休息等待趕快慢慢小心注意安全保護幫助',
  // 人物、家庭、校園與職業
  '人男女老少寶寶孩兒童少年青年大人朋友夥伴同學師長校長主任老師學生醫生護士警察消防',
  '爸媽父母爺奶公婆哥姊弟妹叔伯阿姨舅姑孫子兒女一家人姓名字號歲',
  '學校教室操場圖書館辦公室走廊廁所黑板粉筆桌椅書包課本作業簿鉛筆橡皮擦尺剪刀膠水',
  '國語數學英文自然社會生活音樂美術體育健康綜合班級組隊功課考試分數獎狀遊戲活動比賽',
  // 身體與健康
  '身體頭臉眉眼睛耳鼻口嘴唇牙舌脖子肩胸背肚腰手掌指腳腿膝蓋皮毛髮血汗淚心腦氣力聲',
  '生病痛癢累餓渴飽發燒感冒咳嗽吃藥打針醫院診所健康乾淨衛生運動',
  // 自然、天氣與動植物
  '日月星光雲風雨雷電雪霜霧彩虹晴陰涼冷熱溫暖氣候季節山川河海湖江溪泉水火土石沙泥',
  '木林森花草樹葉根莖枝芽果種籽米豆瓜菜茶竹稻麥森林公園花園農場',
  '動物植物生物貓狗牛羊馬豬雞鴨鵝魚蝦蟹龜蛙蛇鳥雀燕鷹鴿蟲蜂蝶蚊蟻蜘蛛兔猴象獅虎熊',
  '狼狐鹿鼠龍鳳羽毛翅膀尾巴角爪蛋窩巢',
  // 飲食、衣物與日常用品
  '飯麵粥餅麵包蛋糕糖果餅乾牛奶豆漿果汁汽水開水湯肉蛋菜水果蘋果香蕉西瓜草莓葡萄橘子',
  '早餐午餐晚餐點心味道甜酸苦辣鹹香臭好吃美味',
  '衣服褲裙鞋襪帽圍巾手套口袋扣子拉鍊雨傘雨衣眼鏡手錶鏡子梳子毛巾牙刷肥皂衛生紙',
  '房子家門窗牆壁屋頂地板樓梯電梯房間客廳廚房浴室床被枕頭燈電視電話電腦冰箱冷氣電扇',
  '碗筷湯匙叉子盤子杯子瓶子鍋子刀子盒子箱子袋子籃子垃圾桶玩具球積木玩偶氣球故事書',
  // 交通、顏色與形狀
  '車汽車公車火車高鐵捷運腳踏車機車船飛機站牌紅綠燈馬路人行道斑馬線方向盤輪子速度',
  '顏色紅橙黃綠藍紫黑白灰粉棕金銀亮暗彩圓方尖平直彎曲條塊張片顆粒滴串群雙件套雙',
  //其他補充
  '注出確每起來'
].join('');

const GRADE12_BASIC_CHARS = new Set(GRADE12_RAW.split(''));

/**
 * 國小中年級（三、四年級）新增常用字庫（約 800 字，與低年級合併共約 1,550 字）
 * 依據：
 * 1. 字頻總表序號 751～1,750 區間核心字（累積文本覆蓋率提升至 93%～95%）
 * 2. 補齊低年級延後之抽象概念字、說明文邏輯詞、情緒形容詞與形聲字族
 */
const GRADE34_EXTRA_RAW = [
  // 抽象思維、邏輯連接與說明文核心字（自然、社會科高頻字）
  '因由故原原因結果目的過程方法步驟條件限制範圍標準規則秩序法律制度政府社會國家民族',
  '歷史文化傳統現代未來發展進步改變影響作用效果功能價值意義重要主要基本一般普通特別',
  '特殊具體抽象簡單複雜困難容易清楚模糊正確錯誤確實實際事實真相現象情況狀態環境資源',
  '能源材料物質構造組織系統比例平均總共合計約略大約超過接近達到增加減少擴大縮小提升',
  '降低維持保持建立形成產生出現消失存在包含包括屬於區分比較分析研究觀察實驗測量調查',
  '記錄報告討論發表意見建議贊成反對解決處理管理控制利用節約浪費保護破壞污染恢復改善',
  '與及並則卻仍既便即凡各某該此其彼此互相彼此互相各自所有全部整體部分內容表面中心',
  // 情緒心理、品格與人際互動
  '情感心情情緒態度精神意志性格習慣品質道德責任義務權利自由平等尊重信任誠實勇敢謙虛',
  '驕傲自私貪心懶惰勤勞努力認真負責耐心細心粗心專心好奇興奮激動緊張擔心害怕恐懼焦急',
  '慌張失望絕望悲傷哀愁痛苦煩惱憤怒討厭恨嫉妒慚愧後悔感動感激感謝欣賞佩服羨慕同情安慰',
  '鼓勵稱讚批評責備原諒道歉拜託拒絕接受允許禁止命令要求強迫配合合作團結競爭勝利光榮',
  // 動作與狀態進階字（含高頻形聲衍生字）
  '舉措抓捕捉握擁抱扶拖拉扯撕折疊捲揉捏敲擊撞碰摔倒跌滑跳躍奔馳追趕逃避躲藏尋找發現',
  '探索拜訪參觀旅遊出發到達停留經過穿越攀登降落漂浮沉沒流動滾動搖晃震動旋轉翻滾倒立',
  '排列整理分類收集儲存堆積分散傳遞運輸交換交易買賣價格費用成本利潤收入支出節省豐富',
  '貧窮缺乏充足飽滿飢餓營養消化呼吸循環排泄成長發育成熟衰老死亡治療護理預防感染病毒',
  '細菌清潔消毒整齊混亂安靜寂靜熱鬧喧嘩吵鬧明亮黑暗閃爍照耀反射透明鮮豔暗淡粗糙光滑',
  '堅硬柔軟脆弱牢固鬆散乾燥潮濕濕潤溫暖炎熱涼爽寒冷冰凍融化蒸發燃燒熄滅爆炸危險災難',
  // 社會、文化、產業與地理進階字
  '首都縣市鄉鎮部落社區鄰居親戚祖先世代人口職業工作工業農業商業服務交通通訊網路資訊',
  '科技發明創造設計建築工程機械設備工具武器工廠商店市場銀行郵局醫院車站機場港口碼頭',
  '博物館美術館音樂廳劇場體育館寺廟教堂古蹟風景名勝島嶼半島大陸海洋海岸沙灘岩石山脈',
  '平原盆地丘陵高原峽谷瀑布森林草原沙漠氣候溫度濕度氣壓風向颱風地震洪水乾旱環保生態',
  // 語文修辭與閱讀寫作常見字
  '文章段落標題題目大意主旨中心思想角色情節背景經過結局描寫敘述說明議論抒情比喻擬人',
  '誇張排比疑問感嘆符號標點句號逗號頓號冒號引號括號破折號省略號字典辭典查詢翻譯解釋',
  '背誦朗讀默讀欣賞創作修改訂正抄寫筆記日記週記信件卡片海報廣告新聞報導雜誌書籍出版社',
  // 常見形聲字族與日常高頻補充字
  '清請情精靜晴睛猜倩包飽泡炮袍胞抱方放防房訪仿芳紡訪青清請情精靜晴睛主住注柱駐註珠',
  '包抱飽泡炮袍胞馬媽嗎碼罵螞交校較郊效餃絞皮披疲坡破波玻被工功攻紅江虹空控恐貢項',
  '分粉芬紛份盆貧盼化花華貨靴少沙紗炒吵抄秒妙省相想箱霜廂象像橡羊洋樣養氧詳祥鮮',
  '古故苦枯姑估居胡湖蝴糊乎呼戲虎虛慮處據劇急穩隱聽廳聖聲勝乘剩盛城誠成城程呈醒星',
  '令零領鈴冷齡鄰憐可河何荷呵哥歌奇騎寄椅意億憶藝議義儀蟻之芝乏眨泛眨貶眨乏'
].join('');

const GRADE34_BASIC_CHARS = new Set([
  ...GRADE12_BASIC_CHARS,
  ...GRADE34_EXTRA_RAW.split('')
]);

export function initVocabChecker() {
  const btnCheck = document.getElementById('btn-check-hard-vocab');
  const btnClear = document.getElementById('btn-clear-hard-vocab');
  const selectGrade = document.getElementById('select-vocab-grade');
  const countBadge = document.getElementById('vocab-char-count');
  const pagesContainer = document.getElementById('pages-container');

  if (!pagesContainer) return;

  // 即時統計全卷國字與總字數
  const updateCharCount = () => {
    if (!countBadge) return;
    let totalChars = 0;
    let chineseChars = 0;

    document.querySelectorAll('.paper-page .question-block').forEach((block) => {
      const clone = block.cloneNode(true);
      clone.querySelectorAll('.block-actions, .block-drag-handle, .tpl-inline-controls, .ra-speak-block-btn').forEach((el) => el.remove());
      const txt = (clone.textContent || '').replace(/\s+/g, '');
      totalChars += txt.length;
      const matches = txt.match(/[\u4E00-\u9FFF]/g);
      if (matches) chineseChars += matches.length;
    });

    countBadge.textContent = `📝 全卷國字：${chineseChars} 字（含標點共 ${totalChars} 字）`;
  };

  const observer = new MutationObserver(updateCharCount);
  observer.observe(pagesContainer, { childList: true, subtree: true, characterData: true });
  pagesContainer.addEventListener('input', updateCharCount);
  updateCharCount();

  // 清除生難字標記的共用函式
  const clearHardVocabMarks = () => {
    document.querySelectorAll('.char-token.is-hard-vocab').forEach((token) => {
      token.classList.remove('is-hard-vocab');
      if (!token.classList.contains('is-polyphone')) {
        token.removeAttribute('title');
      }
    });
  };

  // 切換年段下拉選單時，若畫面上已有標記則自動重新依新年段檢測
  if (selectGrade) {
    selectGrade.addEventListener('change', () => {
      if (document.querySelector('.char-token.is-hard-vocab') && btnCheck) {
        btnCheck.click();
      }
    });
  }

  // 一鍵標記超出選定年段常用字範圍的生難字
  if (btnCheck) {
    btnCheck.addEventListener('click', () => {
      const gradeMode = selectGrade ? selectGrade.value : 'grade12';
      const targetDict = gradeMode === 'grade34' ? GRADE34_BASIC_CHARS : GRADE12_BASIC_CHARS;
      const gradeLabel = gradeMode === 'grade34' ? '中年級' : '低年級';

      document.querySelectorAll('.blocks-container').forEach((box) => scanAndWrapChars(box));

      let hardCount = 0;
      const hardCharsSet = new Set();

      document.querySelectorAll('.paper-page .char-token').forEach((token) => {
        const ch = token.dataset.baseChar;
        // 僅針對中文字元進行檢查，排除標點與英數
        if (ch && /[\u4E00-\u9FFF]/.test(ch) && !targetDict.has(ch)) {
          token.classList.add('is-hard-vocab');
          token.title = `${gradeLabel}超綱生難字「${ch}」：開啟破音字編輯模式後可點擊單獨顯示或調整注音`;
          hardCount++;
          hardCharsSet.add(ch);
        } else {
          token.classList.remove('is-hard-vocab');
          if (!token.classList.contains('is-polyphone')) {
            token.removeAttribute('title');
          }
        }
      });

      const uniqueList = Array.from(hardCharsSet).slice(0, 15).join('、');
      const previewText = hardCharsSet.size > 0
        ? `\n常見超綱字例：${uniqueList}${hardCharsSet.size > 15 ? ' 等...' : ''}`
        : '';

      alert(
        `【${gradeLabel}生難字檢查完成】\n` +
        `共標記出 ${hardCount} 處（不重複共 ${hardCharsSet.size} 個）超出${gradeLabel}基礎字庫的生難字。${previewText}\n\n` +
        `（畫面上已加上底線標記，列印或匯出 PDF 時會自動隱藏）`
      );
    });
  }

  // 清除生難字標記
  if (btnClear) {
    btnClear.addEventListener('click', clearHardVocabMarks);
  }
}