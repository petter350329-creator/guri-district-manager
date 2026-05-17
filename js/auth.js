import { auth, db, state, ROLE_LABEL, isSA, isChairman, isRegion, isLeader } from './config.js';
import { showScreen, showToast } from './utils.js';
import { ref, set, get } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

export function initAuth(onLogin) {
  onAuthStateChanged(auth, async user => {
    if (!user) { state.currentUser = null; state.userRole = null; showScreen('login'); return; }
    state.currentUser = user;

    const uSnap = await get(ref(db, 'users/' + user.uid));
    if (!uSnap.exists()) {
      const allSnap = await get(ref(db, 'users'));
      if (!allSnap.exists()) {
        await set(ref(db, 'users/' + user.uid), {
          email: user.email, name: user.displayName,
          nickname: user.displayName, role: 'superadmin', createdAt: Date.now()
        });
      } else {
        const emailKey = btoa(user.email).replace(/=/g, '');
        const wSnap = await get(ref(db, 'whitelist/' + emailKey));
        if (wSnap.exists()) {
          const d = wSnap.val();
          await set(ref(db, 'users/' + user.uid), {
            email: user.email, name: user.displayName, nickname: user.displayName,
            role: d.role, regionId: d.regionId||null, districtId: d.districtId||null, createdAt: Date.now()
          });
        } else {
          document.getElementById('reg-email').textContent = user.email;
          showScreen('register'); return;
        }
      }
    }

    const uData = (await get(ref(db, 'users/' + user.uid))).val();
    state.userRole       = uData?.role || null;
    state.userNickname   = uData?.nickname || uData?.name || user.displayName || '';
    state.userRegionId   = uData?.regionId || null;
    state.userDistrictId = uData?.districtId || null;
    if (!state.userRole) { showScreen('pending'); return; }

    const [rs, ds] = await Promise.all([get(ref(db,'regions')), get(ref(db,'districts'))]);
    state.regionsCache   = rs.val() || {};
    state.districtsCache = ds.val() || {};
    onLogin();
  });

  getRedirectResult(auth).catch(() => {});
}

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export function setupAuthButtons() {
  window.doLogin = async () => {
    try {
      if (isMobile) await signInWithRedirect(auth, new GoogleAuthProvider());
      else          await signInWithPopup(auth, new GoogleAuthProvider());
    } catch(e) {
      if (e.code !== 'auth/popup-closed-by-user') alert('로그인 실패: ' + e.message);
    }
  };
  window.doLogout = async () => await signOut(auth);
  window.submitRegister = async () => {
    const name     = document.getElementById('reg-name').value.trim();
    const regionId = document.getElementById('reg-region-sel').value;
    if (!name)     { alert('이름을 입력해주세요'); return; }
    if (!regionId) { alert('소속 지역을 선택해주세요'); return; }
    await set(ref(db, 'requests/' + state.currentUser.uid), {
      email: state.currentUser.email, name, role: 'district_leader', regionId, createdAt: Date.now()
    });
    showScreen('pending');
  };
}

export function applyRoleUI() {
  document.querySelectorAll('.uname').forEach(el => el.textContent = state.userNickname);
  document.querySelectorAll('.leader-only').forEach(el  => el.style.display = isLeader()   ? '' : 'none');
  document.querySelectorAll('.region-only').forEach(el  => el.style.display = isRegion()   ? '' : 'none');
  document.querySelectorAll('.chairman-only').forEach(el=> el.style.display = isChairman() ? '' : 'none');
  document.querySelectorAll('.sa-only').forEach(el      => el.style.display = isSA()       ? '' : 'none');
  // 구역장은 설정 탭을 간소화하게 보임
  const settingsBody = document.querySelector('.settings-body');
  if (settingsBody && state.userRole === 'district_leader') {
    settingsBody.classList.add('leader-settings');
  }
}
