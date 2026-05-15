import type {
  GameState,
  GameAction,
  Player,
  Runner,
  Runners,
  CellData,
  HistorySnapshot,
  Half,
  Base,
  PitchType,
  HitData,
  RunnerNote,
  PitcherStats,
  SubstitutionLog,
} from '../types';
import { SAMPLE } from '../data/constants';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function cellKey(inn: number, ord: number, app: number, half: Half): string {
  return `${half}-${inn}-${ord}-${app}`;
}

export function parseKey(k: string): [Half, number, number, number] {
  const p = k.split('-');
  return [p[0] as Half, +p[1], +p[2], +p[3]];
}

export function isOut(r: string | null): boolean {
  if (!r) return false;
  // ꓘ prefix: KT(ꓘ2T) / KSG(ꓘ2-3) — 보/자/E 없는 패턴은 모두 아웃 (다른주자수비 출루는 보/자/E 포함)
  if (/^ꓘ[\d-]+T?$/.test(r) && !/[보자E]/.test(r)) return true;
  // 구형 포맷 하위 호환
  if (r.startsWith('KT') && r !== 'KT') return true;
  if (r.startsWith('K') && r.length > 1 && /^\d/.test(r.slice(1))) return true;
  return (
    r === 'K' ||
    r === 'K3B' ||
    r === 'A' ||
    (r.startsWith('SH') && r !== 'SH진루') ||
    r.startsWith('BU') ||
    r.startsWith('SF') ||
    /^\d([-→]\d)*(T|A|U|R)?$/.test(r) ||
    // 플라이/파울플라이/라인드라이브: F<숫자>, f<숫자>, L<숫자>
    // (FC<숫자>=야수선택은 진루이므로 제외)
    (/^[fFL]\d/.test(r) && !r.startsWith('FC')) ||
    /^IF/.test(r) ||
    r === 'x2' ||
    r === 'xB' ||
    r === 'xBU' ||
    r === 'IP' ||
    r === 'IP0'
  );
}

export function isOnBase(r: string | null): boolean {
  if (!r) return false;
  if (/^\/[789]$/.test(r)) return true; // 단타 /7 /8 /9
  if (/^>[789](-[789])?$/.test(r)) return true; // 2루타 >7 >7-8 >8-9 >9
  if (/^>>>[789]$/.test(r)) return true; // 3루타 >>>7 >>>8 >>>9
  if (/^E[\d-]+$/.test(r)) return true; // 실책 진루 E6, E5, E6-3 등
  if (/^E번트\d$/.test(r)) return true; // 번트 실책 E번트6 등
  if (/^KE\d$/.test(r)) return true; // 낫아웃 수비실책 KE2 등
  if (/^FC[\d-]+$/.test(r)) return true; // 야수선택 FC4, FC4-3 등
  if (/^ꓘ/.test(r) && /[보자E]/.test(r)) return true; // 다른주자수비 출루 (buildKDef: 보/자/E 포함)
  if (/^#\dE$/.test(r)) return true; // 타격방해 #2E 등
  if (/^Ob\dE$/.test(r)) return true; // 주루방해 Ob3E 등
  return [
    'B',
    'IB',
    'IB2',
    'HP',
    'E',
    'FC',
    'INT',
    'BUNT',
    'OBUNT',
    'HR',
    'GHR',
    'GCW',
    'KW',
    'KP',
    'K다른주자',
    'KE',
    'FC번트',
    'E번트',
    'SH진루',
    'DP_E',
    'TP_E',
    '/hit',
    '>hit',
    '>>>hit',
    'H1',
    'H2',
    'H3',
  ].includes(r);
}

export function findPitcher(lu: Player[]): { name: string; num: string; pitchCount: number } {
  const p = lu.find((x) => x.pos === 1);
  return p ? { name: p.name, num: p.num, pitchCount: 0 } : { name: '—', num: '', pitchCount: 0 };
}

// 자책점 가중치: 자책=1, 반자책=0.5, 비자책=0
function erValue(earned: boolean | 'half' | undefined): number {
  if (earned === true) return 1;
  if (earned === 'half') return 0.5;
  return 0;
}

function pitcherKey(p: { name: string; num: string }): string {
  return `${p.num}:${p.name}`;
}

function savePitcherStats(
  map: Record<string, PitcherStats>,
  pitcher: { name: string; num: string; pitchCount: number },
  pitchBalls: number,
  pitchStrikes: number
): Record<string, PitcherStats> {
  return {
    ...map,
    [pitcherKey(pitcher)]: { pitchCount: pitcher.pitchCount, pitchBalls, pitchStrikes },
  };
}

function loadPitcherStats(
  map: Record<string, PitcherStats>,
  pitcher: { name: string; num: string }
): PitcherStats {
  return map[pitcherKey(pitcher)] ?? { pitchCount: 0, pitchBalls: 0, pitchStrikes: 0 };
}

function snapshot(s: GameState): HistorySnapshot {
  return {
    half: s.half,
    inning: s.inning,
    outs: s.outs,
    balls: s.balls,
    strikes: s.strikes,
    curBatterOrder: s.curBatterOrder,
    awayNextOrder: s.awayNextOrder,
    homeNextOrder: s.homeNextOrder,
    selCellKey: s.selCellKey,
    cells: JSON.parse(JSON.stringify(s.cells)),
    runners: JSON.parse(JSON.stringify(s.runners)),
    pendingBatter: s.pendingBatter ? { ...s.pendingBatter } : null,
    pitcher: { ...s.pitcher },
    pitchCount: s.pitchCount,
    pitchBalls: s.pitchBalls,
    pitchStrikes: s.pitchStrikes,
    pitcherStatsMap: { ...s.pitcherStatsMap },
    awayR: s.awayR,
    homeR: s.homeR,
    awayH: s.awayH,
    homeH: s.homeH,
    awayER: s.awayER,
    homeER: s.homeER,
    awayInn: [...s.awayInn],
    homeInn: [...s.homeInn],
  };
}

function saveHist(s: GameState): HistorySnapshot[] {
  const hist = [...s.history, snapshot(s)];
  if (hist.length > 60) hist.shift();
  return hist;
}

function forceWalk(runners: Runners, batter: Runner): Runners {
  const r = { ...runners };
  if (r['1B'] && r['2B'] && r['3B']) {
    // 만루 → 3루 주자 득점 (득점은 reducer 밖에서 처리)
    r['3B'] = r['2B'];
    r['2B'] = r['1B'];
  } else if (r['1B'] && r['2B']) {
    r['3B'] = r['2B'];
    r['2B'] = r['1B'];
  } else if (r['1B']) {
    r['2B'] = r['1B'];
  }
  r['1B'] = batter;
  return r;
}

function advanceInning(s: GameState, cells: Record<string, CellData>): GameState {
  const { awayInn, homeInn } = s;
  let { half, inning } = s;
  const prevInn = [...awayInn];
  const prevHome = [...homeInn];

  // 이닝 종료 전 타자 위치 저장 (다음 이닝 해당 팀 leadoff)
  // 현재 타자가 결과 없으면 (견제사/도루실패로 3아웃) 현재 타자부터 다시 시작
  const prevHalf = half;
  const curCell = cells[s.selCellKey];
  const curBatterFinished = curCell && curCell.result !== null;
  const finishedOrder = curBatterFinished ? (s.curBatterOrder % 9) + 1 : s.curBatterOrder;
  let awayNextOrder = s.awayNextOrder;
  let homeNextOrder = s.homeNextOrder;
  const prevInning = inning;

  if (half === 'top') {
    prevInn[inning - 1] =
      s.awayR -
      (inning > 1 ? awayInn.slice(0, inning - 1).reduce((sum: number, v) => sum + (v || 0), 0) : 0);
    awayNextOrder = finishedOrder;
    half = 'bottom';
  } else {
    prevHome[inning - 1] =
      s.homeR - homeInn.slice(0, inning - 1).reduce((sum: number, v) => sum + (v || 0), 0);
    homeNextOrder = finishedOrder;
    half = 'top';
    inning++;
  }

  // 직전 공격팀(=새 수비팀) 라인업의 needsPosReview=true (대타/대주자로 들어와 수비포지션 미확정)
  // 선수들에 대해 ScoreSheet 수비 layer 가 즉시 반영되도록 kind='D' SubstitutionLog 자동 추가.
  // 이미 같은 (선수,pos) 의 D 기록이 있으면 스킵 (중복 방지).
  const defendingSide: 'away' | 'home' = prevHalf === 'top' ? 'away' : 'home';
  const defendingLU = defendingSide === 'away' ? s.awayLineup : s.homeLineup;
  const newDefLogs: SubstitutionLog[] = [];
  defendingLU.forEach((p) => {
    if (!p.needsPosReview) return;
    const exists = s.substitutions.some(
      (sub) =>
        sub.kind === 'D' &&
        sub.side === defendingSide &&
        sub.newName === p.name &&
        sub.newNum === p.num &&
        sub.pos === p.pos
    );
    if (!exists) {
      newDefLogs.push({
        inning: prevInning,
        half: prevHalf,
        side: defendingSide,
        kind: 'D',
        pos: p.pos,
        newName: p.name,
        newNum: p.num,
        oldName: '',
        oldNum: '',
        order: p.order,
        atOrder: s.curBatterOrder,
      });
    }
  });
  const substitutions =
    newDefLogs.length > 0 ? [...s.substitutions, ...newDefLogs] : s.substitutions;

  // 새 half에서 타석을 시작할 타자
  const leadOff = half === 'top' ? awayNextOrder : homeNextOrder;

  const nextPitcherBase = half === 'top' ? findPitcher(s.homeLineup) : findPitcher(s.awayLineup);
  const pitcherChanged =
    nextPitcherBase.name !== s.pitcher.name || nextPitcherBase.num !== s.pitcher.num;

  let pitcherStatsMap = s.pitcherStatsMap;
  let pitchBalls: number;
  let pitchStrikes: number;
  let pitcher: typeof s.pitcher;

  if (pitcherChanged) {
    pitcherStatsMap = savePitcherStats(pitcherStatsMap, s.pitcher, s.pitchBalls, s.pitchStrikes);
    const saved = loadPitcherStats(pitcherStatsMap, nextPitcherBase);
    pitchBalls = saved.pitchBalls;
    pitchStrikes = saved.pitchStrikes;
    pitcher = { ...nextPitcherBase, pitchCount: saved.pitchCount };
  } else {
    pitchBalls = s.pitchBalls;
    pitchStrikes = s.pitchStrikes;
    pitcher = { ...nextPitcherBase, pitchCount: s.pitcher.pitchCount };
  }

  return {
    ...s,
    cells,
    half,
    inning,
    outs: 0,
    balls: 0,
    strikes: 0,
    pendingBatter: null,
    runners: {},
    curBatterOrder: leadOff,
    awayNextOrder,
    homeNextOrder,
    selCellKey: cellKey(inning, leadOff, 0, half),
    pitcher,
    pitchBalls,
    pitchStrikes,
    pitcherStatsMap,
    awayInn: prevInn,
    homeInn: prevHome,
    substitutions,
    history: saveHist(s),
  };
}

function nextBatterState(s: GameState): Partial<GameState> {
  const next = (s.curBatterOrder % 9) + 1;
  // 해당 타자가 현재 이닝에 이미 결과를 낸 타석이 있으면 자동으로 다음 appearance 사용
  const usedApps = Object.values(s.cells)
    .filter(
      (c) => c.half === s.half && c.inning === s.inning && c.order === next && c.result !== null
    )
    .reduce((m, c) => Math.max(m, c.appearance + 1), 0);

  return {
    balls: 0,
    strikes: 0,
    curBatterOrder: next,
    selCellKey: cellKey(s.inning, next, usedApps, s.half),
  };
}

function ensureCell(cells: Record<string, CellData>, key: string): Record<string, CellData> {
  if (cells[key]) return cells;
  const [shf, si, so, sa] = parseKey(key);
  // 셀 생성 순(=PA 발생 순)으로 단조 증가하는 paSeq 부여 → 타순이 아닌 시간 순으로 정렬 가능
  let maxSeq = 0;
  for (const c of Object.values(cells)) {
    const s = c.paSeq ?? 0;
    if (s > maxSeq) maxSeq = s;
  }
  return {
    ...cells,
    [key]: {
      half: shf,
      inning: si,
      order: so,
      appearance: sa,
      pitches: [],
      result: null,
      runnerNotes: [],
      paSeq: maxSeq + 1,
    },
  };
}

// ── Initial state ─────────────────────────────────────────────────────────────

export const initialGameState: GameState = {
  league: 'KBO',
  awayTeam: 'KIA',
  homeTeam: '한화',
  date: '',
  half: 'top',
  inning: 1,
  outs: 0,
  balls: 0,
  strikes: 0,
  pitchCount: 0,
  pitchBalls: 0,
  pitchStrikes: 0,
  pitcherStatsMap: {},
  curBatterOrder: 1,
  awayNextOrder: 1,
  homeNextOrder: 1,
  selCellKey: 'top-1-1-0',
  cells: {},
  runners: {},
  pendingBatter: null,
  awayLineup: [],
  homeLineup: [],
  awayBench: [],
  homeBench: [],
  pitcher: { name: '—', num: '', pitchCount: 0 },
  awayR: 0,
  awayH: 0,
  awayE: 0,
  awayER: 0,
  homeR: 0,
  homeH: 0,
  homeE: 0,
  homeER: 0,
  awayInn: Array(15).fill(null),
  homeInn: Array(15).fill(null),
  history: [],
  gameEvents: [],
  pitcherChanges: [],
  substitutions: [],
};

// ── Reducer ───────────────────────────────────────────────────────────────────

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    // ── INIT ────────────────────────────────────────────────────────────────
    case 'INIT_GAME': {
      const { setup } = action;
      const awayLineup = setup.awayLineup.length
        ? setup.awayLineup
        : SAMPLE.away.slice(0, 9).map((p, i) => ({ ...p, order: i + 1 }));
      const homeLineup = setup.homeLineup.length
        ? setup.homeLineup
        : SAMPLE.home.slice(0, 9).map((p, i) => ({ ...p, order: i + 1 }));
      const awayBench = setup.awayBench.length ? setup.awayBench : SAMPLE.away.slice(9);
      const homeBench = setup.homeBench.length ? setup.homeBench : SAMPLE.home.slice(9);
      const pitcher = findPitcher(homeLineup);

      return {
        ...initialGameState,
        league: setup.league,
        awayTeam: setup.awayTeam,
        homeTeam: setup.homeTeam,
        date: setup.date,
        awayLineup,
        homeLineup,
        awayBench,
        homeBench,
        pitcher,
        selCellKey: cellKey(1, 1, 0, 'top'),
        stadium: setup.stadium,
        gameNum: setup.gameNum,
        startTime: setup.startTime,
        endTime: setup.endTime,
        attendance: setup.attendance,
        umpireHome: setup.umpireHome,
        umpire1B: setup.umpire1B,
        umpire2B: setup.umpire2B,
        umpire3B: setup.umpire3B,
        umpireLeft: setup.umpireLeft,
        umpireRight: setup.umpireRight,
        recorder1: setup.recorder1,
        recorder2: setup.recorder2,
      };
    }

    // ── SET_GAME_INFO ────────────────────────────────────────────────────────
    case 'SET_GAME_INFO': {
      return {
        ...state,
        awayTeam: action.awayTeam,
        homeTeam: action.homeTeam,
        date: action.date,
        league: action.league,
      };
    }

    // ── SET_LINEUPS ──────────────────────────────────────────────────────────
    case 'SET_LINEUPS': {
      return {
        ...state,
        awayLineup: action.awayLineup,
        homeLineup: action.homeLineup,
        awayBench: action.awayBench,
        homeBench: action.homeBench,
      };
    }

    // ── LINEUP MANAGEMENT ───────────────────────────────────────────────────
    case 'CHANGE_LU_POS': {
      const luKey = action.team === 'away' ? 'awayLineup' : 'homeLineup';
      const lu = [...state[luKey]];
      const target = lu[action.idx];
      const oldPos = target.pos;
      const side: 'away' | 'home' = action.team;
      const newSubs: SubstitutionLog[] = [];
      const mkLog = (p: Player, pos: number): SubstitutionLog => ({
        inning: state.inning,
        half: state.half,
        side,
        kind: 'D',
        pos,
        newName: p.name,
        newNum: p.num,
        oldName: '',
        oldNum: '',
        order: p.order,
        atOrder: state.curBatterOrder,
      });

      // 동일 포지션을 가진 다른 선수가 있으면 자동 스왑 — 라인업 내 중복 방지
      // 스왑당한 선수의 포지션 변경도 ScoreSheet 수비 layer 에 반영되도록 로깅
      if (oldPos !== action.pos) {
        const swapIdx = lu.findIndex((p, i) => i !== action.idx && p.pos === action.pos);
        if (swapIdx >= 0) {
          const swapped = { ...lu[swapIdx], pos: oldPos };
          lu[swapIdx] = swapped;
          newSubs.push(mkLog(swapped, oldPos));
        }
      }
      lu[action.idx] = { ...lu[action.idx], pos: action.pos, needsPosReview: false };

      // 본인의 포지션 변경 — 실제 변경이 있을 때만 로깅
      if (oldPos !== action.pos) {
        newSubs.push(mkLog(lu[action.idx], action.pos));
      }
      const substitutions =
        newSubs.length > 0 ? [...state.substitutions, ...newSubs] : state.substitutions;
      return { ...state, [luKey]: lu, substitutions };
    }

    case 'CHANGE_LU_ORDER': {
      const luKey = action.team === 'away' ? 'awayLineup' : 'homeLineup';
      const lu = [...state[luKey]];
      const num = Math.max(0, Math.min(9, action.order));
      lu[action.idx] = { ...lu[action.idx], order: num, ...(num === 0 ? { pos: 1 } : {}) };
      return { ...state, [luKey]: lu };
    }

    case 'ADD_BENCH_TO_LU': {
      const luKey = action.team === 'away' ? 'awayLineup' : 'homeLineup';
      const benchKey = action.team === 'away' ? 'awayBench' : 'homeBench';
      const lu = [...state[luKey]];
      const bench = [...state[benchKey]];
      const p = bench[action.benchIdx];

      if (action.luIdx !== null && action.luIdx < lu.length) {
        const old = lu[action.luIdx];
        lu[action.luIdx] = { ...p, order: old.order, pos: p.pos };
        bench.push({ ...old });
        bench.splice(action.benchIdx, 1);
      } else {
        if (lu.length >= 10) return state;
        lu.push({ ...p, order: lu.length + 1 });
        bench.splice(action.benchIdx, 1);
      }

      return { ...state, [luKey]: lu, [benchKey]: bench };
    }

    case 'DELETE_LU_PLAYER': {
      const luKey = action.team === 'away' ? 'awayLineup' : 'homeLineup';
      const benchKey = action.team === 'away' ? 'awayBench' : 'homeBench';
      const lu = [...state[luKey]];
      const bench = [...state[benchKey]];
      const [removed] = lu.splice(action.idx, 1);
      lu.forEach((p, i) => {
        p.order = i + 1;
      });
      bench.push(removed);
      return { ...state, [luKey]: lu, [benchKey]: bench };
    }

    case 'ADD_PITCHER_SLOT': {
      const luKey = action.team === 'away' ? 'awayLineup' : 'homeLineup';
      const lu = [...state[luKey]];
      if (lu.length >= 10) return state;
      lu.push({ name: '투수', num: 'P', pos: 1, order: 0, hitType: 1 });
      return { ...state, [luKey]: lu };
    }

    case 'RESTORE_LINEUP': {
      return {
        ...state,
        awayLineup: [
          ...SAMPLE.away.slice(0, 9).map((p, i) => ({ ...p, order: i + 1 })),
          { ...SAMPLE.away[9], order: 0 },
        ],
        homeLineup: [
          ...SAMPLE.home.slice(0, 9).map((p, i) => ({ ...p, order: i + 1 })),
          { ...SAMPLE.home[9], order: 0 },
        ],
        awayBench: SAMPLE.away.slice(10),
        homeBench: SAMPLE.home.slice(10),
      };
    }

    // ── SEL_CELL ─────────────────────────────────────────────────────────────
    case 'SEL_CELL': {
      return { ...state, selCellKey: action.key };
    }

    // ── TOGGLE_BATTER_SIDE — 스위치 타자의 좌/우 토글 ────────────────────────
    // 현재 selCellKey 셀에 batterSide 토글 (없으면 라인업 hitType 기본값에서 반대로 시작)
    case 'TOGGLE_BATTER_SIDE': {
      const key = state.selCellKey;
      const lu = state.half === 'top' ? state.awayLineup : state.homeLineup;
      const bat = lu[state.curBatterOrder - 1];
      // 스위치 타자 (hitType === 3) 만 토글 허용
      if (!bat || bat.hitType !== 3) return state;
      const cells = ensureCell(state.cells, key);
      const cur = cells[key];
      // 기본값: 스위치 타자의 라인업 기본은 좌석 (Diamond 코드 주석 — hitType 3 = 왼쪽)
      const currentSide = cur.batterSide ?? 'L';
      const nextSide: 'L' | 'R' = currentSide === 'L' ? 'R' : 'L';
      return {
        ...state,
        cells: { ...cells, [key]: { ...cur, batterSide: nextSide } },
      };
    }

    // ── PITCH ────────────────────────────────────────────────────────────────
    case 'PITCH': {
      const { pitchType } = action;
      const key = state.selCellKey;
      let cells = ensureCell(state.cells, key);
      const cell = { ...cells[key] };
      if (cell.result) return state;

      cell.pitches = [...cell.pitches, pitchType as PitchType];
      cell.eventLog = [...(cell.eventLog || []), { kind: 'pitch', pitch: pitchType as PitchType }];

      let { balls, strikes, pitchBalls, pitchStrikes } = state;
      switch (pitchType) {
        case 'S':
          strikes++;
          pitchStrikes++;
          break;
        case 'SW':
          strikes++;
          pitchStrikes++;
          break;
        case 'B':
          balls++;
          pitchBalls++;
          break;
        case 'F':
          if (strikes < 2) strikes++;
          pitchStrikes++;
          break;
        case 'FE':
          if (strikes < 2) strikes++;
          break;
        case 'BS':
          strikes++;
          pitchStrikes++;
          break;
        case 'BF':
          strikes++;
          pitchStrikes++;
          break; // 번트파울: 2스트라이크에서도 추가 → K3B
        case 'PC1':
          balls++;
          pitchBalls++;
          break; // 피치클락 두수위반볼
        case 'PC2':
          balls++;
          pitchBalls++;
          break; // 피치클락 포수위반볼
        case 'PC3':
          strikes++;
          pitchStrikes++;
          break; // 피치클락 타자위반스트라이크
      }

      const pitcher = { ...state.pitcher, pitchCount: (state.pitcher.pitchCount || 0) + 1 };
      const pitchCount = state.pitchCount + 1;

      // Auto-strikeout
      if (strikes >= 3) {
        cell.result = pitchType === 'BF' ? 'K3B' : 'K';
        cell.cellOutNum = Math.min(state.outs + 1, 3);
        cell.eventLog = [
          ...(cell.eventLog || []),
          { kind: 'result' as const, result: cell.result },
        ];
        const outs = state.outs + 1;
        cells = { ...cells, [key]: cell };
        const next = nextBatterState({ ...state, outs });

        return {
          ...state,
          cells,
          outs,
          balls: 0,
          strikes: 0,
          ...next,
          pitcher,
          pitchCount,
          pitchStrikes,
          pitchBalls,
          history: saveHist(state),
        };
      }

      // Auto-walk
      if (balls >= 4) {
        cell.result = 'B';
        const lu = state.half === 'top' ? state.awayLineup : state.homeLineup;
        const bat = lu[state.curBatterOrder - 1];
        const batObj: Runner = {
          name: bat?.name || '',
          num: bat?.num || '',
          order: state.curBatterOrder,
          half: state.half,
          inning: state.inning,
        };

        let awayR = state.awayR;
        let homeR = state.homeR;
        let awayER = state.awayER;
        let homeER = state.homeER;
        let newRunners: Runners;

        const prev1B = state.runners['1B'];
        const prev2B = state.runners['2B'];
        const prev3B = state.runners['3B'];

        if (prev1B && prev2B && prev3B) {
          if (state.half === 'top') {
            awayR++;
            awayER++;
          } else {
            homeR++;
            homeER++;
          }
          newRunners = forceWalk(state.runners, batObj);
        } else {
          newRunners = forceWalk(state.runners, batObj);
        }

        cells = { ...cells, [key]: cell };

        // 밀어진 주자에 runnerNote(causedBy) 추가 — 한자 표시용
        const addForceNote = (runner: Runner, destBase: 'HOME' | Base) => {
          if (!runner.inning) return;
          for (let app = 0; app <= 5; app++) {
            const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
            if (cells[rk]) {
              const existing = cells[rk].runnerNotes || [];
              if (
                !existing.find((en) => en.base === destBase && en.causedBy === state.curBatterOrder)
              ) {
                const update: Partial<CellData> = {
                  runnerNotes: [
                    ...existing,
                    { causedBy: state.curBatterOrder, base: destBase, force: true },
                  ],
                };
                if (destBase === 'HOME') {
                  update.scored = true;
                  // 볼넷/사구 밀어내기 득점 — 자책, 책임은 현재 투수
                  update.earned = true;
                  update.scorePitcher = `${pitcher.name}(${pitcher.num})`;
                }
                cells = { ...cells, [rk]: { ...cells[rk], ...update } };
              }
              break;
            }
          }
        };
        if (prev1B) addForceNote(prev1B, '2B');
        if (prev1B && prev2B) addForceNote(prev2B, '3B');
        if (prev1B && prev2B && prev3B) addForceNote(prev3B, 'HOME');
        const next = nextBatterState(state);

        return {
          ...state,
          cells,
          runners: newRunners,
          balls: 0,
          strikes: 0,
          ...next,
          pitcher,
          pitchCount,
          pitchBalls,
          pitchStrikes,
          awayR,
          homeR,
          awayER,
          homeER,
          history: saveHist(state),
        };
      }

      return {
        ...state,
        cells: { ...cells, [key]: cell },
        balls,
        strikes,
        pitcher,
        pitchCount,
        pitchBalls,
        pitchStrikes,
        history: saveHist(state),
      };
    }

    // ── BAT_ADV ──────────────────────────────────────────────────────────────
    case 'BAT_ADV': {
      const { ballType } = action;
      const key = state.selCellKey;
      let cells = ensureCell(state.cells, key);

      let result: string;
      let cellUpdate: Partial<CellData>;
      if (action.hitData) {
        const hd: HitData = action.hitData;
        // 선행주자아웃은 안타가 아니므로 H1으로 변환하지 않고 hitType을 result 코드로 사용
        if (hd.hitType === '선행주자아웃' || hd.hitType === '→선행주자아웃') {
          result = hd.hitType;
        } else {
          result = hd.bases === 1 ? 'H1' : hd.bases === 2 ? 'H2' : hd.bases === 3 ? 'H3' : 'HR';
        }
        // HR류는 hd.hrTime(BatAdvModal 입력값) 우선, 없으면 Date.now()
        const ts = hd.hrTime ?? Date.now();
        cellUpdate = { result, hitData: hd, ballType: hd.ballType, timestamp: ts };
      } else {
        result = action.result;
        cellUpdate = { result, ...(ballType ? { ballType } : {}), timestamp: Date.now() };
      }

      // BB 책임 룰: result가 BB류이고 PA 도중 투수 교체로 pendingBBChargeTo가 있으면 전임 투수에 귀속
      const bbResults = ['B', 'IB', 'IB2'];
      let bbChargedTo: string | undefined;
      let updatedPitcherChanges = state.pitcherChanges;
      if (bbResults.includes(result)) {
        const lastIdx = state.pitcherChanges.length - 1;
        const last = lastIdx >= 0 ? state.pitcherChanges[lastIdx] : null;
        if (
          last &&
          last.pendingBBChargeTo &&
          last.inning === state.inning &&
          last.half === state.half &&
          last.order === state.curBatterOrder
        ) {
          bbChargedTo = last.pendingBBChargeTo;
          updatedPitcherChanges = [...state.pitcherChanges];
          updatedPitcherChanges[lastIdx] = { ...last, pendingBBChargeTo: undefined };
        }
      }

      const cell = {
        ...cells[key],
        ...cellUpdate,
        ...(bbChargedTo ? { bbChargedTo } : {}),
        ...(action.deflection ? { deflection: action.deflection } : {}),
        // BAT_ADV는 항상 진루 결과 — 이전 상태(BAT_OUT 등)에서 남은 cellOutNum 명시적 제거
        cellOutNum: undefined,
        eventLog: [...(cells[key].eventLog || []), { kind: 'result' as const, result }],
      };
      cells = { ...cells, [key]: cell };

      const lu = state.half === 'top' ? state.awayLineup : state.homeLineup;
      const bat = lu[state.curBatterOrder - 1];
      const batObj: Runner = {
        name: bat?.name || '',
        num: bat?.num || '',
        order: state.curBatterOrder,
        half: state.half,
        inning: state.inning,
      };

      const BASE_MAP: Record<string, string> = {
        '/7': '1B',
        '/8': '1B',
        '/9': '1B',
        INT: '1B',
        BUNT: '1B',
        OBUNT: '1B',
        '/hit': '1B',
        H1: '1B',
        '>7': '2B',
        '>7-8': '2B',
        '>8-9': '2B',
        '>9': '2B',
        '>hit': '2B',
        H2: '2B',
        '>>>7': '3B',
        '>>>8': '3B',
        '>>>9': '3B',
        '>>>hit': '3B',
        H3: '3B',
        HR: 'HOME',
        GHR: 'HOME',
        GCW: 'HOME',
        B: '1B',
        IB: '1B',
        IB2: '1B',
        HP: '1B',
        ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`#${n}E`, '1B'])),
        ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [`Ob${n}E`, '1B'])),
        E: '1B',
        FC: '1B',
        KW: '1B',
        KP: '1B',
        KE: '1B',
        K다른주자: '1B',
        FC번트: '1B',
        E번트: '1B',
        SH진루: '1B',
        DP_E: '1B',
        TP_E: '1B',
        선행주자아웃: '1B',
        '→선행주자아웃': '1B',
      };
      const dest = BASE_MAP[result] || '1B';
      const forceTypes = [
        'B',
        'IB',
        'IB2',
        'HP',
        ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `#${n}E`),
        ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `Ob${n}E`),
      ];

      let runners = { ...state.runners };
      let awayR = state.awayR;
      let homeR = state.homeR;

      // 득점 마크 — earned 명시 (BB 밀어내기/HR 등은 자책=true)
      const markScored = (runner: Runner, earnedFlag: boolean | 'half' = true) => {
        if (runner.inning) {
          for (let app = 0; app <= 5; app++) {
            const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
            if (cells[rk]) {
              cells = {
                ...cells,
                [rk]: { ...cells[rk], scored: true, earned: earnedFlag },
              };
              break;
            }
          }
        }
      };

      if (dest === 'HOME') {
        // HR/GHR: 모든 주자 득점 + HOME note 기록
        (['3B', '2B', '1B'] as Base[]).forEach((b) => {
          if (runners[b]) {
            if (state.half === 'top') awayR++;
            else homeR++;
            const r = runners[b]!;
            markScored(r);
            // 주자 셀에 HOME note (causedBy = 타자) 추가
            if (r.inning) {
              for (let app = 0; app <= 5; app++) {
                const rk = cellKey(r.inning, r.order, app, r.half || state.half);
                if (cells[rk]) {
                  const existing = cells[rk].runnerNotes || [];
                  if (
                    !existing.find((n) => n.base === 'HOME' && n.causedBy === state.curBatterOrder)
                  ) {
                    cells = {
                      ...cells,
                      [rk]: {
                        ...cells[rk],
                        scored: true,
                        runnerNotes: [
                          ...existing,
                          { causedBy: state.curBatterOrder, base: 'HOME' as const },
                        ],
                      },
                    };
                  }
                  break;
                }
              }
            }
          }
        });

        if (state.half === 'top') awayR++;
        else homeR++;

        // 타자 자신의 HR 득점 — 셀에 scored:true (투수 실점 집계 + 시각 표시에 사용)
        if (state.selCellKey && cells[state.selCellKey]) {
          cells = {
            ...cells,
            [state.selCellKey]: {
              ...cells[state.selCellKey],
              scored: true,
              earned: true,
              scorePitcher: `${state.pitcher.name}(${state.pitcher.num})`,
            },
          };
        }

        runners = {};
      } else if (forceTypes.includes(result)) {
        // 볼넷/사구 등: force walk
        const prev1B = runners['1B'];
        const prev2B = runners['2B'];
        const prev3B = runners['3B'];
        if (prev1B && prev2B && prev3B) {
          const r3 = prev3B!;
          if (state.half === 'top') awayR++;
          else homeR++;
          markScored(r3);
        }
        runners = forceWalk(runners, batObj);

        // 밀어진 주자에 runnerNote(causedBy) 추가 — 한자 표시용
        const addForceNote = (runner: Runner, destBase: 'HOME' | Base) => {
          if (!runner.inning) return;
          for (let app = 0; app <= 5; app++) {
            const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
            if (cells[rk]) {
              const existing = cells[rk].runnerNotes || [];
              if (
                !existing.find((en) => en.base === destBase && en.causedBy === state.curBatterOrder)
              ) {
                const update: Partial<CellData> = {
                  runnerNotes: [
                    ...existing,
                    { causedBy: state.curBatterOrder, base: destBase, force: true },
                  ],
                };
                if (destBase === 'HOME') {
                  update.scored = true;
                  // 볼넷/사구 밀어내기 득점 — 자책, 책임은 현재 투수
                  update.earned = true;
                  update.scorePitcher = `${state.pitcher.name}(${state.pitcher.num})`;
                }
                cells = { ...cells, [rk]: { ...cells[rk], ...update } };
              }
              break;
            }
          }
        };
        if (prev1B) addForceNote(prev1B, '2B');
        if (prev1B && prev2B) addForceNote(prev2B, '3B');
        if (prev1B && prev2B && prev3B) addForceNote(prev3B, 'HOME');
      } else {
        // note는 RUN_ADV에서만 기록 (BAT_ADV에서 미리 찍지 않음)
      }

      const hitTypes = new Set([
        '/7',
        '/8',
        '/9',
        'INT',
        'BUNT',
        '/hit',
        'H1',
        '>7',
        '>7-8',
        '>8-9',
        '>9',
        '>hit',
        'H2',
        '>>>7',
        '>>>8',
        '>>>9',
        '>>>hit',
        'H3',
        'HR',
        'GHR',
        'GCW',
      ]);
      const awayH = hitTypes.has(result) && state.half === 'top' ? state.awayH + 1 : state.awayH;
      const homeH = hitTypes.has(result) && state.half === 'bottom' ? state.homeH + 1 : state.homeH;

      const isErrorResult =
        /^E\d$/.test(result) ||
        /^E번트\d$/.test(result) ||
        /^KE\d$/.test(result) ||
        result === 'DP_E' ||
        result === 'TP_E';
      const earnedDiff = isErrorResult
        ? 0
        : state.half === 'top'
          ? awayR - state.awayR
          : homeR - state.homeR;
      const awayER = state.half === 'top' ? state.awayER + earnedDiff : state.awayER;
      const homeER = state.half === 'bottom' ? state.homeER + earnedDiff : state.homeER;

      // θ 타격완료 → S 집계 (BB/HP/ob/KW/KP/KE 제외: 이미 PITCH에서 카운트됨)
      const noPitchResults = new Set([
        'B',
        'IB',
        'IB2',
        'HP',
        'KW',
        'KP',
        'KE',
        ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `#${n}E`),
        ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `Ob${n}E`),
      ]);
      const isBatContact = !noPitchResults.has(result);
      const batPitcher = isBatContact
        ? { ...state.pitcher, pitchCount: (state.pitcher.pitchCount || 0) + 1 }
        : state.pitcher;
      const batPitchCount = isBatContact ? state.pitchCount + 1 : state.pitchCount;
      const batPitchStrikes = isBatContact ? state.pitchStrikes + 1 : state.pitchStrikes;

      const isHitOrFC = !forceTypes.includes(result) && dest !== 'HOME';
      const hasExistingRunners = Object.keys(runners).filter((k) => runners[k as Base]).length > 0;

      if (isHitOrFC && hasExistingRunners) {
        return {
          ...state,
          cells,
          runners,
          balls: 0,
          strikes: 0,
          pitcher: batPitcher,
          pitchCount: batPitchCount,
          pitchStrikes: batPitchStrikes,
          awayR,
          homeR,
          awayH,
          homeH,
          awayER,
          homeER,
          pendingBatter: { runner: batObj, dest: dest as Base },
          pitcherChanges: updatedPitcherChanges,
          history: saveHist(state),
        };
      }

      if (isHitOrFC) {
        runners[dest as Base] = batObj;
      }

      const next = nextBatterState({ ...state, cells, runners });
      return {
        ...state,
        cells,
        runners,
        balls: 0,
        strikes: 0,
        ...next,
        pitcher: batPitcher,
        pitchCount: batPitchCount,
        pitchStrikes: batPitchStrikes,
        awayR,
        homeR,
        awayH,
        homeH,
        awayER,
        homeER,
        pendingBatter: null,
        pitcherChanges: updatedPitcherChanges,
        history: saveHist(state),
      };
    }

    // ── BAT_OUT ──────────────────────────────────────────────────────────────
    case 'BAT_OUT': {
      const { result, dp: isDP, tp: isTP, ballType } = action;
      const key = state.selCellKey;
      let cells = ensureCell(state.cells, key);
      // 현재 타자의 chronological 아웃 번호
      // 병살(DP): 주자가 먼저 아웃 → 타자는 +2번째 아웃
      // 삼중살(TP): 주자 2명 먼저 → 타자는 +3번째
      const batterOutOffset = isTP ? 3 : isDP ? 2 : 1;
      const myOutNum = Math.min(state.outs + batterOutOffset, 3);
      cells = {
        ...cells,
        [key]: {
          ...cells[key],
          result,
          cellOutNum: myOutNum,
          eventLog: [...(cells[key].eventLog || []), { kind: 'result' as const, result }],
          ...(isDP ? { isDoublePlay: true } : {}),
          ...(isTP ? { isTriplePlay: true } : {}),
          ...(ballType ? { ballType } : {}),
          ...(action.deflection ? { deflection: action.deflection } : {}),
        },
      };

      const extraOuts = isDP ? 1 : isTP ? 2 : 0;

      // 병살/삼중살: 아웃된 주자 셀에 runOutNum, runOutInning, runOut(부분 수비 수열) 기록
      // 다이아몬드에서도 해당 주자 제거
      const runners = { ...state.runners };
      if (isDP || isTP) {
        const digits = result.match(/\d+/g) || [];
        let need = isTP ? 2 : 1;
        let runnerOutIdx = 0;
        for (const base of ['1B', '2B', '3B'] as const) {
          if (need <= 0) break;
          const runner = runners[base];
          if (runner) {
            const runOutNum = state.outs + 1 + runnerOutIdx; // Ⅰ or Ⅱ (before batter)
            // 주자가 아웃된 부분 수비 수열: 전체 seq에서 뒷 부분(나머지 아웃) 제거
            const partCount = digits.length - extraOuts + runnerOutIdx;
            const runOutSeq = digits.slice(0, partCount).join('-') || result;
            // 포스플레이: 주자는 다음 베이스에서 아웃
            const dpOutBase = base === '1B' ? '2B' : base === '2B' ? '3B' : 'HOME';
            for (let app = 0; app <= 5; app++) {
              const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
              if (cells[rk]) {
                cells = {
                  ...cells,
                  [rk]: {
                    ...cells[rk],
                    runOut: runOutSeq,
                    runOutBase: dpOutBase,
                    runOutNum,
                    runOutInning: state.inning,
                    isDPRunner: true,
                  },
                };
                break;
              }
            }
            delete runners[base]; // 다이아몬드에서 제거
            need--;
            runnerOutIdx++;
          }
        }
      }

      const outs = Math.min(state.outs + 1 + extraOuts, 3);

      // 3아웃 시 잔루: 남은 주자(DP/TP 아웃 제외) 셀에 lobCell 표기
      // 타자일순 대비 — 같은 (inning, order) 의 가장 최근 PA (높은 app) 셀에 찍어야 함
      if (outs === 3) {
        for (const runner of Object.values(runners).filter(Boolean)) {
          if (runner) {
            for (let app = 5; app >= 0; app--) {
              const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
              if (cells[rk]) {
                cells = { ...cells, [rk]: { ...cells[rk], lobCell: true } };
                break;
              }
            }
          }
        }
      }

      // θ 타격완료 → S 집계 (아웃 타구는 항상 타격 접촉)
      const batPitcher = { ...state.pitcher, pitchCount: (state.pitcher.pitchCount || 0) + 1 };
      const batPitchCount = state.pitchCount + 1;
      const batPitchStrikes = state.pitchStrikes + 1;

      // 3아웃이면 다음 타자로 넘어가지 않고 현재 타자 그대로 대기 (사용자가 이닝교대 버튼 눌러야 함)
      const next = outs === 3 ? {} : nextBatterState({ ...state, outs });
      return {
        ...state,
        cells,
        runners,
        outs,
        balls: 0,
        strikes: 0,
        ...next,
        pitcher: batPitcher,
        pitchCount: batPitchCount,
        pitchStrikes: batPitchStrikes,
        history: saveHist(state),
      };
    }

    // ── RUN_ADV ──────────────────────────────────────────────────────────────
    case 'RUN_ADV': {
      const { base, runner, dest, earned } = action;
      // 현재 타자 셀에 투구/결과 기록이 있으면 현재 타자, 없으면 이전 타자가 일으킨 진루
      // (예: 4번 SF 후 5번이 아직 안 던진 상태에서 주자 진루 → 4번에 귀속)
      // 단, 자력 진루(도루/폭투/포일/보크)는 항상 현재 타자(현재 PA 진행 중)
      const RUN_ADV_SELF_CODES = [
        'S',
        '(S)',
        'SD',
        '(SD)',
        'W',
        '(W)',
        'P',
        '(P)',
        'BK',
        '(BK)',
        '✓BK',
        '✓(BK)',
      ];
      const isRunAdvSelf = !!action.steal || RUN_ADV_SELF_CODES.includes(action.advCode || '');
      let inferredCausedBy = state.curBatterOrder;
      if (!action.causedBy && !isRunAdvSelf) {
        const curCell = state.cells[state.selCellKey];
        const hasBattingRecord = !!curCell && (curCell.pitches.length > 0 || !!curCell.result);
        if (!hasBattingRecord) {
          inferredCausedBy = state.curBatterOrder === 1 ? 9 : state.curBatterOrder - 1;
        }
      }
      const runAdvCausedBy = action.causedBy ?? inferredCausedBy;
      const runners: Runners = { ...state.runners };
      delete runners[base];

      let awayR = state.awayR;
      let homeR = state.homeR;
      let awayER = state.awayER;
      let homeER = state.homeER;
      let cells = state.cells;

      if (dest === 'HOME') {
        if (state.half === 'top') {
          awayR++;
          awayER += erValue(earned);
        } else {
          homeR++;
          homeER += erValue(earned);
        }

        // 득점한 주자 셀에 HOME note 기록
        if (runner.inning) {
          for (let app = 0; app <= 5; app++) {
            const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
            if (cells[rk]) {
              const existing = cells[rk].runnerNotes || [];
              const homeNote: RunnerNote = {
                causedBy: runAdvCausedBy,
                base: 'HOME',
                rbi: action.rbi,
                steal: action.steal,
                advCode: action.advCode,
                chain: action.chain,
              };

              const runnerNotes = existing.find(
                (n) => n.base === 'HOME' && n.causedBy === runAdvCausedBy
              )
                ? existing
                : [...existing, homeNote];

              cells = {
                ...cells,
                [rk]: {
                  ...cells[rk],
                  scored: true,
                  earned,
                  scorePitcher: action.scorePitcher,
                  runnerNotes,
                  ...(action.deflection ? { deflection: action.deflection } : {}),
                },
              };
              // 타점은 타자 셀에 기록
              if (action.rbi && state.selCellKey && cells[state.selCellKey]) {
                cells = {
                  ...cells,
                  [state.selCellKey]: {
                    ...cells[state.selCellKey],
                    rbi: true,
                  },
                };
              }
              break;
            }
          }
        }

        // 도루/폭투/포일/보크 시 현재 타자 셀 eventLog에 '/' 항목 추가
        const wpCodes = ['W', '(W)', 'P', '(P)', 'BK', '(BK)', '✓BK', '✓(BK)'];
        if (state.selCellKey) {
          cells = ensureCell(cells, state.selCellKey);
          const sc = cells[state.selCellKey];
          if (action.steal || wpCodes.includes(action.advCode || '')) {
            const isDouble = action.advCode === 'SD' || action.advCode === '(SD)';
            cells = {
              ...cells,
              [state.selCellKey]: {
                ...sc,
                eventLog: [
                  ...(sc.eventLog || []),
                  {
                    kind: 'runner_steal' as const,
                    runnerName: runner.name,
                    dest,
                    double: isDouble || undefined,
                    advCode: action.advCode,
                  },
                ],
              },
            };
          } else {
            // 일반 진루(타자도움·실책 등) — FIFO 보존을 위해 현재 타자 셀 eventLog에 추가
            cells = {
              ...cells,
              [state.selCellKey]: {
                ...sc,
                eventLog: [
                  ...(sc.eventLog || []),
                  {
                    kind: 'runner_adv' as const,
                    runnerName: runner.name,
                    dest,
                    advCode: action.advCode,
                    rbi: action.rbi,
                  },
                ],
              },
            };
          }
        }

        return { ...state, runners, cells, awayR, homeR, awayER, homeER, history: saveHist(state) };
      }

      if (runners[dest as Base]) {
        const chain: Record<string, string> = { '1B': '2B', '2B': '3B', '3B': 'HOME' };
        const nx = chain[dest];
        if (nx === 'HOME') {
          if (state.half === 'top') awayR++;
          else homeR++;
          runners[dest as Base] = undefined;
        } else {
          runners[nx as Base] = runners[dest as Base];
          runners[dest as Base] = undefined;
        }
      }

      runners[dest as Base] = runner;

      // 2B, 3B 진루 note 기록 (1B는 찍지 않음)
      if (dest === '2B' || dest === '3B') {
        if (runner.inning) {
          for (let app = 0; app <= 5; app++) {
            const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
            if (cells[rk]) {
              const existing = cells[rk].runnerNotes || [];
              if (
                !existing.find(
                  (n) =>
                    n.base === dest && n.causedBy === runAdvCausedBy && n.steal === action.steal
                )
              ) {
                cells = {
                  ...cells,
                  [rk]: {
                    ...cells[rk],
                    runnerNotes: [
                      ...existing,
                      {
                        causedBy: runAdvCausedBy,
                        base: dest as Base,
                        steal: action.steal,
                        advCode: action.advCode,
                        chain: action.chain,
                      },
                    ],
                    ...(action.deflection ? { deflection: action.deflection } : {}),
                  },
                };
              }
              break;
            }
          }
        }
      }

      // 도루/폭투/포일/보크 또는 일반 진루 — FIFO 보존을 위해 현재 타자 셀 eventLog에 추가
      const wpCodes2 = ['W', '(W)', 'P', '(P)', 'BK', '(BK)', '✓BK', '✓(BK)'];
      if (state.selCellKey) {
        cells = ensureCell(cells, state.selCellKey);
        const sc = cells[state.selCellKey];
        if (action.steal || wpCodes2.includes(action.advCode || '')) {
          const isDouble = action.advCode === 'SD' || action.advCode === '(SD)';
          cells = {
            ...cells,
            [state.selCellKey]: {
              ...sc,
              eventLog: [
                ...(sc.eventLog || []),
                {
                  kind: 'runner_steal' as const,
                  runnerName: runner.name,
                  dest,
                  double: isDouble || undefined,
                  advCode: action.advCode,
                },
              ],
            },
          };
        } else {
          cells = {
            ...cells,
            [state.selCellKey]: {
              ...sc,
              eventLog: [
                ...(sc.eventLog || []),
                {
                  kind: 'runner_adv' as const,
                  runnerName: runner.name,
                  dest,
                  advCode: action.advCode,
                  rbi: action.rbi,
                },
              ],
            },
          };
        }
      }

      return { ...state, runners, cells, awayR, homeR, awayER, homeER, history: saveHist(state) };
    }

    // ── RUN_OUT ──────────────────────────────────────────────────────────────
    case 'RUN_OUT': {
      const runner = state.runners[action.base];
      const runners: Runners = { ...state.runners };
      delete runners[action.base];
      const outs = state.outs + 1;

      // 결과 코드에서 실제 아웃 위치 추론 (H=홈, C=3루, B=2루, A=1루, CS=다음베이스, 포스=다음베이스)
      const inferOutBase = (result: string, startBase: Base): string => {
        const last = result[result.length - 1];
        if (last === 'H') return 'HOME';
        if (last === 'C') return '3B';
        if (last === 'B') return '2B';
        if (last === 'A') return '1B';
        if (result.startsWith('CS') || result.startsWith('X')) {
          if (startBase === '1B') return '2B';
          if (startBase === '2B') return '3B';
          return 'HOME';
        }
        if (/^[\d-]+$/.test(result) || result === '●') {
          if (startBase === '1B') return '2B';
          if (startBase === '2B') return '3B';
          return 'HOME';
        }
        return startBase;
      };
      const outBase = inferOutBase(action.result, action.base);

      let cells = { ...state.cells };
      if (runner) {
        let found = false;

        const runOutNum = outs; // 이 주자 아웃이 몇 번째 아웃인지
        const deflPatch = action.deflection ? { deflection: action.deflection } : {};
        for (let app = 0; app <= 5; app++) {
          const rk = cellKey(runner.inning, runner.order, app, runner.half);
          if (cells[rk]) {
            cells = {
              ...cells,
              [rk]: {
                ...cells[rk],
                runOut: action.result,
                runOutBase: outBase,
                runOutNum,
                runOutInning: state.inning,
                ...deflPatch,
              },
            };
            found = true;
            break;
          }
        }

        if (!found) {
          const otherHalf: Half = runner.half === 'top' ? 'bottom' : 'top';
          for (let app = 0; app <= 5; app++) {
            const rk = cellKey(runner.inning, runner.order, app, otherHalf);
            if (cells[rk]) {
              cells = {
                ...cells,
                [rk]: {
                  ...cells[rk],
                  runOut: action.result,
                  runOutBase: outBase,
                  runOutNum,
                  runOutInning: state.inning,
                  ...deflPatch,
                },
              };
              found = true;
              break;
            }
          }
        }

        if (!found) {
          const rk = cellKey(runner.inning, runner.order, 0, runner.half);
          const newCell: CellData = {
            half: runner.half,
            inning: runner.inning,
            order: runner.order,
            appearance: 0,
            pitches: [],
            result: null,
            runnerNotes: [],
            runOut: action.result,
            runOutBase: outBase,
            runOutNum,
            runOutInning: state.inning,
            ...deflPatch,
          };
          cells = { ...cells, [rk]: newCell };
        }
      }

      // 3아웃 시 잔루: 남은 주자(runners = 이미 out 제거된 상태) 셀에 lobCell 표기
      // 타자일순 대비 — 가장 최근 PA (높은 app) 셀에 찍음
      if (outs === 3) {
        for (const rem of Object.values(runners).filter(Boolean)) {
          if (rem) {
            let found = false;
            for (let app = 5; app >= 0; app--) {
              const rk = cellKey(rem.inning, rem.order, app, rem.half || state.half);
              if (cells[rk]) {
                cells = { ...cells, [rk]: { ...cells[rk], lobCell: true } };
                found = true;
                break;
              }
            }
            if (!found) {
              const otherHalf: Half = (rem.half || state.half) === 'top' ? 'bottom' : 'top';
              for (let app = 5; app >= 0; app--) {
                const rk = cellKey(rem.inning, rem.order, app, otherHalf);
                if (cells[rk]) {
                  cells = { ...cells, [rk]: { ...cells[rk], lobCell: true } };
                  break;
                }
              }
            }
          }
        }
      }

      // 모든 주자 아웃을 현재 타자 셀 eventLog에 runner_cs 항목으로 기록 (FIFO 보존)
      if (runner && state.selCellKey) {
        cells = ensureCell(cells, state.selCellKey);
        const sc = cells[state.selCellKey];
        cells = {
          ...cells,
          [state.selCellKey]: {
            ...sc,
            eventLog: [
              ...(sc.eventLog || []),
              {
                kind: 'runner_cs' as const,
                runnerName: runner.name,
                runOut: action.result,
                base: action.base,
              },
            ],
          },
        };
      }

      // 3아웃이어도 자동 이닝교대 X (사용자가 '다음이닝' 버튼 눌러야 NEXT_INNING)
      return { ...state, runners, outs, cells, history: saveHist(state) };
    }

    // ── PLACE_BATTER ─────────────────────────────────────────────────────────
    case 'PLACE_BATTER': {
      if (!state.pendingBatter) return state;
      const { runner, dest } = state.pendingBatter;

      if (state.runners[dest]) return state;

      const runners = { ...state.runners, [dest]: runner };
      const next = nextBatterState({ ...state, runners });
      // PLACE_BATTER 는 BAT_ADV 의 자동 후속 단계라 별도 history 안 쌓음 (UNDO 시 BAT_ADV 한 번으로 같이 풀리도록)
      return { ...state, runners, ...next, pendingBatter: null };
    }

    // ── CHAIN_BATTER_SKIP ────────────────────────────────────────────────────
    // 연결동작: dest가 막혀있을 때 타자를 toBase로 직접 이동
    case 'CHAIN_BATTER_SKIP': {
      if (!state.pendingBatter) return state;
      const { runner } = state.pendingBatter;
      const { toBase, earned, rbi, scorePitcher, advCode } = action;
      const runners: Runners = { ...state.runners };
      let cells = state.cells;
      let awayR = state.awayR,
        homeR = state.homeR;
      let awayER = state.awayER,
        homeER = state.homeER;

      if (toBase === 'HOME') {
        if (state.half === 'top') {
          awayR++;
          awayER += erValue(earned);
        } else {
          homeR++;
          homeER += erValue(earned);
        }
        if (runner.inning) {
          for (let app = 0; app <= 5; app++) {
            const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
            if (cells[rk]) {
              const existing = cells[rk].runnerNotes || [];
              // CHAIN_BATTER_SKIP: 타자 자신의 진루이므로 causedBy 없음, advCode만 기록
              const homeNote: RunnerNote = {
                base: 'HOME',
                rbi,
                advCode,
                chain: true,
              };
              cells = {
                ...cells,
                [rk]: {
                  ...cells[rk],
                  scored: true,
                  earned,
                  scorePitcher,
                  runnerNotes: [...existing, homeNote],
                  ...(action.deflection ? { deflection: action.deflection } : {}),
                },
              };
              if (rbi && state.selCellKey && cells[state.selCellKey]) {
                cells = { ...cells, [state.selCellKey]: { ...cells[state.selCellKey], rbi: true } };
              }
              break;
            }
          }
        }
      } else {
        // 목적 루에 기존 주자가 있으면 한 루씩 밀어냄
        if (runners[toBase]) {
          const chain: Record<string, string> = { '1B': '2B', '2B': '3B', '3B': 'HOME' };
          const nx = chain[toBase];
          if (nx === 'HOME') {
            if (state.half === 'top') awayR++;
            else homeR++;
            runners[toBase] = undefined;
          } else {
            runners[nx as Base] = runners[toBase];
            runners[toBase] = undefined;
          }
        }
        runners[toBase] = runner;
        if (toBase === '2B' || toBase === '3B') {
          if (runner.inning) {
            for (let app = 0; app <= 5; app++) {
              const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
              if (cells[rk]) {
                const existing = cells[rk].runnerNotes || [];
                cells = {
                  ...cells,
                  [rk]: {
                    ...cells[rk],
                    runnerNotes: [
                      ...existing,
                      // causedBy 없음: 타자 자신의 chain 진루
                      { base: toBase as Base, advCode, chain: true },
                    ],
                    ...(action.deflection ? { deflection: action.deflection } : {}),
                  },
                };
                break;
              }
            }
          }
        }
      }

      // 현재 타자 셀 eventLog에 기록 (FIFO 보존)
      if (state.selCellKey && cells[state.selCellKey]) {
        cells = {
          ...cells,
          [state.selCellKey]: {
            ...cells[state.selCellKey],
            eventLog: [
              ...(cells[state.selCellKey].eventLog || []),
              {
                kind: 'runner_adv' as const,
                runnerName: runner.name,
                dest: toBase,
                advCode,
                rbi,
              },
            ],
          },
        };
      }

      const next = nextBatterState({ ...state, runners });
      return {
        ...state,
        runners,
        cells,
        awayR,
        homeR,
        awayER,
        homeER,
        ...next,
        pendingBatter: null,
        history: saveHist(state),
      };
    }

    // ── REMOVE_RUNNER ────────────────────────────────────────────────────────
    // chain 대기: 주자를 루에서 제거만 (득점·노트 없음)
    case 'REMOVE_RUNNER': {
      const runners: Runners = { ...state.runners };
      delete runners[action.base];
      return { ...state, runners, history: saveHist(state) };
    }

    // ── CHAIN_TRANSIT_ADV ────────────────────────────────────────────────────
    // chain 대기 주자 최종 배치 (RUN_ADV와 동일 로직, runner 외부 주입)
    case 'CHAIN_TRANSIT_ADV': {
      const { runner, fromBase, toBase, earned, rbi, scorePitcher, advCode } = action;
      const chainTransitCausedBy = action.causedBy ?? state.curBatterOrder;
      const SELF_ADV_CODES = [
        'S',
        '(S)',
        'SD',
        '(SD)',
        'W',
        '(W)',
        'P',
        '(P)',
        'BK',
        '(BK)',
        '✓BK',
        '✓(BK)',
      ];
      const isSelfAdv = !!action.steal || SELF_ADV_CODES.includes(advCode || '');
      // 사용자가 명시적으로 chain 체크한 경우만 시각적 chain 마크 표시
      const markChain = !!action.chain;
      const runners: Runners = { ...state.runners };
      // transit 주자만 제거 — fromBase에 다른 주자가 있을 경우 (REMOVE_RUNNER 이후 원래 점유자가 남은 경우) 보존
      if (!runners[fromBase] || runners[fromBase]!.order === runner.order) {
        delete runners[fromBase];
      }
      let cells = state.cells;
      let awayR = state.awayR,
        homeR = state.homeR,
        awayER = state.awayER,
        homeER = state.homeER;

      if (toBase === 'HOME') {
        if (state.half === 'top') {
          awayR++;
          awayER += erValue(earned);
        } else {
          homeR++;
          homeER += erValue(earned);
        }
        if (runner.inning) {
          // 중간 경유 루 note + HOME note 기록
          const baseOrder: (Base | 'HOME')[] = ['1B', '2B', '3B', 'HOME'];
          const fromIdx = baseOrder.indexOf(fromBase);
          for (let app = 0; app <= 5; app++) {
            const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
            if (cells[rk]) {
              let existing = cells[rk].runnerNotes || [];
              // 중간 경유 루 (fromBase 다음부터 3B까지)
              for (let bi = fromIdx + 1; bi < 3; bi++) {
                // 3 = HOME index
                const noteBase = baseOrder[bi];
                if (noteBase === '1B') continue;
                if (
                  !existing.find((n) => n.base === noteBase && n.causedBy === chainTransitCausedBy)
                ) {
                  existing = [
                    ...existing,
                    {
                      causedBy: chainTransitCausedBy,
                      base: noteBase,
                      chain: markChain || undefined,
                    } as RunnerNote,
                  ];
                }
              }
              // HOME note
              const homeNote: RunnerNote = {
                causedBy: chainTransitCausedBy,
                base: 'HOME',
                rbi,
                advCode,
                chain: markChain || undefined,
                steal: isSelfAdv || undefined,
              };
              cells = {
                ...cells,
                [rk]: {
                  ...cells[rk],
                  scored: true,
                  earned,
                  scorePitcher,
                  runnerNotes: [...existing, homeNote],
                  ...(action.deflection ? { deflection: action.deflection } : {}),
                },
              };
              if (rbi && state.selCellKey && cells[state.selCellKey]) {
                cells = { ...cells, [state.selCellKey]: { ...cells[state.selCellKey], rbi: true } };
              }
              break;
            }
          }
        }
      } else {
        if (runners[toBase]) {
          const chain: Record<string, string> = { '1B': '2B', '2B': '3B', '3B': 'HOME' };
          const nx = chain[toBase];
          if (nx === 'HOME') {
            if (state.half === 'top') awayR++;
            else homeR++;
            runners[toBase] = undefined;
          } else {
            runners[nx as Base] = runners[toBase];
            runners[toBase] = undefined;
          }
        }
        runners[toBase] = runner;

        // 중간 경유 루 + 최종 루 note 기록
        if (runner.inning) {
          const baseOrder: (Base | 'HOME')[] = ['1B', '2B', '3B', 'HOME'];
          const fromIdx = baseOrder.indexOf(fromBase);
          const toIdx = baseOrder.indexOf(toBase as Base | 'HOME');
          // fromBase 다음 루부터 toBase까지 각각 note 기록
          for (let bi = fromIdx + 1; bi <= toIdx; bi++) {
            const noteBase = baseOrder[bi];
            if (noteBase === '1B') continue; // 1B는 note 안 찍음
            for (let app = 0; app <= 5; app++) {
              const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
              if (cells[rk]) {
                const existing = cells[rk].runnerNotes || [];
                // 최종 루에만 advCode 붙임, 중간 루는 causedBy(한자)만
                const isLast = bi === toIdx;
                const noteEntry: RunnerNote = isLast
                  ? {
                      causedBy: chainTransitCausedBy,
                      base: noteBase,
                      advCode,
                      chain: markChain || undefined,
                      steal: isSelfAdv || undefined,
                    }
                  : {
                      causedBy: chainTransitCausedBy,
                      base: noteBase,
                      chain: markChain || undefined,
                    };
                if (
                  !existing.find((n) => n.base === noteBase && n.causedBy === chainTransitCausedBy)
                ) {
                  cells = {
                    ...cells,
                    [rk]: {
                      ...cells[rk],
                      runnerNotes: [...existing, noteEntry],
                      // 최종 루에만 deflection 부착 (중간 루 중복 방지)
                      ...(isLast && action.deflection ? { deflection: action.deflection } : {}),
                    },
                  };
                }
                break;
              }
            }
          }
        }
      }

      // 현재 타자 셀 eventLog에 기록 (FIFO 보존, insertIndex 있으면 해당 위치 splice)
      if (state.selCellKey) {
        cells = ensureCell(cells, state.selCellKey);
        const sc = cells[state.selCellKey];
        const isDouble = advCode === 'SD' || advCode === '(SD)';
        const eventEntry = isSelfAdv
          ? {
              kind: 'runner_steal' as const,
              runnerName: runner.name,
              dest: toBase,
              advCode,
              double: isDouble || undefined,
            }
          : {
              kind: 'runner_adv' as const,
              runnerName: runner.name,
              dest: toBase,
              advCode,
              rbi,
            };
        const baseLog = sc.eventLog || [];
        const newLog =
          typeof action.insertIndex === 'number' &&
          action.insertIndex >= 0 &&
          action.insertIndex <= baseLog.length
            ? [
                ...baseLog.slice(0, action.insertIndex),
                eventEntry,
                ...baseLog.slice(action.insertIndex),
              ]
            : [...baseLog, eventEntry];
        cells = {
          ...cells,
          [state.selCellKey]: {
            ...sc,
            eventLog: newLog,
          },
        };
      }

      return { ...state, runners, cells, awayR, homeR, awayER, homeER, history: saveHist(state) };
    }

    // ── NEXT_BATTER ──────────────────────────────────────────────────────────
    case 'NEXT_BATTER': {
      return { ...state, ...nextBatterState(state) };
    }

    // ── NEXT_INNING ──────────────────────────────────────────────────────────
    // 3아웃 후 사용자가 '다음이닝' 버튼을 누르면 발생. advanceInning 으로 위임 (needsPosReview
    // 자동 SubstitutionLog 처리 포함).
    case 'NEXT_INNING': {
      return advanceInning(state, state.cells);
    }

    // ── CLEAR_CELL ───────────────────────────────────────────────────────────
    case 'CLEAR_CELL': {
      const key = state.selCellKey;
      const cell = state.cells[key];

      // A) 진행 중인 PA — result 없는데 투구만 있는 셀 → 그 PA 의 투구만 클리어
      if (cell && !cell.result && cell.pitches.length > 0) {
        const cells = { ...state.cells };
        delete cells[key];
        return { ...state, cells, balls: 0, strikes: 0 };
      }

      if (state.history.length === 0) return state;

      // B/C) "한 타순(PA) 의 모든 액션" 을 한 번에 pop
      //   - 현재 셀에 result 있음 → 그 셀의 타순(=cell.order)을 타깃
      //   - 현재 셀 비어있음 (신규 타자 들어옴) → 직전 snapshot 의 타순을 타깃
      // 같은 타순 cB 를 가진 snapshot 들을 연속으로 pop (BAT_ADV + 그 PA 동안 일어난 RUN_ADV/PITCH 등 묶어서)
      let targetOrder: number;
      if (cell?.result) {
        targetOrder = cell.order;
      } else {
        const lastSnap = state.history[state.history.length - 1];
        targetOrder = lastSnap.curBatterOrder;
      }

      let history = [...state.history];
      let result = state;
      let popped = false;
      while (history.length > 0) {
        const top = history[history.length - 1];
        if (top.curBatterOrder !== targetOrder) break;
        history = history.slice(0, -1);
        result = { ...result, ...top, history };
        popped = true;
      }

      // 타깃과 매칭되는 snapshot 이 없으면 일반 UNDO 한 번으로 폴백
      if (!popped) {
        history = [...state.history];
        const top = history.pop()!;
        result = { ...result, ...top, history };
      }

      return result;
    }

    // ── ADD_OVERFLOW ─────────────────────────────────────────────────────────
    case 'ADD_OVERFLOW': {
      const { half, inning, curBatterOrder } = state;
      const mx = Object.values(state.cells)
        .filter((c) => c.half === half && c.inning === inning && c.order === curBatterOrder)
        .reduce((m, c) => Math.max(m, c.appearance), -1);

      const na = mx + 1;
      const bk = cellKey(inning, curBatterOrder, 0, half);
      let cells = ensureCell(state.cells, bk);
      const nk = cellKey(inning, curBatterOrder, na, half);

      cells = {
        ...cells,
        [nk]: {
          half,
          inning,
          order: curBatterOrder,
          appearance: na,
          pitches: [],
          result: null,
          runnerNotes: [],
        },
      };

      return { ...state, cells, selCellKey: nk };
    }

    // ── UNDO ─────────────────────────────────────────────────────────────────
    case 'UNDO': {
      if (!state.history.length) return state;
      const history = [...state.history];
      const prev = history.pop()!;
      return { ...state, ...prev, history };
    }

    // ── SUBST ────────────────────────────────────────────────────────────────
    case 'SUBST': {
      const { side, pos, player, mid } = action;
      const luKey = side === 'away' ? 'awayLineup' : 'homeLineup';
      const benchKey = side === 'away' ? 'awayBench' : 'homeBench';
      const lu = [...state[luKey]];
      const bench = [...state[benchKey]];
      const targetIdx = lu.findIndex((x) => x.pos === pos);
      const existingIdx = lu.findIndex((x) => x.num === player.num && x.name === player.name);

      let oldPlayer: Player | null = null;
      let logOrder: number | undefined;

      if (existingIdx >= 0 && targetIdx >= 0 && existingIdx !== targetIdx) {
        // 라인업 내 선수가 새 포지션으로 이동 → 두 선수 포지션 swap
        oldPlayer = lu[targetIdx];
        const oldPosOfNewPlayer = lu[existingIdx].pos;
        lu[existingIdx] = { ...lu[existingIdx], pos };
        lu[targetIdx] = { ...lu[targetIdx], pos: oldPosOfNewPlayer };
        // 새 선수의 본인 배팅 타순 (= existingIdx의 order, 변경 안 됨)
        logOrder = lu[existingIdx].order;
      } else if (targetIdx >= 0) {
        // 벤치에서 새로 들어옴 → 기존 포지션 선수와 교체
        oldPlayer = lu[targetIdx];
        lu[targetIdx] = { ...player, order: oldPlayer.order, pos };
        bench.push({ ...oldPlayer });
        bench.splice(bench.indexOf(player), 1);
        // 새 선수가 인계받은 타순 (= 빠진 선수의 order)
        logOrder = oldPlayer.order;
      }

      const subEntry: SubstitutionLog = {
        inning: state.inning,
        half: state.half,
        side,
        kind: 'D',
        pos,
        newName: player.name,
        newNum: player.num,
        oldName: oldPlayer?.name ?? '',
        oldNum: oldPlayer?.num ?? '',
        order: logOrder,
        atOrder: state.curBatterOrder,
        mid,
      };

      return {
        ...state,
        [luKey]: lu,
        [benchKey]: bench,
        substitutions: [...state.substitutions, subEntry],
      };
    }

    // ── PITCHER_CHANGE ───────────────────────────────────────────────────────
    case 'PITCHER_CHANGE': {
      const { side, player, mid } = action;
      const luKey = side === 'away' ? 'awayLineup' : 'homeLineup';
      const benchKey = side === 'away' ? 'awayBench' : 'homeBench';
      const lu = [...state[luKey]];
      const bench = [...state[benchKey]];
      const idx = lu.findIndex((x) => x.pos === 1);

      let oldPlayer: Player | null = null;
      if (idx >= 0) {
        oldPlayer = lu[idx];
        lu[idx] = { ...player, order: oldPlayer.order, pos: 1 };
        bench.push({ ...oldPlayer });
        bench.splice(bench.indexOf(player), 1);
      }

      const newStatsMap = savePitcherStats(
        state.pitcherStatsMap,
        state.pitcher,
        state.pitchBalls,
        state.pitchStrikes
      );
      const incoming = loadPitcherStats(newStatsMap, player);

      // BB 책임 룰: PA 도중 교체이고 전임 투수가 불리한 카운트(볼 ≥ 2 또는 카운트가 타자 우위)에서
      // 카운트를 이어받은 경우, 다음 BB는 전임 투수 책임. 단순화하여 mid 정보가 있으면
      // 이후 첫 BAT_ADV에서 BB일 때 전임투수 charge로 전환.
      const inheritsBB = !!mid && (mid.balls >= 2 || mid.balls > mid.strikes);
      const prevPitcherName = state.pitcher.name;

      return {
        ...state,
        [luKey]: lu,
        [benchKey]: bench,
        pitcher: { name: player.name, num: player.num, pitchCount: incoming.pitchCount },
        pitchBalls: incoming.pitchBalls,
        pitchStrikes: incoming.pitchStrikes,
        pitcherStatsMap: newStatsMap,
        pitcherChanges: [
          ...state.pitcherChanges,
          {
            inning: state.inning,
            half: state.half,
            order: state.curBatterOrder,
            name: player.name,
            num: player.num,
            oldName: oldPlayer?.name,
            oldNum: oldPlayer?.num,
            mid,
            pendingBBChargeTo: inheritsBB ? prevPitcherName : undefined,
          },
        ],
      };
    }

    // ── SUBST_RUNNER ─────────────────────────────────────────────────────────
    case 'SUBST_RUNNER': {
      const { base, player, side, mid } = action;
      const prev = state.runners[base];
      if (!prev) return state;

      const luKey = side === 'away' ? 'awayLineup' : 'homeLineup';
      const benchKey = side === 'away' ? 'awayBench' : 'homeBench';
      const lu = [...state[luKey]];
      const bench = [...state[benchKey]];
      const idx = lu.findIndex((x) => x.order === prev.order);
      if (idx >= 0) {
        const old = lu[idx];
        lu[idx] = { ...player, order: old.order, pos: old.pos, needsPosReview: true };
        bench.push({ ...old });
        const pi = bench.findIndex((x) => x.num === player.num && x.name === player.name);
        if (pi >= 0) bench.splice(pi, 1);
      }

      const newRunner: Runner = {
        name: player.name,
        num: player.num,
        order: prev.order,
        half: prev.half,
        inning: prev.inning,
        pinchRunner: { num: prev.num, name: prev.name, mid },
      };

      const subEntry: SubstitutionLog = {
        inning: state.inning,
        half: state.half,
        side,
        kind: 'R',
        pos: 0,
        newName: player.name,
        newNum: player.num,
        oldName: prev.name,
        oldNum: prev.num,
        order: prev.order,
        atOrder: state.curBatterOrder,
        base,
        mid,
      };

      // 대주자가 기용된 베이스의 셀(원래 주자의 PA 셀)에 Ⓡ 마커
      let cells = state.cells;
      if (prev.inning) {
        for (let app = 0; app <= 5; app++) {
          const rk = cellKey(prev.inning, prev.order, app, prev.half);
          if (cells[rk]) {
            cells = {
              ...cells,
              [rk]: {
                ...cells[rk],
                pinchRunnerMark: { base, pinchName: player.name, mid },
              },
            };
            break;
          }
        }
      }

      return {
        ...state,
        runners: { ...state.runners, [base]: newRunner },
        [luKey]: lu,
        [benchKey]: bench,
        substitutions: [...state.substitutions, subEntry],
        cells,
      };
    }

    // ── SUBST_BATTER ─────────────────────────────────────────────────────────
    case 'SUBST_BATTER': {
      const { player, side, mid } = action;
      const luKey = side === 'away' ? 'awayLineup' : 'homeLineup';
      const benchKey = side === 'away' ? 'awayBench' : 'homeBench';
      const lu = [...state[luKey]];
      const bench = [...state[benchKey]];
      const idx = lu.findIndex((x) => x.order === state.curBatterOrder);
      let oldPlayer: Player | null = null;
      if (idx >= 0) {
        oldPlayer = lu[idx];
        lu[idx] = { ...player, order: oldPlayer.order, pos: oldPlayer.pos, needsPosReview: true };
        bench.push({ ...oldPlayer });
        const pi = bench.findIndex((x) => x.num === player.num && x.name === player.name);
        if (pi >= 0) bench.splice(pi, 1);
      }

      // 현재 타석 셀: 결과가 없으면 pinchHitter 정보 기록한 채로 유지
      const key = state.selCellKey;
      let cells = { ...state.cells };
      if (cells[key] && !cells[key].result) {
        // 기존 카운트/투구는 보존, 전임 타자 정보를 셀에 표기
        cells = {
          ...cells,
          [key]: {
            ...cells[key],
            pinchHitter: oldPlayer ? { num: oldPlayer.num, name: oldPlayer.name, mid } : undefined,
          },
        };
      } else if (!cells[key] && oldPlayer) {
        cells = {
          ...cells,
          [key]: {
            half: state.half,
            inning: state.inning,
            order: state.curBatterOrder,
            appearance: 0,
            pitches: [],
            result: null,
            runnerNotes: [],
            pinchHitter: { num: oldPlayer.num, name: oldPlayer.name, mid },
          },
        };
      }

      const subEntry: SubstitutionLog = {
        inning: state.inning,
        half: state.half,
        side,
        kind: 'H',
        pos: 0,
        newName: player.name,
        newNum: player.num,
        oldName: oldPlayer?.name ?? '',
        oldNum: oldPlayer?.num ?? '',
        order: state.curBatterOrder,
        atOrder: state.curBatterOrder,
        mid,
      };

      return {
        ...state,
        [luKey]: lu,
        [benchKey]: bench,
        cells,
        substitutions: [...state.substitutions, subEntry],
      };
    }

    // ── STRIKEOUT ─────────────────────────────────────────────────────────────
    case 'STRIKEOUT': {
      const { result, pitchType } = action;
      const key = state.selCellKey;
      let cells = ensureCell(state.cells, key);
      const cell = { ...cells[key] };
      if (cell.result) return state;

      cell.pitches = [...cell.pitches, pitchType];
      cell.eventLog = [...(cell.eventLog || []), { kind: 'pitch', pitch: pitchType }];
      cell.result = result;
      if (isOut(result) || result === 'K') {
        cell.cellOutNum = Math.min(state.outs + 1, 3);
        cell.eventLog = [...(cell.eventLog || []), { kind: 'result' as const, result }];
      }
      cells = { ...cells, [key]: cell };

      const pitcher = { ...state.pitcher, pitchCount: (state.pitcher.pitchCount || 0) + 1 };
      const pitchCount = state.pitchCount + 1;
      const pitchStrikes = state.pitchStrikes + 1;

      if (isOut(result) || result === 'K') {
        const outs = state.outs + 1;

        // 3아웃 시 잔루: 남은 주자 셀에 lobCell 표기 (타자일순 대비 — 가장 최근 PA 셀에)
        if (outs === 3) {
          for (const runner of Object.values(state.runners).filter(Boolean)) {
            if (runner) {
              for (let app = 5; app >= 0; app--) {
                const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
                if (cells[rk]) {
                  cells = { ...cells, [rk]: { ...cells[rk], lobCell: true } };
                  break;
                }
              }
            }
          }
        }

        // 3아웃이면 다음 타자로 넘어가지 않고 대기
        const next = outs === 3 ? {} : nextBatterState({ ...state, outs });
        return {
          ...state,
          cells,
          outs,
          balls: 0,
          strikes: 0,
          ...next,
          pitcher,
          pitchCount,
          pitchStrikes,
          history: saveHist(state),
        };
      }

      const lu = state.half === 'top' ? state.awayLineup : state.homeLineup;
      const bat = lu[state.curBatterOrder - 1];
      const batObj: Runner = {
        name: bat?.name || '',
        num: bat?.num || '',
        order: state.curBatterOrder,
        half: state.half,
        inning: state.inning,
      };

      const hasExistingRunners =
        Object.keys(state.runners).filter((k) => state.runners[k as Base]).length > 0;
      if (hasExistingRunners) {
        return {
          ...state,
          cells,
          balls: 0,
          strikes: 0,
          pitcher,
          pitchCount,
          pitchStrikes,
          pendingBatter: { runner: batObj, dest: '1B' },
          history: saveHist(state),
        };
      }

      const runners = { ...state.runners, '1B': batObj };
      const next = nextBatterState({ ...state, cells, runners });
      return {
        ...state,
        cells,
        runners,
        balls: 0,
        strikes: 0,
        ...next,
        pitcher,
        pitchCount,
        pitchStrikes,
        pendingBatter: null,
        history: saveHist(state),
      };
    }

    // ── CELL_NOTE ─────────────────────────────────────────────────────────────
    case 'CELL_NOTE': {
      const ck = state.selCellKey;
      const existing = state.cells[ck];
      const cell: CellData = existing ?? {
        half: state.half,
        inning: state.inning,
        order: state.curBatterOrder,
        appearance: 0,
        pitches: [],
        result: null,
        runnerNotes: [],
      };
      const updated = {
        ...cell,
        sideNotes: [...(cell.sideNotes || []), action.note],
        eventLog: [...(cell.eventLog || []), { kind: 'note' as const, note: action.note }],
      };
      return { ...state, cells: { ...state.cells, [ck]: updated } };
    }

    // ── GAME_EVENT ────────────────────────────────────────────────────────────
    case 'GAME_EVENT': {
      const ev = {
        inning: state.inning,
        half: state.half,
        type: action.eventType,
        detail: action.detail,
      };
      return { ...state, gameEvents: [...state.gameEvents, ev] };
    }

    // ── EDIT_PITCH (PitcherLogPanel 편집) ────────────────────────────────────
    case 'EDIT_PITCH': {
      const { cellKey: ck, entryIdx, newPitch } = action;
      const cell = state.cells[ck];
      if (!cell || !cell.eventLog) return state;
      if (entryIdx < 0 || entryIdx >= cell.eventLog.length) return state;
      const targetEntry = cell.eventLog[entryIdx];
      if (targetEntry.kind !== 'pitch') return state;

      const newEventLog = cell.eventLog.map((e, i) =>
        i === entryIdx ? { kind: 'pitch' as const, pitch: newPitch } : e
      );
      // pitches 배열에서 같은 위치의 pitch 교체
      let pitchSeq = -1;
      let targetPitchIdx = -1;
      cell.eventLog.forEach((e, i) => {
        if (e.kind === 'pitch') pitchSeq++;
        if (i === entryIdx) targetPitchIdx = pitchSeq;
      });
      const newPitches =
        targetPitchIdx >= 0 && targetPitchIdx < cell.pitches.length
          ? cell.pitches.map((p, i) => (i === targetPitchIdx ? newPitch : p))
          : cell.pitches;

      // 현재 진행 중인 PA(아직 결과 없는 selCellKey 셀) 편집이면 카운트 재계산
      const isCurrentPA = ck === state.selCellKey && !cell.result;
      let updatedState = state;
      if (isCurrentPA) {
        let balls = 0;
        let strikes = 0;
        for (const p of newPitches) {
          switch (p) {
            case 'S':
            case 'SW':
            case 'BS':
            case 'PC3':
              strikes++;
              break;
            case 'F':
            case 'FE':
              if (strikes < 2) strikes++;
              break;
            case 'BF':
              strikes++; // 번트파울 — 2스트 후에도 추가 (K3B 트리거)
              break;
            case 'B':
            case 'PC1':
            case 'PC2':
              balls++;
              break;
          }
        }
        updatedState = {
          ...state,
          balls: Math.min(balls, 4),
          strikes: Math.min(strikes, 3),
        };
      }

      return {
        ...updatedState,
        cells: {
          ...state.cells,
          [ck]: { ...cell, eventLog: newEventLog, pitches: newPitches },
        },
        history: saveHist(state),
      };
    }

    // ── EDIT_HIT_ZONE (안타 방향 변경 — 8안 → 9안 등) ─────────────────────────
    case 'EDIT_HIT_ZONE': {
      const { cellKey: ck, newZone } = action;
      const cell = state.cells[ck];
      if (!cell || !cell.hitData) return state;
      return {
        ...state,
        cells: {
          ...state.cells,
          [ck]: {
            ...cell,
            hitData: { ...cell.hitData, zone: newZone },
          },
        },
        history: saveHist(state),
      };
    }

    // ── EDIT_HIT_DATA (안타류 result + hitData 교체 — 같은 베이스 내) ────────
    // BatAdvModal editMode 에서 사용. 베이스 변경 없음을 호출자가 보장.
    // newHitData 가 undefined 면 hitData 제거 (안타 → 실책 같이 hitData 없는 결과로 전환)
    case 'EDIT_HIT_DATA': {
      const { cellKey: ck, newHitData, newResult, newBallType, newDeflection } = action;
      const cell = state.cells[ck];
      if (!cell) return state;
      const newEventLog = (cell.eventLog || []).map((e) =>
        e.kind === 'result' ? { ...e, result: newResult } : e
      );
      // newDeflection: undefined = 유지, null = 제거, value = 교체
      const deflPatch =
        newDeflection === undefined
          ? {}
          : newDeflection === null
            ? { deflection: undefined }
            : { deflection: newDeflection };
      return {
        ...state,
        cells: {
          ...state.cells,
          [ck]: {
            ...cell,
            result: newResult,
            hitData: newHitData,
            ballType: newHitData ? newHitData.ballType : newBallType,
            eventLog: newEventLog,
            ...deflPatch,
          },
        },
        history: saveHist(state),
      };
    }

    // ── EDIT_RUNNER_REASON (도루 ↔ 폭투 ↔ 포일 ↔ 보크) ───────────────────────
    // 진루 사유(advCode) 만 변경 — dest/rbi/steal/causedBy 등 부작용은 그대로
    case 'EDIT_RUNNER_REASON': {
      const { cellKey: ck, entryIdx, newAdvCode } = action;
      const cell = state.cells[ck];
      if (!cell || !cell.eventLog) return state;
      if (entryIdx < 0 || entryIdx >= cell.eventLog.length) return state;
      const target = cell.eventLog[entryIdx];
      if (target.kind !== 'runner_steal' && target.kind !== 'runner_adv') return state;

      // 도루(S/(S)/SD/(SD)) 계열인지 판정
      const stealCodes = ['S', '(S)', 'SD', '(SD)'];
      const newIsSteal = stealCodes.includes(newAdvCode);

      // eventLog entry 교체 — kind도 도루 ↔ 일반 진루로 전환 가능
      const newEventLog = cell.eventLog.map((e, i) => {
        if (i !== entryIdx) return e;
        if (newIsSteal) {
          const isDouble = newAdvCode === 'SD' || newAdvCode === '(SD)';
          const dest =
            target.kind === 'runner_steal' ? target.dest : (target as { dest: string }).dest;
          const runnerName =
            target.kind === 'runner_steal'
              ? target.runnerName
              : (target as { runnerName: string }).runnerName;
          return {
            kind: 'runner_steal' as const,
            runnerName,
            dest,
            advCode: newAdvCode,
            double: isDouble || undefined,
          };
        } else {
          // runner_adv 로 전환
          const dest =
            target.kind === 'runner_adv' ? target.dest : (target as { dest: string }).dest;
          const runnerName =
            target.kind === 'runner_adv'
              ? target.runnerName
              : (target as { runnerName: string }).runnerName;
          const rbi = target.kind === 'runner_adv' ? target.rbi : undefined;
          return {
            kind: 'runner_adv' as const,
            runnerName,
            dest,
            advCode: newAdvCode,
            ...(rbi ? { rbi } : {}),
          };
        }
      });

      // 같은 cell의 runnerNotes 에서 일치하는 노트 advCode 도 갱신
      // (advCode는 진루 사유 표시용, base/causedBy는 그대로)
      const targetRunnerName =
        target.kind === 'runner_steal' || target.kind === 'runner_adv' ? target.runnerName : '';
      const targetDest =
        target.kind === 'runner_steal' || target.kind === 'runner_adv' ? target.dest : '';
      let updatedCells: typeof state.cells = {
        ...state.cells,
        [ck]: { ...cell, eventLog: newEventLog },
      };
      // 모든 cells의 runnerNotes에서 해당 주자의 같은 dest 노트의 advCode/steal 갱신
      Object.entries(updatedCells).forEach(([k, c]) => {
        if (!c.runnerNotes || c.runnerNotes.length === 0) return;
        let touched = false;
        const newNotes = c.runnerNotes.map((n) => {
          if (n.base !== targetDest) return n;
          // runnerName으로 매칭은 어려움 — base가 같으면 변경 (보수적)
          // 더 정확한 매칭이 필요하면 추가 식별자 도입 필요
          if (n.advCode === target.advCode) {
            touched = true;
            return { ...n, advCode: newAdvCode, steal: newIsSteal || undefined };
          }
          return n;
        });
        if (touched) {
          updatedCells = { ...updatedCells, [k]: { ...c, runnerNotes: newNotes } };
        }
      });
      void targetRunnerName; // future use — runner 매칭 정확도 개선용

      return {
        ...state,
        cells: updatedCells,
        history: saveHist(state),
      };
    }

    // ── EDIT_BAT_RESULT_CODE (안타 ↔ 내야안타 ↔ 실책 등 — 동일 베이스) ────────
    // 1루 도달 결과 코드 안에서만 교환 — 주자/실점 변동 없음
    case 'EDIT_BAT_RESULT_CODE': {
      const { cellKey: ck, newResult } = action;
      const cell = state.cells[ck];
      if (!cell) return state;

      const newEventLog = (cell.eventLog || []).map((e) =>
        e.kind === 'result' ? { ...e, result: newResult } : e
      );

      return {
        ...state,
        cells: {
          ...state.cells,
          [ck]: {
            ...cell,
            result: newResult,
            eventLog: newEventLog,
          },
        },
        history: saveHist(state),
      };
    }

    // ── EDIT_BAT_OUT_CODE (1땅 ↔ 6땅 ↔ F1 등 — 동일 아웃 카운트) ─────────────
    // 아웃 결과의 fielder/ballType만 변경 — outs/주자/cellOutNum 변동 없음
    case 'EDIT_BAT_OUT_CODE': {
      const { cellKey: ck, newResult, newBallType } = action;
      const cell = state.cells[ck];
      if (!cell) return state;

      const newEventLog = (cell.eventLog || []).map((e) =>
        e.kind === 'result' ? { ...e, result: newResult } : e
      );

      return {
        ...state,
        cells: {
          ...state.cells,
          [ck]: {
            ...cell,
            result: newResult,
            eventLog: newEventLog,
            // ballType: 새 값 명시되면 갱신, undefined면 cell에서 제거
            ballType: newBallType,
          },
        },
        history: saveHist(state),
      };
    }

    // ── EDIT_SCORED_RUN — 득점 셀의 자책여부/실점투수 변경 ───────────────────
    case 'EDIT_SCORED_RUN': {
      const { cellKey: ck, newEarned, newScorePitcher } = action;
      const cell = state.cells[ck];
      if (!cell || !cell.scored) return state;

      // 자책점 재계산: earned 변경 분만큼 awayER/homeER 보정
      // 자책=1, 반자책=0.5, 비자책=0
      const delta = erValue(newEarned) - erValue(cell.earned);

      const awayER = cell.half === 'top' ? state.awayER + delta : state.awayER;
      const homeER = cell.half === 'bottom' ? state.homeER + delta : state.homeER;

      return {
        ...state,
        cells: {
          ...state.cells,
          [ck]: {
            ...cell,
            earned: newEarned,
            scorePitcher: newScorePitcher ?? cell.scorePitcher,
          },
        },
        awayER,
        homeER,
        history: saveHist(state),
      };
    }

    case 'SET_GAME_DECISIONS': {
      return { ...state, gameDecisions: action.decisions };
    }

    case 'SWAP_FIELD_POS': {
      const luKey = action.team === 'away' ? 'awayLineup' : 'homeLineup';
      const lu = [...state[luKey]];
      const { idx1, idx2 } = action;
      if (idx1 === idx2 || idx1 < 0 || idx2 < 0 || idx1 >= lu.length || idx2 >= lu.length)
        return state;
      const p1 = lu[idx1];
      const p2 = lu[idx2];
      // P(pos=1)/D(pos=0) 는 swap 대상 제외
      if (p1.pos === 1 || p2.pos === 1 || p1.pos === 0 || p2.pos === 0) return state;
      // pos 교환
      lu[idx1] = { ...p1, pos: p2.pos };
      lu[idx2] = { ...p2, pos: p1.pos };
      const newSubs = [
        {
          inning: state.inning,
          half: state.half,
          side: action.team,
          kind: 'D' as const,
          pos: p2.pos,
          newName: p1.name,
          newNum: p1.num,
          oldName: p1.name,
          oldNum: p1.num,
          order: p1.order,
          atOrder: state.curBatterOrder,
        },
        {
          inning: state.inning,
          half: state.half,
          side: action.team,
          kind: 'D' as const,
          pos: p1.pos,
          newName: p2.name,
          newNum: p2.num,
          oldName: p2.name,
          oldNum: p2.num,
          order: p2.order,
          atOrder: state.curBatterOrder,
        },
      ];
      return {
        ...state,
        [luKey]: lu,
        substitutions: [...state.substitutions, ...newSubs],
      };
    }

    default:
      return state;
  }
}
