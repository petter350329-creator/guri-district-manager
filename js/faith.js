import { db, state, SPIRIT_LEVELS, isRegion, isLeader, canEdit } from './config.js';
import { showToast, getWeekId, getWeekLabel, shiftWeek, monthFromWeek } from './utils.js';
import { openWorshipPop, openMemoPop, openDynPop, openWeekPicker } from './popups.js';
import { openListMgmt } from './settings.js';
import { openProfile } from './profile.js';
import { openMemberModal } from './members.js';
import { ref, set, get, update } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

export async function initFaithTab() {
  const el = document.getElementById('faith-content');
  if (!el) return;
  if (state.userRole === 'district_leader') {
    state.faithDistrictId = state.userDistrictId;
    if (!state.faithDistrictId) {
      el.innerHTML = '<div class="empty-state"><p>소속 구역이 없습니다<br>임원에게 문의하세요</p></div>';
      return;
    }
    await loadFaithWeek(); return;
  }
  if (state.faithDistrictId) { await loadFaithWeek(); return; }
  renderDistrictPicker(el, state.userRole === 'region_admin' ? state.userRegionId : null);
}

function renderDistrictPicker(el, filterRid) {
  const byR = {};
  Object.entries(state.districtsCache).forEach(([did, d]) => {
    if (filterRid && d.regionId !== filterRid) return;
    if (!byR[d.regionId]) byR[d.regionId] = [];
    byR[d.regionId].push({ did, name: d.name });
  });
  if (!Object.keys(byR).length) {
    el.innerHTML = '<div class="empty-state"><p>구역이 없습니다</p></div>'; return;
  }
  let html = '<div style="padding:20px 16px"><div class="section-label">구역 선택</div>';
  Object.entries(byR).forEach(([rid, ds]) => {
    html += '<div class="region-group"><div class="region-group-title">' + (state.regionsCache[rid]?.name || rid) + '</div><div class="district-btn-row">';
    ds.forEach(d => { html += '<button class="district-pick-btn" data-did="' + d.did + '">' + d.name + '</button>'; });
    html += '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;
  el.querySelectorAll('.district-pick-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.faithDistrictId = btn.dataset.did;
      await loadFaithWeek();
    });
  });
}

async function loadDynLists(did) {
  const [es, ss, xs] = await Promise.all([
    get(ref(db, 'eduList/' + did)),
    get(ref(db, 'serviceList/' + did)),
    get(ref(db, 'extraOfferings/' + did))
  ]);
  state.eduListCache         = es.val() || {};
  state.serviceListCache     = ss.val() || {};
  state.extraOfferingCache   = xs.val() || {};
}

export async function loadFaithWeek() {
  const el = document.getElementById('faith-content');
  if (!el) return;
  el.innerHTML = '<div class="loading">불러오는 중…</div>';
  const did = state.faithDistrictId;
  if (!did) return;
  await loadDynLists(did);

  const prevWeekId = shiftWeek(state.currentWeekId, -1);
  const [ms, ws, mths, pws, detailSnap] = await Promise.all([
    get(ref(db, 'members/' + did)),
    get(ref(db, 'weekly/' + did + '/' + state.currentWeekId)),
    get(ref(db, 'monthly/' + did + '/' + state.currentMonthId)),
    get(ref(db, 'weekly/' + did + '/' + prevWeekId)),
    get(ref(db, 'memberDetail/' + did))
  ]);
  const members    = ms.val() || {};
  let   weekData   = ws.val() || {};
  const monthData  = mths.val() || {};
  const prevData   = pws.val() || {};
  const detailData = detailSnap.val() || {};

  // 목표 자동 이월
  const carry = {};
  Object.keys(members).forEach(mid => {
    const cur  = (weekData[mid]  || {}).goal || {};
    const prev = (prevData[mid]  || {}).goal || {};
    if (!cur.prevText && prev.text) {
      carry['weekly/' + did + '/' + state.currentWeekId + '/' + mid + '/goal/prevText'] = prev.text;
      if (!weekData[mid]) weekData[mid] = {};
      if (!weekData[mid].goal) weekData[mid].goal = {};
      weekData[mid].goal.prevText = prev.text;
    }
    if (!cur.prevLeaderNote && prev.leaderNote) {
      carry['weekly/' + did + '/' + state.currentWeekId + '/' + mid + '/goal/prevLeaderNote'] = prev.leaderNote;
      if (!weekData[mid]) weekData[mid] = {};
      if (!weekData[mid].goal) weekData[mid].goal = {};
      weekData[mid].goal.prevLeaderNote = prev.leaderNote;
    }
  });
  if (Object.keys(carry).length) await update(ref(db), carry);

  const dName     = state.districtsCache[did]?.name || '구역';
  const rName     = state.regionsCache[state.districtsCache[did]?.regionId]?.name || '';
  const active    = Object.entries(members).filter(([,m]) => m.isActive !== false).sort((a,b) => (a[1].order||0)-(b[1].order||0));
  const isCW      = state.currentWeekId === getWeekId();
  const extraCols = Object.entries(state.extraOfferingCache);
  const backBtn   = (isRegion() && state.userRole !== 'district_leader')
    ? '<button class="icon-btn" id="btn-back-dist">← 목록</button>' : '';

  let html =
    '<div class="faith-topbar">'
    + backBtn
    + '<div class="faith-title">' + (rName ? rName + ' · ' : '') + dName + '</div>'
    + '<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">'
    + '<button class="icon-btn" id="btn-prev-week">◀</button>'
    + '<button class="week-badge-btn" id="btn-week-pick">' + getWeekLabel(state.currentWeekId) + '</button>'
    + '<button class="icon-btn" id="btn-next-week"' + (isCW ? ' disabled' : '') + '>▶</button>'
    + (isLeader() ? '<button class="btn btn-sm" id="btn-add-member">＋ 구역원 추가</button>' : '')
    + '</div></div>'
    + '<div class="table-scroll"><table class="faith-table"><thead>'
    + '<tr class="sector-row">'
    + '<th class="col-name" rowspan="2">이름</th>'
    + '<th colspan="2" class="sector-head s-worship">⛪ 예배</th>'
    + '<th colspan="1" class="sector-head s-edu">📖 교육' + (isRegion() ? ' <button class="mgmt-btn" data-mgmt="edu" data-did="' + did + '">관리</button>' : '') + '</th>'
    + '<th colspan="1" class="sector-head s-svc">🤝 모임(봉사)' + (isRegion() ? ' <button class="mgmt-btn" data-mgmt="service" data-did="' + did + '">관리</button>' : '') + '</th>'
    + '<th colspan="' + (3 + extraCols.length) + '" class="sector-head s-offering">💰 헌금' + (isRegion() ? ' <button class="mgmt-btn" data-mgmt="extra" data-did="' + did + '">관리</button>' : '') + '</th>'
    + '<th colspan="3" class="sector-head s-goal">🎯 단계향상 목표</th>'
    + '</tr><tr class="sub-head-row">'
    + '<th class="col-worship">삼일</th>'
    + '<th class="col-worship" style="border-right:1px solid rgba(133,183,235,.2)">주일</th>'
    + '<th class="col-tags-head">받은 교육</th>'
    + '<th class="col-tags-head" style="border-right:1px solid rgba(93,202,133,.2)">모임(봉사)</th>'
    + '<th class="col-chk col-weekly">주정</th>'
    + '<th class="col-chk col-monthly">십일</th>'
    + '<th class="col-chk col-monthly">건축</th>'
    + extraCols.map(([,x]) => '<th class="col-chk col-extra">' + x.name + '</th>').join('')
    + '<th class="col-prev-goal">지난주 목표</th>'
    + '<th class="col-result">달성</th>'
    + '<th class="col-cur-goal">이번주 목표 / 임원 조언</th>'
    + '</tr></thead><tbody id="faith-tbody"></tbody></table></div>'
    + '<div class="table-hint"><span class="monthly-badge">십일·건축</span> 월간 유지 &nbsp;|&nbsp; 이름 클릭 → 상세카드</div>';

  el.innerHTML = html;

  // 상단 버튼 이벤트
  document.getElementById('btn-back-dist')?.addEventListener('click', () => { state.faithDistrictId = null; initFaithTab(); });
  document.getElementById('btn-prev-week')?.addEventListener('click', () => { state.currentWeekId = shiftWeek(state.currentWeekId,-1); state.currentMonthId = monthFromWeek(state.currentWeekId); loadFaithWeek(); });
  document.getElementById('btn-next-week')?.addEventListener('click', () => { const nw = shiftWeek(state.currentWeekId,1); if(nw<=getWeekId()){state.currentWeekId=nw;state.currentMonthId=monthFromWeek(nw);loadFaithWeek();} });
  document.getElementById('btn-week-pick')?.addEventListener('click', e => openWeekPicker(e.currentTarget, wk => { state.currentWeekId = wk; state.currentMonthId = monthFromWeek(wk); loadFaithWeek(); }));
  document.getElementById('btn-add-member')?.addEventListener('click', () => openMemberModal(did));
  el.querySelectorAll('.mgmt-btn').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); openListMgmt(btn.dataset.mgmt, btn.dataset.did); }));

  // tbody
  const tbody = document.getElementById('faith-tbody');
  if (!active.length) {
    tbody.innerHTML = '<tr><td colspan="20" class="empty-td">구역원이 없습니다<br><button class="btn-xs" id="btn-add-empty">＋ 구역원 추가</button></td></tr>';
    document.getElementById('btn-add-empty')?.addEventListener('click', () => openMemberModal(did));
    return;
  }

  active.forEach(([mid, member]) => {
    const w    = weekData[mid] || {};
    const m    = monthData[mid] || {};
    const wor  = w.worship || {};
    const mOff = m.offering || {};
    const goal = w.goal || {};
    const eduDone = w.education || {};
    const svcDone = w.service   || {};

    // 심령 배지
    const sk = detailData[mid]?.spiritLevel || '';
    const sp = sk ? SPIRIT_LEVELS.find(s => s.key === sk) : null;
    const spBadge = sp
      ? '<span style="display:block;background:' + sp.bg + ';color:' + sp.color + ';border:0.5px solid ' + sp.border + ';border-radius:3px;padding:1px 5px;font-size:.58rem;margin-top:1px;white-space:nowrap">' + sp.label + '</span>'
      : '';

    // 예배 셀
    function wCell(data, wType) {
      if (!data || !data.type) return '<span class="w-none">—</span>';
      const map = { present:{c:'var(--success)',s:'●'}, zoom:{c:'var(--accent)',s:'Z'}, excuse:{c:'var(--monthly)',s:'사'} };
      const cfg = map[data.type] || {c:'var(--muted)',s:'?'};
      const sub = data.time || data.excuseType || '';
      const memo = data.type === 'excuse'
        ? '<span class="memo-icon' + (data.excuseNote?' memo-has':'') + '" data-did="' + did + '" data-mid="' + mid + '" data-wtype="' + wType + '">📝</span>'
        : '';
      return '<span style="color:' + cfg.c + ';font-size:.72rem;white-space:nowrap">' + cfg.s + '<br><span style="font-size:.65rem;opacity:.8">' + sub + '</span></span>' + memo;
    }

    const eduBadges = Object.keys(eduDone).filter(id => eduDone[id])
      .map(id => '<span class="item-badge" data-did="' + did + '" data-mid="' + mid + '" data-id="' + id + '" data-dtype="edu">' + (state.eduListCache[id]?.name||'?') + '</span>').join('');
    const svcBadges = Object.keys(svcDone).filter(id => svcDone[id])
      .map(id => '<span class="item-badge svc-badge" data-did="' + did + '" data-mid="' + mid + '" data-id="' + id + '" data-dtype="service">' + (state.serviceListCache[id]?.name||'?') + '</span>').join('');
    const rBtns = ['○','△','✕'].map(r => {
      const on = goal.prevResult === r;
      return '<button class="result-btn' + (on?' result-on r-'+r:'') + '" data-did="' + did + '" data-mid="' + mid + '" data-r="' + r + '">' + r + '</button>';
    }).join('');

    const tr = document.createElement('tr');
    tr.className = 'faith-row';
    tr.innerHTML =
      '<td class="col-name-td"><span class="member-name-cell" data-did="' + did + '" data-mid="' + mid + '" data-name="' + member.name + '">' + member.name + '</span>' + spBadge + '</td>'
      + '<td class="col-worship-td" data-did="' + did + '" data-mid="' + mid + '" data-wtype="samil">' + wCell(wor.samil,'samil') + '</td>'
      + '<td class="col-worship-td sep-right" data-did="' + did + '" data-mid="' + mid + '" data-wtype="juil">' + wCell(wor.juil,'juil') + '</td>'
      + '<td class="col-tags-td" data-did="' + did + '" data-mid="' + mid + '" data-dtype="edu">' + eduBadges + (canEdit() ? '<span class="badge-add">+</span>' : '') + '</td>'
      + '<td class="col-tags-td sep-right" data-did="' + did + '" data-mid="' + mid + '" data-dtype="service">' + svcBadges + (canEdit() ? '<span class="badge-add">+</span>' : '') + '</td>'
      + '<td class="col-chk-td' + (w.offering?.weekly?' checked':'') + '" data-did="' + did + '" data-mid="' + mid + '" data-action="wkly">' + (w.offering?.weekly?'✓':'') + '</td>'
      + '<td class="col-chk-td col-monthly-td' + (mOff.tithe?' checked':'') + '" data-did="' + did + '" data-mid="' + mid + '" data-action="tithe">' + (mOff.tithe?'✓':'') + '</td>'
      + '<td class="col-chk-td col-monthly-td sep-right' + (mOff.construction?' checked':'') + '" data-did="' + did + '" data-mid="' + mid + '" data-action="construction">' + (mOff.construction?'✓':'') + '</td>'
      + extraCols.map(([id]) => '<td class="col-chk-td col-extra-td' + (mOff.extras?.[id]?' checked':'') + '" data-did="' + did + '" data-mid="' + mid + '" data-action="extra" data-eid="' + id + '">' + (mOff.extras?.[id]?'✓':'') + '</td>').join('')
      + '<td class="col-prev-goal-td">'
        + (goal.prevText ? '<div style="font-size:.72rem;color:var(--muted)">' + goal.prevText + '</div>' : '')
        + (goal.prevLeaderNote ? '<div style="font-size:.67rem;color:#a78bfa;margin-top:2px">💬 ' + goal.prevLeaderNote + '</div>' : '')
      + '</td>'
      + '<td class="col-result-td">' + rBtns + '</td>'
      + '<td class="col-cur-goal-td">'
        + '<input class="goal-input" type="text" value="' + (goal.text||'') + '" placeholder="이번주 목표…"' + (canEdit()?'':' readonly') + ' data-did="' + did + '" data-mid="' + mid + '" data-gtype="goal">'
        + '<input class="goal-input leader-note-input" type="text" value="' + (goal.leaderNote||'') + '" placeholder="💬 임원 조언…"' + (isRegion()?'':' readonly') + ' data-did="' + did + '" data-mid="' + mid + '" data-gtype="leader">'
      + '</td>';
    tbody.appendChild(tr);
  });

  // 이벤트 위임
  tbody.addEventListener('click', e => {
    const t = e.target;
    const nameCell = t.closest('.member-name-cell');
    if (nameCell) { openProfile(nameCell.dataset.did, nameCell.dataset.mid, nameCell.dataset.name); return; }
    if (t.classList.contains('memo-icon')) { e.stopPropagation(); openMemoPop(t, t.dataset.did, t.dataset.mid, t.dataset.wtype, loadFaithWeek); return; }
    if (!canEdit()) return;
    const wTd = t.closest('.col-worship-td');
    if (wTd) { openWorshipPop(wTd, wTd.dataset.did, wTd.dataset.mid, wTd.dataset.wtype, loadFaithWeek); return; }
    const dynTd = t.closest('.col-tags-td');
    if (dynTd && !t.classList.contains('item-badge')) { openDynPop(dynTd, dynTd.dataset.did, dynTd.dataset.mid, dynTd.dataset.dtype, loadFaithWeek); return; }
    const chkTd = t.closest('.col-chk-td');
    if (chkTd) {
      const { did, mid, action, eid } = chkTd.dataset;
      if      (action==='wkly')         toggleWkly(did, mid);
      else if (action==='tithe')        toggleMonthly(did, mid, 'tithe');
      else if (action==='construction') toggleMonthly(did, mid, 'construction');
      else if (action==='extra')        toggleExtra(did, mid, eid);
      return;
    }
    const rBtn = t.closest('.result-btn');
    if (rBtn) { toggleResult(rBtn.dataset.did, rBtn.dataset.mid, rBtn.dataset.r); return; }
  });
  tbody.addEventListener('dblclick', e => {
    if (!canEdit()) return;
    const badge = e.target.closest('.item-badge');
    if (badge) { e.stopPropagation(); removeDyn(badge.dataset.did, badge.dataset.mid, badge.dataset.id, badge.dataset.dtype); }
  });
  tbody.querySelectorAll('.goal-input').forEach(inp => {
    inp.addEventListener('blur', async e => {
      const { did, mid, gtype } = e.target.dataset;
      const path = 'weekly/' + did + '/' + state.currentWeekId + '/' + mid + '/goal/' + (gtype==='goal'?'text':'leaderNote');
      await set(ref(db, path), e.target.value.trim());
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
  });
}

// ── 헌금 / 달성 토글 ──
async function toggleWkly(did, mid)       { const p = 'weekly/'+did+'/'+state.currentWeekId+'/'+mid+'/offering/weekly'; const s=await get(ref(db,p)); await set(ref(db,p),!s.val()); loadFaithWeek(); }
async function toggleMonthly(did, mid, f) { const p = 'monthly/'+did+'/'+state.currentMonthId+'/'+mid+'/offering/'+f;  const s=await get(ref(db,p)); await set(ref(db,p),!s.val()); loadFaithWeek(); }
async function toggleExtra(did, mid, id)  { const p = 'monthly/'+did+'/'+state.currentMonthId+'/'+mid+'/offering/extras/'+id; const s=await get(ref(db,p)); await set(ref(db,p),s.val()?null:true); loadFaithWeek(); }
async function toggleResult(did, mid, r)  { const p = 'weekly/'+did+'/'+state.currentWeekId+'/'+mid+'/goal/prevResult'; const s=await get(ref(db,p)); await set(ref(db,p),s.val()===r?null:r); loadFaithWeek(); }
async function removeDyn(did, mid, id, t) { const k=t==='edu'?'education':'service'; await set(ref(db,'weekly/'+did+'/'+state.currentWeekId+'/'+mid+'/'+k+'/'+id),null); loadFaithWeek(); }
