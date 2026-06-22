import { useReducer, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type {
  GameSetup,
  GameState,
  UIState,
  Base,
  BaseTargetState,
  ContextMenuState,
  PitchType,
  Player,
  Runner,
} from '../types';
import { gameReducer, initialGameState } from '../store/gameReducer';
import { POS_NAME } from '../data/constants';
import Scoreboard from '../components/Scoreboard';
import ScoreSheet from '../components/ScoreSheet';
import InputPanel from '../components/InputPanel';
import Diamond from '../components/Diamond';
import PitcherLogPanel from '../components/PitcherLogPanel';
import type { EditRowInfo } from '../components/PitcherLogPanel';
import EditRowModal from '../components/modals/EditRowModal';
import Toast from '../components/Toast';
import ContextMenu from '../components/ContextMenu';
import BatAdvModal from '../components/modals/BatAdvModal';
import BatOutModal from '../components/modals/BatOutModal';
import RunAdvModal from '../components/modals/RunAdvModal';
import StrikeoutModal from '../components/modals/StrikeoutModal';
import RunOutModal from '../components/modals/RunOutModal';
import FielderModal from '../components/modals/FielderModal';
import DeflModal from '../components/modals/DeflModal';
import PlayersModal from '../components/modals/PlayersModal';
import DefenseListModal from '../components/modals/DefenseListModal';
import MoundVisitModal from '../components/modals/MoundVisitModal';
import GameEndModal from '../components/modals/GameEndModal';
import LineupReviewModal from '../components/modals/LineupReviewModal';
import ScoreReviewModal, { type ScoredRunRow } from '../components/modals/ScoreReviewModal';

const initialUI: UIState = {
  batAdvOpen: false,
  batOutOpen: false,
  runAdvOpen: false,
  runOutOpen: false,
  fielderOpen: false,
  deflOpen: false,
  playersOpen: false,
  batAdvResult: null,
  batAdvBallType: null,
  batAdvHitData: null,
  batOutType: null,
  runAdvResult: null,
  runAdvDest: null,
  runAdvEarned: true as boolean | 'half',
  runAdvRbi: false,
  runAdvPitcher: '',
  runAdvFielder: null,
  runOutResult: null,
  stkOpen: false,
  stkPitchType: null,
  selRunnerBase: null,
  fielderSeq: [],
  fielderTitle: '',
  deflFielder: null,
  deflType: '라이나',
  playerSelIdx: null,
  playerList: [],
  playersTitle: '',
  luSelIdx: null,
  benchSelIdx: null,
  luTeam: 'away',
  srchName: '',
  srchNum: '',
};

interface Props {
  setup: GameSetup;
  onEnd: () => void;
}

type FielderEntry = {
  pos: number;
  assist: boolean;
  putout: boolean;
  error: boolean;
  throwDir: string;
  throwHeight: string;
  shift: boolean;
};

function buildFielderStr(seq: FielderEntry[]): string {
  return seq
    .map((f) => f.pos + (f.assist ? '보' : '') + (f.putout ? '자' : '') + (f.error ? 'E' : ''))
    .join('-');
}

function getAdvCode(reason: string, fielderSeq?: FielderEntry[]): string | undefined {
  const fstr = fielderSeq && fielderSeq.length > 0 ? buildFielderStr(fielderSeq) : '';
  // 도루
  if (reason.includes('도루') || reason.includes('스틸')) {
    if (reason === '이중도루') return 'SD';
    if (reason === '(S) 무관심이중도루') return '(SD)';
    return reason.startsWith('(S)') ? '(S)' : 'S';
  }
  // 폭투
  if (reason.includes('폭투')) return reason.startsWith('(W)') ? '(W)' : 'W';
  // 포일
  if (reason.includes('포일')) return reason.startsWith('(P)') ? '(P)' : 'P';
  // 보크
  if (reason.includes('보크')) {
    const parens = reason.includes('(BK)');
    const pitch = reason.startsWith('✓');
    if (pitch && parens) return '✓(BK)';
    if (pitch) return '✓BK';
    return parens ? '(BK)' : 'BK';
  }
  // 실책 (수비수 포함)
  if (reason === 'E 실책') return fstr ? `E${fstr}` : 'E';
  if (reason === '(E) 기록실책') return fstr ? `(E${fstr})` : '(E)';
  // 주루방해
  if (reason === 'ob 주루방해') return fstr ? `OB${fstr}` : 'OB';
  // 다른주자수비 → 수비수 번호
  if (reason === '다른주자수비') return fstr || undefined;
  // 타자의도움 → advCode 없음
  return undefined;
}

export default function GameScreen({ setup, onEnd }: Props) {
  const [G, dispatch] = useReducer(
    gameReducer,
    { setup } as unknown as Parameters<typeof gameReducer>[1],
    (init) => gameReducer(initialGameState, { type: 'INIT_GAME', setup: (init as any).setup })
  );

  const [UI, setUI] = useState<UIState>(initialUI);
  const [showSheet, setShowSheet] = useState(false);
  const [pendingRevertKey, setPendingRevertKey] = useState<string | null>(null);
  // 수비 위치 드래그 상태 — pos swap
  const [posDrag, setPosDrag] = useState<{ team: 'away' | 'home'; idx: number } | null>(null);
  const [posDragOver, setPosDragOver] = useState<{ team: 'away' | 'home'; idx: number } | null>(
    null
  );
  const [gameEndOpen, setGameEndOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('kbo_sheet_state')) {
      localStorage.setItem('kbo_sheet_state', JSON.stringify(G));
    }
  }, [G]);

  // KBO 규칙: 한 번 교체로 빠진 선수는 같은 경기에서 어떤 형태로도 재출전 불가.
  // 교체 기록(substitutions/pitcherChanges)의 oldName/oldNum 을 모아 교체 후보 벤치에서 제외.
  const subbedOutKeys = useMemo(() => {
    const s = new Set<string>();
    G.substitutions.forEach((sub) => {
      if (sub.oldName) s.add(`${sub.oldNum || ''}::${sub.oldName}`);
    });
    G.pitcherChanges.forEach((pc) => {
      if (pc.oldName) s.add(`${pc.oldNum || ''}::${pc.oldName}`);
    });
    return s;
  }, [G.substitutions, G.pitcherChanges]);
  const availableBench = useCallback(
    (bench: Player[]) => bench.filter((p) => !subbedOutKeys.has(`${p.num}::${p.name}`)),
    [subbedOutKeys]
  );

  // 이닝 전환(half/inning 변화) 자동 감지 → 직전 공격 팀(=이번 수비 팀)에 H/R 미확정 선수 있으면 LineupReviewModal 자동 오픈
  // (자책점 모달은 더 이상 자동으로 띄우지 않음 — '다음이닝' 버튼을 누르면 NEXT_INNING 직전에 먼저 띄움)
  const prevHalfInningRef = useRef<{ half: typeof G.half; inning: number }>({
    half: G.half,
    inning: G.inning,
  });
  useEffect(() => {
    const prev = prevHalfInningRef.current;
    const flipped = prev.half !== G.half || prev.inning !== G.inning;
    prevHalfInningRef.current = { half: G.half, inning: G.inning };
    if (!flipped) return;
    // 직전 공격 팀(prev.half) → 이번 수비 팀
    const defendingSide: 'away' | 'home' = prev.half === 'top' ? 'away' : 'home';
    const defendingLU = defendingSide === 'away' ? G.awayLineup : G.homeLineup;
    const pending = defendingLU.some((p) => p.needsPosReview);
    if (pending) setLineupReviewTeam(defendingSide);
  }, [G.half, G.inning, G.awayLineup, G.homeLineup]);

  // 4구/사구 밀어내기 득점 자동 감지 — 셀에 force=true HOME runnerNote 가 새로 추가되면
  // ScoreReviewModal 을 즉시 띄워 자책여부/실점투수 선택하도록 함.
  const seenForceHomeRef = useRef<Set<string>>(
    new Set(
      Object.entries(G.cells)
        .filter(([, c]) => (c.runnerNotes || []).some((n) => n.base === 'HOME' && n.force))
        .map(([k]) => k)
    )
  );
  useEffect(() => {
    let trigger: { inning: number; half: 'top' | 'bottom' } | null = null;
    Object.entries(G.cells).forEach(([k, c]) => {
      const hasForceHome = (c.runnerNotes || []).some((n) => n.base === 'HOME' && n.force);
      if (hasForceHome && !seenForceHomeRef.current.has(k)) {
        seenForceHomeRef.current.add(k);
        trigger = { inning: c.inning, half: c.half };
      } else if (!hasForceHome && seenForceHomeRef.current.has(k)) {
        // REVERT 등으로 force-home 이 사라진 경우 ref 도 정리
        seenForceHomeRef.current.delete(k);
      }
    });
    if (trigger) setScoreReviewTarget(trigger);
  }, [G.cells]);
  const [chainBases, setChainBases] = useState<Set<Base>>(new Set());
  const [chainPendingBase, setChainPendingBase] = useState<Base | null>(null);
  const [chainCausedBy, setChainCausedBy] = useState<number | null>(null);
  const [chainBatterOpen, setChainBatterOpen] = useState(false);
  // destHasRunner 차단 시 저장된 CHAIN_BATTER_SKIP 파라미터
  const [pendingSkipParams, setPendingSkipParams] = useState<{
    toBase: Base | 'HOME';
    earned: boolean | 'half';
    rbi?: boolean;
    scorePitcher?: string;
    advCode?: string;
  } | null>(null);
  const [chainTransit, setChainTransit] = useState<{
    runner: Runner;
    fromBase: Base;
    atBase: Base;
    earned: boolean | 'half';
    rbi?: boolean;
    scorePitcher?: string;
    advCode?: string;
    steal?: boolean;
    causedBy?: number;
    autoComplete?: boolean;
    insertIndex?: number;
    markChain?: boolean;
  } | null>(null);
  const [defListOpen, setDefListOpen] = useState(false);
  const [defListResult] = useState('');
  const [moundOpen, setMoundOpen] = useState(false);
  // 3아웃 상태에서 일반 입력 시도하면 띄우는 알럿 모달
  const [threeOutAlertOpen, setThreeOutAlertOpen] = useState(false);
  // 다음이닝 클릭 시 자책점 검토 진행 중인지 (확정 시 NEXT_INNING dispatch)
  const [pendingNextInning, setPendingNextInning] = useState(false);
  // 이닝 교대 시 H/R로 들어와 포지션 미확정인 선수가 있으면 자동으로 띄우는 라인업 검토 모달
  const [lineupReviewTeam, setLineupReviewTeam] = useState<'away' | 'home' | null>(null);
  // 이닝 득점 검토 모달 — 자동(3아웃 후 inning 전환 감지) 또는 수동 트리거
  const [scoreReviewTarget, setScoreReviewTarget] = useState<{
    inning: number;
    half: 'top' | 'bottom';
  } | null>(null);
  const [editRowInfo, setEditRowInfo] = useState<EditRowInfo | null>(null);
  // BatAdvModal 편집 모드 — PitcherLog 안타 행에서 클릭하면 활성화
  const [batAdvEditMode, setBatAdvEditMode] = useState<{
    cellKey: string;
    lockBases: 0 | 1 | 2 | 3 | 4;
  } | null>(null);

  // PitcherLog 행 편집 — 'hit' 분기는 BatAdvModal 편집 모드로, 나머지는 EditRowModal
  const handleEditRow = useCallback(
    (info: EditRowInfo) => {
      if (info.kind === 'hit') {
        const cell = G.cells[info.cellKey];
        const hd = cell?.hitData;
        const lockBases: 0 | 1 | 2 | 3 | 4 = hd?.bases ?? 1;
        setBatAdvEditMode({ cellKey: info.cellKey, lockBases });
        // BatAdvModal 내부 state 채우기 위해 UI prefill
        setUI((p) => ({
          ...p,
          batAdvOpen: true,
          batAdvResult: null,
          batAdvBallType: hd?.ballType ?? null,
          batAdvHitData: hd ?? null,
        }));
      } else {
        setEditRowInfo(info);
      }
    },
    [G]
  );
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [baseTargets, setBaseTargets] = useState<BaseTargetState>({
    active: false,
    fromBase: '',
    onSelect: null,
  });
  const [ctx, setCtx] = useState<ContextMenuState>({ open: false, x: 0, y: 0, pos: 0, title: '' });

  const fielderCbRef = useRef<(() => void) | null>(null);
  const playerCbRef = useRef<((p: Player) => void) | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2200);
  }, []);

  // ── 로컬 저장/불러오기 (백엔드 없이 브라우저 localStorage 스냅샷) ─────────────
  const handleLocalSave = useCallback(() => {
    try {
      localStorage.setItem('kbo_saved_game', JSON.stringify(G));
      showToast('로컬에 저장했습니다');
    } catch {
      showToast('저장 실패 (저장 공간 부족)');
    }
  }, [G, showToast]);

  const handleLocalLoad = useCallback(() => {
    const raw = localStorage.getItem('kbo_saved_game');
    if (!raw) {
      showToast('저장된 기록이 없습니다');
      return;
    }
    try {
      const state = JSON.parse(raw) as GameState;
      dispatch({ type: 'LOAD_GAME', state });
      showToast('저장된 기록을 불러왔습니다');
    } catch {
      showToast('불러오기 실패 (손상된 데이터)');
    }
  }, [dispatch, showToast]);

  const clearBaseTargets = useCallback(() => {
    setBaseTargets({ active: false, fromBase: '', onSelect: null });
  }, []);

  const handleBaseTargetClick = useCallback(
    (dest: string) => {
      const cb = baseTargets.onSelect;
      clearBaseTargets();
      if (cb) cb(dest);
    },
    [baseTargets, clearBaseTargets]
  );

  // ── Derived state ──────────────────────────────────────────────────────────
  const curLU = G.half === 'top' ? G.awayLineup : G.homeLineup;
  const defLU = G.half === 'top' ? G.homeLineup : G.awayLineup;

  const selRunnerBadge =
    UI.selRunnerBase && G.runners[UI.selRunnerBase]
      ? `[${UI.selRunnerBase}: ${G.runners[UI.selRunnerBase]!.name}]`
      : '';

  // 실점투수 선택용 — 경기에 실제 등판한 투수만 반환 (해당 팀의 선발 + PITCHER_CHANGE 로 들어온 투수 전부)
  const getActivePitchers = useCallback(
    (side: 'away' | 'home'): Player[] => {
      const lu = side === 'away' ? G.awayLineup : G.homeLineup;
      const bench = side === 'away' ? G.awayBench : G.homeBench;
      const allPool = [...lu, ...bench];
      const battingHalfForSide = side === 'away' ? 'bottom' : 'top';
      const seen = new Set<string>();
      const out: Player[] = [];
      const addByKey = (num: string, name: string) => {
        if (!name) return;
        const key = `${num}:${name}`;
        if (seen.has(key)) return;
        seen.add(key);
        const p = allPool.find((x) => x.num === num && x.name === name);
        if (p) out.push(p);
        else out.push({ name, num, pos: 1, order: 0, hitType: 0 });
      };
      // 현재 lineup 의 pos=1 (현재 마운드에 있는 투수)
      const cur = lu.find((p) => p.pos === 1);
      if (cur) addByKey(cur.num, cur.name);
      // PITCHER_CHANGE 이벤트들 — 해당 팀이 수비하는 half 의 변경 기록 (old/new 모두 등판자)
      G.pitcherChanges.forEach((pc) => {
        if (pc.half !== battingHalfForSide) return;
        if (pc.oldName) addByKey(pc.oldNum || '', pc.oldName);
        addByKey(pc.num || '', pc.name);
      });
      return out;
    },
    [G.awayLineup, G.homeLineup, G.awayBench, G.homeBench, G.pitcherChanges]
  );

  // 3아웃 상태에서 일반 입력 차단용 게이트 — 다음이닝/되돌리기/타석지우기/게임종료 외 핸들러는 진입부에서 호출
  const guardThreeOut = useCallback((): boolean => {
    if (G.outs >= 3) {
      setThreeOutAlertOpen(true);
      return false;
    }
    return true;
  }, [G.outs]);

  // ── Pitch ─────────────────────────────────────────────────────────────────
  const handlePitch = useCallback(
    (pitchType: PitchType) => {
      if (!guardThreeOut()) return;
      const cell = G.cells[G.selCellKey];
      if (cell?.result) {
        showToast('이미 결과가 기록된 타석입니다');
        return;
      }

      const willK =
        (pitchType === 'S' || pitchType === 'SW' || pitchType === 'BS') && G.strikes >= 2;
      const willBB = pitchType === 'B' && G.balls >= 3;

      if (willK) {
        setUI((p) => ({ ...p, stkOpen: true, stkPitchType: pitchType }));
        return;
      }

      // FE: open fielder modal to record which fielder committed the foul error
      if (pitchType === 'FE') {
        fielderCbRef.current = () => {
          dispatch({ type: 'PITCH', pitchType: 'FE' });
          setUI((p) => {
            if (p.fielderSeq.length > 0) {
              dispatch({ type: 'CELL_NOTE', note: `E${p.fielderSeq[0]}` });
            }
            return p;
          });
        };
        setUI((p) => ({
          ...p,
          fielderOpen: true,
          fielderTitle: '파울실책 수비수',
          fielderSeq: [],
        }));
        return;
      }

      dispatch({ type: 'PITCH', pitchType });
      void willBB;
    },
    [G, curLU, dispatch, showToast, guardThreeOut]
  );

  // ── Bat Advance ────────────────────────────────────────────────────────────
  const openBatAdv = useCallback(() => {
    if (!guardThreeOut()) return;
    setUI((p) => ({ ...p, batAdvOpen: true, batAdvResult: null, batAdvHitData: null }));
  }, [guardThreeOut]);

  const confirmBatAdv = useCallback(() => {
    if (!UI.batAdvResult && !UI.batAdvHitData) {
      showToast('진루 사유 선택 필요');
      return;
    }
    // 편집 모드 — BAT_ADV 경로 무조건 차단, EDIT_HIT_DATA 로 dispatch (부작용 없음)
    if (batAdvEditMode) {
      const hd = UI.batAdvHitData;
      let editResult: string;
      if (hd) {
        // 안타 계열: bases → H1/H2/H3/HR 로 변환
        editResult =
          hd.hitType === '선행주자아웃' || hd.hitType === '→선행주자아웃'
            ? hd.hitType
            : hd.bases === 1
              ? 'H1'
              : hd.bases === 2
                ? 'H2'
                : hd.bases === 3
                  ? 'H3'
                  : 'HR';
      } else if (UI.batAdvResult) {
        // 비안타 (실책·내야안타·번트 등) — result 그대로
        editResult = UI.batAdvResult;
      } else {
        showToast('결과 선택 필요');
        return;
      }
      dispatch({
        type: 'EDIT_HIT_DATA',
        cellKey: batAdvEditMode.cellKey,
        newHitData: hd ?? undefined,
        newResult: editResult,
        newBallType: UI.batAdvBallType ?? undefined,
      });
      setUI((p) => ({ ...p, batAdvOpen: false, batAdvHitData: null }));
      setBatAdvEditMode(null);
      return;
    }

    const hasRunners = Object.values(G.runners).some(Boolean);
    setUI((p) => ({ ...p, batAdvOpen: false, batAdvHitData: null }));

    if (UI.batAdvHitData) {
      if (hasRunners) setChainCausedBy(G.curBatterOrder);
      dispatch({ type: 'BAT_ADV', result: 'HIT', hitData: UI.batAdvHitData });
      return;
    }

    const result = UI.batAdvResult!;
    if (hasRunners && result !== 'HR' && result !== 'GHR') setChainCausedBy(G.curBatterOrder);
    dispatch({ type: 'BAT_ADV', result, ballType: UI.batAdvBallType ?? undefined });
  }, [
    UI.batAdvResult,
    UI.batAdvHitData,
    UI.batAdvBallType,
    G,
    curLU,
    dispatch,
    showToast,
    batAdvEditMode,
  ]);

  const autoConfirmBatAdv = useCallback(
    (
      result: string,
      ballType?: '땅' | '뜬' | '라',
      hitData?: import('../types').HitData,
      chain = false,
      deflection?: import('../types').DeflectionInfo
    ) => {
      // 편집 모드 — BAT_ADV 경로 무조건 차단, EDIT_HIT_DATA 로 dispatch
      if (batAdvEditMode) {
        let editResult: string;
        if (hitData) {
          editResult =
            hitData.hitType === '선행주자아웃' || hitData.hitType === '→선행주자아웃'
              ? hitData.hitType
              : hitData.bases === 1
                ? 'H1'
                : hitData.bases === 2
                  ? 'H2'
                  : hitData.bases === 3
                    ? 'H3'
                    : 'HR';
        } else {
          editResult = result;
        }
        dispatch({
          type: 'EDIT_HIT_DATA',
          cellKey: batAdvEditMode.cellKey,
          newHitData: hitData,
          newResult: editResult,
          newBallType: ballType,
          newDeflection: deflection ?? null,
        });
        setUI((p) => ({ ...p, batAdvOpen: false, batAdvResult: null, batAdvHitData: null }));
        setBatAdvEditMode(null);
        return;
      }

      setUI((p) => ({ ...p, batAdvOpen: false, batAdvResult: null, batAdvHitData: null }));
      // 주자가 있으면 chainCausedBy 설정 (연결동작 표시용)
      const hasRunners = Object.values(G.runners).some(Boolean);
      if (hasRunners && !chainCausedBy) setChainCausedBy(G.curBatterOrder);
      if (chain && hitData) {
        const destMap: Record<number, Base> = { 1: '1B', 2: '2B', 3: '3B' };
        const dest = destMap[hitData.bases];
        if (dest) {
          const BASES: Base[] = ['1B', '2B', '3B'];
          const destIdx = BASES.indexOf(dest);
          const blocked = destIdx >= 0 && BASES.slice(0, destIdx + 1).some((b) => G.runners[b]);
          // 연결동작 유발 타자 저장 (BAT_ADV 전에 캡처 — 이후 curBatterOrder 증가)
          setChainCausedBy(G.curBatterOrder);
          if (!blocked) {
            // 즉시 chainBases에 추가 → PLACE_BATTER 후 렌더 시 빨간색으로 표시
            setChainBases((prev) => new Set([...prev, dest]));
          } else {
            // 막혀있으면 chain-pending 표시
            setChainPendingBase(dest);
          }
        }
      } else if (chain && !hitData) {
        // 실책/기타 진루(E·FC·#·ob·DP_E·E기록·번트 등) — 1B 기본 + 연결동작 활성화
        const dest: Base = '1B';
        const blocked = !!G.runners['1B'];
        setChainCausedBy(G.curBatterOrder);
        if (!blocked) {
          setChainBases((prev) => new Set([...prev, dest]));
        } else {
          setChainPendingBase(dest);
        }
      }
      if (hitData) {
        dispatch({ type: 'BAT_ADV', result: 'HIT', hitData, deflection });
      } else {
        dispatch({ type: 'BAT_ADV', result, ballType, deflection });
      }
    },
    [G, curLU, dispatch, showToast, batAdvEditMode]
  );

  // ── Bat Out ───────────────────────────────────────────────────────────────
  const openBatOut = useCallback(() => {
    if (!guardThreeOut()) return;
    setUI((p) => ({ ...p, batOutOpen: true, batOutType: null }));
  }, [guardThreeOut]);

  const confirmStrikeout = useCallback(
    (result: string) => {
      if (!UI.stkPitchType) return;
      const pt = UI.stkPitchType;
      setUI((p) => ({ ...p, stkOpen: false, stkPitchType: null }));
      dispatch({ type: 'STRIKEOUT', result, pitchType: pt });
    },
    [UI.stkPitchType, G, curLU, dispatch, showToast]
  );

  const applyBatOutResult = useCallback(
    (
      result: string,
      dp?: boolean,
      tp?: boolean,
      ballType?: '땅' | '뜬' | '라',
      deflection?: import('../types').DeflectionInfo
    ) => {
      // SF 등 아웃 결과 입력 시점에 현재 타자를 chainCausedBy로 갱신 (주자 있을 때)
      const hasRunners = Object.values(G.runners).some(Boolean);
      if (hasRunners) setChainCausedBy(G.curBatterOrder);
      dispatch({ type: 'BAT_OUT', result, dp, tp, ballType, deflection });
      // 수비 리스트는 BatOutModal 내에서 처리
    },
    [G, dispatch, showToast]
  );

  // ── Runner Advance ────────────────────────────────────────────────────────
  const openRunAdv = useCallback(() => {
    if (!guardThreeOut()) return;
    if (!UI.selRunnerBase || !G.runners[UI.selRunnerBase]) {
      showToast('다이아몬드에서 주자를 먼저 클릭하세요');
      return;
    }
    // 다음 루를 기본 목적지로 설정
    const nextBase: Record<string, Base | 'HOME'> = { '1B': '2B', '2B': '3B', '3B': 'HOME' };
    const defaultDest = nextBase[UI.selRunnerBase] || null;
    setUI((p) => ({
      ...p,
      runAdvOpen: true,
      runAdvResult: null,
      runAdvDest: defaultDest,
      runAdvEarned: true as boolean | 'half',
      runAdvFielder: null,
      runAdvRbi: false,
      runAdvPitcher: '',
    }));
  }, [UI.selRunnerBase, G.runners, showToast, guardThreeOut]);

  // ── Chain-pending 타자 클릭 (blocked 상태에서 chain 타자 먼저 전진) ────────
  const handleChainPendingClick = useCallback(() => {
    if (!chainPendingBase) return;
    // chainTransit: 주자가 연결동작으로 이동 중 (pendingBatter 없음)
    if (!G.pendingBatter && !chainTransit) return;
    setChainBatterOpen(true);
    setUI((p) => ({
      ...p,
      runAdvResult: null,
      runAdvDest: null,
      runAdvEarned: true as boolean | 'half',
      runAdvRbi: false,
      runAdvPitcher: '',
    }));
  }, [chainPendingBase, G.pendingBatter, chainTransit]);

  const confirmRunAdvChain = useCallback(
    (
      chain: boolean,
      fielderSeq: FielderEntry[] = [],
      deflection?: import('../types').DeflectionInfo
    ) => {
      if (!UI.runAdvResult || !UI.runAdvDest || !chainPendingBase) return;
      const toBase = UI.runAdvDest;
      const earned = UI.runAdvEarned;
      const rbi = UI.runAdvRbi;
      const scorePitcher = UI.runAdvPitcher;
      setChainBatterOpen(false);
      setChainPendingBase(null);

      if (chainTransit) {
        const { runner } = chainTransit;
        // 목적지에 기존 주자 있으면 → 기존 주자 먼저 이동하도록 대기
        const destHasRunner = toBase !== 'HOME' && !!G.runners[toBase as Base];
        if (destHasRunner) {
          // chainTransit 유지, pendingBase를 toBase로 다시 설정 → 기존 주자 이동 유도
          setChainPendingBase(toBase as Base);
          showToast(`${toBase}에 주자가 있습니다. 먼저 이동하세요`);
          return;
        }
        setChainTransit(null);
        if (chain && toBase !== 'HOME') {
          setChainBases((prev) => new Set([...prev, toBase as Base]));
        }
        const advCode =
          typeof UI.runAdvResult === 'string' ? getAdvCode(UI.runAdvResult, fielderSeq) : undefined;
        // chain 표시는 chainTransit 생성 시 캡처한 markChain (사용자 체크 값) 사용
        const transitChain = chain || chainTransit.markChain;
        dispatch({
          type: 'CHAIN_TRANSIT_ADV',
          runner,
          fromBase: chainTransit.fromBase,
          toBase,
          earned,
          rbi,
          scorePitcher,
          advCode,
          causedBy: chainCausedBy ?? undefined,
          chain: transitChain,
          deflection,
        });
      } else {
        if (!G.pendingBatter) return;
        // 목적지에 기존 주자 있으면 → 파라미터 저장 후 대기
        const batterAdvCode =
          typeof UI.runAdvResult === 'string' ? getAdvCode(UI.runAdvResult, fielderSeq) : undefined;
        const destHasRunner = toBase !== 'HOME' && !!G.runners[toBase as Base];
        if (destHasRunner) {
          setPendingSkipParams({ toBase, earned, rbi, scorePitcher, advCode: batterAdvCode });
          setChainPendingBase(toBase as Base);
          showToast(`${toBase}에 주자가 있습니다. 먼저 이동하세요`);
          return;
        }
        if (chain && toBase !== 'HOME') {
          setChainBases((prev) => new Set([...prev, toBase as Base]));
        }
        setPendingSkipParams(null);
        dispatch({
          type: 'CHAIN_BATTER_SKIP',
          toBase,
          earned,
          rbi,
          scorePitcher,
          advCode: batterAdvCode,
          deflection,
        });
      }
    },
    [UI, chainPendingBase, chainTransit, G.pendingBatter, dispatch, showToast, chainCausedBy]
  );

  const handleRunnerDestClick = useCallback(
    (dest: Base | 'HOME') => {
      if (!UI.selRunnerBase || !G.runners[UI.selRunnerBase]) return;
      setUI((p) => ({
        ...p,
        runAdvOpen: true,
        runAdvDest: dest,
        runAdvResult: null,
        runAdvEarned: true as boolean | 'half',
        runAdvFielder: null,
        runAdvRbi: false,
        runAdvPitcher: '',
      }));
    },
    [UI.selRunnerBase, G.runners]
  );

  const confirmRunAdv = useCallback(
    (
      chain = false,
      fielderSeq: FielderEntry[] = [],
      deflection?: import('../types').DeflectionInfo
    ) => {
      if (!UI.runAdvResult) {
        showToast('진루 사유 선택');
        return;
      }
      if (!UI.runAdvDest) {
        showToast('목적 베이스 선택');
        return;
      }
      if (!UI.selRunnerBase || !G.runners[UI.selRunnerBase]) {
        showToast('주자가 없습니다');
        return;
      }

      const base = UI.selRunnerBase;
      const runner: Runner = { ...G.runners[base]! };
      const dest = UI.runAdvDest;
      const earned = UI.runAdvEarned;
      const rbi = UI.runAdvRbi;
      const scorePitcher = UI.runAdvPitcher;
      const reason = UI.runAdvResult;

      const isSteal =
        typeof reason === 'string' && (reason.includes('도루') || reason.includes('스틸'));
      const advCode = typeof reason === 'string' ? getAdvCode(reason, fielderSeq) : undefined;
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
      const isSelfAdv = isSteal || (advCode ? SELF_ADV_CODES.includes(advCode) : false);
      setUI((p) => ({
        ...p,
        runAdvOpen: false,
        selRunnerBase: null,
        runAdvDest: null,
        runAdvResult: null,
        runAdvFielder: null,
        runAdvRbi: false,
        runAdvPitcher: '',
      }));

      // chainCausedBy가 있으면 자동으로 chain 모드
      const effectiveChain = chain || !!chainCausedBy;

      // chain 연결동작 또는 자력진루(도루/폭투/포일/보크) + 목적 베이스에 기존 주자 있음
      // → auto-push 방지, 기존 주자 이동을 사용자가 수동 선택
      const destHasRunner = dest !== 'HOME' && !!G.runners[dest as Base];
      const triggerCollisionUI = (effectiveChain || isSelfAdv) && destHasRunner;
      if (triggerCollisionUI) {
        // 자력진루는 리드 주자(트레일 주자가 도착할 위치) eventLog가
        // 뒤에 처리될 bumped 주자 기록보다 앞서야 하므로 insertIndex 캡처
        const insertIndex = G.cells[G.selCellKey]?.eventLog?.length ?? 0;
        dispatch({ type: 'REMOVE_RUNNER', base });
        setChainBases((prev) => {
          const n = new Set(prev);
          n.delete(base);
          return n;
        });
        setChainTransit({
          runner,
          fromBase: base,
          atBase: dest as Base,
          earned,
          rbi,
          scorePitcher,
          advCode,
          steal: isSteal || undefined,
          causedBy: chain ? (chainCausedBy ?? undefined) : undefined,
          // 자력진루는 사용자에게 추가 모달 묻지 않고 기존 주자 이동 후 자동 완료
          autoComplete: isSelfAdv && !effectiveChain,
          insertIndex: isSelfAdv && !effectiveChain ? insertIndex : undefined,
          // 시각적 chain 표시는 사용자가 명시적으로 체크한 경우만
          markChain: chain,
        });
        setChainPendingBase(dest as Base);
        showToast(`${runner.name} → ${dest} 대기 (기존 주자 이동 필요)`);
        return;
      }

      // chainBases 업데이트: 이전 base 제거, 새 dest 추가
      // (사용자가 명시적으로 연결동작 체크한 경우에만 — chainCausedBy 자동 적용 X)
      setChainBases((prev) => {
        const next = new Set(prev);
        next.delete(base);
        if (chain && dest !== 'HOME') next.add(dest as Base);
        return next;
      });

      dispatch({
        type: 'RUN_ADV',
        base,
        runner,
        dest,
        earned,
        rbi,
        scorePitcher,
        steal: isSteal || undefined,
        advCode,
        // chain 체크 시에만 chainCausedBy 사용, 아니면 reducer가 현재 타자로 자동 귀속
        causedBy: chain ? (chainCausedBy ?? undefined) : undefined,
        // 작은 화살표는 사용자가 명시적으로 연결동작 체크한 경우에만
        chain,
        deflection,
      });

      if (dest === 'HOME')
        showToast(
          `${runner.name} 득점! (${earned === true ? '자책ER' : earned === 'half' ? '반자책' : '비자책UER'})`
        );
      else showToast(`${runner.name} → ${dest} (${reason})`);
    },
    [UI, G.runners, G.cells, G.selCellKey, dispatch, showToast, chainBases, chainCausedBy]
  );

  // ── Runner Out ────────────────────────────────────────────────────────────
  const openRunOut = useCallback(() => {
    if (!guardThreeOut()) return;
    if (!UI.selRunnerBase || !G.runners[UI.selRunnerBase]) {
      showToast('다이아몬드에서 주자를 먼저 클릭하세요');
      return;
    }
    setUI((p) => ({ ...p, runOutOpen: true, runOutResult: null }));
  }, [UI.selRunnerBase, G.runners, showToast, guardThreeOut]);

  const confirmRunOut = useCallback(
    (fielderSeq: number[], deflection?: import('../types').DeflectionInfo) => {
      if (!UI.runOutResult) {
        showToast('아웃 사유 선택');
        return;
      }
      if (!UI.selRunnerBase || !G.runners[UI.selRunnerBase]) {
        showToast('주자가 없습니다');
        return;
      }
      const r = G.runners[UI.selRunnerBase]!;
      const base = UI.selRunnerBase;
      const seq = fielderSeq.join('-');
      // 결과 코드 생성: 수비 순서가 있으면 조합, 없으면 아웃 유형 약어
      const outCode = (() => {
        const t = UI.runOutResult!;
        if (t === '포스아웃') return seq || '●';
        if (t === 'T 태그아웃') return seq ? seq + 'T' : 'T';
        if (t === 'X 견제사') return seq ? 'X' + seq : 'X';
        if (t === 'CS 도루실패') return seq ? 'CS' + seq + 'T' : 'CS';
        // 터치/공과/기타 — 수비수번호 + 코드 (예: 5B, 3A)
        const code = t.split(' ')[0];
        return seq ? seq + code : code;
      })();
      dispatch({ type: 'RUN_OUT', base, result: outCode, deflection });
      const newOuts = G.outs + 1;
      showToast(`${r.name} 아웃 (${outCode})  ${newOuts}아웃`);
      if (newOuts >= 3)
        showToast(
          `3아웃! ${G.inning}회 ${G.half === 'top' ? '초' : '말'} 종료 — [다음이닝] 버튼 클릭`
        );
      setUI((p) => ({ ...p, runOutOpen: false, selRunnerBase: null }));
    },
    [UI, G, dispatch, showToast]
  );

  // ── Fielder Modal ─────────────────────────────────────────────────────────
  const confirmFielder = useCallback(() => {
    setUI((p) => ({ ...p, fielderOpen: false }));
    if (fielderCbRef.current) fielderCbRef.current();
  }, []);

  // ── Deflection ────────────────────────────────────────────────────────────
  const confirmDefl = useCallback(() => {
    if (!UI.deflFielder) {
      showToast('수비수 선택');
      return;
    }
    setUI((p) => ({ ...p, deflOpen: false }));
    showToast(`디플렉션: ${UI.deflFielder}번(${UI.deflType})`);
  }, [UI, showToast]);

  // ── Substitution ─────────────────────────────────────────────────────────
  const handleFielderClick = useCallback(
    (e: React.MouseEvent, pos: number) => {
      e.stopPropagation();
      const p = defLU.find((x) => x.pos === pos);
      setCtx({
        open: true,
        x: e.clientX,
        y: e.clientY,
        pos,
        title: `${POS_NAME[pos]} ${p?.name || '(없음)'}`,
      });
    },
    [defLU]
  );

  const openSubst = useCallback(
    (pos: number) => {
      const side: 'away' | 'home' = G.half === 'top' ? 'home' : 'away';
      const bench = side === 'home' ? G.homeBench : G.awayBench;
      const mid = G.balls > 0 || G.strikes > 0 ? { balls: G.balls, strikes: G.strikes } : undefined;
      playerCbRef.current = (player: Player) => {
        dispatch({ type: 'SUBST', side, pos, player, mid });
        showToast(`${player.name} 출전 (${POS_NAME[pos]})`);
      };
      setUI((p) => ({
        ...p,
        playersOpen: true,
        playersTitle: `${POS_NAME[pos]} 교체`,
        playerList: availableBench(bench),
        playerSelIdx: null,
      }));
    },
    [G, dispatch, showToast, availableBench]
  );

  const openPitcherChange = useCallback(() => {
    if (!guardThreeOut()) return;
    const side: 'away' | 'home' = G.half === 'top' ? 'home' : 'away';
    const bench = side === 'home' ? G.homeBench : G.awayBench;
    const mid = G.balls > 0 || G.strikes > 0 ? { balls: G.balls, strikes: G.strikes } : undefined;
    playerCbRef.current = (player: Player) => {
      dispatch({ type: 'PITCHER_CHANGE', side, player, mid });
      showToast(`투수 교체: ${player.name}`);
    };
    setUI((p) => ({
      ...p,
      playersOpen: true,
      playersTitle: '투수 교체',
      playerList: availableBench(bench),
      playerSelIdx: null,
    }));
  }, [G, dispatch, showToast, availableBench, guardThreeOut]);

  const confirmPlayerSel = useCallback(() => {
    if (UI.playerSelIdx === null) {
      showToast('선수 선택');
      return;
    }
    const selected = UI.playerList[UI.playerSelIdx];
    // 동명이인 검사 — 선택된 선수가 속한 팀(라인업+벤치) 안에 같은 이름 + 다른 등번호가 있으면 경고
    const teamRosters = [
      [...G.awayLineup, ...G.awayBench],
      [...G.homeLineup, ...G.homeBench],
    ];
    let dupes: (typeof selected)[] = [];
    for (const roster of teamRosters) {
      const inThisTeam = roster.some((p) => p.num === selected.num && p.name === selected.name);
      if (!inThisTeam) continue;
      dupes = roster.filter((p) => p.name === selected.name && p.num !== selected.num);
      break;
    }
    if (dupes.length > 0) {
      const ok = window.confirm(
        `같은 팀에 "${selected.name}" 선수가 있습니다.\n선택하신 (등번호 : ${selected.num}) 선수가 맞습니까?`
      );
      if (!ok) return;
    }
    setUI((p) => ({ ...p, playersOpen: false }));
    if (playerCbRef.current) playerCbRef.current(selected);
  }, [UI, G, showToast]);

  const openRunnerSubst = useCallback(
    (base: import('../types').Base) => {
      const side: 'away' | 'home' = G.half === 'top' ? 'away' : 'home';
      const bench = side === 'home' ? G.homeBench : G.awayBench;
      const mid = G.balls > 0 || G.strikes > 0 ? { balls: G.balls, strikes: G.strikes } : undefined;
      playerCbRef.current = (player: Player) => {
        dispatch({ type: 'SUBST_RUNNER', base, player, side, mid });
        showToast(`대주자: ${player.name} (${base})`);
      };
      setUI((p) => ({
        ...p,
        playersOpen: true,
        playersTitle: `대주자 교체 (${base})`,
        playerList: availableBench(bench),
        playerSelIdx: null,
      }));
    },
    [G, dispatch, showToast, availableBench]
  );

  const openBatterSubst = useCallback(() => {
    const side: 'away' | 'home' = G.half === 'top' ? 'away' : 'home';
    const bench = side === 'home' ? G.homeBench : G.awayBench;
    const mid = G.balls > 0 || G.strikes > 0 ? { balls: G.balls, strikes: G.strikes } : undefined;
    playerCbRef.current = (player: Player) => {
      dispatch({ type: 'SUBST_BATTER', player, side, mid });
      showToast(`대타: ${player.name}`);
    };
    setUI((p) => ({
      ...p,
      playersOpen: true,
      playersTitle: '대타 교체',
      playerList: availableBench(bench),
      playerSelIdx: null,
    }));
  }, [G, dispatch, showToast, availableBench]);

  // ── Runner toggle ─────────────────────────────────────────────────────────
  const toggleRunnerSel = useCallback(
    (base: Base) => {
      // 연결동작 중인 주자: 일반 주자와 동일하게 선택 → 목적지 클릭 → 모달
      if (chainBases.has(base)) {
        setUI((prev) => {
          const next = prev.selRunnerBase === base ? null : base;
          if (next) showToast(`${G.runners[base]?.name || base} 선택됨 — 목적지 루를 클릭하세요`);
          else showToast('주자 선택 취소');
          return { ...prev, selRunnerBase: next };
        });
        return;
      }
      setUI((prev) => {
        const next = prev.selRunnerBase === base ? null : base;
        if (next) {
          const r = G.runners[base];
          showToast(`${r?.name || base} 선택됨 — 진루 또는 아웃 버튼 사용`);
        } else {
          showToast('주자 선택 취소');
        }
        return { ...prev, selRunnerBase: next };
      });
    },
    [chainBases, G.pendingBatter, G.runners, showToast]
  );

  // ── 타자 자동 배치: 1B~dest 사이 주자 없을 때만 배치 ────────────────────
  const prevPendingRef = useRef<typeof G.pendingBatter>(null);

  useEffect(() => {
    if (!G.pendingBatter) {
      prevPendingRef.current = null;
      return;
    }
    const dest = G.pendingBatter.dest;
    const BASES: Base[] = ['1B', '2B', '3B'];
    const destIdx = BASES.indexOf(dest);
    const blocked = destIdx >= 0 && BASES.slice(0, destIdx + 1).some((b) => G.runners[b]);
    if (!blocked && !chainPendingBase) {
      // chainPendingBase가 있으면 auto-place 안 함 (연결동작 진행 중)
      dispatch({ type: 'PLACE_BATTER' });
    } else if (prevPendingRef.current !== G.pendingBatter) {
      if (!chainPendingBase) showToast('주자를 먼저 이동하세요');
    }
    prevPendingRef.current = G.pendingBatter;
  }, [G.pendingBatter, G.runners, chainPendingBase, dispatch, showToast]);

  // pendingSkipParams가 있고 목적지가 비면 자동 dispatch
  useEffect(() => {
    if (!pendingSkipParams || !G.pendingBatter) return;
    const tb = pendingSkipParams.toBase;
    if (tb === 'HOME' || !G.runners[tb as Base]) {
      dispatch({ type: 'CHAIN_BATTER_SKIP', ...pendingSkipParams });
      setPendingSkipParams(null);
      if (chainPendingBase) setChainPendingBase(null);
    }
  }, [pendingSkipParams, G.pendingBatter, G.runners, chainPendingBase, dispatch]);

  // 자력진루(도루/폭투/포일/보크) 충돌: 기존 주자가 비켜나면 자동으로 transit 완료
  useEffect(() => {
    if (!chainTransit || !chainTransit.autoComplete || !chainPendingBase) return;
    if (G.runners[chainPendingBase]) return;
    const tr = chainTransit;
    dispatch({
      type: 'CHAIN_TRANSIT_ADV',
      runner: tr.runner,
      fromBase: tr.fromBase,
      toBase: chainPendingBase,
      earned: tr.earned,
      rbi: tr.rbi,
      scorePitcher: tr.scorePitcher,
      advCode: tr.advCode,
      steal: tr.steal,
      causedBy: tr.causedBy,
      // 자력진루는 연결동작 화살표를 표시하지 않음
      chain: tr.markChain ?? false,
      // pitcherlog 순서 보정: bumped 주자 기록 앞에 삽입
      insertIndex: tr.insertIndex,
    });
    setChainTransit(null);
    setChainPendingBase(null);
    showToast(`${tr.runner.name} → ${chainPendingBase}`);
  }, [chainTransit, chainPendingBase, G.runners, dispatch, showToast]);

  // ── Game flow ─────────────────────────────────────────────────────────────

  const handlePlaceBatter = useCallback(() => {
    if (!guardThreeOut()) return;
    if (!G.pendingBatter) return;
    const dest = G.pendingBatter.dest;
    if (G.runners[dest]) {
      showToast(`${dest}에 주자가 있습니다. 먼저 이동하세요`);
      return;
    }
    dispatch({ type: 'PLACE_BATTER' });
  }, [G.pendingBatter, G.runners, dispatch, showToast, guardThreeOut]);

  const handleNextBatter = useCallback(() => {
    if (!guardThreeOut()) return;
    setChainBases(new Set());
    setChainPendingBase(null);
    setChainCausedBy(null);
    dispatch({ type: 'NEXT_BATTER' });
  }, [dispatch, guardThreeOut]);

  const handleNextInning = useCallback(() => {
    setChainBases(new Set());
    setChainPendingBase(null);
    setChainCausedBy(null);
    // 현재 공수에 득점이 있으면 자책점 검토 모달 먼저 — 모달 확인 시 NEXT_INNING dispatch
    const hasScored = Object.values(G.cells).some(
      (c) => c.scored && c.inning === G.inning && c.half === G.half
    );
    if (hasScored) {
      setScoreReviewTarget({ inning: G.inning, half: G.half });
      setPendingNextInning(true);
      return;
    }
    // 득점 없으면 바로 이닝 교대
    dispatch({ type: 'NEXT_INNING' });
    setUI((p) => ({ ...p, selRunnerBase: null }));
    showToast(
      `${G.half === 'top' ? G.inning : G.inning + 1}회 ${G.half === 'top' ? '말' : '초'} 시작`
    );
  }, [G, dispatch, showToast]);

  const resetChainUI = useCallback(() => {
    setChainBases(new Set());
    setChainPendingBase(null);
    setChainCausedBy(null);
    setChainTransit(null);
    setPendingSkipParams(null);
    setChainBatterOpen(false);
  }, []);

  const handleRevert = useCallback(() => {
    if (!G.history.length) {
      showToast('되돌릴 내용 없음');
      return;
    }
    dispatch({ type: 'REVERT' });
    resetChainUI();
    setUI((p) => ({ ...p, selRunnerBase: null }));
  }, [G.history.length, dispatch, showToast, resetChainUI]);

  const handleClear = useCallback(() => {
    const cell = G.cells[G.selCellKey];
    if (cell?.result) {
      setPendingRevertKey(G.selCellKey);
    } else {
      dispatch({ type: 'CLEAR_CELL' });
      resetChainUI();
    }
  }, [G.cells, G.selCellKey, dispatch, resetChainUI]);

  const handleClearInning = useCallback(() => {
    if (!G.history.length) {
      showToast('되돌릴 내용 없음');
      return;
    }
    setPendingRevertKey(`__inning__${G.inning}`);
  }, [G.inning, G.history.length, showToast]);

  const handleOverflow = useCallback(() => {
    if (!guardThreeOut()) return;
    dispatch({ type: 'ADD_OVERFLOW' });
    showToast(`${G.curBatterOrder}번타자 ${G.inning}회 추가 타석`);
  }, [G, dispatch, showToast, guardThreeOut]);

  const handleEnd = useCallback(() => {
    setGameEndOpen(true);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'SELECT'
      )
        return;
      if (e.key === '1') handlePitch('S');
      else if (e.key === '2') handlePitch('SW');
      else if (e.key === '3') handlePitch('F');
      else if (e.key === '4') handlePitch('B');
      else if (e.key === 'n' || e.key === 'N') handleNextBatter();
      else if (e.key === 'i' || e.key === 'I') handleNextInning();
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleRevert();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlePitch, handleNextBatter, handleNextInning, handleRevert]);

  // ── Lineup helpers for main view ─────────────────────────────────────────
  const awayBatters = G.awayLineup.filter((p) => p.order > 0).sort((a, b) => a.order - b.order);
  const homeBatters = G.homeLineup.filter((p) => p.order > 0).sort((a, b) => a.order - b.order);
  // PITCHER_CHANGE는 lineup을 직접 업데이트하므로 lineup에서 찾는 게 항상 정확
  const defIsHome = G.half === 'top';
  const awayPitcherName = G.awayLineup.find((p) => p.pos === 1)?.name ?? '';
  const homePitcherName = G.homeLineup.find((p) => p.pos === 1)?.name ?? '';

  return (
    <div className="screen active" id="s-game">
      <div className="game-wrap">
        <Scoreboard
          G={G}
          showSheet={showSheet}
          onToggleSheet={() => setShowSheet((s) => !s)}
          onOpenSheetWindow={() => {
            localStorage.setItem('kbo_sheet_state', JSON.stringify(G));
            window.open('?sheet=1', '_blank', 'noopener,noreferrer');
          }}
          onOpenScoreReview={() => setScoreReviewTarget({ inning: G.inning, half: G.half })}
          onLocalSave={handleLocalSave}
          onLocalLoad={handleLocalLoad}
        />

        {showSheet ? (
          <div className="game-body view-sheet">
            <ScoreSheet
              G={G}
              onSelCell={(key) => {
                dispatch({ type: 'SEL_CELL', key });
                const cell = G.cells[key];
                if (cell?.result) setPendingRevertKey(key);
              }}
            />
            <PitcherLogPanel G={G} onEditRow={handleEditRow} />
          </div>
        ) : (
          <div className="game-body view-main">
            {/* 왼쪽: 다이아몬드 + 라인업 */}
            <div className="left-panel">
              <div className="field-wrap">
                <Diamond
                  G={G}
                  selRunnerBase={UI.selRunnerBase}
                  baseTargets={baseTargets}
                  chainBases={chainBases}
                  chainPendingBase={chainPendingBase}
                  chainTransitRunner={chainTransit?.runner}
                  showChainEndButton={!chainTransit?.autoComplete}
                  onRunnerToggle={toggleRunnerSel}
                  onBaseTargetClick={handleBaseTargetClick}
                  onRunnerDestClick={handleRunnerDestClick}
                  onFielderClick={handleFielderClick}
                  onRunnerContextMenu={openRunnerSubst}
                  onBatterContextMenu={openBatterSubst}
                  onBatterRightClick={() => {
                    dispatch({ type: 'TOGGLE_BATTER_SIDE' });
                    showToast('좌·우 전환');
                  }}
                  onChainPendingClick={handleChainPendingClick}
                  onChainEnd={() => {
                    if (chainTransit && chainPendingBase) {
                      if (!G.runners[chainPendingBase]) {
                        // 대기 위치 비어있으면 거기에 배치
                        dispatch({
                          type: 'CHAIN_TRANSIT_ADV',
                          runner: chainTransit.runner,
                          fromBase: chainTransit.atBase,
                          toBase: chainPendingBase,
                          earned: chainTransit.earned ?? true,
                          rbi: chainTransit.rbi,
                          scorePitcher: chainTransit.scorePitcher,
                          causedBy: chainCausedBy ?? undefined,
                        });
                      } else if (!G.runners[chainTransit.fromBase]) {
                        // 대기 위치 차있으면 원래 위치로 복귀
                        dispatch({
                          type: 'CHAIN_TRANSIT_ADV',
                          runner: chainTransit.runner,
                          fromBase: chainTransit.atBase,
                          toBase: chainTransit.fromBase,
                          earned: chainTransit.earned ?? true,
                        });
                      }
                    }
                    if (G.pendingBatter && chainPendingBase && !chainTransit) {
                      const pb = chainPendingBase;
                      if (!G.runners[pb]) {
                        if (pendingSkipParams && pendingSkipParams.toBase === pb) {
                          dispatch({ type: 'CHAIN_BATTER_SKIP', ...pendingSkipParams });
                        } else {
                          dispatch({ type: 'CHAIN_BATTER_SKIP', toBase: pb, earned: true });
                        }
                      }
                    }
                    setPendingSkipParams(null);
                    setChainBases(new Set());
                    setChainPendingBase(null);
                    setChainTransit(null);
                    setChainCausedBy(null);
                  }}
                  onFieldPosSwap={(fromPos, toPos) => {
                    const team: 'away' | 'home' = G.half === 'top' ? 'home' : 'away';
                    const lu = team === 'away' ? G.awayLineup : G.homeLineup;
                    const idx1 = lu.findIndex((p) => p.pos === fromPos);
                    const idx2 = lu.findIndex((p) => p.pos === toPos);
                    if (idx1 < 0 || idx2 < 0) return;
                    dispatch({ type: 'SWAP_FIELD_POS', team, idx1, idx2 });
                  }}
                />
              </div>
              <div className="lineup-section">
                <div className="lineup-teams">
                  <div className="lineup-team-hd">{G.awayTeam || '원정'}</div>
                  <div className="lineup-team-hd">{G.homeTeam || '홈'}</div>
                </div>
                <div className="lineup-scroll">
                  <table className="lineup-tbl">
                    <colgroup>
                      <col className="lu-col-order" />
                      <col className="lu-col-pos" />
                      <col />
                      <col className="lu-col-order" />
                      <col className="lu-col-pos" />
                      <col />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>타순</th>
                        <th>수비</th>
                        <th>선수명</th>
                        <th>타순</th>
                        <th>수비</th>
                        <th>선수명</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(
                        { length: Math.max(awayBatters.length, homeBatters.length) },
                        (_, i) => {
                          const a = awayBatters[i];
                          const h = homeBatters[i];
                          const isCurAway = G.half === 'top' && a?.order === G.curBatterOrder;
                          const isCurHome = G.half === 'bottom' && h?.order === G.curBatterOrder;
                          const rowCls = isCurAway
                            ? 'bat-cur-away'
                            : isCurHome
                              ? 'bat-cur-home'
                              : '';
                          // 라인업 array index 조회 (수비 위치 swap 키)
                          const aLuIdx = a
                            ? G.awayLineup.findIndex((p) => p.order === a.order)
                            : -1;
                          const hLuIdx = h
                            ? G.homeLineup.findIndex((p) => p.order === h.order)
                            : -1;
                          const isPosDragOverA =
                            posDragOver?.team === 'away' && posDragOver?.idx === aLuIdx;
                          const isPosDragOverH =
                            posDragOver?.team === 'home' && posDragOver?.idx === hLuIdx;
                          // 수비 셀 드래그 — pos swap (P/D 제외)
                          const makePosDragProps = (
                            team: 'away' | 'home',
                            player: typeof a,
                            luIdx: number
                          ) => ({
                            draggable: !!player && player.pos > 1,
                            onDragStart: () => player && setPosDrag({ team, idx: luIdx }),
                            onDragOver: (e: React.DragEvent) => {
                              if (posDrag?.team === team && player && player.pos > 1) {
                                e.preventDefault();
                                setPosDragOver({ team, idx: luIdx });
                              }
                            },
                            onDragLeave: () => setPosDragOver(null),
                            onDrop: () => {
                              if (
                                posDrag?.team === team &&
                                player &&
                                player.pos > 1 &&
                                posDrag.idx !== luIdx
                              ) {
                                dispatch({
                                  type: 'SWAP_FIELD_POS',
                                  team,
                                  idx1: posDrag.idx,
                                  idx2: luIdx,
                                });
                              }
                              setPosDrag(null);
                              setPosDragOver(null);
                            },
                            onDragEnd: () => {
                              setPosDrag(null);
                              setPosDragOver(null);
                            },
                          });
                          const aPosDrag = makePosDragProps('away', a, aLuIdx);
                          const hPosDrag = makePosDragProps('home', h, hLuIdx);
                          const aPosBg = isPosDragOverA ? { background: '#fef9c3' } : undefined;
                          const hPosBg = isPosDragOverH ? { background: '#fef9c3' } : undefined;
                          return (
                            <tr key={i} className={rowCls}>
                              <td>{a?.order ?? ''}</td>
                              <td {...aPosDrag} style={aPosBg}>
                                {a ? (a.pos === 0 ? 'D' : String(a.pos)) : ''}
                              </td>
                              <td style={{ textAlign: 'left', paddingLeft: 4 }}>{a?.name ?? ''}</td>
                              <td>{h?.order ?? ''}</td>
                              <td {...hPosDrag} style={hPosBg}>
                                {h ? (h.pos === 0 ? 'D' : String(h.pos)) : ''}
                              </td>
                              <td style={{ textAlign: 'left', paddingLeft: 4 }}>{h?.name ?? ''}</td>
                            </tr>
                          );
                        }
                      )}
                      {(awayPitcherName || homePitcherName) && (
                        <tr className={`bat-pit ${defIsHome ? 'bat-cur-home' : 'bat-cur-away'}`}>
                          <td>P</td>
                          <td>1</td>
                          <td style={{ textAlign: 'left', paddingLeft: 4 }}>{awayPitcherName}</td>
                          <td>P</td>
                          <td>1</td>
                          <td style={{ textAlign: 'left', paddingLeft: 4 }}>{homePitcherName}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 가운데: 입력 패널 */}
            <InputPanel
              G={G}
              selRunnerBadge={selRunnerBadge}
              onPitch={handlePitch}
              onBatAdv={openBatAdv}
              onBatOut={openBatOut}
              onRunAdv={openRunAdv}
              onRunOut={openRunOut}
              onDefl={() => {
                if (!guardThreeOut()) return;
                setUI((p) => ({ ...p, deflOpen: true, deflFielder: null }));
              }}
              onMoundVisit={() => {
                if (!guardThreeOut()) return;
                setMoundOpen(true);
              }}
              onBatterTimeout={() => {
                if (!guardThreeOut()) return;
                dispatch({ type: 'CELL_NOTE', note: 'BT' });
                dispatch({ type: 'GAME_EVENT', eventType: 'batter_timeout' });
              }}
              onPitcherLeave={() => {
                if (!guardThreeOut()) return;
                dispatch({ type: 'CELL_NOTE', note: 'PL' });
                dispatch({ type: 'GAME_EVENT', eventType: 'pitcher_leave' });
              }}
              onPitcherChange={openPitcherChange}
              onNextBatter={handleNextBatter}
              onNextInning={handleNextInning}
              onRevert={handleRevert}
              onClear={handleClear}
              onClearInning={handleClearInning}
              onOverflow={handleOverflow}
              onPlaceBatter={handlePlaceBatter}
              onEnd={handleEnd}
              onToast={showToast}
            />

            {/* 오른쪽: 투구 로그 */}
            <PitcherLogPanel G={G} onEditRow={handleEditRow} />
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {threeOutAlertOpen && (
        <div
          className="ov open"
          onClick={(e) => {
            if (e.target === e.currentTarget) setThreeOutAlertOpen(false);
          }}
        >
          <div
            className="ov-card"
            style={{ minWidth: 320, maxWidth: 420, textAlign: 'center', padding: '20px 24px' }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--red)',
                marginBottom: 6,
              }}
            >
              3아웃입니다
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>
              이닝교대를 누른 후 진행해 주세요.
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn-ok" onClick={() => setThreeOutAlertOpen(false)}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
      <EditRowModal
        info={editRowInfo}
        onClose={() => setEditRowInfo(null)}
        onSavePitch={(cellKey, entryIdx, newPitch) =>
          dispatch({ type: 'EDIT_PITCH', cellKey, entryIdx, newPitch })
        }
        onSaveZone={(cellKey, newZone) => dispatch({ type: 'EDIT_HIT_ZONE', cellKey, newZone })}
        onSaveRunnerReason={(cellKey, entryIdx, newAdvCode) =>
          dispatch({ type: 'EDIT_RUNNER_REASON', cellKey, entryIdx, newAdvCode })
        }
        onSaveBatResultCode={(cellKey, newResult) =>
          dispatch({ type: 'EDIT_BAT_RESULT_CODE', cellKey, newResult })
        }
        onSaveBatOutCode={(cellKey, newResult, newBallType) =>
          dispatch({ type: 'EDIT_BAT_OUT_CODE', cellKey, newResult, newBallType })
        }
        onSavePitchSeq={(cellKey, pitches) =>
          dispatch({ type: 'EDIT_PITCH_SEQ', cellKey, pitches })
        }
      />
      <BatAdvModal
        open={UI.batAdvOpen}
        selected={UI.batAdvResult}
        onSelect={(v, bt) =>
          setUI((p) => ({ ...p, batAdvResult: v, batAdvBallType: bt ?? null, batAdvHitData: null }))
        }
        onConfirm={confirmBatAdv}
        onAutoConfirm={autoConfirmBatAdv}
        onClose={() => {
          setUI((p) => ({ ...p, batAdvOpen: false, batAdvHitData: null }));
          setBatAdvEditMode(null);
        }}
        selectedHit={UI.batAdvHitData}
        onSelectHit={(d) => setUI((p) => ({ ...p, batAdvHitData: d, batAdvResult: null }))}
        defLU={defLU}
        editMode={!!batAdvEditMode}
        editLockBases={batAdvEditMode?.lockBases}
      />

      <BatOutModal
        open={UI.batOutOpen}
        defLU={defLU}
        onResult={(result, dp, tp, ballType, deflection) => {
          setUI((p) => ({ ...p, batOutOpen: false }));
          applyBatOutResult(result, dp, tp, ballType, deflection);
        }}
        onClose={() => setUI((p) => ({ ...p, batOutOpen: false }))}
      />

      <DefenseListModal
        open={defListOpen}
        result={defListResult}
        defLU={defLU}
        onClose={() => setDefListOpen(false)}
      />

      <GameEndModal
        open={gameEndOpen}
        G={G}
        onConfirm={(decisions) => {
          dispatch({ type: 'SET_GAME_DECISIONS', decisions });
          setGameEndOpen(false);
          setTimeout(onEnd, 300);
        }}
        onClose={() => setGameEndOpen(false)}
      />

      {pendingRevertKey &&
        (() => {
          const isInning = pendingRevertKey.startsWith('__inning__');
          const inningNum = isInning ? Number(pendingRevertKey.replace('__inning__', '')) : null;
          const msg = isInning
            ? `${inningNum}회 이닝 전체가 삭제됩니다. 계속하시겠습니까?`
            : '이 타석 이후의 모든 기록이 삭제됩니다. 계속하시겠습니까?';
          const title = isInning ? '이닝 삭제' : '타석 삭제';
          const onConfirm = () => {
            if (isInning && inningNum !== null) {
              dispatch({ type: 'DELETE_INNING', inning: inningNum });
            } else {
              dispatch({ type: 'REVERT_TO', cellKey: pendingRevertKey });
            }
            resetChainUI();
            setPendingRevertKey(null);
          };
          return (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000,
              }}
              onClick={() => setPendingRevertKey(null)}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: 8,
                  padding: '20px 24px',
                  maxWidth: 340,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#374151', marginBottom: 16 }}>{msg}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setPendingRevertKey(null)}
                    style={{
                      padding: '6px 16px',
                      fontSize: 13,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    취소
                  </button>
                  <button
                    onClick={onConfirm}
                    style={{
                      padding: '6px 16px',
                      fontSize: 13,
                      border: '1px solid #dc2626',
                      background: '#dc2626',
                      color: '#fff',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      <MoundVisitModal
        open={moundOpen}
        onConfirm={(visitor) => {
          setMoundOpen(false);

          dispatch({
            type: 'CELL_NOTE',
            note: visitor === '코칭스태프' ? 'M_R' : visitor === '포수 덕아웃' ? 'M_BD' : 'M_B',
          });

          dispatch({
            type: 'GAME_EVENT',
            eventType: 'mound',
            detail: visitor,
          });

          showToast(`마운드 방문: ${visitor}`);
        }}
        onClose={() => setMoundOpen(false)}
      />

      <LineupReviewModal
        open={lineupReviewTeam !== null}
        teamName={
          lineupReviewTeam === 'away'
            ? G.awayTeam || '원정'
            : lineupReviewTeam === 'home'
              ? G.homeTeam || '홈'
              : ''
        }
        lineup={lineupReviewTeam === 'away' ? G.awayLineup : G.homeLineup}
        onChangePos={(idx, pos) => {
          if (!lineupReviewTeam) return;
          dispatch({ type: 'CHANGE_LU_POS', team: lineupReviewTeam, idx, pos });
        }}
        onClose={() => setLineupReviewTeam(null)}
      />

      {scoreReviewTarget &&
        (() => {
          const { inning, half } = scoreReviewTarget;
          // 해당 이닝/half에서 득점한 셀들 → ScoredRunRow 변환
          const offenseLU = half === 'top' ? G.awayLineup : G.homeLineup;
          const findName = (order?: number) => {
            if (!order) return '';
            const p = offenseLU.find((x) => x.order === order);
            return p?.name || '';
          };
          const rows: ScoredRunRow[] = Object.values(G.cells)
            .filter((c) => c.scored && c.inning === inning && c.half === half)
            .map((c) => {
              const homeNote = (c.runnerNotes || []).find((n) => n.base === 'HOME');
              const causedBy = homeNote?.causedBy;
              return {
                cellKey: `${c.half}-${c.inning}-${c.order}-${c.appearance}`,
                runnerName: findName(c.order),
                runnerOrder: c.order,
                causedByName: causedBy ? findName(causedBy) : '',
                causedByOrder: causedBy,
                earned: c.earned ?? false,
                scorePitcher: c.scorePitcher || '',
              };
            });
          // 해당 half에서 실제 등판한 투수만 (수비 팀)
          const defendingSideForRow: 'away' | 'home' = half === 'top' ? 'home' : 'away';
          const pitcherList = getActivePitchers(defendingSideForRow);
          return (
            <ScoreReviewModal
              open={true}
              inning={inning}
              half={half}
              rows={rows}
              pitcherList={pitcherList}
              onSave={(edits) => {
                edits.forEach((e) => {
                  dispatch({
                    type: 'EDIT_SCORED_RUN',
                    cellKey: e.cellKey,
                    newEarned: e.newEarned,
                    newScorePitcher: e.newScorePitcher,
                  });
                });
                if (edits.length > 0) showToast(`${edits.length}건 변경 적용됨`);
                const wasPending = pendingNextInning;
                setScoreReviewTarget(null);
                setPendingNextInning(false);
                // '다음이닝' 클릭에서 시작된 모달이면 확인 시 실제로 이닝 교대
                if (wasPending) {
                  dispatch({ type: 'NEXT_INNING' });
                  setUI((p) => ({ ...p, selRunnerBase: null }));
                  showToast(
                    `${G.half === 'top' ? G.inning : G.inning + 1}회 ${
                      G.half === 'top' ? '말' : '초'
                    } 시작`
                  );
                }
              }}
              onClose={() => {
                setScoreReviewTarget(null);
                setPendingNextInning(false); // 취소 시 이닝 교대 안 함
              }}
            />
          );
        })()}

      <StrikeoutModal
        open={UI.stkOpen}
        pitchType={UI.stkPitchType}
        defLU={defLU}
        onConfirm={confirmStrikeout}
        onClose={() => setUI((p) => ({ ...p, stkOpen: false, stkPitchType: null }))}
      />

      <RunAdvModal
        open={UI.runAdvOpen}
        runnerBase={UI.selRunnerBase}
        runnerName={UI.selRunnerBase ? G.runners[UI.selRunnerBase]?.name || '' : ''}
        selectedReason={UI.runAdvResult}
        selectedDest={UI.runAdvDest}
        earned={UI.runAdvEarned}
        rbi={UI.runAdvRbi}
        pitcher={UI.runAdvPitcher}
        pitcherList={getActivePitchers(G.half === 'top' ? 'home' : 'away')}
        defLU={defLU}
        inDpPlay={Object.values(G.cells).some(
          (c) =>
            c.half === G.half &&
            c.inning === G.inning &&
            (c.isDoublePlay || c.isTriplePlay) &&
            c.order === (G.curBatterOrder === 1 ? 9 : G.curBatterOrder - 1)
        )}
        onSelectReason={(v) => setUI((p) => ({ ...p, runAdvResult: v }))}
        onSelectDest={(d) => setUI((p) => ({ ...p, runAdvDest: d }))}
        onSetEarned={(v) => setUI((p) => ({ ...p, runAdvEarned: v }))}
        onSetRbi={(v) => setUI((p) => ({ ...p, runAdvRbi: v }))}
        onSetPitcher={(v) => setUI((p) => ({ ...p, runAdvPitcher: v }))}
        onConfirm={confirmRunAdv}
        onClose={() =>
          setUI((p) => ({
            ...p,
            runAdvOpen: false,
            runAdvDest: null,
            runAdvFielder: null,
            runAdvRbi: false,
            runAdvPitcher: '',
          }))
        }
      />

      {/* Chain 타자 전진 모달 (blocked 상태에서 chain 타자가 dest를 건너뛸 때) */}
      <RunAdvModal
        open={chainBatterOpen}
        runnerBase={chainPendingBase}
        runnerName={chainTransit?.runner.name || G.pendingBatter?.runner.name || ''}
        selectedReason={UI.runAdvResult}
        selectedDest={UI.runAdvDest}
        earned={UI.runAdvEarned}
        rbi={UI.runAdvRbi}
        pitcher={UI.runAdvPitcher}
        pitcherList={getActivePitchers(G.half === 'top' ? 'home' : 'away')}
        defLU={defLU}
        onSelectReason={(v) => setUI((p) => ({ ...p, runAdvResult: v }))}
        onSelectDest={(d) => setUI((p) => ({ ...p, runAdvDest: d }))}
        onSetEarned={(v) => setUI((p) => ({ ...p, runAdvEarned: v }))}
        onSetRbi={(v) => setUI((p) => ({ ...p, runAdvRbi: v }))}
        onSetPitcher={(v) => setUI((p) => ({ ...p, runAdvPitcher: v }))}
        onConfirm={confirmRunAdvChain}
        onClose={() => setChainBatterOpen(false)}
      />

      <RunOutModal
        open={UI.runOutOpen}
        runnerBase={UI.selRunnerBase}
        runnerName={UI.selRunnerBase ? G.runners[UI.selRunnerBase]?.name || '' : ''}
        defLU={defLU}
        selected={UI.runOutResult}
        onSelect={(v) => setUI((p) => ({ ...p, runOutResult: v }))}
        onConfirm={confirmRunOut}
        onClose={() => setUI((p) => ({ ...p, runOutOpen: false }))}
      />

      <FielderModal
        open={UI.fielderOpen}
        title={UI.fielderTitle}
        fielderSeq={UI.fielderSeq}
        defLU={defLU}
        onAdd={(pos) => setUI((p) => ({ ...p, fielderSeq: [...p.fielderSeq, pos] }))}
        onClear={() => setUI((p) => ({ ...p, fielderSeq: [] }))}
        onConfirm={confirmFielder}
        onClose={() => setUI((p) => ({ ...p, fielderOpen: false }))}
      />

      <DeflModal
        open={UI.deflOpen}
        deflFielder={UI.deflFielder}
        deflType={UI.deflType}
        defLU={defLU}
        onSelFielder={(pos) => setUI((p) => ({ ...p, deflFielder: pos }))}
        onSelType={(t) => setUI((p) => ({ ...p, deflType: t }))}
        onConfirm={confirmDefl}
        onClose={() => setUI((p) => ({ ...p, deflOpen: false }))}
      />

      <PlayersModal
        open={UI.playersOpen}
        title={UI.playersTitle}
        playerList={UI.playerList}
        selectedIdx={UI.playerSelIdx}
        onSelect={(i) => setUI((p) => ({ ...p, playerSelIdx: i }))}
        onConfirm={confirmPlayerSel}
        onClose={() => setUI((p) => ({ ...p, playersOpen: false }))}
      />

      <ContextMenu
        ctx={ctx}
        hasFielder={true}
        onClose={() => setCtx((c) => ({ ...c, open: false }))}
        onSubst={openSubst}
        onPitcherChange={openPitcherChange}
      />

      <Toast message={toastMsg} visible={toastVisible} />
    </div>
  );
}
