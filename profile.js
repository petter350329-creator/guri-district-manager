import { db, state, SPIRIT_LEVELS, canEdit, isRegion } from './config.js';
import { showScreen, showToast } from './utils.js';
import { ref, set, get } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

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

export async function openProfile(did, mid, name) {
  profileDid = did; profileMid = mid;
  document.getElementById('profile-name').textContent = name;

  const [detailSnap, memberSnap] = await Promise.all([
    get(ref(db, 'memberDetail/' + did + '/' + mid)),
    get(ref(db, 'members/' + did + '/' + mid))
  ]);
  const d = detailSnap.val() || {};
  // 연락처 자동 연동
  if (!d.phone && memberSnap.exists()) d.phone = memberSnap.val()?.phone || '';

  PF_FIELDS.forEach(f => { const el = document.getElementById('pf-' + f); if (el) el.value = d[f] || ''; });

  // 수준 버튼 복원
  ['worshipLevel','faithLevel','eduLevel'].forEach(f => {
    document.querySelectorAll('.level-btn[data-field="' + f + '"]').forEach(b => b.classList.toggle('level-on', b.dataset.val === (d[f]||'')));
  });
  // 신앙 유형 복원
  document.querySelectorAll('.level-btn[data-field="faithType"]').forEach(b => b.classList.toggle('level-on', b.dataset.val === (d.faithType||'')));
  const fnWrap = document.getElementById('faith-type-note-wrap');
  if (fnWrap) fnWrap.style.display = d.faithType === '부분가족신앙' ? 'block' : 'none';

  // 심령 단계 복원
  const sk = d.spiritLevel || '';
  document.querySelectorAll('.spirit-btn').forEach(b => b.classList.toggle('spirit-on', b.dataset.key === sk));
  setSpiritDisplay(sk);

  // 편집 가능 여부
  document.querySelectorAll('.pf-editable').forEach(el => {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.readOnly = !canEdit();
  });
  document.getElementById('btn-save-profile').style.display = canEdit() ? '' : 'none';
  showScreen('profile');
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
  window.closeProfile = () => showScreen('main');

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
    const data = {};
    PF_FIELDS.forEach(f => { const el = document.getElementById('pf-' + f); if (el) data[f] = el.value.trim(); });
    await set(ref(db, 'memberDetail/' + profileDid + '/' + profileMid), data);
    showToast('✅ 저장됐어요');
  };
}
