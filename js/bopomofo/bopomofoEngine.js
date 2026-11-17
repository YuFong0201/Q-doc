import { state } from '../state.js';

export function toggleSingleCharBopomofo(tokenEl) {
  const isCurrentlyHidden = tokenEl.classList.contains('hide-bopo');
  const isCurrentlyForced = tokenEl.classList.contains('force-bopo');

  if (state.bopomofoDefaultOn) {
    // 目前字體為有注音字體時，切換單字「隱藏注音」
    tokenEl.classList.toggle('hide-bopo', !isCurrentlyHidden);
    tokenEl.classList.remove('force-bopo');
  } else {
    // 目前字體為無注音「標楷體」時，切換單字「顯示注音」
    tokenEl.classList.toggle('force-bopo', !isCurrentlyForced);
    tokenEl.classList.remove('hide-bopo');
  }
}