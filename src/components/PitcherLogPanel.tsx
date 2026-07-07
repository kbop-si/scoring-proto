import { useState, useEffect, useRef } from 'react';
import type { GameState, PitchType, HitData, CellEventEntry } from '../types';
import { cellKey as makeCellKey, parseKey } from '../store/gameReducer';

// 볼카운트 수정용 — result 이전 구간의 eventLog (투구 + 도루 '/' 등 주자 이벤트)
function preResultEvents(cell?: { eventLog?: CellEventEntry[] }): CellEventEntry[] | undefined {
  const log = cell?.eventLog;
  if (!log || log.length === 0) return undefined;
  const ri = log.findIndex((e) => e.kind === 'result');
  return ri >= 0 ? log.slice(0, ri) : [...log];
}

const PITCH_LABEL: Partial<Record<PitchType, string>> & Record<string, string> = {
  S: '스트라이크',
  SW: '헛스윙',
  B: '볼',
  F: '파울',
  FE: '파울실책',
  BS: '번트헛스윙',
  BF: '번트파울',
  PC1: '투수위반 볼',
  PC2: '포수위반 볼',
  PC3: '타자위반 스트라이크',
};
// FE{n} → '파울실책(E{n})'
for (let i = 1; i <= 9; i++) PITCH_LABEL[`FE${i}`] = `파울실책(E${i})`;

const PITCH_COLOR: Partial<Record<PitchType, string>> & Record<string, string> = {
  S: '#1e40af',
  SW: '#1e40af',
  B: '#15803d',
  F: '#92400e',
  FE: '#92400e',
  BS: '#1e40af',
  BF: '#92400e',
  PC1: '#15803d',
  PC2: '#15803d',
  PC3: '#1e40af',
};
for (let i = 1; i <= 9; i++) PITCH_COLOR[`FE${i}`] = '#92400e';

// 수비 포지션 번호 → pit.xlsx 표기 레이블
// 1=투수, 2=포수, 3=1루수, 4=2루수, 5=3루수, 6=유격수, 7=좌익수, 8=중견수, 9=우익수
const ZONE_DIR: Record<number, string> = {
  1: '투',
  2: '포',
  3: '1',
  4: '2',
  5: '3',
  6: '유',
  7: '좌',
  8: '중',
  9: '우',
  78: '좌중',
  89: '우중',
};

// 결과 코드 → 한글 표시 (포지션 무관 단일 코드)
const RESULT_CODE_MAP: Record<string, string> = {
  K: '삼진',
  KW: '스낫',
  KP: '스낫',
  KE: '스낫',
  B: '4구',
  IB: '고4',
  HP: '사구',
  HP2: '사구',
  FC: '야선',
  INT: '타방',
};

// result 코드 → pit.xlsx 땅표표기 문자열
// 프리픽스: F(뜬공), f(파울플라이), L(직선타), IF(내야플라이), SF(희생플라이), SH(희생번트), BU(번트아웃)
// 수비번호 조합: '6-3', '6-4-3' 등 첫 번째 포지션만 방향 레이블로 사용
function formatCellResult(
  result: string,
  ballType?: '땅' | '뜬' | '라',
  isDP?: boolean,
  isTP?: boolean,
  hitData?: HitData
): string {
  // 안타·홈런 계열 — 방향 + 결과
  if (
    result === 'H1' ||
    result === 'H2' ||
    result === 'H3' ||
    result === 'HR' ||
    result === 'GHR' ||
    result === 'GCW'
  ) {
    const dir = hitData ? (ZONE_DIR[hitData.zone] ?? String(hitData.zone)) : '';
    if (result === 'H1') return `${dir}안`;
    if (result === 'H2') return `${dir}2`;
    if (result === 'H3') return `${dir}3`;
    return `${dir}홈`;
  }

  // 단일 코드 매핑
  if (RESULT_CODE_MAP[result]) return RESULT_CODE_MAP[result];

  // 태그플레이(T), 루터치(A), 역병살(R) 모드 접미사 제거 후 파싱
  const cleaned = result.replace(/[TAR]$/, '');

  // 프리픽스 파싱 (길이 내림차순으로 먼저 시도)
  type Prefix = 'SF' | 'SH' | 'IF' | 'BU' | 'F' | 'f' | 'L';
  const PREFIXES: Prefix[] = ['SF', 'SH', 'IF', 'BU', 'F', 'f', 'L'];
  let prefix: Prefix | '' = '';
  let rest = cleaned;
  for (const p of PREFIXES) {
    if (cleaned.startsWith(p)) {
      prefix = p;
      rest = cleaned.slice(p.length);
      break;
    }
  }

  // 첫 번째 수비 포지션 → 방향 레이블
  const firstPos = parseInt(rest.split('-')[0]);
  const dir = isNaN(firstPos) ? rest : (ZONE_DIR[firstPos] ?? String(firstPos));

  if (prefix === 'SF') return `${dir}희비`;
  if (prefix === 'SH') return `${dir}희번`;
  if (prefix === 'BU') return isDP ? `${dir}병` : `${dir}번`;
  if (prefix === 'F' || prefix === 'IF')
    return isTP ? `${dir}삼중` : isDP ? `${dir}병` : `${dir}비`;
  if (prefix === 'f') return `${dir}파`;
  if (prefix === 'L') return isTP ? `${dir}삼중` : isDP ? `${dir}병` : `${dir}직`;

  // 프리픽스 없음 = 땅볼 계열 수비번호 조합
  if (isTP) return `${dir}삼중`;
  if (isDP) return `${dir}병`;
  if (ballType === '뜬') return `${dir}비`;
  if (ballType === '라') return `${dir}직`;
  return `${dir}땅`;
}

// 베이스 문자 변환
function baseChar(base?: string | null): string {
  if (base === 'HOME') return '本';
  if (base === '3B') return '③';
  if (base === '2B') return '②';
  if (base === '1B') return '①';
  return '';
}

// 진루 사유 코드 → 한글
const ADV_CODE_LABEL: Record<string, string> = {
  S: '도루',
  '(S)': '도루',
  W: '폭투',
  '(W)': '폭투',
  P: '포일',
  '(P)': '포일',
  BK: '보크',
  '(BK)': '보크',
  '✓BK': '보크',
  '✓(BK)': '보크',
  E: '실책',
};

function advLabel(advCode?: string): string {
  if (!advCode) return '';
  return ADV_CODE_LABEL[advCode] ?? advCode;
}

// side note 코드 → 표시 문자열
const SIDE_NOTE_LABEL: Record<string, string> = {
  PL: '투수판이탈',
  BT: '타자타임',
  PK1: '1루견제',
  PK2: '2루견제',
  PK3: '3루견제',
  M_R: '마운드방문(코칭스태프)',
  M_B: '마운드방문(포수)',
  M_BD: '마운드방문(포수덕아웃)',
  VR: '비디오판독',
  CS: '체크스윙',
  ME: '기타메모',
  GD: '경기지연/중단',
  WE: '경고·퇴장',
  UC: '심판교체',
};

type LogRow = {
  no: number;
  inningKey: string;
  inning: string;
  pitcher: string;
  batter: string;
  paStart: boolean;
  // 편집을 위한 source 매핑 — eventLog 기반 행에만 부여
  cellKey?: string;
  entryIdx?: number;
} & (
  | {
      kind: 'pitch';
      pitchNum: string;
      label: string;
      color: string;
      pitchCode?: PitchType;
      showPitcher?: boolean; // mid-PA 투수 교체 직후 첫 투구 — 새 투수 이름 표시용
    }
  | {
      kind: 'result';
      result: string;
      ballType?: '땅' | '뜬' | '라';
      isDP?: boolean;
      isTP?: boolean;
      hitData?: HitData;
      pitchNum?: string;
    }
  | {
      kind: 'runner';
      label: string;
      // 진루 사유 편집을 위한 메타 (runner_steal/runner_adv 행만)
      advCode?: string;
      runnerName?: string;
      dest?: string;
    } // 도루·도루실패·주자아웃
  | { kind: 'event'; label: string; pitcherLabel?: string } // 견제·마운드방문·투수교체 등
);

function buildPitcherLog(G: GameState): LogRow[] {
  // cells 삽입 순서 = 사용자 입력(생성) 시간 순
  const insertSeq: Record<string, number> = {};
  Object.keys(G.cells).forEach((k, i) => {
    insertSeq[k] = i;
  });
  const seqOf = (c: { half: string; inning: number; order: number; appearance: number }) => {
    const k = `${c.half}-${c.inning}-${c.order}-${c.appearance}`;
    return insertSeq[k] ?? 0;
  };
  const cells = Object.values(G.cells)
    .filter((c) => c.pitches.length > 0 || c.result || (c.eventLog && c.eventLog.length > 0))
    // 이닝 → half(초·말) → cells 삽입 순 (타자 번호로 솔트하지 않음)
    .sort((a, b) => {
      if (a.inning !== b.inning) return a.inning - b.inning;
      if (a.half !== b.half) return a.half === 'top' ? -1 : 1;
      return seqOf(a) - seqOf(b);
    });

  const topCh = G.pitcherChanges
    .filter((c) => c.half === 'top')
    .sort((a, b) => (a.inning !== b.inning ? a.inning - b.inning : a.order - b.order));
  const botCh = G.pitcherChanges
    .filter((c) => c.half === 'bottom')
    .sort((a, b) => (a.inning !== b.inning ? a.inning - b.inning : a.order - b.order));
  // 초기 투수: 첫 번째 교체 기록의 oldName 사용 (RETRO 교체 후 lineup이 이미 갱신돼 있어
  // 현재 lineup에서 읽으면 새 투수가 나옴)
  const topInit =
    topCh.length > 0 && topCh[0].oldName
      ? topCh[0].oldName
      : G.homeLineup.find((p) => p.pos === 1)?.name || '—';
  const botInit =
    botCh.length > 0 && botCh[0].oldName
      ? botCh[0].oldName
      : G.awayLineup.find((p) => p.pos === 1)?.name || '—';

  const noMap: Record<string, number> = {};
  const rows: LogRow[] = [];

  // ── 사전 패스: causedBy 별로 (다른 셀의) 주자 진루 노트 수집 ──
  // key: `${inning}-${half}-${causedByOrder}` → 그 타자의 행동으로 진루한 주자 이벤트들
  type CausedNote = { runnerName: string; label: string };
  const notesByCausedBy: Record<string, CausedNote[]> = {};
  for (const cell of cells) {
    if (!cell.runnerNotes || cell.runnerNotes.length === 0) continue;
    const lu = cell.half === 'top' ? G.awayLineup : G.homeLineup;
    const runnerName = lu.find((p) => p.order === cell.order)?.name || `${cell.order}번`;
    for (const n of cell.runnerNotes) {
      if (n.steal || n.advCode === 'S' || n.advCode === '(S)') continue;
      if ((n as { force?: boolean }).force) continue; // 볼넷·사구 강제 진루 제외
      if (!n.causedBy || n.causedBy === cell.order) continue; // 본인 chain 진루는 본인 셀에 둠
      const reason = advLabel(n.advCode);
      let label: string;
      if (n.base === 'HOME') {
        label = reason ? `${reason}${n.rbi ? '(타점)' : ''}` : `${n.rbi ? '타점 ' : ''}득점`;
      } else {
        label = reason || `→${baseChar(n.base)}`;
      }
      const key = `${cell.inning}-${cell.half}-${n.causedBy}`;
      (notesByCausedBy[key] ||= []).push({
        runnerName,
        label: `${runnerName} ${label}`,
      });
    }
  }

  for (const cell of cells) {
    const battingLU = cell.half === 'top' ? G.awayLineup : G.homeLineup;
    const batter = battingLU.find((p) => p.order === cell.order);
    const changes = cell.half === 'top' ? topCh : botCh;
    const initPitcher = cell.half === 'top' ? topInit : botInit;
    // 이전 이닝까지 적용된 교체 (이 cell이 시작될 때의 투수)
    const priorChanges = changes.filter(
      (ch) => ch.inning < cell.inning || (ch.inning === cell.inning && ch.order < cell.order)
    );
    const startPitcher =
      priorChanges.length > 0 ? priorChanges[priorChanges.length - 1].name : initPitcher;
    // 이 cell의 PA 도중 발생한 mid-PA 교체 (복수 가능) — 투구 수 오름차순 정렬
    const midChanges = changes
      .filter((ch) => ch.inning === cell.inning && ch.order === cell.order && ch.mid)
      .sort((a, b) => {
        const ap = a.mid!.pitches ?? (a.mid!.balls ?? 0) + (a.mid!.strikes ?? 0);
        const bp = b.mid!.pitches ?? (b.mid!.balls ?? 0) + (b.mid!.strikes ?? 0);
        return ap - bp;
      });
    // PA 시작 시점의 투수
    let curPitcher = startPitcher;
    // 구형 데이터 폴백 / 결과 행에 쓰일 default pitcher (PA 최종 투수)
    const pitcher = midChanges.length > 0 ? midChanges[midChanges.length - 1].name : startPitcher;
    const batterName = batter?.name || `${cell.order}번`;
    const inningLabel = `${cell.inning}회${cell.half === 'top' ? '초' : '말'}`;
    const inningKey = `${cell.inning}-${cell.half}`;
    const ck = makeCellKey(cell.inning, cell.order, cell.appearance, cell.half);
    const base = {
      no: 0,
      inningKey,
      inning: inningLabel,
      pitcher,
      batter: batterName,
      cellKey: ck,
    };
    // ── 대타 / 대주자 교체 행 ───────────────────────────────────────────────
    const battingSide: 'away' | 'home' = cell.half === 'top' ? 'away' : 'home';
    let batterShown = false;

    const pinchSubs = (G.substitutions || []).filter(
      (s) =>
        s.kind === 'H' &&
        s.side === battingSide &&
        s.inning === cell.inning &&
        s.half === cell.half &&
        s.atOrder === cell.order
    );
    for (const sub of pinchSubs) {
      const midStr = sub.mid ? ` (${sub.mid.balls}B${sub.mid.strikes}S 후)` : '';
      rows.push({
        ...base,
        no: noMap[pitcher],
        paStart: !batterShown,
        kind: 'event',
        label: `대타 교체: ${sub.oldName} → ${sub.newName}${midStr}`,
      });
      batterShown = true;
    }
    const runnerSubs = (G.substitutions || []).filter(
      (s) =>
        s.kind === 'R' &&
        s.side === battingSide &&
        s.inning === cell.inning &&
        s.half === cell.half &&
        s.atOrder === cell.order
    );
    for (const rs of runnerSubs) {
      const BASE_KO: Record<string, string> = { '1B': '1루', '2B': '2루', '3B': '3루', HOME: '홈' };
      const baseLabel = rs.base ? ` (${BASE_KO[rs.base] ?? rs.base})` : '';
      rows.push({
        ...base,
        no: noMap[pitcher],
        paStart: !batterShown,
        kind: 'event',
        label: `대주자 교체: ${rs.oldName} → ${rs.newName}${baseLabel}`,
      });
      if (!batterShown) batterShown = true;
    }

    // ── 투구 · 이벤트 행 (eventLog FIFO 순수 입력순, 재정렬 없음) ──
    if (cell.eventLog && cell.eventLog.length > 0) {
      let pitchSeq = 0;
      const pendingMidChanges = [...midChanges]; // 남은 mid-PA 교체 큐 (투구 수 오름차순)
      let nextPitchShowsPitcher = false; // mid-PA 교체 직후 첫 투구 행에 투수 이름 표시
      cell.eventLog.forEach((entry, entryIdx) => {
        // 투수 교체 시점 도달: 복수 교체도 순차 처리
        while (pendingMidChanges.length > 0) {
          const ch = pendingMidChanges[0];
          const threshold = ch.mid!.pitches ?? (ch.mid!.balls ?? 0) + (ch.mid!.strikes ?? 0);
          if (pitchSeq >= threshold) {
            rows.push({
              no: 0,
              inningKey,
              inning: inningLabel,
              pitcher: ch.name,
              batter: batterName,
              cellKey: ck,
              paStart: false,
              kind: 'event',
              label: `투수 교체: ${curPitcher} → ${ch.name}`,
              pitcherLabel: ch.name,
            });
            curPitcher = ch.name;
            pendingMidChanges.shift();
            nextPitchShowsPitcher = true;
          } else {
            break;
          }
        }
        const base = {
          no: 0,
          inningKey,
          inning: inningLabel,
          pitcher: curPitcher,
          batter: batterName,
          cellKey: ck,
          entryIdx,
        };

        if (entry.kind === 'pitch') {
          pitchSeq++;
          noMap[curPitcher] = (noMap[curPitcher] ?? 0) + 1;
          const isFirst = !batterShown;
          batterShown = true;
          const showPitcher = nextPitchShowsPitcher;
          nextPitchShowsPitcher = false;
          rows.push({
            ...base,
            no: noMap[curPitcher],
            paStart: isFirst,
            kind: 'pitch',
            pitchNum: `${pitchSeq}구`,
            label: PITCH_LABEL[entry.pitch] ?? entry.pitch,
            color: PITCH_COLOR[entry.pitch] ?? '#374151',
            pitchCode: entry.pitch,
            showPitcher,
          });
        } else if (entry.kind === 'runner_steal') {
          const ac = (entry as { advCode?: string }).advCode;
          const causeLbl =
            ac === 'W' || ac === '(W)'
              ? '폭투'
              : ac === 'P' || ac === '(P)'
                ? '포일'
                : ac === 'BK' || ac === '(BK)' || ac === '✓BK' || ac === '✓(BK)'
                  ? '보크'
                  : '도루';
          const label = `${entry.runnerName} ${causeLbl}`;
          rows.push({
            ...base,
            no: noMap[curPitcher] ?? 0,
            paStart: false,
            kind: 'runner',
            label,
            advCode: ac,
            runnerName: entry.runnerName,
            dest: entry.dest,
          });
        } else if (entry.kind === 'runner_cs') {
          const ro = entry.runOut || '';
          const causeLbl = ro.startsWith('X')
            ? '견제사'
            : ro.startsWith('CS')
              ? '도루아웃'
              : `주자아웃(${ro})`;
          rows.push({
            ...base,
            no: noMap[curPitcher] ?? 0,
            paStart: false,
            kind: 'runner',
            label: `${entry.runnerName} ${causeLbl}`,
          });
        } else if (entry.kind === 'result') {
          noMap[curPitcher] = (noMap[curPitcher] ?? 0) + 1;
          const resultIsFirst = !batterShown;
          batterShown = true;
          rows.push({
            ...base,
            no: noMap[curPitcher],
            paStart: resultIsFirst,
            kind: 'result',
            result: entry.result,
            ballType: cell.ballType,
            isDP: cell.isDoublePlay,
            isTP: cell.isTriplePlay,
            hitData: cell.hitData,
            pitchNum: resultIsFirst ? '1구' : '',
          });
        } else if (entry.kind === 'runner_adv') {
          const ac = entry.advCode;
          const reason = advLabel(ac);
          let label: string;
          if (entry.dest === 'HOME') {
            label = reason
              ? `${reason}${entry.rbi ? '(타점)' : ''}`
              : `${entry.rbi ? '타점 ' : ''}득점`;
          } else {
            label = reason || `→${baseChar(entry.dest)}`;
          }
          rows.push({
            ...base,
            no: noMap[curPitcher] ?? 0,
            paStart: false,
            kind: 'runner',
            label: `${entry.runnerName} ${label}`,
            advCode: ac,
            runnerName: entry.runnerName,
            dest: entry.dest,
          });
        } else {
          // 이벤트 (투수판이탈·마운드방문 등)
          const label =
            SIDE_NOTE_LABEL[(entry as { note: string }).note] ?? (entry as { note: string }).note;
          const isFirstEvent = !batterShown;
          if (isFirstEvent) batterShown = true;
          rows.push({
            ...base,
            no: noMap[curPitcher] ?? 0,
            paStart: isFirstEvent,
            kind: 'event',
            label,
          });
        }
      });
      // 루프 후에도 남은 교체(투구 수를 넘은 시점 이후) 마지막에 추가
      for (const ch of pendingMidChanges) {
        rows.push({
          no: 0,
          inningKey,
          inning: inningLabel,
          pitcher: ch.name,
          batter: batterName,
          cellKey: ck,
          paStart: false,
          kind: 'event',
          label: `투수 교체: ${curPitcher} → ${ch.name}`,
          pitcherLabel: ch.name,
        });
        curPitcher = ch.name;
      }
    } else {
      // 구형 데이터 폴백: pitches + sideNotes 별도 처리
      cell.pitches.forEach((pitch, idx) => {
        noMap[pitcher] = (noMap[pitcher] ?? 0) + 1;
        const isFirst = idx === 0;
        if (isFirst) batterShown = true;
        rows.push({
          ...base,
          no: noMap[pitcher],
          paStart: isFirst,
          kind: 'pitch',
          pitchNum: `${idx + 1}구`,
          label: PITCH_LABEL[pitch] ?? pitch,
          color: PITCH_COLOR[pitch] ?? '#374151',
        });
      });
      for (const note of cell.sideNotes || []) {
        const label = SIDE_NOTE_LABEL[note] ?? note;
        const isFirstNote = !batterShown;
        if (isFirstNote) batterShown = true;
        rows.push({ ...base, no: noMap[pitcher], paStart: isFirstNote, kind: 'event', label });
      }
    }

    // ── 결과 행 ─────────────────────────────────────────────────────────────
    // eventLog에 result/runner_adv/runner_steal entry가 이미 있으면 (신형) 폴백 처리 전부 건너뛰기
    const hasResultInLog = (cell.eventLog || []).some((e) => e.kind === 'result');
    const hasRunnerEvtInLog = (cell.eventLog || []).some(
      (e) => e.kind === 'runner_adv' || e.kind === 'runner_steal'
    );
    if (cell.result && !hasResultInLog) {
      noMap[pitcher] = (noMap[pitcher] ?? 0) + 1;

      const resultIsFirst = !batterShown;
      batterShown = true;
      rows.push({
        ...base,
        no: noMap[pitcher],
        paStart: resultIsFirst,
        kind: 'result',
        result: cell.result,
        ballType: cell.ballType,
        isDP: cell.isDoublePlay,
        isTP: cell.isTriplePlay,
        hitData: cell.hitData,
        pitchNum: resultIsFirst ? '1구' : '',
      });

      // 본인의 chain 진루 노트만 본인 셀에 표시 (다른 주자 진루는 causedBy 셀로 이동됨)
      for (const n of cell.runnerNotes || []) {
        if (n.steal || n.advCode === 'S' || n.advCode === '(S)') continue;
        if ((n as { force?: boolean }).force) continue; // 볼넷·사구 강제 진루 제외
        if (n.causedBy && n.causedBy !== cell.order) continue;
        const reason = advLabel(n.advCode);
        let label: string;
        if (n.base === 'HOME') {
          label = reason ? `${reason}${n.rbi ? '(타점)' : ''}` : `${n.rbi ? '타점 ' : ''}득점`;
        } else {
          label = reason || `→${baseChar(n.base)}`;
        }
        rows.push({ ...base, no: noMap[pitcher], paStart: false, kind: 'runner', label });
      }

      // 이 타자의 행동으로 진루한 다른 주자들 (구형 데이터 폴백 — 신형은 eventLog runner_adv로 처리됨)
      if (!hasRunnerEvtInLog) {
        const causedKey = `${cell.inning}-${cell.half}-${cell.order}`;
        for (const cn of notesByCausedBy[causedKey] || []) {
          rows.push({
            ...base,
            no: noMap[pitcher],
            paStart: false,
            kind: 'runner',
            label: cn.label,
          });
        }
      }
      if (
        cell.runOut &&
        !cell.isDPRunner &&
        !cell.runOut.startsWith('CS') &&
        !cell.runOut.startsWith('X')
      ) {
        rows.push({
          ...base,
          no: noMap[pitcher],
          paStart: false,
          kind: 'runner',
          label: cell.runOut,
        });
      }
    }

    // ── 주자 이벤트 행 (runner 셀 — 병살 주자) ─────────────────
    // CS(도루실패)는 현재 타자 셀 eventLog의 runner_cs로 처리되므로 여기서 제외
    if (cell.runOut && cell.isDPRunner) {
      rows.push({ ...base, no: noMap[pitcher], paStart: false, kind: 'runner', label: '병살' });
    }

    // ── 사이드 이벤트 행 — eventLog 없는 구형 데이터에서만 (eventLog 있으면 이미 포함됨) ──
    if (!cell.eventLog || cell.eventLog.length === 0) {
      for (const note of cell.sideNotes || []) {
        const label = SIDE_NOTE_LABEL[note] ?? note;
        const isFirstNote = !batterShown;
        if (isFirstNote) batterShown = true;
        rows.push({ ...base, no: noMap[pitcher], paStart: isFirstNote, kind: 'event', label });
      }
    }
  }

  return rows;
}

export type EditRowInfo =
  | { kind: 'pitch'; cellKey: string; entryIdx: number; currentPitch: PitchType }
  | { kind: 'hit'; cellKey: string; currentResult: string; currentHitData?: HitData }
  | {
      kind: 'runner_reason';
      cellKey: string;
      entryIdx: number;
      currentAdvCode?: string;
      runnerName: string;
      dest: string;
    }
  | { kind: 'bat_result_code'; cellKey: string; currentResult: string }
  | {
      kind: 'bat_out_code';
      cellKey: string;
      currentResult: string;
      currentBallType?: '땅' | '뜬' | '라';
    }
  | { kind: 'pitch_seq'; cellKey: string; pitches: PitchType[]; result: string | null }
  | {
      kind: 'batter_edit'; // 볼카운트 수정 + 대타 교체 탭
      cellKey: string;
      pitches: PitchType[];
      result: string | null;
      battingSide: 'away' | 'home';
      // result 이전 eventLog 구간 — 있으면 도루 '/' 등 주자 이벤트 포함 재정렬 모드
      events?: CellEventEntry[];
    }
  | {
      kind: 'pitcher_edit'; // 투수 교체
      inning: number;
      half: 'top' | 'bottom';
      order: number;
      pitchingSide: 'away' | 'home';
      currentPitchCount: number; // 이 타석에서 투구 수
    };

export default function PitcherLogPanel({
  G,
  onEditRow,
  onDeleteCell,
  onRetroSwap,
}: {
  G: GameState;
  onEditRow?: (info: EditRowInfo) => void;
  onDeleteCell?: (key: string) => void;
  // 선택된 이닝 시점의 소급 수비 변경 (좌↔우익수 교대 뒤늦게 발견 등)
  onRetroSwap?: (inning: number, half: 'top' | 'bottom') => void;
}) {
  const [selInning, setSelInning] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // 이닝 변경 시 자동으로 현재 이닝 탭 선택
  useEffect(() => {
    setSelInning(`${G.inning}-${G.half}`);
  }, [G.inning, G.half]);

  const rows = buildPitcherLog(G);

  // 각 row에 paIndex 부여 (paStart마다 1 증가) — 같은 PA 그룹 식별용
  const paIndexByRow: number[] = [];
  let curPa = -1;
  for (const r of rows) {
    if ((r as { paStart?: boolean }).paStart) curPa++;
    paIndexByRow.push(curPa);
  }
  const togglePa = (idx: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const inningKeys: string[] = [];
  const inningLabels: Record<string, string> = {};
  for (const r of rows) {
    if (!inningLabels[r.inningKey]) {
      inningKeys.push(r.inningKey);
      inningLabels[r.inningKey] = r.inning;
    }
  }

  // 접힌 PA의 비-paStart 행은 숨김 (paStart 행은 항상 표시)
  const filteredAll = rows
    .map((r, idx) => ({ r, paIdx: paIndexByRow[idx] }))
    .filter(({ r, paIdx }) => {
      if (selInning && r.inningKey !== selInning) return false;
      if (!(r as { paStart?: boolean }).paStart && collapsed.has(paIdx)) return false;
      return true;
    });
  const filtered = filteredAll.map(({ r }) => r);
  const filteredPaIdx = filteredAll.map(({ paIdx }) => paIdx);

  // 새 행 추가될 때마다 자동 스크롤
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filtered.length]);

  return (
    <div className="plp">
      <div className="plp-head">
        {inningKeys.length > 0 && (
          <div
            style={{
              padding: '4px 6px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              gap: 4,
            }}
          >
            <select
              value={selInning ?? ''}
              onChange={(e) => setSelInning(e.target.value || null)}
              style={{
                fontSize: 11,
                padding: '2px 4px',
                borderRadius: 3,
                border: '1px solid var(--border)',
                flex: 1,
                cursor: 'pointer',
              }}
            >
              <option value="">전체</option>
              {inningKeys.map((key) => (
                <option key={key} value={key}>
                  {inningLabels[key]}
                </option>
              ))}
            </select>
            {onRetroSwap && selInning && (
              <button
                onClick={() => {
                  const [innStr, half] = selInning.split('-');
                  onRetroSwap(Number(innStr), half as 'top' | 'bottom');
                }}
                title="이 이닝 시점부터 수비 위치 교대 소급 적용"
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 3,
                  border: '1px solid var(--border)',
                  background: '#fff',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                수비변경
              </button>
            )}
          </div>
        )}
        <div className="plp-row plp-hdr">
          <div className="plp-cell">no</div>
          <div className="plp-cell">이닝</div>
          <div className="plp-cell">투수</div>
          <div className="plp-cell">투구</div>
          <div className="plp-cell">타자</div>
          <div className="plp-cell">결과</div>
        </div>
      </div>
      <div className="plp-body" ref={bodyRef}>
        {filtered.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>
            기록 없음
          </div>
        ) : (
          filtered.map((r, i) => {
            // ── 주자 이벤트 행 ──────────────────────────────────────────
            if (r.kind === 'runner') {
              const runnerRow = r as Extract<LogRow, { kind: 'runner' }>;
              const canEditRunner =
                !!runnerRow.cellKey &&
                runnerRow.entryIdx !== undefined &&
                !!runnerRow.runnerName &&
                !!runnerRow.dest;
              const handleRunnerEdit = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (canEditRunner) {
                  onEditRow?.({
                    kind: 'runner_reason',
                    cellKey: runnerRow.cellKey!,
                    entryIdx: runnerRow.entryIdx!,
                    currentAdvCode: runnerRow.advCode,
                    runnerName: runnerRow.runnerName!,
                    dest: runnerRow.dest!,
                  });
                }
              };
              return (
                <div key={i} className="plp-row" style={{ background: '#f0fdf4' }}>
                  <div className="plp-cell" style={{ color: '#94a3b8' }}>
                    {r.no}
                  </div>
                  <div className="plp-cell" />
                  <div className="plp-cell" />
                  <div className="plp-cell" style={{ color: '#059669', fontSize: 9 }}>
                    주자
                  </div>
                  <div className="plp-cell" style={{ fontSize: 10, color: '#374151' }}>
                    {r.batter}
                  </div>
                  <div
                    className="plp-cell"
                    style={{
                      fontWeight: 700,
                      color: '#059669',
                      cursor: canEditRunner && onEditRow ? 'pointer' : undefined,
                      textDecoration: canEditRunner && onEditRow ? 'underline dotted' : undefined,
                    }}
                    onClick={canEditRunner && onEditRow ? handleRunnerEdit : undefined}
                    title={canEditRunner && onEditRow ? '클릭하여 사유 변경' : undefined}
                  >
                    {r.label}
                  </div>
                </div>
              );
            }

            // ── 사이드 이벤트 행 ────────────────────────────────────────
            if (r.kind === 'event') {
              const evPaIdx = filteredPaIdx[i];
              const evCollapsed = collapsed.has(evPaIdx);
              const isSubstEvent = r.label.startsWith('대타') || r.label.startsWith('대주자');
              const canBatterEdit = isSubstEvent && r.paStart && !!onEditRow && !!r.cellKey;
              return (
                <div
                  key={i}
                  className="plp-row"
                  style={{
                    background: isSubstEvent ? '#fef9c3' : '#fffbeb',
                    borderTop: r.paStart ? '1px solid #cbd5e1' : undefined,
                    cursor: r.paStart ? 'pointer' : undefined,
                  }}
                  onClick={r.paStart ? () => togglePa(evPaIdx) : undefined}
                  title={r.paStart ? '클릭하여 접기/펼치기' : undefined}
                >
                  <div className="plp-cell" style={{ color: '#94a3b8' }}>
                    {r.paStart ? (evCollapsed ? '▶' : '▼') : r.no}
                  </div>
                  <div className="plp-cell">{r.paStart ? r.inning : ''}</div>
                  <div
                    className="plp-cell"
                    style={{
                      fontWeight: 600,
                      cursor: canBatterEdit ? 'pointer' : undefined,
                      textDecoration: canBatterEdit ? 'underline dotted' : undefined,
                      color: canBatterEdit ? '#059669' : undefined,
                    }}
                    title={canBatterEdit ? '클릭하여 투수 교체' : undefined}
                    onClick={
                      canBatterEdit
                        ? (e) => {
                            e.stopPropagation();
                            const [half, inning, order] = parseKey(r.cellKey!);
                            const pitchingSide: 'away' | 'home' = half === 'top' ? 'home' : 'away';
                            const cell = G.cells[r.cellKey!];
                            onEditRow!({
                              kind: 'pitcher_edit',
                              inning,
                              half,
                              order,
                              pitchingSide,
                              currentPitchCount: cell ? cell.pitches.length : 0,
                            });
                          }
                        : undefined
                    }
                  >
                    {r.paStart
                      ? r.pitcher
                      : r.kind === 'event' && 'pitcherLabel' in r && r.pitcherLabel
                        ? r.pitcherLabel
                        : ''}
                  </div>
                  <div className="plp-cell" />
                  <div
                    className="plp-cell"
                    style={{
                      cursor: canBatterEdit ? 'pointer' : undefined,
                      textDecoration: canBatterEdit ? 'underline dotted' : undefined,
                    }}
                    title={canBatterEdit ? '클릭하여 볼카운트/교체 수정' : undefined}
                    onClick={
                      canBatterEdit
                        ? (e) => {
                            e.stopPropagation();
                            const cell = G.cells[r.cellKey!];
                            const [half] = parseKey(r.cellKey!);
                            const battingSide: 'away' | 'home' = half === 'top' ? 'away' : 'home';
                            onEditRow!({
                              kind: 'batter_edit',
                              cellKey: r.cellKey!,
                              pitches: cell ? [...cell.pitches] : [],
                              result: cell?.result ?? null,
                              battingSide,
                              events: preResultEvents(cell),
                            });
                          }
                        : undefined
                    }
                  >
                    {r.paStart ? r.batter : ''}
                  </div>
                  <div className="plp-cell" style={{ fontWeight: 600, color: '#b45309' }}>
                    {r.label}
                  </div>
                </div>
              );
            }

            // ── 투구 / 결과 행 ──────────────────────────────────────────
            const isResult = r.kind === 'result';
            const paIdx = filteredPaIdx[i];
            const isCollapsed = collapsed.has(paIdx);

            // 편집 가능 여부 판정
            const pitchRow = !isResult ? (r as Extract<LogRow, { kind: 'pitch' }>) : null;
            const resultRow = isResult ? (r as Extract<LogRow, { kind: 'result' }>) : null;
            const canEditPitch =
              !!pitchRow &&
              !!pitchRow.pitchCode &&
              !!pitchRow.cellKey &&
              pitchRow.entryIdx !== undefined;
            // 홈런 계열 — 방향(zone) 변경만 허용 (Shift 종류 변경 없음)
            const isHRResult =
              !!resultRow &&
              (resultRow.result === 'HR' ||
                resultRow.result === 'GHR' ||
                resultRow.result === 'GCW');
            const isHitResult =
              isHRResult ||
              (!!resultRow &&
                (resultRow.result === 'H1' ||
                  resultRow.result === 'H2' ||
                  resultRow.result === 'H3'));
            // 1B 도달 결과 (안타·실책·번트 등) — code 변경 가능 그룹
            const isOneBaseResult =
              !!resultRow &&
              (resultRow.result === 'H1' ||
                resultRow.result === 'INT' ||
                resultRow.result === 'BUNT' ||
                resultRow.result === 'OBUNT' ||
                /^E\d/.test(resultRow.result));
            // 아웃 결과 — 수비번호 또는 F#/L#/BU#/SH# 등 (병살/삼중살은 제외 — out count 변경 위험)
            const isOutResult =
              !!resultRow &&
              !resultRow.isDP &&
              !resultRow.isTP &&
              (/^\d+(-\d+)*[TUR]?$/.test(resultRow.result) || // 1, 6-3, 6-3-T 등
                /^F\d/.test(resultRow.result) || // F1, F8
                /^f\d/.test(resultRow.result) || // f1
                /^L\d/.test(resultRow.result) || // L1, L8
                /^IF\d/.test(resultRow.result) || // IF
                /^SF\d/.test(resultRow.result) || // SF
                /^BU\d/.test(resultRow.result) || // BU1
                /^SH\d/.test(resultRow.result));
            const canEditResult =
              !!resultRow && !!resultRow.cellKey && (isHitResult || isOneBaseResult || isOutResult);
            const editable = canEditPitch || canEditResult;

            const handleEditClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (canEditPitch && pitchRow) {
                onEditRow?.({
                  kind: 'pitch',
                  cellKey: pitchRow.cellKey!,
                  entryIdx: pitchRow.entryIdx!,
                  currentPitch: pitchRow.pitchCode!,
                });
              } else if (canEditResult && resultRow) {
                // 안타류: 일반 클릭 = zone 변경 / Shift+클릭 = 결과 코드 변경
                // 1B 도달 결과: 결과 코드 변경
                // 아웃 결과: 결과/ballType 변경
                if (isHitResult && (!e.shiftKey || isHRResult)) {
                  onEditRow?.({
                    kind: 'hit',
                    cellKey: resultRow.cellKey!,
                    currentResult: resultRow.result,
                    currentHitData: resultRow.hitData,
                  });
                } else if (isOutResult) {
                  onEditRow?.({
                    kind: 'bat_out_code',
                    cellKey: resultRow.cellKey!,
                    currentResult: resultRow.result,
                    currentBallType: resultRow.ballType,
                  });
                } else {
                  onEditRow?.({
                    kind: 'bat_result_code',
                    cellKey: resultRow.cellKey!,
                    currentResult: resultRow.result,
                  });
                }
              }
            };

            return (
              <div
                key={i}
                className="plp-row"
                style={{
                  borderTop: r.paStart ? '1px solid #cbd5e1' : undefined,
                  background: isResult ? '#f5f3ff' : undefined,
                  cursor: r.paStart ? 'pointer' : undefined,
                }}
                onClick={r.paStart ? () => togglePa(paIdx) : undefined}
                title={r.paStart ? '클릭하여 접기/펼치기' : undefined}
              >
                <div className="plp-cell" style={{ color: '#94a3b8' }}>
                  {r.paStart ? (isCollapsed ? '▶' : '▼') : r.no}
                </div>
                <div className="plp-cell">{r.paStart ? r.inning : ''}</div>
                <div
                  className="plp-cell"
                  style={{
                    fontWeight: 600,
                    cursor:
                      (r.paStart || (r.kind === 'pitch' && r.showPitcher)) && onEditRow
                        ? 'pointer'
                        : undefined,
                    textDecoration:
                      (r.paStart || (r.kind === 'pitch' && r.showPitcher)) && onEditRow
                        ? 'underline dotted'
                        : undefined,
                    color:
                      (r.paStart || (r.kind === 'pitch' && r.showPitcher)) && onEditRow
                        ? '#059669'
                        : undefined,
                  }}
                  onClick={
                    (r.paStart || (r.kind === 'pitch' && r.showPitcher)) && onEditRow && r.cellKey
                      ? (e) => {
                          e.stopPropagation();
                          const [half, inning, order] = parseKey(r.cellKey!);
                          const pitchingSide: 'away' | 'home' = half === 'top' ? 'home' : 'away';
                          const cell = G.cells[r.cellKey!];
                          onEditRow({
                            kind: 'pitcher_edit',
                            inning,
                            half,
                            order,
                            pitchingSide,
                            currentPitchCount: cell ? cell.pitches.length : 0,
                          });
                        }
                      : undefined
                  }
                  title={
                    (r.paStart || (r.kind === 'pitch' && r.showPitcher)) && onEditRow
                      ? '클릭하여 투수 교체'
                      : undefined
                  }
                >
                  {r.paStart || (r.kind === 'pitch' && r.showPitcher) ? r.pitcher : ''}
                </div>
                <div
                  className="plp-cell"
                  style={{
                    color: isResult ? '#7c3aed' : '#64748b',
                    fontWeight: isResult ? 700 : 400,
                  }}
                >
                  {isResult
                    ? (r as Extract<LogRow, { kind: 'result' }>).pitchNum || ''
                    : (r as { pitchNum: string }).pitchNum}
                </div>
                <div
                  className="plp-cell"
                  style={{
                    cursor: r.paStart && onEditRow && r.cellKey ? 'pointer' : undefined,
                    textDecoration:
                      r.paStart && onEditRow && r.cellKey ? 'underline dotted' : undefined,
                    color: r.paStart && onEditRow && r.cellKey ? '#1e40af' : undefined,
                  }}
                  onClick={
                    r.paStart && onEditRow && r.cellKey
                      ? (e) => {
                          e.stopPropagation();
                          const cell = G.cells[r.cellKey!];
                          const [half] = parseKey(r.cellKey!);
                          const battingSide: 'away' | 'home' = half === 'top' ? 'away' : 'home';
                          onEditRow({
                            kind: 'batter_edit',
                            cellKey: r.cellKey!,
                            pitches: cell ? [...cell.pitches] : [],
                            result: cell?.result ?? null,
                            battingSide,
                            events: preResultEvents(cell),
                          });
                        }
                      : undefined
                  }
                  title={
                    r.paStart && onEditRow && r.cellKey ? '클릭하여 볼카운트/대타 수정' : undefined
                  }
                >
                  {r.paStart ? r.batter : ''}
                </div>
                <div
                  className="plp-cell"
                  style={{
                    fontWeight: 700,
                    color: isResult ? '#7c3aed' : (r as { color: string }).color,
                    cursor: editable && onEditRow ? 'pointer' : undefined,
                    textDecoration: editable && onEditRow ? 'underline dotted' : undefined,
                  }}
                  onClick={editable && onEditRow ? handleEditClick : undefined}
                  title={
                    editable && onEditRow
                      ? isHitResult
                        ? '클릭: 방향 변경 / Shift+클릭: 종류 변경'
                        : '클릭하여 수정'
                      : undefined
                  }
                >
                  {isResult
                    ? formatCellResult(
                        resultRow!.result,
                        resultRow!.ballType,
                        resultRow!.isDP,
                        resultRow!.isTP,
                        resultRow!.hitData
                      )
                    : (r as { label: string }).label}
                  {r.paStart && onDeleteCell && r.cellKey && G.cells[r.cellKey]?.result && (
                    <span style={{ marginLeft: 6 }} onClick={(e) => e.stopPropagation()}>
                      {confirmDeleteKey === r.cellKey ? (
                        <>
                          <button
                            onClick={() => {
                              onDeleteCell(r.cellKey!);
                              setConfirmDeleteKey(null);
                            }}
                            style={{
                              fontSize: 9,
                              padding: '1px 4px',
                              background: '#dc2626',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 2,
                              cursor: 'pointer',
                              marginRight: 2,
                            }}
                          >
                            삭제
                          </button>
                          <button
                            onClick={() => setConfirmDeleteKey(null)}
                            style={{
                              fontSize: 9,
                              padding: '1px 4px',
                              background: '#fff',
                              border: '1px solid #cbd5e1',
                              borderRadius: 2,
                              cursor: 'pointer',
                            }}
                          >
                            취소
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteKey(r.cellKey!)}
                          style={{
                            fontSize: 9,
                            padding: '1px 4px',
                            background: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 2,
                            cursor: 'pointer',
                            color: '#94a3b8',
                          }}
                          title="타석 삭제"
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
