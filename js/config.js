// ── Firebase 초기화 ──
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDpxfXPW464jphvj2K1uZqzUBEtX0jjiVQ',
  authDomain: 'guri-district-manager.firebaseapp.com',
  databaseURL: 'https://guri-district-manager-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'guri-district-manager',
  storageBucket: 'guri-district-manager.firebasestorage.app',
  messagingSenderId: '414381618941',
  appId: '1:414381618941:web:5006d9086ef8bcc9ccb094'
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getDatabase(app);

// ── 공유 상태 (객체로 묶어서 다른 모듈에서 참조/수정 가능) ──
export const state = {
  currentUser:    null,
  userRole:       null,
  userNickname:   '',
  userRegionId:   null,
  userDistrictId: null,
  currentWeekId:  '',   // app.js에서 초기화
  currentMonthId: '',
  regionsCache:   {},
  districtsCache: {},
  faithDistrictId: null,
  eduListCache:   {},
  serviceListCache: {},
  extraOfferingCache: {},
  activePop: null,
};

// ── 상수 ──
export const SPIRIT_LEVELS = [
  { key:'fly',   label:'🦋 날라다녀', bg:'rgba(167,139,250,.18)', color:'#a78bfa', border:'rgba(167,139,250,.5)' },
  { key:'run',   label:'🏃 뛰고있어', bg:'rgba(108,143,255,.18)', color:'#6c8fff', border:'rgba(108,143,255,.5)' },
  { key:'walk',  label:'🚶 걷고있어', bg:'rgba(74,222,128,.18)',  color:'#4ade80', border:'rgba(74,222,128,.5)'  },
  { key:'lay',   label:'😪 누워있어', bg:'rgba(246,169,53,.18)',  color:'#f6a935', border:'rgba(246,169,53,.5)'  },
  { key:'sleep', label:'😴 자고있어', bg:'rgba(248,113,113,.18)', color:'#f87171', border:'rgba(248,113,113,.5)' },
];

export const ROLE_LABEL = {
  superadmin: '관리자', chairman: '회장',
  region_admin: '임원', district_leader: '구역장'
};

// ── 권한 헬퍼 ──
export const isSA       = () => state.userRole === 'superadmin';
export const isChairman = () => ['superadmin','chairman'].includes(state.userRole);
export const isRegion   = () => ['superadmin','chairman','region_admin'].includes(state.userRole);
export const isLeader   = () => ['superadmin','chairman','region_admin','district_leader'].includes(state.userRole);
export const canEdit    = () => isLeader();
