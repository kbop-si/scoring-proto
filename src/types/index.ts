export type Screen = 'splash' | 'league' | 'create' | 'gameinfo' | 'lineup' | 'game';
export type Half = 'top' | 'bottom';
export type Base = '1B' | '2B' | '3B';
export type PitchType = 'S' | 'SW' | 'B' | 'F' | 'FE' | 'BS' | 'BF' | 'PC1' | 'PC2' | 'PC3';

export interface Player {
  name: string;
  num: string;
  pos: number; // 0=DH, 1=P, 2=C, 3-9=fielder
  order: number; // 1-9 batting order, 0=pitcher slot (no AB)
  hitType: number; //1=우타, 2= 좌타, 3=스위치
}

export interface Runner {
  name: string;
  num: string;
  order: number;
  half: Half;
  inning: number;
}

export interface RunnerNote {
  causedBy: number;
  base: Base | 'HOME';
  rbi?: boolean;
  steal?: boolean; // 도루에 의한 진루 (통계용)
  advCode?: string; // 진루 사유 코드 표시 — S/(S)/W/(W)/P/(P)/BK/(BK)/✓BK/✓(BK)
}

export interface HitData {
  zone: number; // 1-9 fielder zone
  dirRow: number; // 0-2 (0=deep/top, 1=mid, 2=near/bottom of 3x3 grid)
  dirCol: number; // 0-2 (0=left, 1=center, 2=right)
  ballType: '땅' | '뜬' | '라';
  deflection: boolean;
  bases: 0 | 1 | 2 | 3 | 4; // 0=out, 1=single, 2=double, 3=triple, 4=HR
}

export interface CellData {
  half: Half;
  inning: number;
  order: number;
  appearance: number;
  pitches: PitchType[];
  result: string | null;
  runnerNotes: RunnerNote[];
  scored?: boolean;
  earned?: boolean | 'half'; // 득점 시 자책 여부 (true=자책, false=비자책, 'half'=반자책)
  rbi?: boolean; // 타점인정 여부
  scorePitcher?: string; // 실점 책임 투수명
  ballType?: '땅' | '뜬' | '라'; // 타구 유형 (땅볼/뜬공/라이너)
  runOut?: string; // 주자 아웃 결과 코드 (주루 중 아웃될 때)
  runOutBase?: string; // 주자가 아웃된 베이스 ('1B' | '2B' | '3B')
  runOutNum?: number; // 병살/삼중살에서 이 주자의 아웃 순서 (1-3)
  runOutInning?: number; // 주자가 아웃된 이닝 (outMap 계산용)
  lobCell?: boolean; // 잔루 — 이닝 종료 시 홈에 못 들어온 주자 셀에 표기 (ℓ)
  isDoublePlay?: boolean; // 병살타 여부 (result 문자열에 포함 안 됨)
  isTriplePlay?: boolean; // 삼중살 여부 (result 문자열에 포함 안 됨)
  defFielders?: number[]; // 수비수 번호 내부 기록 — FC/INT/Ob 등 result에 직접 안 붙는 경우
  isDPRunner?: boolean; // 병살/삼중살에서 아웃된 주자 셀 (outMap pre-population 구분용)
  sideNotes?: string[]; // 마운드방문/타자타임/투수판이탈 등 투구 영역에 표시
  hitData?: HitData; // 구조화된 타구 데이터
}

export interface PitcherData {
  name: string;
  num: string;
  pitchCount: number;
}

export type Runners = Partial<Record<Base, Runner>>;

export interface GameEvent {
  inning: number;
  half: Half;
  type: 'mound' | 'batter_timeout' | 'pitcher_leave';
  detail?: string;
}

export interface PitcherChange {
  inning: number;
  half: Half;
  order: number; // 교체 시점 타자 순서
  name: string; // 새 투수 이름
}

export interface PitcherStats {
  pitchCount: number;
  pitchBalls: number;
  pitchStrikes: number;
}

export interface GameState {
  league: string;
  awayTeam: string;
  homeTeam: string;
  date: string;
  half: Half;
  inning: number;
  outs: number;
  balls: number;
  strikes: number;
  pitchCount: number;
  pitchBalls: number;
  pitchStrikes: number;
  pitcherStatsMap: Record<string, PitcherStats>;
  curBatterOrder: number;
  awayNextOrder: number;
  homeNextOrder: number;
  selCellKey: string;
  cells: Record<string, CellData>;
  runners: Runners;
  pendingBatter: { runner: Runner; dest: Base } | null;
  awayLineup: Player[];
  homeLineup: Player[];
  awayBench: Player[];
  homeBench: Player[];
  pitcher: PitcherData;
  awayR: number;
  awayH: number;
  awayE: number;
  awayER: number; // 자책점
  homeR: number;
  homeH: number;
  homeE: number;
  homeER: number; // 자책점
  awayInn: (number | null)[];
  homeInn: (number | null)[];
  history: HistorySnapshot[];
  gameEvents: GameEvent[];
  pitcherChanges: PitcherChange[];
  // 경기 정보
  stadium?: string;
  gameNum?: string;
  startTime?: string;
  endTime?: string;
  attendance?: string;
  umpireHome?: string;
  umpire1B?: string;
  umpire2B?: string;
  umpire3B?: string;
  umpireLeft?: string;
  umpireRight?: string;
  recorder1?: string;
  recorder2?: string;
}

export interface HistorySnapshot {
  half: Half;
  inning: number;
  outs: number;
  balls: number;
  strikes: number;
  curBatterOrder: number;
  awayNextOrder: number;
  homeNextOrder: number;
  selCellKey: string;
  cells: Record<string, CellData>;
  runners: Runners;
  pendingBatter: { runner: Runner; dest: Base } | null;
  pitcher: PitcherData;
  pitchCount: number;
  pitchBalls: number;
  pitchStrikes: number;
  pitcherStatsMap: Record<string, PitcherStats>;
  awayR: number;
  homeR: number;
  awayH: number;
  homeH: number;
  awayER: number;
  homeER: number;
  awayInn: (number | null)[];
  homeInn: (number | null)[];
}

export interface UIState {
  // Modal open flags
  batAdvOpen: boolean;
  batOutOpen: boolean;
  runAdvOpen: boolean;
  runOutOpen: boolean;
  fielderOpen: boolean;
  deflOpen: boolean;
  playersOpen: boolean;

  // Selection state
  batAdvResult: string | null;
  batAdvBallType: '땅' | '뜬' | '라' | null;
  batAdvHitData: HitData | null;
  batOutType: string | null;
  runAdvResult: string | null;
  runAdvDest: Base | 'HOME' | null;
  runAdvEarned: boolean | 'half';
  runAdvRbi: boolean;
  runAdvPitcher: string;
  runAdvFielder: number | null;
  runOutResult: string | null;
  stkOpen: boolean;
  stkPitchType: PitchType | null;
  selRunnerBase: Base | null;
  fielderSeq: number[];
  fielderTitle: string;
  deflFielder: number | null;
  deflType: string;
  playerSelIdx: number | null;
  playerList: Player[];
  playersTitle: string;

  // Lineup screen
  luSelIdx: number | null;
  benchSelIdx: number | null;
  luTeam: 'away' | 'home';

  // Search
  srchName: string;
  srchNum: string;
}

export interface BaseTargetState {
  active: boolean;
  fromBase: string;
  onSelect: ((dest: string) => void) | null;
}

export interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
  pos: number;
  title: string;
}

export interface GameSetup {
  league: string;
  awayTeam: string;
  homeTeam: string;
  date: string;
  awayLineup: Player[];
  homeLineup: Player[];
  awayBench: Player[];
  homeBench: Player[];
  // Extended game info (GameInfoScreen)
  stadium?: string;
  gameNum?: string;
  doubleHeader?: string;
  startTime?: string;
  endTime?: string;
  attendance?: string;
  umpireHome?: string;
  umpire1B?: string;
  umpire2B?: string;
  umpire3B?: string;
  umpireLeft?: string;
  umpireRight?: string;
  umpireStandby?: string;
  recorder1?: string;
  recorder2?: string;
  temperature?: string;
  humidity?: string;
  windDir?: string;
  windSpeed?: string;
  weatherLog?: string;
}

export type GameAction =
  | { type: 'PITCH'; pitchType: PitchType }
  | { type: 'BAT_ADV'; result: string; ballType?: '땅' | '뜬' | '라'; hitData?: HitData }
  | { type: 'BAT_OUT'; result: string; dp?: boolean; tp?: boolean }
  | { type: 'STRIKEOUT'; result: 'K' | 'KW' | 'KP' | 'KE'; pitchType: PitchType }
  | {
      type: 'RUN_ADV';
      base: Base;
      runner: Runner;
      dest: string;
      earned: boolean | 'half';
      rbi?: boolean;
      scorePitcher?: string;
      steal?: boolean;
      advCode?: string;
    }
  | { type: 'RUN_OUT'; base: Base; result: string }
  | { type: 'NEXT_BATTER' }
  | { type: 'NEXT_INNING' }
  | { type: 'CLEAR_CELL' }
  | { type: 'ADD_OVERFLOW' }
  | { type: 'PLACE_BATTER' }
  | { type: 'UNDO' }
  | { type: 'SEL_CELL'; key: string }
  | { type: 'SUBST'; side: 'away' | 'home'; pos: number; player: Player }
  | { type: 'SUBST_RUNNER'; base: Base; player: Player; side: 'away' | 'home' }
  | { type: 'SUBST_BATTER'; player: Player; side: 'away' | 'home' }
  | { type: 'PITCHER_CHANGE'; side: 'away' | 'home'; player: Player }
  | { type: 'CHANGE_LU_POS'; team: 'away' | 'home'; idx: number; pos: number }
  | { type: 'CHANGE_LU_ORDER'; team: 'away' | 'home'; idx: number; order: number }
  | { type: 'ADD_BENCH_TO_LU'; team: 'away' | 'home'; benchIdx: number; luIdx: number | null }
  | { type: 'DELETE_LU_PLAYER'; team: 'away' | 'home'; idx: number }
  | { type: 'ADD_PITCHER_SLOT'; team: 'away' | 'home' }
  | { type: 'RESTORE_LINEUP' }
  | {
      type: 'SET_LINEUPS';
      awayLineup: Player[];
      homeLineup: Player[];
      awayBench: Player[];
      homeBench: Player[];
    }
  | { type: 'SET_GAME_INFO'; awayTeam: string; homeTeam: string; date: string; league: string }
  | { type: 'INIT_GAME'; setup: GameSetup }
  | { type: 'GAME_EVENT'; eventType: 'mound' | 'batter_timeout' | 'pitcher_leave'; detail?: string }
  | { type: 'CELL_NOTE'; note: string };
