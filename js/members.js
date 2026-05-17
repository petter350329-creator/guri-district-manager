import { db, state, canEdit } from './config.js';
import { showToast } from './utils.js';
import { ref, set, get, push, remove, update } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

export async function openMemberModal(did) {
  if (!canEdit()) { showToast('권한이 없습니다'); return; }
  if (!did) { showToast('구역을 먼저 선택해주세요'); return; }
  const snap = await get(ref(db, 'members/' + did));
  const members = snap.val() || {};
  const list = Object.entries(members).sort((a,b) => (a[1].order||0)-(b[1].order||0));
  const el = document.getElementById('member-list');
  el.innerHTML = list.length
    ? list.map(([mid, m]) =>
        '<div class="user-row' + (m.isActive===false?' row-inactive':'') + '">'
        + '<div class="user-info"><div class="user-name">' + m.name + '</div><div class="user-sub">' + (m.phone||'연락처 없음') + '</div></div>'
        + '<div style="display:flex;gap:5px">'
        + '<button class="btn-xs" data-act="toggle" data-did="' + did + '" data-mid="' + mid + '" data-cur="' + (m.isActive!==false) + '">' + (m.isActive!==false?'비활성':'활성') + '</button>'
        + '<button class="btn-danger-xs" data-act="del" data-did="' + did + '" data-mid="' + mid + '">삭제</button>'
        + '</div></div>'
      ).join('')
    : '<div style="padding:16px;text-align:center;color:var(--muted);font-size:.83rem">구역원이 없습니다</div>';
  el.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.act === 'toggle') toggleActive(btn.dataset.did, btn.dataset.mid, btn.dataset.cur === 'true');
      if (btn.dataset.act === 'del')    deleteMember(btn.dataset.did, btn.dataset.mid);
    });
  });
  document.getElementById('inp-member-name').value  = '';
  document.getElementById('inp-member-phone').value = '';
  document.getElementById('modal-member').dataset.did = did;
  document.getElementById('modal-member').classList.add('show');
}

async function toggleActive(did, mid, cur) {
  await update(ref(db, 'members/' + did + '/' + mid), { isActive: !cur });
  openMemberModal(did);
}
async function deleteMember(did, mid) {
  if (!canEdit()) { showToast('권한이 없습니다'); return; }
  if (!confirm('삭제할까요?')) return;
  await remove(ref(db, 'members/' + did + '/' + mid));
  showToast('삭제됐어요'); openMemberModal(did);
}

export function setupMemberModal() {
  window.closeMemberModal = () => document.getElementById('modal-member').classList.remove('show');
  window.addMember = async () => {
    if (!canEdit()) { showToast('권한이 없습니다'); return; }
    const did   = document.getElementById('modal-member').dataset.did;
    const name  = document.getElementById('inp-member-name').value.trim();
    const phone = document.getElementById('inp-member-phone').value.trim();
    if (!name) { alert('이름을 입력해주세요'); return; }
    const snap = await get(ref(db, 'members/' + did));
    await set(push(ref(db, 'members/' + did)), {
      name, phone, isActive: true,
      order: Object.keys(snap.val()||{}).length, joinedAt: Date.now()
    });
    showToast('✅ 추가됐어요'); openMemberModal(did);
  };
}
