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
  // KT[pos] = 삼진 후 태그 아웃, K[seq] = 삼진 후 송구 아웃 (e.g. K2-3)
  if (r.startsWith('KT') && r !== 'KT') return true;
  if (r.startsWith('K') && r.length > 1 && /^\d/.test(r.slice(1))) return true;
  return (
    r === 'K' ||
    r === 'K3B' ||
    r === 'A' ||
    (r.startsWith('SH') && r !== 'SH진루') ||
    r.startsWith('BU') ||
    r.startsWith('SF') ||
    /^\d([-→]\d)*(T|U|R)?$/.test(r) ||
    /^[fFL]/.test(r) ||
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
  if (/^E\d$/.test(r)) return true; // 실책 진루 E6, E5 등
  if (/^E번트\d$/.test(r)) return true; // 번트 실책 E번트6 등
  if (/^KE\d$/.test(r)) return true; // 낫아웃 수비실책 KE2 등
  if (/^ꓘ[\d-]+$/.test(r)) return true; // 다른주자수비 출루 ꓘ3, ꓘ2-3 등
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
  const prevHalf = half;
  const finishedOrder = (s.curBatterOrder % 9) + 1;
  let awayNextOrder = s.awayNextOrder;
  let homeNextOrder = s.homeNextOrder;

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
  void prevHalf;

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
      lu[action.idx] = { ...lu[action.idx], pos: action.pos };
      return { ...state, [luKey]: lu };
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

    // ── PITCH ────────────────────────────────────────────────────────────────
    case 'PITCH': {
      const { pitchType } = action;
      const key = state.selCellKey;
      let cells = ensureCell(state.cells, key);
      const cell = { ...cells[key] };
      if (cell.result) return state;

      cell.pitches = [...cell.pitches, pitchType as PitchType];

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
        let newRunners: Runners;

        if (state.runners['1B'] && state.runners['2B'] && state.runners['3B']) {
          if (state.half === 'top') awayR++;
          else homeR++;
          // 3루 주자 득점 표시
          const r3 = state.runners['3B']!;
          if (r3.inning) {
            for (let app = 0; app <= 5; app++) {
              const rk = cellKey(r3.inning, r3.order, app, r3.half || state.half);
              if (cells[rk]) {
                cells = { ...cells, [rk]: { ...cells[rk], scored: true } };
                break;
              }
            }
          }
          newRunners = forceWalk(state.runners, batObj);
        } else {
          newRunners = forceWalk(state.runners, batObj);
        }

        cells = { ...cells, [key]: cell };
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
        result = hd.bases === 1 ? 'H1' : hd.bases === 2 ? 'H2' : hd.bases === 3 ? 'H3' : 'HR';
        cellUpdate = { result, hitData: hd, ballType: hd.ballType };
      } else {
        result = action.result;
        cellUpdate = { result, ...(ballType ? { ballType } : {}) };
      }

      const cell = { ...cells[key], ...cellUpdate };
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

      const markScored = (runner: Runner) => {
        if (runner.inning) {
          for (let app = 0; app <= 5; app++) {
            const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
            if (cells[rk]) {
              cells = { ...cells, [rk]: { ...cells[rk], scored: true } };
              break;
            }
          }
        }
      };

      if (dest === 'HOME') {
        // HR/GHR: 모든 주자 득점
        (['3B', '2B', '1B'] as Base[]).forEach((b) => {
          if (runners[b]) {
            if (state.half === 'top') awayR++;
            else homeR++;
            markScored(runners[b]!);
          }
        });

        if (state.half === 'top') awayR++;
        else homeR++;

        runners = {};
      } else if (forceTypes.includes(result)) {
        // 볼넷/사구 등: force walk
        if (runners['1B'] && runners['2B'] && runners['3B']) {
          const r3 = runners['3B']!;
          if (state.half === 'top') awayR++;
          else homeR++;
          markScored(r3);
        }
        runners = forceWalk(runners, batObj);
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
        history: saveHist(state),
      };
    }

    // ── BAT_OUT ──────────────────────────────────────────────────────────────
    case 'BAT_OUT': {
      const { result, dp: isDP, tp: isTP } = action;
      const key = state.selCellKey;
      let cells = ensureCell(state.cells, key);
      cells = {
        ...cells,
        [key]: {
          ...cells[key],
          result,
          ...(isDP ? { isDoublePlay: true } : {}),
          ...(isTP ? { isTriplePlay: true } : {}),
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
            for (let app = 0; app <= 5; app++) {
              const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
              if (cells[rk]) {
                cells = {
                  ...cells,
                  [rk]: {
                    ...cells[rk],
                    runOut: runOutSeq,
                    runOutBase: base,
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
      if (outs === 3) {
        for (const runner of Object.values(runners).filter(Boolean)) {
          if (runner) {
            for (let app = 0; app <= 5; app++) {
              const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
              if (cells[rk]) {
                cells = { ...cells, [rk]: { ...cells[rk], lobCell: true } };
                break;
              }
            }
          }
        }
        const batPitcher = { ...state.pitcher, pitchCount: (state.pitcher.pitchCount || 0) + 1 };
        return advanceInning(
          {
            ...state,
            pitcher: batPitcher,
            pitchCount: state.pitchCount + 1,
            pitchStrikes: state.pitchStrikes + 1,
          },
          cells
        );
      }

      // θ 타격완료 → S 집계 (아웃 타구는 항상 타격 접촉)
      const batPitcher = { ...state.pitcher, pitchCount: (state.pitcher.pitchCount || 0) + 1 };
      const batPitchCount = state.pitchCount + 1;
      const batPitchStrikes = state.pitchStrikes + 1;

      const next = nextBatterState({ ...state, outs });
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
      const runAdvCausedBy = action.causedBy ?? state.curBatterOrder;
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
          if (earned === true || earned === 'half') awayER++;
        } else {
          homeR++;
          if (earned === true || earned === 'half') homeER++;
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
                    n.base === dest &&
                    n.causedBy === runAdvCausedBy &&
                    n.steal === action.steal
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
                      },
                    ],
                  },
                };
              }
              break;
            }
          }
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

      let cells = { ...state.cells };
      if (runner) {
        let found = false;

        const runOutNum = outs; // 이 주자 아웃이 몇 번째 아웃인지
        for (let app = 0; app <= 5; app++) {
          const rk = cellKey(runner.inning, runner.order, app, runner.half);
          if (cells[rk]) {
            cells = {
              ...cells,
              [rk]: {
                ...cells[rk],
                runOut: action.result,
                runOutBase: action.base,
                runOutNum,
                runOutInning: state.inning,
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
                  runOutBase: action.base,
                  runOutNum,
                  runOutInning: state.inning,
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
            runOutBase: action.base,
            runOutNum,
            runOutInning: state.inning,
          };
          cells = { ...cells, [rk]: newCell };
        }
      }

      // 3아웃 시 잔루: 남은 주자(runners = 이미 out 제거된 상태) 셀에 lobCell 표기
      if (outs === 3) {
        for (const rem of Object.values(runners).filter(Boolean)) {
          if (rem) {
            let found = false;
            for (let app = 0; app <= 5; app++) {
              const rk = cellKey(rem.inning, rem.order, app, rem.half || state.half);
              if (cells[rk]) {
                cells = { ...cells, [rk]: { ...cells[rk], lobCell: true } };
                found = true;
                break;
              }
            }
            if (!found) {
              const otherHalf: Half = (rem.half || state.half) === 'top' ? 'bottom' : 'top';
              for (let app = 0; app <= 5; app++) {
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

      if (outs === 3) {
        return advanceInning({ ...state, runners }, cells);
      }

      return { ...state, runners, outs, cells, history: saveHist(state) };
    }

    // ── PLACE_BATTER ─────────────────────────────────────────────────────────
    case 'PLACE_BATTER': {
      if (!state.pendingBatter) return state;
      const { runner, dest } = state.pendingBatter;

      if (state.runners[dest]) return state;

      const runners = { ...state.runners, [dest]: runner };
      const next = nextBatterState({ ...state, runners });
      return { ...state, runners, ...next, pendingBatter: null, history: saveHist(state) };
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
          if (earned === true || earned === 'half') awayER++;
        } else {
          homeR++;
          if (earned === true || earned === 'half') homeER++;
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
              };
              cells = {
                ...cells,
                [rk]: {
                  ...cells[rk],
                  scored: true,
                  earned,
                  scorePitcher,
                  runnerNotes: [...existing, homeNote],
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
                      { base: toBase as Base, advCode },
                    ],
                  },
                };
                break;
              }
            }
          }
        }
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
          if (earned === true || earned === 'half') awayER++;
        } else {
          homeR++;
          if (earned === true || earned === 'half') homeER++;
        }
        if (runner.inning) {
          for (let app = 0; app <= 5; app++) {
            const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
            if (cells[rk]) {
              const existing = cells[rk].runnerNotes || [];
              const homeNote: RunnerNote = {
                causedBy: chainTransitCausedBy,
                base: 'HOME',
                rbi,
                advCode,
              };
              cells = {
                ...cells,
                [rk]: {
                  ...cells[rk],
                  scored: true,
                  earned,
                  scorePitcher,
                  runnerNotes: [...existing, homeNote],
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
                      { causedBy: chainTransitCausedBy, base: toBase as Base, advCode },
                    ],
                  },
                };
                break;
              }
            }
          }
        }
      }

      return { ...state, runners, cells, awayR, homeR, awayER, homeER, history: saveHist(state) };
    }

    // ── NEXT_BATTER ──────────────────────────────────────────────────────────
    case 'NEXT_BATTER': {
      return { ...state, ...nextBatterState(state) };
    }

    // ── NEXT_INNING ──────────────────────────────────────────────────────────
    case 'NEXT_INNING': {
      const { awayInn, homeInn } = state;
      let { half, inning } = state;
      const prevInn = [...awayInn];
      const prevHome = [...homeInn];

      const finishedOrder = (state.curBatterOrder % 9) + 1;
      let awayNextOrder = state.awayNextOrder;
      let homeNextOrder = state.homeNextOrder;

      if (half === 'top') {
        prevInn[inning - 1] =
          state.awayR -
          (inning > 1 ? awayInn.slice(0, inning - 1).reduce((s: number, v) => s + (v || 0), 0) : 0);
        awayNextOrder = finishedOrder;
        half = 'bottom';
      } else {
        prevHome[inning - 1] =
          state.homeR - homeInn.slice(0, inning - 1).reduce((s: number, v) => s + (v || 0), 0);
        homeNextOrder = finishedOrder;
        half = 'top';
        inning++;
      }

      const leadOff = half === 'top' ? awayNextOrder : homeNextOrder;

      const nextPitcherBase =
        half === 'top' ? findPitcher(state.homeLineup) : findPitcher(state.awayLineup);
      const pitcherChanged =
        nextPitcherBase.name !== state.pitcher.name || nextPitcherBase.num !== state.pitcher.num;
      let pitcherStatsMap = state.pitcherStatsMap;
      let pitchBalls: number;
      let pitchStrikes: number;
      let pitcher: typeof state.pitcher;
      if (pitcherChanged) {
        pitcherStatsMap = savePitcherStats(
          pitcherStatsMap,
          state.pitcher,
          state.pitchBalls,
          state.pitchStrikes
        );
        const saved = loadPitcherStats(pitcherStatsMap, nextPitcherBase);
        pitchBalls = saved.pitchBalls;
        pitchStrikes = saved.pitchStrikes;
        pitcher = { ...nextPitcherBase, pitchCount: saved.pitchCount };
      } else {
        pitchBalls = state.pitchBalls;
        pitchStrikes = state.pitchStrikes;
        pitcher = { ...nextPitcherBase, pitchCount: state.pitcher.pitchCount };
      }

      return {
        ...state,
        half,
        inning,
        outs: 0,
        balls: 0,
        strikes: 0,
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
        history: saveHist(state),
      };
    }

    // ── CLEAR_CELL ───────────────────────────────────────────────────────────
    case 'CLEAR_CELL': {
      const key = state.selCellKey;
      const cell = state.cells[key];

      if (cell?.result && state.history.length) {
        const history = [...state.history];
        const prev = history.pop()!;
        return { ...state, ...prev, history };
      }

      const cells = { ...state.cells };
      delete cells[key];
      return { ...state, cells, balls: 0, strikes: 0 };
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
      const { side, pos, player } = action;
      const luKey = side === 'away' ? 'awayLineup' : 'homeLineup';
      const benchKey = side === 'away' ? 'awayBench' : 'homeBench';
      const lu = [...state[luKey]];
      const bench = [...state[benchKey]];
      const idx = lu.findIndex((x) => x.pos === pos);

      if (idx >= 0) {
        const old = lu[idx];
        lu[idx] = { ...player, order: old.order, pos };
        bench.push({ ...old });
        bench.splice(bench.indexOf(player), 1);
      }

      return { ...state, [luKey]: lu, [benchKey]: bench };
    }

    // ── PITCHER_CHANGE ───────────────────────────────────────────────────────
    case 'PITCHER_CHANGE': {
      const { side, player } = action;
      const luKey = side === 'away' ? 'awayLineup' : 'homeLineup';
      const benchKey = side === 'away' ? 'awayBench' : 'homeBench';
      const lu = [...state[luKey]];
      const bench = [...state[benchKey]];
      const idx = lu.findIndex((x) => x.pos === 1);

      if (idx >= 0) {
        const old = lu[idx];
        lu[idx] = { ...player, order: old.order, pos: 1 };
        bench.push({ ...old });
        bench.splice(bench.indexOf(player), 1);
      }

      const newStatsMap = savePitcherStats(
        state.pitcherStatsMap,
        state.pitcher,
        state.pitchBalls,
        state.pitchStrikes
      );
      const incoming = loadPitcherStats(newStatsMap, player);

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
          },
        ],
      };
    }

    // ── SUBST_RUNNER ─────────────────────────────────────────────────────────
    case 'SUBST_RUNNER': {
      const { base, player, side } = action;
      const prev = state.runners[base];
      if (!prev) return state;

      const luKey = side === 'away' ? 'awayLineup' : 'homeLineup';
      const benchKey = side === 'away' ? 'awayBench' : 'homeBench';
      const lu = [...state[luKey]];
      const bench = [...state[benchKey]];
      const idx = lu.findIndex((x) => x.order === prev.order);
      if (idx >= 0) {
        const old = lu[idx];
        lu[idx] = { ...player, order: old.order, pos: old.pos };
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
      };

      return {
        ...state,
        runners: { ...state.runners, [base]: newRunner },
        [luKey]: lu,
        [benchKey]: bench,
      };
    }

    // ── SUBST_BATTER ─────────────────────────────────────────────────────────
    case 'SUBST_BATTER': {
      const { player, side } = action;
      const luKey = side === 'away' ? 'awayLineup' : 'homeLineup';
      const benchKey = side === 'away' ? 'awayBench' : 'homeBench';
      const lu = [...state[luKey]];
      const bench = [...state[benchKey]];
      const idx = lu.findIndex((x) => x.order === state.curBatterOrder);
      if (idx >= 0) {
        const old = lu[idx];
        lu[idx] = { ...player, order: old.order, pos: old.pos };
        bench.push({ ...old });
        const pi = bench.findIndex((x) => x.num === player.num && x.name === player.name);
        if (pi >= 0) bench.splice(pi, 1);
      }

      // 현재 타석 셀 초기화 (새 타자로)
      const key = state.selCellKey;
      const cells = { ...state.cells };
      if (cells[key] && !cells[key].result) {
        delete cells[key];
      }

      return {
        ...state,
        [luKey]: lu,
        [benchKey]: bench,
        cells,
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
      cell.result = result;
      cells = { ...cells, [key]: cell };

      const pitcher = { ...state.pitcher, pitchCount: (state.pitcher.pitchCount || 0) + 1 };
      const pitchCount = state.pitchCount + 1;
      const pitchStrikes = state.pitchStrikes + 1;

      if (isOut(result) || result === 'K') {
        const outs = state.outs + 1;

        if (outs === 3) {
          for (const runner of Object.values(state.runners).filter(Boolean)) {
            if (runner) {
              for (let app = 0; app <= 5; app++) {
                const rk = cellKey(runner.inning, runner.order, app, runner.half || state.half);
                if (cells[rk]) {
                  cells = { ...cells, [rk]: { ...cells[rk], lobCell: true } };
                  break;
                }
              }
            }
          }
          return advanceInning({ ...state, pitcher, pitchCount, pitchStrikes }, cells);
        }

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
      const updated = { ...cell, sideNotes: [...(cell.sideNotes || []), action.note] };
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

    default:
      return state;
  }
}
