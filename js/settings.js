import { db, state, ROLE_LABEL, isRegion, isChairman } from './config.js';
import { showToast } from './utils.js';
import { ref, set, get, push, remove, update } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

// ── 목록 관리 ──
let mgmtDid = '', mgmtType = '';

export async function openListMgmt(type, did) {
  if (!isRegion()) { showToast('권한이 없습니다'); return; }
  mgmtDid = did; mgmtType = type;
  const labels = { edu:'📖 교육', service:'🤝 봉사', extra:'💰 기타헌금' };
  document.getElementById('list-mgmt-title').textContent = labels[type] + ' 목록 관리';
  await refreshMgmtList();
  document.getElementById('inp-mgmt-name').value = '';
  document.getElementById('modal-listmgmt').classList.add('show');
}
async function refreshMgmtList() {
  const paths = { edu:'eduList/'+mgmtDid, service:'serviceList/'+mgmtDid, extra:'extraOfferings/'+mgmtDid };
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
    const paths2 = { edu:'eduList/'+mgmtDid, service:'serviceList/'+mgmtDid, extra:'extraOfferings/'+mgmtDid };
    await remove(ref(db, paths2[mgmtType] + '/' + btn.dataset.del));
    await refreshMgmtList();
  }));
}

// ── 멤버 · 승인 관리 ──
export async function openUserMgmt() {
  await loadUserList();
  document.getElementById('modal-users').classList.add('show');
}
async function loadUserList() {
  const [uSnap, rSnap] = await Promise.all([get(ref(db,'users')), get(ref(db,'requests'))]);
  const users = uSnap.val()||{}, reqs = rSnap.val()||{};
  const visR  = Object.entries(reqs).filter(([,u]) => isChairman() || (state.userRole==='region_admin' && u.regionId===state.userRegionId));
  const visU  = Object.entries(users).filter(([,u]) => isChairman() || (state.userRole==='region_admin' && u.regionId===state.userRegionId));
  let html = '';
  if (visR.length) {
    html += '<div class="section-label danger-label">⏳ 승인 대기 (' + visR.length + ')</div>';
    html += visR.map(([uid, u]) =>
      '<div class="user-row"><div class="user-info"><div class="user-name">' + (u.name||uid) + '</div><div class="user-sub">' + (u.email||'') + '</div></div>'
      + '<div class="user-actions">'
      + (isChairman() ? '<select id="req-role-' + uid + '" class="small-select"><option value="district_leader">구역장</option><option value="region_admin">임원</option></select>' : '')
      + '<button class="btn-xs" data-approve="' + uid + '">수락</button>'
      + '<button class="btn-danger-xs" data-reject="' + uid + '">거절</button>'
      + '</div></div>'
    ).join('');
  }
  html += '<div class="section-label" style="margin-top:12px">👥 멤버</div>';
  html += visU.map(([uid, u]) =>
    '<div class="user-row"><div class="user-info"><div class="user-name">' + (u.nickname||u.name||uid) + '</div><div class="user-sub">' + (state.districtsCache[u.districtId]?.name||'미배정') + '</div></div>'
    + (isChairman()
      ? '<div class="user-actions"><select class="small-select" data-role-uid="' + uid + '">'
        + ['district_leader','region_admin','chairman','superadmin'].map(r =>
            '<option value="' + r + '"' + (u.role===r?' selected':'') + '>' + ROLE_LABEL[r] + '</option>'
          ).join('')
        + '</select><button class="btn-danger-xs" data-del-user="' + uid + '">삭제</button></div>'
      : '<span class="role-badge">' + (ROLE_LABEL[u.role]||u.role) + '</span>')
    + '</div>'
  ).join('') || '<div style="padding:12px;color:var(--muted);font-size:.83rem">없음</div>';

  const el = document.getElementById('user-list');
  el.innerHTML = html;
  el.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => approveUser(b.dataset.approve)));
  el.querySelectorAll('[data-reject]').forEach(b  => b.addEventListener('click', () => rejectUser(b.dataset.reject)));
  el.querySelectorAll('[data-role-uid]').forEach(sel => sel.addEventListener('change', async () => {
    await update(ref(db,'users/'+sel.dataset.roleUid),{role:sel.value}); showToast('권한 변경됐어요');
  }));
  el.querySelectorAll('[data-del-user]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('삭제할까요?')) return;
    await remove(ref(db,'users/'+b.dataset.delUser)); loadUserList();
  }));
}
async function approveUser(uid) {
  const roleEl = document.getElementById('req-role-'+uid);
  const role   = roleEl ? roleEl.value : 'district_leader';
  const snap   = await get(ref(db,'requests/'+uid));
  if (!snap.exists()) { await loadUserList(); return; }
  const u = snap.val();
  await set(ref(db,'users/'+uid),{email:u.email||'',name:u.name||'',nickname:u.name||'',role,regionId:u.regionId||null,createdAt:Date.now()});
  await remove(ref(db,'requests/'+uid)); showToast('✅ 승인됐어요'); await loadUserList();
}
async function rejectUser(uid) { if(!confirm('거절할까요?'))return; await remove(ref(db,'requests/'+uid)); loadUserList(); }

// ── 구역장 배정 ──
export async function openAssignModal() {
  await loadAssignList();
  document.getElementById('modal-assign').classList.add('show');
}
async function loadAssignList() {
  const [rs, ds, us] = await Promise.all([get(ref(db,'regions')),get(ref(db,'districts')),get(ref(db,'users'))]);
  state.regionsCache = rs.val()||{}; state.districtsCache = ds.val()||{};
  const users    = us.val()||{};
  const myDists  = Object.entries(state.districtsCache).filter(([,d]) => isChairman()||d.regionId===state.userRegionId);
  const distOpts = myDists.map(([did,d]) => '<option value="'+did+'">' + d.name + '</option>').join('');
  const targets  = Object.entries(users).filter(([,u]) => u.role==='district_leader'&&(isChairman()||u.regionId===state.userRegionId));
  const el = document.getElementById('assign-list');
  el.innerHTML = targets.map(([uid,u]) =>
    '<div class="user-row"><div class="user-info"><div class="user-name">' + (u.nickname||u.name) + '</div><div class="user-sub">현재: ' + (state.districtsCache[u.districtId]?.name||'미배정') + '</div></div>'
    + '<select class="small-select" data-auid="'+uid+'"><option value="">미배정</option>'+distOpts+'</select></div>'
  ).join('') || '<div style="padding:12px;color:var(--muted);font-size:.83rem">없음</div>';
  el.querySelectorAll('[data-auid]').forEach(sel => sel.addEventListener('change', async () => {
    await update(ref(db,'users/'+sel.dataset.auid),{districtId:sel.value||null}); showToast('✅ 배정됐어요');
  }));
}

// ── 지역·구역 관리 ──
export async function openDistrictMgmt() {
  await loadDistrictMgmt();
  document.getElementById('modal-districts').classList.add('show');
}
async function loadDistrictMgmt() {
  const [rs, ds] = await Promise.all([get(ref(db,'regions')),get(ref(db,'districts'))]);
  state.regionsCache = rs.val()||{}; state.districtsCache = ds.val()||{};
  document.getElementById('sel-new-dist-region').innerHTML =
    Object.entries(state.regionsCache).map(([rid,r]) => '<option value="'+rid+'">'+r.name+'</option>').join('')
    || '<option value="">지역을 먼저 추가하세요</option>';
  const rl = document.getElementById('region-list');
  rl.innerHTML = Object.entries(state.regionsCache).map(([rid,r]) =>
    '<div class="user-row"><div class="user-info"><div class="user-name">'+r.name+'</div></div><button class="btn-danger-xs" data-del-r="'+rid+'">삭제</button></div>'
  ).join('') || '<div style="padding:8px;color:var(--muted);font-size:.8rem">없음</div>';
  rl.querySelectorAll('[data-del-r]').forEach(b => b.addEventListener('click', async () => {
    if(!confirm('삭제할까요?'))return; await remove(ref(db,'regions/'+b.dataset.delR)); loadDistrictMgmt();
  }));
  const dl = document.getElementById('district-list');
  dl.innerHTML = Object.entries(state.districtsCache).map(([did,d]) =>
    '<div class="user-row"><div class="user-info"><div class="user-name">'+d.name+'</div><div class="user-sub">'+(state.regionsCache[d.regionId]?.name||'?')+'</div></div><button class="btn-danger-xs" data-del-d="'+did+'">삭제</button></div>'
  ).join('') || '<div style="padding:8px;color:var(--muted);font-size:.8rem">없음</div>';
  dl.querySelectorAll('[data-del-d]').forEach(b => b.addEventListener('click', async () => {
    if(!confirm('삭제할까요?'))return; await remove(ref(db,'districts/'+b.dataset.delD)); loadDistrictMgmt();
  }));
}

export function setupSettingsButtons() {
  window.closeListMgmt     = () => document.getElementById('modal-listmgmt').classList.remove('show');
  window.closeUserMgmt     = () => document.getElementById('modal-users').classList.remove('show');
  window.closeAssignModal  = () => document.getElementById('modal-assign').classList.remove('show');
  window.closeDistrictMgmt = () => document.getElementById('modal-districts').classList.remove('show');

  window.addMgmtItem = async () => {
    const name = document.getElementById('inp-mgmt-name').value.trim(); if (!name) return;
    const paths = { edu:'eduList/'+mgmtDid, service:'serviceList/'+mgmtDid, extra:'extraOfferings/'+mgmtDid };
    await set(push(ref(db, paths[mgmtType])), { name });
    document.getElementById('inp-mgmt-name').value = '';
    showToast('✅ 추가됐어요'); await refreshMgmtList();
  };
  window.addRegion = async () => {
    const n = document.getElementById('inp-region-name').value.trim(); if (!n) return;
    await set(push(ref(db,'regions')),{name:n}); document.getElementById('inp-region-name').value=''; showToast('✅'); loadDistrictMgmt();
  };
  window.addDistrict = async () => {
    const n   = document.getElementById('inp-dist-name').value.trim();
    const rid = document.getElementById('sel-new-dist-region').value;
    if (!n||!rid){alert('이름과 지역을 선택해주세요');return;}
    await set(push(ref(db,'districts')),{name:n,regionId:rid}); document.getElementById('inp-dist-name').value=''; showToast('✅'); loadDistrictMgmt();
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
