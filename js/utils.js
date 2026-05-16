import { state } from './config.js';

// ── 날짜 유틸 ──
export function getWeekId(d) {
  const t = d ? new Date(d) : new Date();
  const y = t.getFullYear();
  const j = new Date(y, 0, 1);
  return y + '-W' + String(Math.ceil(((t - j) / 86400000 + j.getDay() + 1) / 7)).padStart(2, '0');
}
export function getMonthId(d) {
  const t = d ? new Date(d) : new Date();
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0');
}
export function shiftWeek(w, d) {
  const [y, wn] = w.split('-W');
  let week = parseInt(wn) + d, year = parseInt(y);
  if (week < 1)  { year--; week = 52; }
  if (week > 52) { year++; week = 1;  }
  return year + '-W' + String(week).padStart(2, '0');
}
export function monthFromWeek(w) {
  const [y, wn] = w.split('-W');
  const j   = new Date(parseInt(y), 0, 1);
  const off  = (parseInt(wn) - 1) * 7 - j.getDay() + 1;
  const m    = new Date(parseInt(y), 0, off);
  return m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0');
}
export function getWeekLabel(w) {
  const [y, wn] = w.split('-W');
  const j  = new Date(parseInt(y), 0, 1);
  const off = (parseInt(wn) - 1) * 7 - j.getDay() + 1;
  const m  = new Date(parseInt(y), 0, off);
  const s  = new Date(m); s.setDate(m.getDate() + 6);
  return (m.getMonth()+1) + '/' + m.getDate() + '~' + (s.getMonth()+1) + '/' + s.getDate();
}

// ── UI 유틸 ──
export function showScreen(n) {
  document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
  const el = document.getElementById('screen-' + n);
  if (el) el.style.display = 'flex';
}
export function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
export function openPop(pop, refEl, w, h) {
  closePop();
  const rect   = refEl.getBoundingClientRect();
  const margin = 8;
  let top  = rect.bottom + 4;
  let left = Math.max(margin, Math.min(rect.left, window.innerWidth - (w||200) - margin));
  if (top + (h||280) > window.innerHeight - margin) top = Math.max(margin, rect.top - (h||280) - 4);
  pop.style.top  = top  + 'px';
  pop.style.left = left + 'px';
  const ov = document.createElement('div');
  ov.id = 'pop-ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:498';
  ov.addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault(); closePop();
  }, { once: true, capture: true });
  document.body.appendChild(ov);
  document.body.appendChild(pop);
  state.activePop = pop;
}
export function closePop() {
  if (state.activePop) { state.activePop.remove(); state.activePop = null; }
  const ov = document.getElementById('pop-ov');
  if (ov) ov.remove();
}
