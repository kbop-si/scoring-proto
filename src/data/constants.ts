import type { Player } from '../types';

export const KBO_TEAMS = [
  'KIA',
  '롯데',
  '삼성',
  '한화',
  '두산',
  'LG',
  'SSG',
  'NC',
  'KT',
  '키움',
  '대한민국',
  '도미니카',
];

export const POS_NAME: Record<number, string> = {
  0: 'DH',
  1: '투수',
  2: '포수',
  3: '1루수',
  4: '2루수',
  5: '3루수',
  6: '유격수',
  7: '좌익수',
  8: '중견수',
  9: '우익수',
};

export const POS_ABBR: Record<number, string> = {
  0: 'D',
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
};

export const KAN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
export const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const TEAM_FLAG: Record<string, string> = {
  KIA: `${BASE}/logos/kia.png`,
  롯데: `${BASE}/logos/lotte.jpg`,
  삼성: `${BASE}/logos/samsung.png`,
  한화: `${BASE}/logos/hanwha.png`,
  두산: `${BASE}/logos/doosan.png`,
  LG: `${BASE}/logos/lg.png`,
  SSG: `${BASE}/logos/ssg.png`,
  NC: `${BASE}/logos/nc.png`,
  KT: `${BASE}/logos/kt.png`,
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
  2: { x: 100, y: 197 }, // 포수: 홈 아래로 이동 (홈 rect y=168~182 아래)
  3: { x: 164, y: 125 }, // 1루수: 1루 베이스 rect(138~152,123~137) 우측 바깥
  4: { x: 128, y: 97 }, // 2루수: 1~2루 사이
  5: { x: 36, y: 125 }, // 3루수: 3루 베이스 rect(48~62,123~137) 좌측 바깥
  6: { x: 72, y: 97 }, // 유격수: 2~3루 사이
  7: { x: 25, y: 52 }, // 좌익수
  8: { x: 100, y: 22 }, // 중견수
  9: { x: 175, y: 52 }, // 우익수
};

export const PITCH_SYM: Record<string, string> = {
  S: '○', // 스트라이크
  SW: '', // SVG 사용
  B: '—', // 볼
  F: '△', // 파울
  FE: '▲', // 파울실책
  BS: '●', // 번트헛스윙
  BF: '▲', // 번트파울
  PC1: '', // svg 사용
  PC2: '', // SVG 사용
  PC3: '', // SVG 사용
  θ: 'θ', // 타격완료
};

// record.md 기준 표시 기호 변환 (저장 코드 → 화면 표시)
export const RESULT_SYMBOL: Record<string, string> = {
  HR: '◊',
  GHR: 'GH',
  GCW: '◊', // 끝내기 홈런
  K3B: 'K△', // 쓰리번트 삼진
  KW: 'KW', // 낫아웃+폭투 (그대로)
  KP: 'KP', // 낫아웃+패스트볼
  KE: 'KE', // 낫아웃+실책
};

export const RESULT_COL: Record<string, string> = {
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`#${n}E`, '#111'])),
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`Ob${n}E`, '#111'])),
  K: '#111',
  B: '#111',
  IB: '#111',
  IB2: '#111',
  HP: '#111',
  KW: '#111',
  KP: '#111',
  KE: '#111',
  HR: '#111',
  GHR: '#111',
  GCW: '#111',
  FC4: '#111',
  FC5: '#111',
  FC6: '#111',
  FC: '#111',
  FC번트: '#111',
  E번트: '#111',
  SH진루: '#111',
  DP_E: '#111',
  TP_E: '#111',
  '4-3': '#111',
  '6-3': '#111',
  '5-3': '#111',
  // 단타
  '/7': '#111',
  '/8': '#111',
  '/9': '#111',
  INT: '#111',
  BUNT: '#111',
  OBUNT: '#111',
  '/hit': '#111',
  H1: '#111',
  // 2루타
  '>7': '#111',
  '>7-8': '#111',
  '>8-9': '#111',
  '>9': '#111',
  '>hit': '#111',
  H2: '#111',
  // 3루타
  '>>>7': '#111',
  '>>>8': '#111',
  '>>>9': '#111',
  '>>>hit': '#111',
  H3: '#111',
  F7: '#111',
  F8: '#111',
  F9: '#111',
  SF7: '#111',
  SF8: '#111',
  SF9: '#111',
  f2: '#111',
  f7: '#111',
  f8: '#111',
  f9: '#111',
  L4: '#111',
  L5: '#111',
  L6: '#111',
  L7: '#111',
  L8: '#111',
  L9: '#111',
  x2: '#111',
  xBU: '#111',
  IP: '#111',
  IP0: '#111',
  K3B: '#111',
  KT: '#111',
  A: '#111',
  IF: '#111',
  // 기타 진루
  E기록: '#111',
  선행주자아웃: '#111',
  '→선행주자아웃': '#111',
  K다른주자: '#111',
};

// Base path lines for score cell SVG (viewBox 40x40, diamond: top(20,2) right(38,20) bottom(20,38) left(2,20))
const S1 = [{ x1: 20, y1: 38, x2: 38, y2: 20, c: '#111', w: 2.5 }];
const S2 = [...S1, { x1: 38, y1: 20, x2: 20, y2: 2, c: '#111', w: 2.5 }];
const S3 = [...S2, { x1: 20, y1: 2, x2: 2, y2: 20, c: '#111', w: 2.5 }];

export const BASE_LINES: Record<
  string,
  { x1: number; y1: number; x2: number; y2: number; c: string; w: number }[]
> = {
  // 단타
  '/7': S1,
  '/8': S1,
  '/9': S1,
  INT: S1,
  BUNT: S1,
  OBUNT: S1,
  '/hit': S1,
  H1: S1,
  // 출루 (볼넷/사구/실책/FC 등) — 1루까지 선 표시
  B: S1,
  IB: S1,
  IB2: S1,
  HP: S1,
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`#${n}E`, S1])),
  ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`Ob${n}E`, S1])),
  E: S1,
  // FC류는 다이아몬드 S1 라인(/) 표시 안 함 — 셀 결과 코드(FC4 등)와 ballType 마크로만 표시
  KW: S1,
  KP: S1,
  KE: S1,
  E번트: S1,
  SH진루: S1,
  DP_E: S1,
  TP_E: S1,
  E기록: S1,
  K다른주자: S1,
  GCW: [
    { x1: 20, y1: 38, x2: 38, y2: 20, c: '#111', w: 2.5 },
    { x1: 38, y1: 20, x2: 20, y2: 2, c: '#111', w: 2.5 },
    { x1: 20, y1: 2, x2: 2, y2: 20, c: '#111', w: 2.5 },
    { x1: 2, y1: 20, x2: 20, y2: 38, c: '#111', w: 2.5 },
  ],
  // 2루타
  '>7': S2,
  '>7-8': S2,
  '>8-9': S2,
  '>9': S2,
  '>hit': S2,
  H2: S2,
  // 3루타
  '>>>7': S3,
  '>>>8': S3,
  '>>>9': S3,
  '>>>hit': S3,
  H3: S3,
  HR: [
    { x1: 20, y1: 38, x2: 38, y2: 20, c: '#111', w: 2.5 },
    { x1: 38, y1: 20, x2: 20, y2: 2, c: '#111', w: 2.5 },
    { x1: 20, y1: 2, x2: 2, y2: 20, c: '#111', w: 2.5 },
    { x1: 2, y1: 20, x2: 20, y2: 38, c: '#111', w: 2.5 },
  ],
  GHR: [
    { x1: 20, y1: 38, x2: 38, y2: 20, c: '#111', w: 2.5 },
    { x1: 38, y1: 20, x2: 20, y2: 2, c: '#111', w: 2.5 },
    { x1: 20, y1: 2, x2: 2, y2: 20, c: '#111', w: 2.5 },
    { x1: 2, y1: 20, x2: 20, y2: 38, c: '#111', w: 2.5 },
  ],
};

export const SAMPLE: { away: Player[]; home: Player[] } = {
  away: [
    // 타순 1-9 (투수 제외)
    { name: '고승민', num: '2', pos: 6, order: 1, hitType: 1 },
    { name: '김시현', num: '3', pos: 3, order: 2, hitType: 2 },
    { name: '김우동', num: '4', pos: 8, order: 3, hitType: 3 },
    { name: '김동현', num: '5', pos: 5, order: 4, hitType: 1 },
    { name: '박건우', num: '6', pos: 9, order: 5, hitType: 2 },
    { name: '박승욱', num: '7', pos: 7, order: 6, hitType: 3 },
    { name: '강민제', num: '10', pos: 4, order: 7, hitType: 1 },
    { name: '박지훈', num: '9', pos: 2, order: 8, hitType: 2 },
    { name: '박진형', num: 'DH', pos: 0, order: 9, hitType: 3 },
    // 투수 슬롯 (타순 없음)
    { name: '박시영', num: '8', pos: 1, order: 0, hitType: 1 },
    // 벤치
    { name: '이호준', num: '11', pos: 3, order: 0, hitType: 2 },
    { name: '최재훈', num: '12', pos: 6, order: 0, hitType: 3 },
  ],
  home: [
    // 타순 1-9 (투수 제외)
    { name: '문보경', num: '2', pos: 3, order: 1, hitType: 1 },
    { name: '노시환', num: '5', pos: 5, order: 2, hitType: 2 },
    { name: '채은성', num: '7', pos: 7, order: 3, hitType: 3 },
    { name: '이원석', num: '11', pos: 4, order: 4, hitType: 1 },
    { name: '허경민', num: '14', pos: 8, order: 5, hitType: 2 },
    { name: '페라자', num: '17', pos: 2, order: 6, hitType: 3 },
    { name: '황영묵', num: '23', pos: 9, order: 7, hitType: 1 },
    { name: '장우주', num: '51', pos: 6, order: 8, hitType: 2 },
    { name: '전민재', num: '4', pos: 0, order: 9, hitType: 3 },
    // 투수 슬롯 (타순 없음)
    { name: '유현빈', num: '61', pos: 1, order: 0, hitType: 1 },
    // 벤치
    { name: '이지영', num: '30', pos: 2, order: 0, hitType: 2 },
    { name: '안권수', num: '22', pos: 5, order: 0, hitType: 3 },
  ],
};
