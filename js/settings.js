import { db, state, ROLE_LABEL, isRegion, isChairman, isSA } from './config.js';
import { showToast } from './utils.js';
import { ref, set, get, push, remove, update } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

// ── 목록 관리 ──
let mgmtDid = '', mgmtType = '', mgmtOnDone = null;

export async function openListMgmt(type, did, onDone = null) {
  if (!isRegion()) { showToast('권한이 없습니다'); return; }
  mgmtDid = did; mgmtType = type; mgmtOnDone = onDone;
  const labels = { edu:'📖 교육', service:'🤝 봉사', extra:'💰 기타헌금' };
  document.getElementById('list-mgmt-title').textContent = labels[type] + ' 목록 관리';
  await refreshMgmtList();
  document.getElementById('inp-mgmt-name').value = '';
  document.getElementById('modal-listmgmt').classList.add('show');
}
async function refreshMgmtList() {
  const paths = { edu:'globalEduList', service:'globalServiceList', extra:'globalExtraOfferings' };
  const snap  = await get(ref(db, paths[mgmtType]));
  const items = snap.val() || {};
  const el    = document.getElementById('mgmt-list-inner');
  if (!Object.keys(items).length) {
    el.innerHTML = '<div style="padding:10px;color:var(--muted);font-size:.8rem">항목이 없습니다</div>'; return;
  }
  el.innerHTML = Object.entries(items).map(([id, v]) =>
    '<div class="user-row"><div class="user-info"><div class="user-name">' + v.name + '</div></div>'
    + '<button class="btn-danger-xs" data-del="' + id + '">삭제</button></div>'
  ).join('');
  el.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('삭제할까요?')) return;
    const paths2 = { edu:'globalEduList', service:'globalServiceList', extra:'globalExtraOfferings' };
    await remove(ref(db, paths2[mgmtType] + '/' + btn.dataset.del));
    await refreshMgmtList();
    if (mgmtOnDone) mgmtOnDone();
  }));
}

// ── 미승인 · 미분류 멤버 관리 ──
export async function openPendingMgmt() {
  if (!isRegion()) { showToast('권한이 없습니다'); return; }
  await loadPendingAndUnclassified();
  document.getElementById('modal-users').classList.add('show');
}

async function loadPendingAndUnclassified() {
  const [uSnap, rSnap] = await Promise.all([get(ref(db,'users')), get(ref(db,'requests'))]);
  const users = uSnap.val()||{}, reqs = rSnap.val()||{};

  // 미승인 (requests)
  const visR = Object.entries(reqs).filter(([,u]) =>
    isChairman() || (state.userRole==='region_admin' && u.regionId===state.userRegionId));

  // 미분류 (users 중 regionId 없는 자)
  const unclassified = Object.entries(users)
    .filter(([uid]) => uid !== state.currentUser?.uid)
    .filter(([,u]) => !u.regionId || !state.regionsCache[u.regionId]);

  // ── 미승인 탭 ──
  let pendingHtml = '';
  if (visR.length) {
    pendingHtml = visR.map(([uid, u]) => {
      const rName = state.regionsCache[u.regionId]?.name || u.regionId || '미분류';
      return '<div class="user-row"><div class="user-info"><div class="user-name">' + (u.name||uid) + '</div>'
        + '<div class="user-sub">' + (u.email||'') + ' · ' + rName + '</div></div>'
        + '<div class="user-actions">'
        + (isChairman() ? '<select id="req-role-'+uid+'" class="small-select"><option value="district_leader">구역장</option><option value="region_admin">임원</option></select>' : '')
        + '<button class="btn-xs" data-approve="'+uid+'">수락</button>'
        + '<button class="btn-danger-xs" data-reject="'+uid+'">거절</button>'
        + '</div></div>';
    }).join('');
  } else {
    pendingHtml = '<div style="padding:12px;color:var(--muted);font-size:.83rem">대기 중인 승인 요청이 없어요</div>';
  }

  // ── 미분류 탭 ──
  let unclassifiedHtml = '';
  if (unclassified.length) {
    unclassifiedHtml = unclassified.map(([uid, u]) => {
      const roleLabel = ROLE_LABEL[u.role] || u.role || '역할 없음';
      let row = '<div class="user-row" style="flex-wrap:wrap;gap:6px">'
        + '<div class="user-info"><div class="user-name">' + (u.nickname||u.name||uid) + '</div>'
        + '<div class="user-sub">' + (u.email||'') + ' · ' + roleLabel + '</div></div>'
        + '<div class="user-actions">';
      if (isChairman()) {
        row += '<select class="small-select" data-region-uid="'+uid+'" title="지역 배정">'
          + '<option value="">(지역 미배정)</option>'
          + Object.entries(state.regionsCache).map(([rid,r]) =>
              '<option value="'+rid+'"'+(u.regionId===rid?' selected':'')+'>'+r.name+'</option>'
            ).join('')
          + '</select>';
        row += '<button class="btn-danger-xs" data-del-user="'+uid+'">삭제</button>';
      }
      row += '</div></div>';
      return row;
    }).join('');
  } else {
    unclassifiedHtml = '<div style="padding:12px;color:var(--muted);font-size:.83rem">미분류 멤버가 없어요</div>';
  }

  document.getElementById('pane-pending').innerHTML = pendingHtml;
  document.getElementById('pane-unclassified').innerHTML = unclassifiedHtml;

  const el = document.getElementById('modal-users');

  // 미승인 이벤트
  el.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => approveUser(b.dataset.approve)));
  el.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', () => rejectUser(b.dataset.reject)));

  // 미분류 지역 변경
  el.querySelectorAll('[data-region-uid]').forEach(sel => {
    sel.addEventListener('change', async () => {
      await update(ref(db,'users/'+sel.dataset.regionUid),{regionId: sel.value||null});
      showToast('✅ 지역 배정됐어요');
    });
  });

  // 미분류 삭제
  el.querySelectorAll('[data-del-user]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('멤버를 삭제할까요?')) return;
    await remove(ref(db,'users/'+b.dataset.delUser));
    showToast('삭제됐어요');
    loadPendingAndUnclassified();
  }));
}

// ── 미승인·미분류 탭 전환 ──
window.switchPendingTab = (tab) => {
  document.getElementById('pane-pending').style.display      = tab === 'pending'      ? '' : 'none';
  document.getElementById('pane-unclassified').style.display = tab === 'unclassified' ? '' : 'none';
  document.getElementById('pill-pending').classList.toggle('active',      tab === 'pending');
  document.getElementById('pill-unclassified').classList.toggle('active', tab === 'unclassified');
};

// ── 멤버 소속 관리 ──
export async function openMemberMgmt() {
  if (!isRegion()) { showToast('권한이 없습니다'); return; }
  await loadMemberMgmt();
  document.getElementById('modal-member-mgmt').classList.add('show');
}

async function loadMemberMgmt() {
  const [uSnap, rSnap, dSnap] = await Promise.all([
    get(ref(db,'users')), get(ref(db,'regions')), get(ref(db,'districts'))
  ]);
  state.regionsCache   = rSnap.val()||{};
  state.districtsCache = dSnap.val()||{};
  const users = uSnap.val()||{};

  const distOptsByRegion = {};
  Object.entries(state.districtsCache).forEach(([did,d]) => {
    if (!distOptsByRegion[d.regionId]) distOptsByRegion[d.regionId] = [];
    distOptsByRegion[d.regionId].push({ did, name: d.name });
  });
  function buildDistOpts(regionId, selDid) {
    const list = distOptsByRegion[regionId] || [];
    return '<option value="">(구역 미배정)</option>'
      + list.map(d => '<option value="'+d.did+'"'+(d.did===selDid?' selected':'')+'>'+d.name+'</option>').join('');
  }

  const visU = Object.entries(users)
    .filter(([uid]) => uid !== state.currentUser?.uid)
    .filter(([,u]) => u.regionId && state.regionsCache[u.regionId])
    .filter(([,u]) => isChairman() || (state.userRole==='region_admin' && u.regionId===state.userRegionId));

  if (!visU.length) {
    document.getElementById('member-mgmt-list').innerHTML =
      '<div style="padding:12px;color:var(--muted);font-size:.83rem">없음</div>';
    return;
  }

  const byRegion = {};
  visU.forEach(([uid, u]) => {
    const rid = u.regionId;
    if (!byRegion[rid]) byRegion[rid] = [];
    byRegion[rid].push([uid, u]);
  });

  let html = '';
  const rids = Object.keys(byRegion).sort((a,b) =>
    (state.regionsCache[a]?.name||a).localeCompare(state.regionsCache[b]?.name||b));

  rids.forEach((rid, idx) => {
    const rName = state.regionsCache[rid]?.name || rid;
    const openClass = idx === 0 ? ' open' : '';
    const rows = byRegion[rid].map(([uid, u]) => {
      const curDistName = state.districtsCache[u.districtId]?.name || '미배정';
      const roleLabel   = ROLE_LABEL[u.role] || u.role;
      let row = '<div class="user-row" style="flex-wrap:wrap;gap:6px">'
        + '<div class="user-info" style="min-width:100px">'
        + '<div class="user-name">' + (u.nickname||u.name||uid) + '</div>'
        + '<div class="user-sub">' + curDistName + ' · ' + roleLabel + '</div>'
        + '</div><div class="user-actions" style="flex-wrap:wrap;gap:4px">';

      if (isChairman()) {
        row += '<select class="small-select" data-role-uid="'+uid+'" title="역할">'
          + ['district_leader','region_admin','chairman','superadmin'].map(r =>
              '<option value="'+r+'"'+(u.role===r?' selected':'')+'>'+ROLE_LABEL[r]+'</option>').join('')
          + '</select>';
        row += '<select class="small-select" data-region-uid="'+uid+'" title="지역">'
          + '<option value="">(지역 미배정)</option>'
          + Object.entries(state.regionsCache).map(([r,rv]) =>
              '<option value="'+r+'"'+(u.regionId===r?' selected':'')+'>'+rv.name+'</option>').join('')
          + '</select>';
      }
      if (u.role === 'district_leader') {
        const forRegion = isChairman() ? (u.regionId||'') : state.userRegionId;
        row += '<select class="small-select" data-dist-uid="'+uid+'" title="구역">'
          + buildDistOpts(forRegion, u.districtId) + '</select>';
      }
      if (isChairman()) {
        row += '<button class="btn-danger-xs" data-del-user="'+uid+'">삭제</button>';
      }
      row += '</div></div>';
      return row;
    }).join('');

    html +=
      '<div class="region-accordion'+openClass+'" data-rid="'+rid+'">'
      + '<div class="region-acc-header"><span>'+rName+'</span>'
      + '<span class="acc-count">'+byRegion[rid].length+'명</span>'
      + '<span class="acc-arrow">'+(idx===0?'▲':'▼')+'</span></div>'
      + '<div class="region-acc-body">'+rows+'</div>'
      + '</div>';
  });

  const el = document.getElementById('member-mgmt-list');
  el.innerHTML = html;

  el.querySelectorAll('[data-role-uid]').forEach(sel => sel.addEventListener('change', async () => {
    await update(ref(db,'users/'+sel.dataset.roleUid),{role: sel.value});
    showToast('✅ 역할 변경됐어요');
  }));
  el.querySelectorAll('[data-region-uid]').forEach(sel => sel.addEventListener('change', async () => {
    await update(ref(db,'users/'+sel.dataset.regionUid),{regionId: sel.value||null});
    showToast('✅ 지역 변경됐어요');
  }));
  el.querySelectorAll('[data-dist-uid]').forEach(sel => sel.addEventListener('change', async () => {
    await update(ref(db,'users/'+sel.dataset.distUid),{districtId: sel.value||null});
    showToast('✅ 구역 배정됐어요');
  }));
  el.querySelectorAll('[data-del-user]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('멤버를 삭제할까요?')) return;
    await remove(ref(db,'users/'+b.dataset.delUser));
    showToast('삭제됐어요');
    loadMemberMgmt();
  }));

  // 아코디언
  el.querySelectorAll('.region-acc-header').forEach(hdr => hdr.addEventListener('click', () => {
    const acc = hdr.closest('.region-accordion');
    const isOpen = acc.classList.toggle('open');
    hdr.querySelector('.acc-arrow').textContent = isOpen ? '▲' : '▼';
  }));
}

async function approveUser(uid) {
  const roleEl = document.getElementById('req-role-'+uid);
  const role   = roleEl ? roleEl.value : 'district_leader';
  const snap   = await get(ref(db,'requests/'+uid));
  if (!snap.exists()) { await loadPendingAndUnclassified(); return; }
  const u = snap.val();
  await set(ref(db,'users/'+uid), {
    email: u.email||'', name: u.name||'', nickname: u.name||'',
    role, regionId: u.regionId||null, districtId: null, createdAt: Date.now()
  });
  await remove(ref(db,'requests/'+uid));
  showToast('✅ 승인됐어요');
  await loadPendingAndUnclassified();
}
async function rejectUser(uid) {
  if (!confirm('거절할까요?')) return;
  await remove(ref(db,'requests/'+uid));
  loadPendingAndUnclassified();
}

// ── 구역원 이관 승인 ──
export async function openTransferMgmt() {
  if (!isRegion()) { showToast('권한이 없습니다'); return; }
  await loadTransferList();
  document.getElementById('modal-transfer-mgmt').classList.add('show');
}
async function loadTransferList() {
  const trSnap = await get(ref(db, 'transferRequests'));
  const reqs = trSnap.val() || {};
  const el   = document.getElementById('transfer-mgmt-list');

  const myDids = new Set(
    Object.entries(state.districtsCache)
      .filter(([,d]) => isChairman() || d.regionId === state.userRegionId)
      .map(([did]) => did)
  );
  const visReqs = Object.entries(reqs).filter(([,r]) => myDids.has(r.fromDid) || myDids.has(r.toDid));

  if (!visReqs.length) {
    el.innerHTML = '<div style="padding:12px;color:var(--muted);font-size:.83rem">대기 중인 이관 요청이 없습니다</div>';
    return;
  }

  el.innerHTML = visReqs.map(([mid, r]) => {
    const fromName   = state.districtsCache[r.fromDid]?.name || r.fromDid;
    const toName     = state.districtsCache[r.toDid]?.name   || r.toDid;
    const dt         = new Date(r.requestedAt);
    const dateStr    = dt.getFullYear()+'.'+String(dt.getMonth()+1).padStart(2,'0')+'.'+String(dt.getDate()).padStart(2,'0');
    const canApprove = myDids.has(r.fromDid);
    return '<div class="user-row">'
      + '<div class="user-info"><div class="user-name">'+(r.name||mid)+'</div>'
      + '<div class="user-sub">'+fromName+' → '+toName+' · '+dateStr+'</div></div>'
      + (canApprove
        ? '<div class="user-actions">'
          + '<button class="btn-xs" data-tr-approve="'+mid+'" data-from="'+r.fromDid+'" data-to="'+r.toDid+'">승인</button>'
          + '<button class="btn-danger-xs" data-tr-reject="'+mid+'">거절</button></div>'
        : '<span class="role-badge" style="font-size:.68rem">상대 구역 승인 대기</span>')
      + '</div>';
  }).join('');

  el.querySelectorAll('[data-tr-approve]').forEach(btn => btn.addEventListener('click', async () => {
    const mid = btn.dataset.trApprove, fromDid = btn.dataset.from, toDid = btn.dataset.to;
    if (!confirm('이관을 승인할까요?')) return;

    const [mSnap, dSnap, wSnap, moSnap] = await Promise.all([
      get(ref(db, 'members/'+fromDid+'/'+mid)),
      get(ref(db, 'memberDetail/'+fromDid+'/'+mid)),
      get(ref(db, 'weekly/'+fromDid)),
      get(ref(db, 'monthly/'+fromDid))
    ]);
    const updates = {};
    if (mSnap.exists())  { updates['members/'+toDid+'/'+mid] = mSnap.val();  updates['members/'+fromDid+'/'+mid] = null; }
    if (dSnap.exists())  { updates['memberDetail/'+toDid+'/'+mid] = dSnap.val(); updates['memberDetail/'+fromDid+'/'+mid] = null; }
    // weekly 기록 이동
    if (wSnap.exists()) {
      Object.entries(wSnap.val()).forEach(([wid, wData]) => {
        if (wData[mid]) {
          updates['weekly/'+toDid+'/'+wid+'/'+mid] = wData[mid];
          updates['weekly/'+fromDid+'/'+wid+'/'+mid] = null;
        }
      });
    }
    // monthly 기록 이동
    if (moSnap.exists()) {
      const moData = moSnap.val();
      Object.entries(moData).forEach(([monthId, mMonthData]) => {
        if (mMonthData[mid]) {
          updates['monthly/'+toDid+'/'+monthId+'/'+mid] = mMonthData[mid];
          updates['monthly/'+fromDid+'/'+monthId+'/'+mid] = null;
        }
      });
    }
    updates['transferRequests/'+mid] = null;
    await update(ref(db), updates);
    showToast('✅ 이관 완료됐어요');
    await loadTransferList();
  }));

  el.querySelectorAll('[data-tr-reject]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('이관 요청을 거절할까요?')) return;
    await remove(ref(db, 'transferRequests/'+btn.dataset.trReject));
    showToast('이관 요청이 거절됐어요');
    await loadTransferList();
  }));
}

// ── 구역장 배정 ──
export async function openAssignModal() {
  if (!isRegion()) { showToast('권한이 없습니다'); return; }
  await loadAssignList();
  document.getElementById('modal-assign').classList.add('show');
}
async function loadAssignList() {
  const [rs, ds, us] = await Promise.all([get(ref(db,'regions')),get(ref(db,'districts')),get(ref(db,'users'))]);
  state.regionsCache = rs.val()||{}; state.districtsCache = ds.val()||{};
  const users   = us.val()||{};
  const myDists = Object.entries(state.districtsCache).filter(([,d]) => isChairman()||d.regionId===state.userRegionId);
  const distOpts = myDists.map(([did,d]) => '<option value="'+did+'">'+d.name+'</option>').join('');
  const targets  = Object.entries(users).filter(([,u]) => u.role==='district_leader'&&(isChairman()||u.regionId===state.userRegionId));
  const el = document.getElementById('assign-list');
  el.innerHTML = targets.map(([uid,u]) =>
    '<div class="user-row"><div class="user-info"><div class="user-name">'+(u.nickname||u.name)+'</div>'
    +'<div class="user-sub">현재: '+(state.districtsCache[u.districtId]?.name||'미배정')+'</div></div>'
    +'<select class="small-select" data-auid="'+uid+'"><option value="">미배정</option>'+distOpts+'</select></div>'
  ).join('') || '<div style="padding:12px;color:var(--muted);font-size:.83rem">없음</div>';
  el.querySelectorAll('[data-auid]').forEach(sel => {
    const curDid = users[sel.dataset.auid]?.districtId || '';
    if (curDid) sel.value = curDid;
    sel.addEventListener('change', async () => {
      await update(ref(db,'users/'+sel.dataset.auid),{districtId:sel.value||null});
      showToast('✅ 배정됐어요');
    });
  });
}

// ── 지역·구역 관리 (회장 이상 / 임원은 구역만) ──
export async function openDistrictMgmt() {
  if (!isChairman()) { showToast('권한이 없습니다'); return; }
  await loadDistrictMgmt();
  document.getElementById('modal-districts').classList.add('show');
}
async function loadDistrictMgmt() {
  const [rs, ds] = await Promise.all([get(ref(db,'regions')),get(ref(db,'districts'))]);
  state.regionsCache = rs.val()||{}; state.districtsCache = ds.val()||{};

  // 지역 추가 입력란: 회장 이상만 표시
  const regionAddRow = document.querySelector('#modal-districts .region-add-row');
  if (regionAddRow) regionAddRow.style.display = isChairman() ? '' : 'none';

  document.getElementById('sel-new-dist-region').innerHTML =
    Object.entries(state.regionsCache).map(([rid,r]) => '<option value="'+rid+'">'+r.name+'</option>').join('')
    || '<option value="">지역을 먼저 추가하세요</option>';

  const rl = document.getElementById('region-list');
  rl.innerHTML = Object.entries(state.regionsCache).map(([rid,r]) =>
    '<div class="user-row"><div class="user-info"><div class="user-name">'+r.name+'</div></div>'
    // 지역 삭제: 회장만
    +(isChairman() ? '<button class="btn-danger-xs" data-del-r="'+rid+'">삭제</button>' : '')
    +'</div>'
  ).join('') || '<div style="padding:8px;color:var(--muted);font-size:.8rem">없음</div>';

  rl.querySelectorAll('[data-del-r]').forEach(b => b.addEventListener('click', async () => {
    if (!isChairman()) return;
    const rid = b.dataset.delR, rName = state.regionsCache[rid]?.name || rid;
    const relDists = Object.values(state.districtsCache).filter(d => d.regionId === rid);
    const msg = relDists.length
      ? `'${rName}' 지역을 삭제할까요?\n\n⚠️ 이 지역에 구역이 ${relDists.length}개 있습니다.\n구역도 직접 삭제해주세요.`
      : `'${rName}' 지역을 삭제할까요?`;
    if (!confirm(msg)) return;
    await remove(ref(db,'regions/'+rid));
    loadDistrictMgmt();
  }));

  const dl = document.getElementById('district-list');
  dl.innerHTML = Object.entries(state.districtsCache)
    .filter(([,d]) => isChairman() || d.regionId === state.userRegionId)
    .map(([did,d]) =>
      '<div class="user-row"><div class="user-info"><div class="user-name">'+d.name+'</div>'
      +'<div class="user-sub">'+(state.regionsCache[d.regionId]?.name||'⚠️ 지역 없음')+'</div></div>'
      +'<button class="btn-danger-xs" data-del-d="'+did+'">삭제</button></div>'
    ).join('') || '<div style="padding:8px;color:var(--muted);font-size:.8rem">없음</div>';

  dl.querySelectorAll('[data-del-d]').forEach(b => b.addEventListener('click', async () => {
    const did = b.dataset.delD, dName = state.districtsCache[did]?.name || did;
    const mSnap = await get(ref(db,'members/'+did));
    const mCount = mSnap.exists() ? Object.keys(mSnap.val()).length : 0;
    const msg = mCount
      ? `'${dName}' 구역을 삭제할까요?\n\n⚠️ 구역원이 ${mCount}명 있습니다.\n구역원 데이터는 남아있게 됩니다.`
      : `'${dName}' 구역을 삭제할까요?`;
    if (!confirm(msg)) return;
    await remove(ref(db,'districts/'+did));
    loadDistrictMgmt();
  }));
}

export function setupSettingsButtons() {
  window.closeListMgmt     = () => { document.getElementById('modal-listmgmt').classList.remove('show'); if (mgmtOnDone) mgmtOnDone(); };
  window.closeUserMgmt     = () => document.getElementById('modal-users').classList.remove('show');
  window.closeMemberMgmt   = () => document.getElementById('modal-member-mgmt').classList.remove('show');
  window.closeAssignModal  = () => document.getElementById('modal-assign').classList.remove('show');
  window.closeDistrictMgmt = () => document.getElementById('modal-districts').classList.remove('show');
  window.closeTransferMgmt = () => document.getElementById('modal-transfer-mgmt').classList.remove('show');

  window.addMgmtItem = async () => {
    if (!isRegion()) return;
    const name = document.getElementById('inp-mgmt-name').value.trim(); if (!name) return;
    const paths = { edu:'globalEduList', service:'globalServiceList', extra:'globalExtraOfferings' };
    await set(push(ref(db, paths[mgmtType])), { name });
    document.getElementById('inp-mgmt-name').value = '';
    showToast('✅ 추가됐어요'); await refreshMgmtList();
    if (mgmtOnDone) mgmtOnDone();
  };
  window.addRegion = async () => {
    if (!isChairman()) return;
    const n = document.getElementById('inp-region-name').value.trim(); if (!n) return;
    await set(push(ref(db,'regions')),{name:n});
    document.getElementById('inp-region-name').value='';
    showToast('✅'); loadDistrictMgmt();
  };
  window.addDistrict = async () => {
    if (!isRegion()) return;
    const n = document.getElementById('inp-dist-name').value.trim();
    const rid = document.getElementById('sel-new-dist-region').value;
    if (!n||!rid){ alert('이름과 지역을 선택해주세요'); return; }
    await set(push(ref(db,'districts')),{name:n,regionId:rid});
    document.getElementById('inp-dist-name').value='';
    showToast('✅'); loadDistrictMgmt();
  };
  window.openNickModal = () => {
    document.getElementById('inp-nickname').value = state.userNickname;
    document.getElementById('modal-nickname').classList.add('show');
  };
  window.closeNickModal = () => document.getElementById('modal-nickname').classList.remove('show');
  window.saveNickname = async () => {
    const nn = document.getElementById('inp-nickname').value.trim(); if (!nn) return;
    await update(ref(db,'users/'+state.currentUser.uid),{nickname:nn});
    state.userNickname = nn;
    document.querySelectorAll('.uname').forEach(el => el.textContent = nn);
    window.closeNickModal(); showToast('✅ 닉네임 변경됐어요');
  };
}
