import { db, state, SPIRIT_LEVELS, REGION_ADMIN_NAME, canEdit, isRegion } from './config.js';
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

// 지체관계 역할 정의
const REL_ROLES = [
  { key:'인도자', cols:['이름','연락처','소속','비고'] },
  { key:'섬김이', cols:['이름','연락처','소속','비고'] },
  { key:'교사',   cols:['이름','연락처','소속','비고'] },
  { key:'전도사', cols:['이름','연락처','소속','비고'] },
  { key:'강사',   cols:['이름','연락처','소속','비고'] },
];

let profileDid = '', profileMid = '';
let _savedSnapshot = '';
let _relData = { friends:[], roles:{} };  // 친분자 배열, 역할별 단일 데이터

function getFormSnapshot() {
  const data = {};
  PF_FIELDS.forEach(f => { const el = document.getElementById('pf-' + f); if (el) data[f] = el.value.trim(); });
  data.__rel = JSON.stringify(_relData);
  return JSON.stringify(data);
}
function isDirty() { return canEdit() && getFormSnapshot() !== _savedSnapshot; }

export async function openProfile(did, mid, name) {
  profileDid = did; profileMid = mid;
  document.getElementById('profile-name').textContent = name;

  const [detailSnap, memberSnap] = await Promise.all([
    get(ref(db, 'memberDetail/' + did + '/' + mid)),
    get(ref(db, 'members/'      + did + '/' + mid))
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

  // 사진 복원
  const photoEl = document.getElementById('pf-photo-preview');
  if (photoEl) photoEl.src = d.photo || '';
  const photoWrap = document.getElementById('pf-photo-wrap');
  if (photoWrap) photoWrap.style.backgroundImage = d.photo ? 'url(' + d.photo + ')' : '';

  // 지체관계 복원
  _relData = d.relData ? (typeof d.relData === 'string' ? JSON.parse(d.relData) : d.relData) : { friends:[], roles:{} };
  renderRelSection();

  document.querySelectorAll('.pf-editable').forEach(el => {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.readOnly = !canEdit();
  });
  document.getElementById('btn-save-profile').style.display   = canEdit() ? '' : 'none';
  document.getElementById('btn-transfer-profile').style.display = canEdit() ? '' : 'none';

  _savedSnapshot = getFormSnapshot();
  showScreen('profile');
}

// ── 지체관계 렌더 ──
function renderRelSection() {
  const wrap = document.getElementById('rel-section-body');
  if (!wrap) return;
  const editable = canEdit();

  // 친분자 목록
  const friends = _relData.friends || [];
  let html = '<div class="rel-group"><div class="rel-group-title">👥 친분자</div>';
  friends.forEach((f, i) => {
    html += relFriendRow(f, i, editable);
  });
  if (editable) html += '<button class="btn-xs rel-add-friend" style="margin-top:6px">＋ 친분자 추가</button>';
  html += '</div>';

  // 역할별
  html += '<div class="rel-group" style="margin-top:14px"><div class="rel-group-title">🔗 관계 인물</div>';
  REL_ROLES.forEach(({ key, cols }) => {
    const rv = (_relData.roles || {})[key] || {};
    html += '<div class="rel-role-row">'
      + '<div class="rel-role-label">' + key + '</div>'
      + '<div class="rel-role-fields">'
      + cols.map(c => '<input class="rel-input pf-editable" data-role="' + key + '" data-col="' + c + '" placeholder="' + c + '" value="' + (rv[c]||'') + '"' + (editable?'':' readonly') + '>').join('')
      + '</div></div>';
  });
  html += '</div>';

  wrap.innerHTML = html;

  // 친분자 입력 이벤트
  wrap.querySelectorAll('.rel-friend-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const idx = +inp.dataset.idx, col = inp.dataset.col;
      if (!_relData.friends[idx]) _relData.friends[idx] = {};
      _relData.friends[idx][col] = inp.value;
    });
  });
  // 친분자 삭제
  wrap.querySelectorAll('.rel-del-friend').forEach(btn => {
    btn.addEventListener('click', () => {
      _relData.friends.splice(+btn.dataset.idx, 1);
      renderRelSection();
    });
  });
  // 친분자 추가
  wrap.querySelector('.rel-add-friend')?.addEventListener('click', () => {
    if (!_relData.friends) _relData.friends = [];
    _relData.friends.push({ 이름:'', 연락처:'', 소속:'', 관계:'' });
    renderRelSection();
  });
  // 역할 입력 이벤트
  wrap.querySelectorAll('.rel-input[data-role]').forEach(inp => {
    inp.addEventListener('input', () => {
      const role = inp.dataset.role, col = inp.dataset.col;
      if (!_relData.roles) _relData.roles = {};
      if (!_relData.roles[role]) _relData.roles[role] = {};
      _relData.roles[role][col] = inp.value;
    });
  });
}

function relFriendRow(f, i, editable) {
  return '<div class="rel-friend-row">'
    + ['이름','연락처','소속','관계'].map(c =>
        '<input class="rel-input rel-friend-input pf-editable" data-idx="' + i + '" data-col="' + c + '" placeholder="' + c + '" value="' + (f[c]||'') + '"' + (editable?'':' readonly') + '>'
      ).join('')
    + (editable ? '<button class="rel-del-friend btn-danger-xs" data-idx="' + i + '">✕</button>' : '')
    + '</div>';
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
      if (choice === 'save')        { await doSaveProfile(); showToast('✅ 저장됐어요'); }
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

  // 사진 업로드
  window.handlePhotoUpload = (input) => {
    if (!input.files?.[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 240;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = h * MAX / w; w = MAX; } }
        else       { if (h > MAX) { w = w * MAX / h; h = MAX; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const b64 = canvas.toDataURL('image/jpeg', 0.75);
        const wrap = document.getElementById('pf-photo-wrap');
        if (wrap) wrap.style.backgroundImage = 'url(' + b64 + ')';
        // hidden 저장용
        let hidden = document.getElementById('pf-photo-data');
        if (!hidden) { hidden = document.createElement('input'); hidden.type='hidden'; hidden.id='pf-photo-data'; document.body.appendChild(hidden); }
        hidden.value = b64;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
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
      requestedAt: Date.now(), requestedBy: state.currentUser.uid
    });
    document.getElementById('modal-transfer').classList.remove('show');
    showToast('✅ 이관 요청 전송됨. 기존 구역 임원 승인 후 이관됩니다.');
  };
}

async function doSaveProfile() {
  const data = {};
  PF_FIELDS.forEach(f => { const el = document.getElementById('pf-' + f); if (el) data[f] = el.value.trim(); });
  // 사진
  const photoHidden = document.getElementById('pf-photo-data');
  if (photoHidden?.value) data.photo = photoHidden.value;
  else {
    const wrap = document.getElementById('pf-photo-wrap');
    if (wrap?.style.backgroundImage && wrap.style.backgroundImage !== 'none' && wrap.style.backgroundImage !== '') {
      const match = wrap.style.backgroundImage.match(/url\("?(.+?)"?\)/);
      if (match) data.photo = match[1];
    }
  }
  // 지체관계
  data.relData = JSON.stringify(_relData);
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
