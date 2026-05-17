import { db, state, SPIRIT_LEVELS } from './config.js';
import { openPop, closePop, showToast, getWeekId, getWeekLabel, shiftWeek, monthFromWeek } from './utils.js';
import { ref, set, get } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const SAMIL_TIMES = ['12시','19시','20시','당일방문'];
const JUIL_TIMES  = ['12시','15시','19:30','당일방문'];
const ZOOM_EXTRA  = '그외';
const EXCUSE      = ['대체예배','온라인예배'];

// ── 예배 팝오버 ──
export async function openWorshipPop(refEl, did, mid, wType, onDone) {
  const snap = await get(ref(db, 'weekly/' + did + '/' + state.currentWeekId + '/' + mid + '/worship/' + wType));
  const cur  = snap.val() || {};
  const times = wType === 'samil' ? SAMIL_TIMES : JUIL_TIMES;
  const label = wType === 'samil' ? '삼일예배' : '주일예배';

  function isOn(type, val) {
    return cur.type === type && (cur.time === val || cur.excuseType === val) ? ' pop-on' : '';
  }

  const pop = document.createElement('div');
  pop.className = 'worship-pop';
  pop.innerHTML =
    '<div class="pop-title">' + label + '</div>'
    + '<div class="pop-sec"><div class="pop-sec-label">당일출석</div><div class="pop-row">'
    + times.map(t => '<button class="pop-btn' + isOn('present',t) + '" data-t="present" data-time="' + t + '">' + t + '</button>').join('')
    + '</div></div>'
    + '<div class="pop-sec"><div class="pop-sec-label">줌</div><div class="pop-row">'
    + [...times.filter(t => t !== '당일방문'), ZOOM_EXTRA].map(t => '<button class="pop-btn' + isOn('zoom',t) + '" data-t="zoom" data-time="' + t + '">' + t + '</button>').join('')
    + '</div></div>'
    + '<div class="pop-sec"><div class="pop-sec-label">사유출석</div><div class="pop-row">'
    + EXCUSE.map(t => '<button class="pop-btn' + isOn('excuse',t) + '" data-t="excuse" data-excuse="' + t + '">' + t + '</button>').join('')
    + '</div></div>'
    + '<button class="pop-clear" id="pop-absent-btn">✗ 미출석</button>'
    + '<button class="pop-reset-btn" id="pop-reset-btn">↩ 초기화(미기록)</button>';

  pop.querySelectorAll('[data-t]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await set(ref(db, 'weekly/' + did + '/' + state.currentWeekId + '/' + mid + '/worship/' + wType), {
        type: btn.dataset.t, time: btn.dataset.time||null, excuseType: btn.dataset.excuse||null
      });
      closePop(); if (onDone) onDone();
    });
  });
  pop.querySelector('#pop-absent-btn').addEventListener('click', async () => {
    await set(ref(db, 'weekly/' + did + '/' + state.currentWeekId + '/' + mid + '/worship/' + wType), { type: 'absent' });
    closePop(); if (onDone) onDone();
  });
  pop.querySelector('#pop-reset-btn').addEventListener('click', async () => {
    await set(ref(db, 'weekly/' + did + '/' + state.currentWeekId + '/' + mid + '/worship/' + wType), null);
    closePop(); if (onDone) onDone();
  });
  openPop(pop, refEl, 200, 260);
}

// ── 메모 팝오버 ──
export async function openMemoPop(refEl, did, mid, wType, onDone) {
  const snap = await get(ref(db, 'weekly/' + did + '/' + state.currentWeekId + '/' + mid + '/worship/' + wType + '/excuseNote'));
  const cur  = snap.val() || '';
  const pop  = document.createElement('div');
  pop.className = 'worship-pop';
  pop.innerHTML =
    '<div class="pop-title">📝 사유출석 메모</div>'
    + '<textarea id="memo-ta" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:7px 9px;color:var(--text);font-family:inherit;font-size:.8rem;resize:vertical;min-height:60px;outline:none">' + cur + '</textarea>'
    + '<div style="display:flex;gap:6px;margin-top:8px">'
    + '<button class="pop-btn pop-on" id="memo-save" style="flex:1">저장</button>'
    + '<button class="pop-clear" id="memo-close" style="flex:none;width:auto;padding:4px 10px">닫기</button></div>';
  pop.querySelector('#memo-save').addEventListener('click', async () => {
    const val = pop.querySelector('#memo-ta').value.trim();
    await set(ref(db, 'weekly/' + did + '/' + state.currentWeekId + '/' + mid + '/worship/' + wType + '/excuseNote'), val || null);
    closePop(); if (onDone) onDone(); showToast('✅ 메모 저장됐어요');
  });
  pop.querySelector('#memo-close').addEventListener('click', closePop);
  openPop(pop, refEl, 220, 160);
  pop.querySelector('#memo-ta').focus();
}

// ── 교육/봉사 팝오버 ──
export async function openDynPop(refEl, did, mid, listType, onDone) {
  const isEdu = listType === 'edu';
  const list  = isEdu ? state.eduListCache : state.serviceListCache;
  const items = Object.entries(list);
  if (!items.length) { showToast((isEdu ? '교육' : '봉사') + ' 목록을 먼저 추가해주세요'); return; }
  const key  = isEdu ? 'education' : 'service';
  const snap = await get(ref(db, 'weekly/' + did + '/' + state.currentWeekId + '/' + mid + '/' + key));
  const done = snap.val() || {};
  const pop  = document.createElement('div');
  pop.className = 'worship-pop';
  let html = '<div class="pop-title">' + (isEdu ? '📖 교육' : '🤝 봉사') + ' 선택 <span style="font-size:.65rem;color:var(--muted)">(배지 더블클릭 제거)</span></div><div class="pop-row">';
  items.forEach(([id, v]) => {
    html += '<button class="pop-btn' + (done[id] ? ' pop-on' : '') + '" data-id="' + id + '">' + (done[id] ? '✓ ' : '') + v.name + '</button>';
  });
  html += '</div>';
  pop.innerHTML = html;
  pop.querySelectorAll('[data-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const path = 'weekly/' + did + '/' + state.currentWeekId + '/' + mid + '/' + key + '/' + btn.dataset.id;
      const s    = await get(ref(db, path));
      const nv   = s.val() ? null : true;
      await set(ref(db, path), nv);
      btn.className = 'pop-btn' + (nv ? ' pop-on' : '');
      btn.textContent = (nv ? '✓ ' : '') + list[btn.dataset.id]?.name;
      if (onDone) onDone();
    });
  });
  openPop(pop, refEl, 210, 180);
}

// ── 달력 팝오버 ──
export function openWeekPicker(refEl, onSelect) {
  const base = (() => {
    const [y, wn] = state.currentWeekId.split('-W');
    const j   = new Date(parseInt(y), 0, 1);
    const off = (parseInt(wn) - 1) * 7 - j.getDay() + 1;
    return new Date(parseInt(y), 0, off);
  })();
  let calYear = base.getFullYear(), calMonth = base.getMonth();
  const pop = document.createElement('div');
  pop.className = 'worship-pop calendar-pop';

  function buildCal() {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay  = new Date(calYear, calMonth + 1, 0);
    let d = new Date(firstDay);
    const dow = d.getDay(); d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    const weeks = [];
    while (d <= lastDay) {
      const days = [];
      for (let i = 0; i < 7; i++) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
      weeks.push({ wid: getWeekId(days[0]), days });
      if (d.getMonth() > calMonth && d.getFullYear() >= calYear) break;
    }
    const mn = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const todayWid = getWeekId();
    let html =
      '<div class="pop-title" style="display:flex;align-items:center;gap:8px">'
      + '<button class="pop-btn" id="cal-prev">◀</button>'
      + '<span style="flex:1;text-align:center">' + calYear + '년 ' + mn[calMonth] + '</span>'
      + '<button class="pop-btn" id="cal-next">▶</button></div>'
      + '<div class="cal-header"><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span><span>일</span></div>';
    weeks.forEach(w => {
      html += '<div class="cal-week' + (w.wid === state.currentWeekId ? ' cal-week-on' : '') + '" data-wid="' + w.wid + '">';
      w.days.forEach(day => {
        html += '<span class="cal-day'
          + (day.getMonth() !== calMonth ? ' cal-dim' : '')
          + (getWeekId(day) === todayWid ? ' cal-this' : '')
          + '">' + day.getDate() + '</span>';
      });
      html += '</div>';
    });
    return html;
  }

  pop.innerHTML = buildCal();
  pop.addEventListener('click', e => {
    if (e.target.id === 'cal-prev') { e.stopPropagation(); calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } pop.innerHTML = buildCal(); return; }
    if (e.target.id === 'cal-next') { e.stopPropagation(); calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } pop.innerHTML = buildCal(); return; }
    const week = e.target.closest('.cal-week');
    if (week) { closePop(); onSelect(week.dataset.wid); }
  });
  openPop(pop, refEl, 240, 320);
}
