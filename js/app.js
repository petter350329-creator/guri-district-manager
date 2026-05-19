import { state }                        from './config.js';
import { getWeekId, getMonthId, showScreen } from './utils.js';
import { initAuth, setupAuthButtons, applyRoleUI } from './auth.js';
import { initFaithTab, loadFaithWeek }  from './faith.js';
import { setupProfileButtons }          from './profile.js';
import { setupMemberModal }             from './members.js';
import { openPendingMgmt, openMemberMgmt, openDistrictMgmt, openTransferMgmt, setupSettingsButtons } from './settings.js';

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
  if (tab === 'evang') placeholder('evang-content','🌱','전도 현황');
  if (tab === 'visit') placeholder('visit-content','🫂','심방 현황');
  if (tab === 'stats') placeholder('stats-content','📊','통계 · 대시보드');
};
function placeholder(id, icon, label) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = '<div class="empty-state"><div style="font-size:2.5rem">' + icon + '</div><p style="margin-top:12px">' + label + '<br>다음 버전 추가 예정</p></div>';
}

// ── 설정 탭 버튼 ──
window.openPendingMgmt  = openPendingMgmt;
window.openMemberMgmt   = openMemberMgmt;
window.openDistrictMgmt = openDistrictMgmt;
window.openTransferMgmt = openTransferMgmt;

// ── 로그인 후 메인 진입 ──
function enterMain() {
  applyRoleUI();
  applyTabLabels();
  showScreen('main');
  switchTab('faith');
}

// ── 임원/회장 역할에 따른 탭 라벨 조정 ──
function applyTabLabels() {
  const role = state.userRole;
  const faithBtn = document.querySelector('.tab-btn[data-tab="faith"] .tab-label');
  if (faithBtn) {
    if (role === 'district_leader') faithBtn.textContent = '신앙관리';
    else faithBtn.textContent = '구역 신앙';
  }
  const statsBtn = document.querySelector('.tab-btn[data-tab="stats"] .tab-label');
  if (statsBtn) statsBtn.textContent = '통계';
}

// ── 인증 시작 ──
initAuth(enterMain);

// ── 모달 배경 클릭 닫기 ──
document.addEventListener('click', e => {
  [
    'modal-member','modal-users','modal-member-mgmt','modal-districts',
    'modal-nickname','modal-listmgmt','modal-transfer-mgmt',
    'modal-save-confirm','modal-transfer'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el && e.target === el) el.classList.remove('show');
  });
});
