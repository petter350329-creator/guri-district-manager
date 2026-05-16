import { state }                        from './config.js';
import { getWeekId, getMonthId, showScreen } from './utils.js';
import { initAuth, setupAuthButtons, applyRoleUI } from './auth.js';
import { initFaithTab, loadFaithWeek }  from './faith.js';
import { setupProfileButtons }          from './profile.js';
import { setupMemberModal }             from './members.js';
import { openUserMgmt, openAssignModal, openDistrictMgmt, setupSettingsButtons } from './settings.js';

// ── 초기화 ──
state.currentWeekId  = getWeekId();
state.currentMonthId = getMonthId();

// ── 버튼 함수 등록 ──
setupAuthButtons();
setupProfileButtons();
setupMemberModal();
setupSettingsButtons();

// ── 탭 전환 ──
window.switchTab = (tab) => {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  document.querySelector('.tab-btn[data-tab="' + tab + '"]')?.classList.add('active');
  if (tab === 'faith') initFaithTab();
  if (tab === 'evang') placeholder('evang-content','🌱','전도 관리');
  if (tab === 'visit') placeholder('visit-content','🫂','심방 기록');
  if (tab === 'stats') placeholder('stats-content','📊','통계 · 대시보드');
};
function placeholder(id, icon, label) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = '<div class="empty-state"><div style="font-size:2.5rem">' + icon + '</div><p style="margin-top:12px">' + label + '<br>다음 버전 추가 예정</p></div>';
}

// ── 설정 탭 버튼 ──
window.openUserMgmt     = openUserMgmt;
window.openAssignModal  = openAssignModal;
window.openDistrictMgmt = openDistrictMgmt;

// ── 로그인 후 메인 진입 ──
function enterMain() {
  applyRoleUI();
  showScreen('main');
  switchTab('faith');
  // 설정 탭 구역원 관리 버튼
  document.getElementById('btn-member-settings')?.addEventListener('click', () => {
    const did = state.userDistrictId || state.faithDistrictId || '';
    import('./members.js').then(m => m.openMemberModal(did));
  });
}

// ── 인증 시작 ──
initAuth(enterMain);

// ── 모달 배경 클릭 닫기 ──
document.addEventListener('click', e => {
  ['modal-member','modal-users','modal-districts','modal-assign','modal-nickname','modal-listmgmt'].forEach(id => {
    if (e.target === document.getElementById(id)) document.getElementById(id).classList.remove('show');
  });
});
