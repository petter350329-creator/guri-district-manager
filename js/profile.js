import { db, state, SPIRIT_LEVELS, canEdit, isRegion } from './config.js';
import { showScreen, showToast } from './utils.js';
import { ref, set, get, update } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const PF_FIELDS = [
  'birth','baptismDate','phone','address','workplace',
  'contactMethod','contactNote','relationship',
  'mbti','enneagram','personality','workSchedule',
  'worshipPattern','worshipLevel','worshipLevelNote','offeringNote',
  'faithLevel','faithLevelNote','faithNote',
  'eduLevel','eduNote','evangelismNote',
  'familyNote','economicNote',
  'visitTime','caution','prayer','notes',
  'prevLeader','prevLeaderContact',
  'spiritLevel','faithType','faithTypeNote'
];

let profileDid = '', profileMid = '';
let _savedSnapshot = '';

function getFormSnapshot() {
  const data = {};
  PF_FIELDS.forEach(f => { const el = document.getElementById('pf-' + f); if (el) data[f] = el.value.trim(); });
  return JSON.stringify(data);
}
function isDirty() { return canEdit() && getFormSnapshot() !== _savedSnapshot; }

export async function openProfile(did, mid, name) {
  profileDid = did; profileMid = mid;
  document.getElementById('profile-name').textContent = name;

  const [detailSnap, memberSnap] = await Promise.all([
    get(ref(db, 'memberDetail/' + did + '/' + mid)),
    get(ref(db, 'members/' + did + '/' + mid))
  ]);
  const d = detailSnap.val() || {};
  if (!d.phone && memberSnap.exists()) d.phone = memberSnap.val()?.phone || '';

  PF_FIELDS.forEach(f => { const el = document.getElementById('pf-' + f); if (el) el.value = d[f] || ''; });

  ['worshipLevel','faithLevel','eduLevel'].forEach(f => {
    document.querySelectorAll('.level-btn[data-field="' + f + '"]').forEach(b => b.classList.toggle('level-on', b.dataset.val === (d[f]||'')));
  });
  document.querySelectorAll('.level-btn[data-field="faithType"]').forEach(b => b.classList.toggle('level-on', b.dataset.val === (d.faithType||'')));
  const fnWrap = document.getElementById('faith-type-note-wrap');
  if (fnWrap) fnWrap.style.display = d.faithType === '부분가족신앙' ? 'block' : 'none';

  const sk = d.spiritLevel || '';
  document.querySelectorAll('.spirit-btn').forEach(b => b.classList.toggle('spirit-on', b.dataset.key === sk));
  setSpiritDisplay(sk);

  document.querySelectorAll('.pf-editable').forEach(el => {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.readOnly = !canEdit();
  });
  document.getElementById('btn-save-profile').style.display = canEdit() ? '' : 'none';
  document.getElementById('btn-transfer-profile').style.display = canEdit() ? '' : 'none';

  renderStamp(d.managerStamp || null);
  _savedSnapshot = getFormSnapshot();
  showScreen('profile');
}

// ── 10번: 임원 확인 도장 ──
function renderStamp(stamp) {
  const el = document.getElementById('manager-stamp-area');
  if (!el) return;
  if (stamp) {
    const dt = new Date(stamp.timestamp);
    const dateStr = dt.getFullYear() + '.' + String(dt.getMonth()+1).padStart(2,'0') + '.' + String(dt.getDate()).padStart(2,'0');
    el.innerHTML =
      '<div class="stamp-box stamp-done">'
      + '<div class="stamp-mark">인</div>'
      + '<div class="stamp-name">' + (stamp.name||'임원') + '</div>'
      + '<div class="stamp-date">' + dateStr + '</div>'
      + '</div>';
  } else {
    el.innerHTML =
      '<div class="stamp-box stamp-empty' + (isRegion() ? ' stamp-clickable' : '') + '" id="btn-stamp-apply">'
      + '<div class="stamp-mark">인</div>'
      + '<div class="stamp-label">미확인</div>'
      + '</div>';
    if (isRegion()) {
      el.querySelector('#btn-stamp-apply').addEventListener('click', applyStamp);
    }
  }
}

async function applyStamp() {
  if (!isRegion()) return;
  if (!confirm('확인 도장을 찍을까요?')) return;
  const stamp = {
    uid: state.currentUser.uid,
    name: state.userNickname || state.currentUser.displayName || '임원',
    timestamp: Date.now()
  };
  await update(ref(db, 'memberDetail/' + profileDid + '/' + profileMid), { managerStamp: stamp });
  renderStamp(stamp);
  showToast('✅ 확인 도장이 찍혔어요');
}

function setSpiritDisplay(key) {
  const sp   = SPIRIT_LEVELS.find(s => s.key === key);
  const disp = document.getElementById('spirit-display');
  if (!disp) return;
  if (sp) {
    disp.textContent   = sp.label;
    disp.style.cssText = 'background:' + sp.bg + ';color:' + sp.color + ';border-color:' + sp.border
      + ';display:block;border-radius:6px;padding:6px 14px;font-size:.82rem;font-weight:600;border:.5px solid;margin-top:8px;text-align:center';
  } else {
    disp.style.display = 'none';
  }
}

export function setupProfileButtons() {
  window.closeProfile = async () => {
    if (isDirty()) {
      const choice = await showSaveConfirm();
      if (choice === 'save')   { await doSaveProfile(); showToast('✅ 저장됐어요'); }
      else if (choice === 'cancel') { return; }
    }
    showScreen('main');
  };

  window.setLevel = (field, val) => {
    if (!canEdit()) return;
    document.querySelectorAll('.level-btn[data-field="' + field + '"]').forEach(b => b.classList.toggle('level-on', b.dataset.val === val));
    const el = document.getElementById('pf-' + field); if (el) el.value = val;
  };

  window.setFaithType = (val) => {
    if (!canEdit()) return;
    document.querySelectorAll('.level-btn[data-field="faithType"]').forEach(b => b.classList.toggle('level-on', b.dataset.val === val));
    const el = document.getElementById('pf-faithType'); if (el) el.value = val;
    const wrap = document.getElementById('faith-type-note-wrap');
    if (wrap) wrap.style.display = val === '부분가족신앙' ? 'block' : 'none';
  };

  window.setSpiritLevel = (key) => {
    if (!canEdit()) return;
    document.querySelectorAll('.spirit-btn').forEach(b => b.classList.toggle('spirit-on', b.dataset.key === key));
    const el = document.getElementById('pf-spiritLevel'); if (el) el.value = key;
    setSpiritDisplay(key);
  };

  window.saveProfile = async () => {
    await doSaveProfile();
    showToast('✅ 저장됐어요');
  };

  window.openTransferModal = async () => {
    await loadTransferOptions();
    document.getElementById('modal-transfer').classList.add('show');
  };
  window.closeTransferModal = () => document.getElementById('modal-transfer').classList.remove('show');

  window.submitTransfer = async () => {
    const toDid = document.getElementById('sel-transfer-did').value;
    if (!toDid) { showToast('이관할 구역을 선택해주세요'); return; }
    const name = document.getElementById('profile-name').textContent;
    await set(ref(db, 'transferRequests/' + profileMid), {
      fromDid: profileDid, toDid, name,
      requestedAt: Date.now(),
      requestedBy: state.currentUser.uid
    });
    document.getElementById('modal-transfer').classList.remove('show');
    showToast('✅ 이관 요청 전송됨. 기존 구역 임원 승인 후 이관됩니다.');
  };
}

async function doSaveProfile() {
  const data = {};
  PF_FIELDS.forEach(f => { const el = document.getElementById('pf-' + f); if (el) data[f] = el.value.trim(); });
  await set(ref(db, 'memberDetail/' + profileDid + '/' + profileMid), data);
  _savedSnapshot = getFormSnapshot();
}

function showSaveConfirm() {
  return new Promise(resolve => {
    const modal = document.getElementById('modal-save-confirm');
    if (!modal) { resolve('discard'); return; }
    modal.classList.add('show');
    function cleanup() {
      modal.classList.remove('show');
      modal.querySelector('#btn-sc-save').onclick    = null;
      modal.querySelector('#btn-sc-discard').onclick = null;
      modal.querySelector('#btn-sc-cancel').onclick  = null;
    }
    modal.querySelector('#btn-sc-save').onclick    = () => { cleanup(); resolve('save'); };
    modal.querySelector('#btn-sc-discard').onclick = () => { cleanup(); resolve('discard'); };
    modal.querySelector('#btn-sc-cancel').onclick  = () => { cleanup(); resolve('cancel'); };
  });
}

async function loadTransferOptions() {
  const el = document.getElementById('sel-transfer-did');
  const opts = Object.entries(state.districtsCache)
    .filter(([did]) => did !== profileDid)
    .map(([did, d]) => {
      const rn = state.regionsCache[d.regionId]?.name || '';
      return '<option value="' + did + '">' + (rn ? rn + ' · ' : '') + d.name + '</option>';
    }).join('');
  el.innerHTML = '<option value="">구역 선택</option>' + opts;
}
