import type { Player } from '../types';

export const KBO_TEAMS = [
  'KIA', '롯데', '삼성', '한화', '두산', 'LG', 'SSG', 'NC', 'KT', '키움',
  '대한민국', '도미니카',
];

export const POS_NAME: Record<number, string> = {
  0: 'DH', 1: '투수', 2: '포수', 3: '1루수', 4: '2루수',
  5: '3루수', 6: '유격수', 7: '좌익수', 8: '중견수', 9: '우익수',
};

export const POS_ABBR: Record<number, string> = {
  0: 'D', 1: '1', 2: '2', 3: '3', 4: '4',
  5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
};

export const KAN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
export const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const TEAM_FLAG: Record<string, string> = {
  KIA:  `${BASE}/logos/kia.png`,
  롯데: `${BASE}/logos/lotte.jpg`,
  삼성: `${BASE}/logos/samsung.png`,
  한화: `${BASE}/logos/hanwha.png`,
  두산: `${BASE}/logos/doosan.png`,
  LG:   `${BASE}/logos/lg.png`,
  SSG:  `${BASE}/logos/ssg.png`,
  NC:   `${BASE}/logos/nc.png`,
  KT:   `${BASE}/logos/kt.png`,
  키움: `${BASE}/logos/kiwoom.jpg`,
  대한민국: '',
  도미니카: '',
};

// SVG base centers (viewBox 200x200)
export const BASE_XY: Record<string, { x: number; y: number }> = {
  HOME: { x: 100, y: 175 },
  '1B': { x: 145, y: 130 },
  '2B': { x: 100, y: 85 },
  '3B': { x: 55, y: 130 },
};

// Fielder SVG centers (베이스 사각형과 겹치지 않도록 오프셋)
// 베이스: HOME(100,175) 1B(145,130) 2B(100,85) 3B(55,130) — 각 14×14 사각형
export const FPOS_XY: Record<number, { x: number; y: number }> = {
  1: { x: 100, y: 128 }, // 투수: 마운드 중앙
  2: { x: 100, y: 193 }, // 포수: 홈 아래로 이동 (홈 rect y=168~182 아래)
  3: { x: 164, y: 125 }, // 1루수: 1루 베이스 rect(138~152,123~137) 우측 바깥
  4: { x: 128, y: 105 }, // 2루수: 1~2루 사이
  5: { x: 36,  y: 125 }, // 3루수: 3루 베이스 rect(48~62,123~137) 좌측 바깥
  6: { x: 72,  y: 105 }, // 유격수: 2~3루 사이
  7: { x: 25,  y: 52  }, // 좌익수
  8: { x: 100, y: 22  }, // 중견수
  9: { x: 175, y: 52  }, // 우익수
};

export const PITCH_SYM: Record<string, string> = {
  S: '○',   // 스트라이크
  SW: '',   // SVG 사용
  B: '—',   // 볼
  F: '△',   // 파울
  FE: '▲',  // 파울실책
  BS: '●',  // 번트헛스윙
  BF: '▲',  // 번트파울
  PC1: '', // svg 사용
  PC2: '',  // SVG 사용
  PC3: '',  // SVG 사용
  θ: 'θ',  // 타격완료
};

// record.md 기준 표시 기호 변환 (저장 코드 → 화면 표시)
export const RESULT_SYMBOL: Record<string, string> = {
  HR:   '◊',
  GHR:  'GH',
  GCW:  '◊',   // 끝내기 홈런
  K3B:  'K△',  // 쓰리번트 삼진
  KW:   'KW',  // 낫아웃+폭투 (그대로)
  KP:   'KP',  // 낫아웃+패스트볼
  KE:   'KE',  // 낫아웃+실책
};

export const RESULT_COL: Record<string, string> = {
  K: '#111', B: '#111', IB: '#111', IB2: '#2980b9', HP: '#16a34a',
  KW: '#16a34a', KP: '#16a34a', KE: '#16a34a',
  HR: '#c0392b', GHR: '#c0392b', GCW: '#c0392b',
  FC4: '#15803d', FC5: '#15803d', FC6: '#15803d', FC: '#15803d',
  'FC번트': '#15803d', 'E번트': '#dc2626', 'SH진루': '#2563eb',
  'DP_E': '#7c3aed', 'TP_E': '#7c3aed',
  '4-3': '#7c3aed', '6-3': '#7c3aed', '5-3': '#7c3aed',
  // 단타
  '/7': '#111', '/8': '#111', '/9': '#2563eb',
  INT: '#111', BUNT: '#2563eb',
  '/hit': '#111', H1: '#2563eb',
  // 2루타
  '>7': '#2563eb', '>7-8': '#2563eb', '>8-9': '#2563eb', '>9': '#2563eb',
  '>hit': '#2563eb', H2: '#2563eb',
  // 3루타
  '>>>7': '#2563eb', '>>>8': '#2563eb', '>>>9': '#2563eb',
  '>>>hit': '#2563eb', H3: '#2563eb',
  F7: '#92400e', F8: '#92400e', F9: '#92400e',
  SF7: '#92400e', SF8: '#92400e', SF9: '#92400e',
  f2: '#92400e', f7: '#92400e', f8: '#92400e', f9: '#92400e',
  L4: '#92400e', L5: '#92400e', L6: '#92400e', L7: '#92400e', L8: '#92400e', L9: '#92400e',
  x2: '#7c3aed', xBU: '#7c3aed', IP: '#7c3aed', IP0: '#7c3aed',
  K3B: '#c0392b', KT: '#c0392b', A: '#92400e', IF: '#92400e',
  // 기타 진루
  'E기록': '#2563eb', '선행주자아웃': '#2563eb', '→선행주자아웃': '#2563eb',
  'K다른주자': '#16a34a',
};

// Base path lines for score cell SVG (viewBox 40x40, diamond: top(20,2) right(38,20) bottom(20,38) left(2,20))
const S1 = [{ x1: 20, y1: 38, x2: 38, y2: 20, c: '#2563eb', w: 2.5 }];
const S2 = [...S1, { x1: 38, y1: 20, x2: 20, y2: 2, c: '#2563eb', w: 2.5 }];
const S3 = [...S2, { x1: 20, y1: 2, x2: 2, y2: 20, c: '#2563eb', w: 2.5 }];

export const BASE_LINES: Record<string, { x1: number; y1: number; x2: number; y2: number; c: string; w: number }[]> = {
  // 단타
  '/7': S1, '/8': S1, '/9': S1, INT: S1, BUNT: S1, '/hit': S1, H1: S1,
  // 출루 (볼넷/사구/실책/FC 등) — 1루까지 선 표시
  B: S1, IB: S1, IB2: S1, HP: S1, '#': S1, ob: S1,
  E: S1, FC: S1, FC4: S1, FC5: S1, FC6: S1,
  KW: S1, KP: S1, KE: S1,
  'FC번트': S1, 'E번트': S1, 'SH진루': S1, 'DP_E': S1, 'TP_E': S1,
  'E기록': S1, '선행주자아웃': S1, '→선행주자아웃': S1, 'K다른주자': S1,
  GCW: [
    { x1: 20, y1: 38, x2: 38, y2: 20, c: '#111', w: 2.5 },
    { x1: 38, y1: 20, x2: 20, y2: 2,  c: '#111', w: 2.5 },
    { x1: 20, y1: 2,  x2: 2,  y2: 20, c: '#111', w: 2.5 },
    { x1: 2,  y1: 20, x2: 20, y2: 38, c: '#111', w: 2.5 },
  ],
  // 2루타
  '>7': S2, '>7-8': S2, '>8-9': S2, '>9': S2, '>hit': S2, H2: S2,
  // 3루타
  '>>>7': S3, '>>>8': S3, '>>>9': S3, '>>>hit': S3, H3: S3,
  HR: [
    { x1: 20, y1: 38, x2: 38, y2: 20, c: '#111', w: 2.5 },
    { x1: 38, y1: 20, x2: 20, y2: 2,  c: '#111', w: 2.5 },
    { x1: 20, y1: 2,  x2: 2,  y2: 20, c: '#111', w: 2.5 },
    { x1: 2,  y1: 20, x2: 20, y2: 38, c: '#111', w: 2.5 },
  ],
  GHR: [
    { x1: 20, y1: 38, x2: 38, y2: 20, c: '#111', w: 2.5 },
    { x1: 38, y1: 20, x2: 20, y2: 2,  c: '#111', w: 2.5 },
    { x1: 20, y1: 2,  x2: 2,  y2: 20, c: '#111', w: 2.5 },
    { x1: 2,  y1: 20, x2: 20, y2: 38, c: '#111', w: 2.5 },
  ],
};

export const SAMPLE: { away: Player[]; home: Player[] } = {
  away: [
    // 타순 1-9 (투수 제외)
    { name: '고승민', num: '2',  pos: 6, order: 1, hitType: 1 },
    { name: '김대현', num: '3',  pos: 3, order: 2, hitType: 2 },
    { name: '김동혁', num: '4',  pos: 8, order: 3, hitType: 3 },
    { name: '김동현', num: '5',  pos: 5, order: 4, hitType: 1 },
    { name: '박건우', num: '6',  pos: 9, order: 5, hitType: 2 },
    { name: '박승욱', num: '7',  pos: 7, order: 6, hitType: 3 },
    { name: '강민제', num: '10', pos: 4, order: 7, hitType: 1 },
    { name: '박지훈', num: '9',  pos: 2, order: 8, hitType: 2 },
    { name: '박진형', num: 'DH', pos: 0, order: 9, hitType: 3 },
    // 투수 슬롯 (타순 없음)
    { name: '박시영', num: '8',  pos: 1, order: 0, hitType: 1 },
    // 벤치
    { name: '이호준', num: '11', pos: 3, order: 0, hitType: 2 },
    { name: '최재훈', num: '12', pos: 6, order: 0, hitType: 3 },
  ],
  home: [
    // 타순 1-9 (투수 제외)
    { name: '문보경', num: '2',  pos: 3, order: 1, hitType: 1 },
    { name: '노시환', num: '5',  pos: 5, order: 2, hitType: 2 },
    { name: '채은성', num: '7',  pos: 7, order: 3, hitType: 3 },
    { name: '이원석', num: '11', pos: 4, order: 4, hitType: 1 },
    { name: '허경민', num: '14', pos: 8, order: 5, hitType: 2 },
    { name: '페라자',  num: '17', pos: 2, order: 6, hitType: 3 },
    { name: '황영묵', num: '23', pos: 9, order: 7, hitType: 1 },
    { name: '장우주', num: '51', pos: 6, order: 8, hitType: 2 },
    { name: '전민재', num: '4',  pos: 0, order: 9, hitType: 3 },
    // 투수 슬롯 (타순 없음)
    { name: '유현빈', num: '61', pos: 1, order: 0, hitType: 1 },
    // 벤치
    { name: '이지영', num: '30', pos: 2, order: 0, hitType: 2 },
    { name: '안권수', num: '22', pos: 5, order: 0, hitType: 3 },
  ],
};
