import { eventBus } from './eventBus.js';

export const state = {
  paperSize: 'a4-portrait',        // 'a4-portrait' | 'a4-landscape' | 'b4-portrait' | 'b4-landscape'
  columnLayout: '1',               // '1' (單欄) | '2' (雙欄)
  columnDivider: 'none',           // 'none' (留白) | 'dashed' (虛線) | 'solid' (實線)
  headerTemplate: 'exam',          // 'exam' | 'quiz' | 'worksheet' | 'none'
  fontFamily: 'BpmfZihiKaiStd',    // 'BpmfZihiKaiStd' | 'BpmfZihiSansRegular' | 'BpmfZihiSansBold' | 'DFKaiPlain'
  bopomofoDefaultOn: true,         // 由 fontFamily 自動決定（選 DFKaiPlain 時為 false）
  polyphoneEditEnabled: false,     // 是否啟用點擊破音字編輯（預設關閉）
  showPolyphoneHints: true,        // 是否顯示破音字黃底提示
  polyphoneDict: {}                // 載入的破音字字典
};

export function updateState(key, value) {
  state[key] = value;
  eventBus.emit(`state:${key}`, value);
}