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
  // 대타/대주자로 들어와 다음 수비 시점에 포지션 재배치가 필요한 상태
  // (이닝 교대 시 알람 + 라인업 행 강조용. CHANGE_LU_POS로 해제)
  needsPosReview?: boolean;
}

export interface PinchInfo {
  num: string;
  name: string;
  mid?: { balls: number; strikes: number };
}

export interface Runner {
  name: string;
  num: string;
  order: number;
  half: Half;
  inning: number;
  pinchRunner?: PinchInfo; // 이 주자가 대주자라면 원래 주자 정보
}

export interface RunnerNote {
  causedBy?: number;
  base: Base | 'HOME';
  rbi?: boolean;
  steal?: boolean; // 도루에 의한 진루 (통계용)
  advCode?: string; // 진루 사유 코드 표시 — S/(S)/W/(W)/P/(P)/BK/(BK)/✓BK/✓(BK)
  force?: boolean; // 볼넷/사구 강제진루 (연결동작 화살표 표시 안 함)
  chain?: boolean; // 연결동작에 의한 진루 (화살표 표시용)
}

export interface HitData {
  zone: number; // 1-9 fielder zone
  hitType?: string; // 'INT' | 'BUNT' | 'OBUNT' | '1B' | '2B' | '3B' | 'HR' | ...
  dirRow: number; // 0-2 (0=deep/top, 1=mid, 2=near/bottom of 3x3 grid)
  dirCol: number; // 0-2 (0=left, 1=center, 2=right)
  ballType: '땅' | '뜬' | '라';
  bases: 0 | 1 | 2 | 3 | 4; // 0=out, 1=single, 2=double, 3=triple, 4=HR
  dist?: number; // 홈런 비거리 (HR)
  hrTime?: number; // 홈런 시각 (epoch ms, BatAdvModal에서 입력)
}

// 디플렉션 정보 — 셀 좌측에 작은 수비수번호 + 땅/뜬/라 표시
// (수비수 1명 + 타구유형 1개. 번트인 경우 ballType='땅'으로 저장)
export interface DeflectionInfo {
  pos: number; // 1-9
  ballType: '땅' | '뜬' | '라';
}

export interface CellData {
  half: Half;
  inning: number;
  order: number;
  appearance: number;
  paSeq?: number; // PA 발생 순 (chronological, 셀 생성 시 할당)
  cellOutNum?: number; // 타자가 아웃당한 시점의 chronological 아웃 번호 (1·2·3)
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
  chainSkip?: Base; // 연결동작 2베이스 이상 이동 시 최초 건너뛴 베이스 ('2B' | '3B')
  defFielders?: number[]; // 수비수 번호 내부 기록 — FC/INT/Ob 등 result에 직접 안 붙는 경우
  isDPRunner?: boolean; // 병살/삼중살에서 아웃된 주자 셀 (outMap pre-population 구분용)
  sideNotes?: string[]; // 마운드방문/타자타임/투수판이탈 등 투구 영역에 표시
  hitData?: HitData; // 구조화된 타구 데이터
  deflection?: DeflectionInfo; // 디플렉션 — 셀 좌측 작은 번호 표시
  eventLog?: CellEventEntry[]; // 투구·이벤트 FIFO 순서 기록
  timestamp?: number; // 결과 기록 시점 (ms epoch) — 홈런 등 시각 표시용
  pinchHitter?: PinchInfo; // 이 셀의 타자가 대타로 들어왔다면 (전임 타자 정보 — 전임에 표기)
  cycleStart?: boolean; // 타자일순 시작 셀 (overflow appearance>0의 첫 셀)
  bbChargedTo?: string; // BB 책임 투수 (PA 도중 교체 시 전임 투수)
  pinchRunnerMark?: { base: Base; pinchName: string; mid?: { balls: number; strikes: number } };
  batterSide?: 'L' | 'R'; // 스위치 타자 좌/우 선택 (hitType=3 인 경우만 의미. 미지정이면 hitType 기본값)
}

// 투구와 이벤트(마운드방문 등)의 순서를 보존하는 엔트리
export type CellEventEntry =
  | { kind: 'pitch'; pitch: PitchType }
  | { kind: 'note'; note: string }
  | { kind: 'runner_steal'; runnerName: string; dest: string; double?: boolean; advCode?: string }
  | { kind: 'runner_cs'; runnerName: string; runOut: string; base: string }
  | { kind: 'result'; result: string }
  | { kind: 'runner_adv'; runnerName: string; dest: string; advCode?: string; rbi?: boolean };

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
  num?: string;
  oldName?: string;
  oldNum?: string;
  mid?: { balls: number; strikes: number }; // 교체 시점 볼카운트 (PA 도중 교체)
  // PA 도중 교체 후 BB 발생 시 전임 투수 책임 — 첫 BAT_ADV(BB)에서 소비됨
  pendingBBChargeTo?: string; // 전임 투수 이름
}

export interface SubstitutionLog {
  inning: number;
  half: Half;
  side: 'away' | 'home';
  kind: 'H' | 'R' | 'D'; // H=대타, R=대주자, D=수비교대
  pos: number; // 새 포지션 (H/R는 0 또는 미사용)
  newName: string;
  newNum: string;
  oldName: string;
  oldNum: string;
  order?: number; // 새 선수의 배팅 라인업 순서 (이 행이 어느 타순 칸에 표시될지 결정)
  atOrder?: number; // 교체 발생 시점에 타석에 있던 타자의 타순 (X,Y) 표기용
  base?: Base; // R인 경우 기용된 루
  mid?: { balls: number; strikes: number }; // 볼카운트 도중 교체 시점
}

export interface PitcherStats {
  pitchCount: number;
  pitchBalls: number;
  pitchStrikes: number;
}

// 경기 종료 시 양팀 투수 판정 — 값은 투수명 (pitcherChanges.name / 선발투수명과 매칭)
export interface TeamDecisions {
  win?: string;
  loss?: string;
  save?: string;
  holds: string[];
  bs: string[];
}

export interface GameDecisions {
  away: TeamDecisions;
  home: TeamDecisions;
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
  substitutions: SubstitutionLog[];
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
  // 경기 종료 시 산정된 양팀 투수 판정 (W/L/S/H/BS). 종료 모달 확인 시 set.
  gameDecisions?: GameDecisions;
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
  | { type: 'TOGGLE_BATTER_SIDE' } // 스위치 타자 좌/우 토글 (현재 selCellKey 셀에 batterSide set)
  | {
      type: 'BAT_ADV';
      result: string;
      ballType?: '땅' | '뜬' | '라';
      hitData?: HitData;
      deflection?: DeflectionInfo;
    }
  | {
      type: 'BAT_OUT';
      result: string;
      dp?: boolean;
      tp?: boolean;
      ballType?: '땅' | '뜬' | '라';
      deflection?: DeflectionInfo;
    }
  | { type: 'STRIKEOUT'; result: string; pitchType: PitchType }
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
      causedBy?: number;
      chain?: boolean;
      deflection?: DeflectionInfo;
    }
  | { type: 'RUN_OUT'; base: Base; result: string; deflection?: DeflectionInfo }
  | { type: 'NEXT_BATTER' }
  | { type: 'NEXT_INNING' }
  | { type: 'CLEAR_CELL' }
  | { type: 'ADD_OVERFLOW' }
  | { type: 'PLACE_BATTER' }
  | {
      type: 'CHAIN_BATTER_SKIP';
      toBase: Base | 'HOME';
      earned: boolean | 'half';
      rbi?: boolean;
      scorePitcher?: string;
      advCode?: string;
      deflection?: DeflectionInfo;
    }
  | { type: 'REMOVE_RUNNER'; base: Base }
  | {
      type: 'CHAIN_TRANSIT_ADV';
      runner: Runner;
      fromBase: Base;
      toBase: Base | 'HOME';
      earned: boolean | 'half';
      rbi?: boolean;
      scorePitcher?: string;
      advCode?: string;
      causedBy?: number;
      steal?: boolean;
      chain?: boolean;
      insertIndex?: number;
      deflection?: DeflectionInfo;
    }
  | { type: 'UNDO' }
  | { type: 'SEL_CELL'; key: string }
  | {
      type: 'SUBST';
      side: 'away' | 'home';
      pos: number;
      player: Player;
      mid?: { balls: number; strikes: number };
    }
  | {
      type: 'SUBST_RUNNER';
      base: Base;
      player: Player;
      side: 'away' | 'home';
      mid?: { balls: number; strikes: number };
    }
  | {
      type: 'SUBST_BATTER';
      player: Player;
      side: 'away' | 'home';
      mid?: { balls: number; strikes: number };
    }
  | {
      type: 'PITCHER_CHANGE';
      side: 'away' | 'home';
      player: Player;
      mid?: { balls: number; strikes: number };
    }
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
  | { type: 'CELL_NOTE'; note: string }
  | { type: 'EDIT_PITCH'; cellKey: string; entryIdx: number; newPitch: PitchType }
  | { type: 'EDIT_HIT_ZONE'; cellKey: string; newZone: number }
  | {
      type: 'EDIT_HIT_DATA';
      cellKey: string;
      newHitData?: HitData;
      newResult: string;
      newBallType?: '땅' | '뜬' | '라';
      newDeflection?: DeflectionInfo | null; // null = 제거, undefined = 유지
    }
  | { type: 'EDIT_RUNNER_REASON'; cellKey: string; entryIdx: number; newAdvCode: string }
  | { type: 'EDIT_BAT_RESULT_CODE'; cellKey: string; newResult: string }
  | {
      type: 'EDIT_BAT_OUT_CODE';
      cellKey: string;
      newResult: string;
      newBallType?: '땅' | '뜬' | '라';
    }
  | {
      type: 'EDIT_SCORED_RUN';
      cellKey: string;
      newEarned: boolean | 'half';
      newScorePitcher?: string;
    }
  | { type: 'SET_GAME_DECISIONS'; decisions: GameDecisions };
