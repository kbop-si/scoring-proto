import { useReducer, useState, useCallback, useEffect, useRef } from 'react';
import type {
  GameSetup,
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
  deflection: boolean;
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

  useEffect(() => {
    if (localStorage.getItem('kbo_sheet_state')) {
      localStorage.setItem('kbo_sheet_state', JSON.stringify(G));
    }
  }, [G]);
  const [chainBases, setChainBases] = useState<Set<Base>>(new Set());
  const [chainPendingBase, setChainPendingBase] = useState<Base | null>(null);
  const [chainBatterOpen, setChainBatterOpen] = useState(false);
  const [chainTransit, setChainTransit] = useState<{
    runner: Runner;
    fromBase: Base;
    atBase: Base;
    earned: boolean | 'half';
    rbi?: boolean;
    scorePitcher?: string;
  } | null>(null);
  const [defListOpen, setDefListOpen] = useState(false);
  const [defListResult] = useState('');
  const [moundOpen, setMoundOpen] = useState(false);
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

  // ── Pitch ─────────────────────────────────────────────────────────────────
  const handlePitch = useCallback(
    (pitchType: PitchType) => {
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

      if (willBB) {
        const bat = curLU[G.curBatterOrder - 1];
        showToast(`볼넷 B  ${bat?.name || ''} 1루`);
      }
    },
    [G, curLU, dispatch, showToast]
  );

  // ── Bat Advance ────────────────────────────────────────────────────────────
  const openBatAdv = useCallback(() => {
    setUI((p) => ({ ...p, batAdvOpen: true, batAdvResult: null, batAdvHitData: null }));
  }, []);

  const confirmBatAdv = useCallback(() => {
    if (!UI.batAdvResult && !UI.batAdvHitData) {
      showToast('진루 사유 선택 필요');
      return;
    }
    setUI((p) => ({ ...p, batAdvOpen: false, batAdvHitData: null }));

    if (UI.batAdvHitData) {
      dispatch({ type: 'BAT_ADV', result: 'HIT', hitData: UI.batAdvHitData });
      const names = ['', '1루타', '2루타', '3루타', '홈런'];
      const bat = curLU[G.curBatterOrder - 1];
      showToast(`${bat?.name || '타자'} ${names[UI.batAdvHitData.bases]}`);
      return;
    }

    const result = UI.batAdvResult!;
    dispatch({ type: 'BAT_ADV', result, ballType: UI.batAdvBallType ?? undefined });

    if (result === 'HR' || result === 'GHR') {
      const bat = curLU[G.curBatterOrder - 1];
      showToast(`${bat?.name || '타자'} 홈런!`);
    } else if (!Object.values(G.runners).some(Boolean)) {
      const bat = curLU[G.curBatterOrder - 1];
      showToast(`${bat?.name || '타자'} → ${result}`);
    }
  }, [UI.batAdvResult, UI.batAdvHitData, UI.batAdvBallType, G, curLU, dispatch, showToast]);

  const autoConfirmBatAdv = useCallback(
    (
      result: string,
      ballType?: '땅' | '뜬' | '라',
      hitData?: import('../types').HitData,
      chain = false
    ) => {
      setUI((p) => ({ ...p, batAdvOpen: false, batAdvResult: null, batAdvHitData: null }));
      if (chain && hitData) {
        const destMap: Record<number, Base> = { 1: '1B', 2: '2B', 3: '3B' };
        const dest = destMap[hitData.bases];
        if (dest) {
          const BASES: Base[] = ['1B', '2B', '3B'];
          const destIdx = BASES.indexOf(dest);
          const blocked = destIdx >= 0 && BASES.slice(0, destIdx + 1).some((b) => G.runners[b]);
          if (!blocked) {
            // 즉시 chainBases에 추가 → PLACE_BATTER 후 렌더 시 빨간색으로 표시
            setChainBases((prev) => new Set([...prev, dest]));
          } else {
            // 막혀있으면 chain-pending 표시
            setChainPendingBase(dest);
          }
        }
      }
      if (hitData) {
        dispatch({ type: 'BAT_ADV', result: 'HIT', hitData });
        const names = ['', '1루타', '2루타', '3루타', '홈런'];
        const bat = curLU[G.curBatterOrder - 1];
        showToast(`${bat?.name || '타자'} ${names[hitData.bases]}`);
      } else {
        dispatch({ type: 'BAT_ADV', result, ballType });
        if (result === 'HR' || result === 'GHR') {
          const bat = curLU[G.curBatterOrder - 1];
          showToast(`${bat?.name || '타자'} 홈런!`);
        } else if (!Object.values(G.runners).some(Boolean)) {
          const bat = curLU[G.curBatterOrder - 1];
          showToast(`${bat?.name || '타자'} → ${result}`);
        }
      }
    },
    [G, curLU, dispatch, showToast]
  );

  // ── Bat Out ───────────────────────────────────────────────────────────────
  const openBatOut = useCallback(() => {
    setUI((p) => ({ ...p, batOutOpen: true, batOutType: null }));
  }, []);

  const confirmStrikeout = useCallback(
    (result: string) => {
      if (!UI.stkPitchType) return;
      const pt = UI.stkPitchType;
      setUI((p) => ({ ...p, stkOpen: false, stkPitchType: null }));
      const safeResult = result as 'K' | 'KW' | 'KP' | 'KE';
      dispatch({ type: 'STRIKEOUT', result: safeResult, pitchType: pt });
      if (result === 'K') {
        const newOuts = G.outs + 1;
        showToast(`삼진! K  ${newOuts}아웃`);
        if (newOuts >= 3)
          showToast(
            `3아웃! ${G.inning}회 ${G.half === 'top' ? '초' : '말'} 종료 — [다음이닝] 버튼 클릭`
          );
      } else {
        const bat = curLU[G.curBatterOrder - 1];
        const msg: Record<string, string> = {
          KW: '폭투 낫아웃',
          KP: '포일 낫아웃',
          KE: '실책 낫아웃',
        };
        showToast(`${bat?.name || '타자'} ${msg[result] || result} 1루`);
      }
    },
    [UI.stkPitchType, G, curLU, dispatch, showToast]
  );

  const applyBatOutResult = useCallback(
    (result: string, dp?: boolean, tp?: boolean) => {
      dispatch({ type: 'BAT_OUT', result, dp, tp });
      const newOuts = G.outs + 1 + (dp ? 1 : tp ? 2 : 0);
      showToast(`아웃 (${result})  ${Math.min(newOuts, 3)}아웃`);
      if (newOuts >= 3)
        showToast(
          `3아웃! ${G.inning}회 ${G.half === 'top' ? '초' : '말'} 종료 — [다음이닝] 버튼 클릭`
        );
      // 수비 리스트는 BatOutModal 내에서 처리
    },
    [G, dispatch, showToast]
  );

  // ── Runner Advance ────────────────────────────────────────────────────────
  const openRunAdv = useCallback(() => {
    if (!UI.selRunnerBase || !G.runners[UI.selRunnerBase]) {
      showToast('다이아몬드에서 주자를 먼저 클릭하세요');
      return;
    }
    setUI((p) => ({
      ...p,
      runAdvOpen: true,
      runAdvResult: null,
      runAdvDest: null,
      runAdvEarned: true as boolean | 'half',
      runAdvFielder: null,
      runAdvRbi: false,
      runAdvPitcher: '',
    }));
  }, [UI.selRunnerBase, G.runners, showToast]);

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
    (chain: boolean, fielderSeq: FielderEntry[] = []) => {
      if (!UI.runAdvResult || !UI.runAdvDest || !chainPendingBase) return;
      const toBase = UI.runAdvDest;
      const earned = UI.runAdvEarned;
      const rbi = UI.runAdvRbi;
      const scorePitcher = UI.runAdvPitcher;
      setChainBatterOpen(false);
      setChainPendingBase(null);

      if (chainTransit) {
        // 연결동작 중 진루: 루 주자를 최종 위치로 이동
        const { runner, atBase } = chainTransit;
        setChainTransit(null);
        if (chain && toBase !== 'HOME') {
          setChainBases((prev) => new Set([...prev, toBase as Base]));
        }
        const advCode =
          typeof UI.runAdvResult === 'string' ? getAdvCode(UI.runAdvResult, fielderSeq) : undefined;
        dispatch({
          type: 'CHAIN_TRANSIT_ADV',
          runner,
          fromBase: atBase,
          toBase,
          earned,
          rbi,
          scorePitcher,
          advCode,
        });
        if (toBase === 'HOME') showToast(`${runner.name} 득점!`);
        else showToast(`${runner.name} → ${toBase} (chain)`);
      } else {
        if (!G.pendingBatter) return;
        if (chain && toBase !== 'HOME') {
          setChainBases((prev) => new Set([...prev, toBase as Base]));
        }
        dispatch({ type: 'CHAIN_BATTER_SKIP', toBase, earned, rbi, scorePitcher });
        if (toBase === 'HOME') showToast(`${G.pendingBatter.runner.name} 득점!`);
        else showToast(`${G.pendingBatter.runner.name} → ${toBase} (chain)`);
      }
    },
    [UI, chainPendingBase, chainTransit, G.pendingBatter, dispatch, showToast]
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
    (chain = false, fielderSeq: FielderEntry[] = []) => {
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

      // chain 연결동작 + 목적 베이스에 기존 주자 있음 → auto-push 방지
      const destHasRunner = dest !== 'HOME' && !!G.runners[dest as Base];
      if (chain && destHasRunner) {
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
        });
        setChainPendingBase(dest as Base);
        showToast(`${runner.name} → ${dest} 대기 (기존 주자 이동 필요)`);
        return;
      }

      // chainBases 업데이트: 이전 base 제거, 새 dest 추가(chain이고 HOME이 아닐 때)
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
      });

      if (dest === 'HOME')
        showToast(
          `${runner.name} 득점! (${earned === true ? '자책ER' : earned === 'half' ? '반자책' : '비자책UER'})`
        );
      else showToast(`${runner.name} → ${dest} (${reason})`);
    },
    [UI, G.runners, dispatch, showToast]
  );

  // ── Runner Out ────────────────────────────────────────────────────────────
  const openRunOut = useCallback(() => {
    if (!UI.selRunnerBase || !G.runners[UI.selRunnerBase]) {
      showToast('다이아몬드에서 주자를 먼저 클릭하세요');
      return;
    }
    setUI((p) => ({ ...p, runOutOpen: true, runOutResult: null }));
  }, [UI.selRunnerBase, G.runners, showToast]);

  const confirmRunOut = useCallback(
    (fielderSeq: number[]) => {
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
        if (t === 'CS 도루실패') return seq ? 'CS' + seq : 'CS';
        // 터치/공과/기타 — 수비수번호 + 코드 (예: 5B, 3A)
        const code = t.split(' ')[0];
        return seq ? seq + code : code;
      })();
      dispatch({ type: 'RUN_OUT', base, result: outCode });
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
      playerCbRef.current = (player: Player) => {
        dispatch({ type: 'SUBST', side, pos, player });
        showToast(`${player.name} 출전 (${POS_NAME[pos]})`);
      };
      setUI((p) => ({
        ...p,
        playersOpen: true,
        playersTitle: `${POS_NAME[pos]} 교체`,
        playerList: [...bench],
        playerSelIdx: null,
      }));
    },
    [G, dispatch, showToast]
  );

  const openPitcherChange = useCallback(() => {
    const side: 'away' | 'home' = G.half === 'top' ? 'home' : 'away';
    const bench = side === 'home' ? G.homeBench : G.awayBench;
    playerCbRef.current = (player: Player) => {
      dispatch({ type: 'PITCHER_CHANGE', side, player });
      showToast(`투수 교체: ${player.name}`);
    };
    setUI((p) => ({
      ...p,
      playersOpen: true,
      playersTitle: '투수 교체',
      playerList: [...bench],
      playerSelIdx: null,
    }));
  }, [G, dispatch, showToast]);

  const confirmPlayerSel = useCallback(() => {
    if (UI.playerSelIdx === null) {
      showToast('선수 선택');
      return;
    }
    setUI((p) => ({ ...p, playersOpen: false }));
    if (playerCbRef.current) playerCbRef.current(UI.playerList[UI.playerSelIdx]);
  }, [UI, showToast]);

  const openRunnerSubst = useCallback(
    (base: import('../types').Base) => {
      const side: 'away' | 'home' = G.half === 'top' ? 'away' : 'home';
      const bench = side === 'home' ? G.homeBench : G.awayBench;
      playerCbRef.current = (player: Player) => {
        dispatch({ type: 'SUBST_RUNNER', base, player, side });
        showToast(`대주자: ${player.name} (${base})`);
      };
      setUI((p) => ({
        ...p,
        playersOpen: true,
        playersTitle: `대주자 교체 (${base})`,
        playerList: [...bench],
        playerSelIdx: null,
      }));
    },
    [G, dispatch, showToast]
  );

  const openBatterSubst = useCallback(() => {
    const side: 'away' | 'home' = G.half === 'top' ? 'away' : 'home';
    const bench = side === 'home' ? G.homeBench : G.awayBench;
    playerCbRef.current = (player: Player) => {
      dispatch({ type: 'SUBST_BATTER', player, side });
      showToast(`대타: ${player.name}`);
    };
    setUI((p) => ({
      ...p,
      playersOpen: true,
      playersTitle: '대타 교체',
      playerList: [...bench],
      playerSelIdx: null,
    }));
  }, [G, dispatch, showToast]);

  // ── Runner toggle ─────────────────────────────────────────────────────────
  const toggleRunnerSel = useCallback(
    (base: Base) => {
      // 연결동작 중인 주자 또는 pendingBatter 상태: 클릭 즉시 RunAdv 모달 오픈
      if (chainBases.has(base) || (G.pendingBatter && G.runners[base])) {
        setUI((prev) => ({
          ...prev,
          selRunnerBase: base,
          runAdvOpen: true,
          runAdvResult: null,
          runAdvDest: null,
          runAdvEarned: true as boolean | 'half',
          runAdvRbi: false,
          runAdvPitcher: '',
        }));
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
    if (!blocked) {
      dispatch({ type: 'PLACE_BATTER' });
      // chain-pending이 해소됐으면 제거
      if (chainPendingBase === dest) setChainPendingBase(null);
    } else if (prevPendingRef.current !== G.pendingBatter) {
      if (!chainPendingBase) showToast('주자를 먼저 이동하세요');
    }
    prevPendingRef.current = G.pendingBatter;
  }, [G.pendingBatter, G.runners, chainPendingBase, dispatch, showToast]);

  // ── Game flow ─────────────────────────────────────────────────────────────
  const handlePlaceBatter = useCallback(() => {
    if (!G.pendingBatter) return;
    const dest = G.pendingBatter.dest;
    if (G.runners[dest]) {
      showToast(`${dest}에 주자가 있습니다. 먼저 이동하세요`);
      return;
    }
    dispatch({ type: 'PLACE_BATTER' });
  }, [G.pendingBatter, G.runners, dispatch, showToast]);

  const handleNextBatter = useCallback(() => {
    setChainBases(new Set());
    setChainPendingBase(null);
    dispatch({ type: 'NEXT_BATTER' });
  }, [dispatch]);

  const handleNextInning = useCallback(() => {
    setChainBases(new Set());
    setChainPendingBase(null);
    dispatch({ type: 'NEXT_INNING' });
    setUI((p) => ({ ...p, selRunnerBase: null }));
    showToast(
      `${G.half === 'top' ? G.inning : G.inning + 1}회 ${G.half === 'top' ? '말' : '초'} 시작`
    );
  }, [G, dispatch, showToast]);

  const handleUndo = useCallback(() => {
    if (!G.history.length) {
      showToast('되돌릴 내용 없음');
      return;
    }
    dispatch({ type: 'UNDO' });
    setUI((p) => ({ ...p, selRunnerBase: null }));
    showToast('Undo 완료');
  }, [G.history.length, dispatch, showToast]);

  const handleClear = useCallback(() => {
    dispatch({ type: 'CLEAR_CELL' });
  }, [dispatch]);

  const handleOverflow = useCallback(() => {
    dispatch({ type: 'ADD_OVERFLOW' });
    showToast(`${G.curBatterOrder}번타자 ${G.inning}회 추가 타석`);
  }, [G, dispatch, showToast]);

  const handleEnd = useCallback(() => {
    if (confirm('경기를 종료하시겠습니까?')) {
      showToast('경기 종료 처리됨');
      setTimeout(onEnd, 1000);
    }
  }, [onEnd, showToast]);

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
        handleUndo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlePitch, handleNextBatter, handleNextInning, handleUndo]);

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
        />

        {showSheet ? (
          <div className="game-body view-sheet">
            <ScoreSheet G={G} onSelCell={(key) => dispatch({ type: 'SEL_CELL', key })} />
            <PitcherLogPanel G={G} />
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
                  onRunnerToggle={toggleRunnerSel}
                  onBaseTargetClick={handleBaseTargetClick}
                  onRunnerDestClick={handleRunnerDestClick}
                  onFielderClick={handleFielderClick}
                  onRunnerContextMenu={openRunnerSubst}
                  onBatterContextMenu={openBatterSubst}
                  onChainPendingClick={handleChainPendingClick}
                  onChainEnd={() => {
                    setChainBases(new Set());
                    setChainPendingBase(null);
                    setChainTransit(null);
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
                          return (
                            <tr key={i} className={rowCls}>
                              <td>{a?.order ?? ''}</td>
                              <td>{a ? (a.pos === 0 ? 'D' : String(a.pos)) : ''}</td>
                              <td style={{ textAlign: 'left', paddingLeft: 4 }}>{a?.name ?? ''}</td>
                              <td>{h?.order ?? ''}</td>
                              <td>{h ? (h.pos === 0 ? 'D' : String(h.pos)) : ''}</td>
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
              onDefl={() => setUI((p) => ({ ...p, deflOpen: true, deflFielder: null }))}
              onMoundVisit={() => setMoundOpen(true)}
              onBatterTimeout={() => {
                dispatch({ type: 'CELL_NOTE', note: 'BT' });
                dispatch({ type: 'GAME_EVENT', eventType: 'batter_timeout' });
                showToast('타자 타임아웃 기록');
              }}
              onPitcherLeave={() => {
                dispatch({ type: 'CELL_NOTE', note: 'PL' });
                dispatch({ type: 'GAME_EVENT', eventType: 'pitcher_leave' });
                showToast('투수판 이탈 기록');
              }}
              onPitcherChange={openPitcherChange}
              onNextBatter={handleNextBatter}
              onNextInning={handleNextInning}
              onUndo={handleUndo}
              onClear={handleClear}
              onOverflow={handleOverflow}
              onPlaceBatter={handlePlaceBatter}
              onEnd={handleEnd}
              onToast={showToast}
            />

            {/* 오른쪽: 투구 로그 */}
            <PitcherLogPanel G={G} />
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <BatAdvModal
        open={UI.batAdvOpen}
        selected={UI.batAdvResult}
        onSelect={(v, bt) =>
          setUI((p) => ({ ...p, batAdvResult: v, batAdvBallType: bt ?? null, batAdvHitData: null }))
        }
        onConfirm={confirmBatAdv}
        onAutoConfirm={autoConfirmBatAdv}
        onClose={() => setUI((p) => ({ ...p, batAdvOpen: false, batAdvHitData: null }))}
        selectedHit={UI.batAdvHitData}
        onSelectHit={(d) => setUI((p) => ({ ...p, batAdvHitData: d, batAdvResult: null }))}
        defLU={defLU}
      />

      <BatOutModal
        open={UI.batOutOpen}
        defLU={defLU}
        onResult={(result, dp, tp) => {
          setUI((p) => ({ ...p, batOutOpen: false }));
          applyBatOutResult(result, dp, tp);
        }}
        onClose={() => setUI((p) => ({ ...p, batOutOpen: false }))}
      />

      <DefenseListModal
        open={defListOpen}
        result={defListResult}
        defLU={defLU}
        onClose={() => setDefListOpen(false)}
      />

      <MoundVisitModal
        open={moundOpen}
        onConfirm={(visitor) => {
          setMoundOpen(false);

          dispatch({
            type: 'CELL_NOTE',
            note: visitor === '코칭스태프' ? 'M_R' : 'M_B',
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
        pitcherList={
          G.half === 'top'
            ? G.homeLineup.filter((p) => p.pos === 1).concat(G.homeBench.filter((p) => p.pos === 1))
            : G.awayLineup.filter((p) => p.pos === 1).concat(G.awayBench.filter((p) => p.pos === 1))
        }
        defLU={defLU}
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
        pitcherList={
          G.half === 'top'
            ? G.homeLineup.filter((p) => p.pos === 1).concat(G.homeBench.filter((p) => p.pos === 1))
            : G.awayLineup.filter((p) => p.pos === 1).concat(G.awayBench.filter((p) => p.pos === 1))
        }
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
