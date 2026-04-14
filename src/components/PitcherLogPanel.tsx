import { useState, useEffect, useRef } from 'react';
import type { GameState, PitchType, HitData } from '../types';

const PITCH_LABEL: Record<PitchType, string> = {
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

const PITCH_COLOR: Record<PitchType, string> = {
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

// 수비 구역 번호 → 방향 레이블
const ZONE_DIR: Record<number, string> = {
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '유',
  7: '좌',
  8: '중',
  9: '우',
};

// 결과 코드 → 한글 표시
const RESULT_CODE_MAP: Record<string, string> = {
  K: '삼진',
  KW: '낫아웃',
  KP: '낫아웃',
  KE: '낫아웃',
  B: '4구',
  IB: '고의4구',
  HP: '사구',
  HR: '홈런',
  GHR: '장내홈런',
  FC: '야선',
  INT: '타방',
  HP2: '사구',
  SH: '희번',
  SF: '희비',
};

// result 코드 → 표시 문자열
// 안타(H1/H2/H3): hitData.zone으로 방향 표시 / 나머지: 저장된 코드 그대로
function formatCellResult(
  result: string,
  ballType?: '땅' | '뜬' | '라',
  isDP?: boolean,
  isTP?: boolean,
  hitData?: HitData
): string {
  // 안타 계열 — 방향 + 루타 숫자
  if (result === 'H1' || result === 'H2' || result === 'H3') {
    const dir = hitData ? (ZONE_DIR[hitData.zone] ?? String(hitData.zone)) : '';
    if (result === 'H1') return `${dir}안`;
    if (result === 'H2') return `${dir}2`;
    if (result === 'H3') return `${dir}3`;
  }

  // 한글 코드 매핑
  if (RESULT_CODE_MAP[result]) return RESULT_CODE_MAP[result];

  // 수비 번호 조합 (6-3, 4-6-3 등) + 타구 유형·병살 접미사
  let s = result;
  if (ballType === '땅') s += '땅';
  else if (ballType === '뜬') s += '비';
  else if (ballType === '라') s += '직';
  if (isTP) s += '삼중';
  else if (isDP) s += '병';
  return s;
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
  M_R: '마운드방문(감독)',
  M_B: '마운드방문(코치)',
};

type LogRow = {
  no: number;
  inningKey: string;
  inning: string;
  pitcher: string;
  batter: string;
  paStart: boolean;
} & (
  | { kind: 'pitch'; pitchNum: string; label: string; color: string }
  | {
      kind: 'result';
      result: string;
      ballType?: '땅' | '뜬' | '라';
      isDP?: boolean;
      isTP?: boolean;
      hitData?: HitData;
      pitchNum?: string;
    }
  | { kind: 'runner'; label: string } // 도루·도루실패·주자아웃
  | { kind: 'event'; label: string } // 견제·마운드방문 등
);

function buildPitcherLog(G: GameState): LogRow[] {
  const cells = Object.values(G.cells)
    .filter((c) => c.pitches.length > 0 || c.result || (c.eventLog && c.eventLog.length > 0))
    .sort((a, b) => {
      if (a.inning !== b.inning) return a.inning - b.inning;
      if (a.half !== b.half) return a.half === 'top' ? -1 : 1;
      if (a.order !== b.order) return a.order - b.order;
      return a.appearance - b.appearance;
    });

  const topInit = G.homeLineup.find((p) => p.pos === 1)?.name || '—';
  const botInit = G.awayLineup.find((p) => p.pos === 1)?.name || '—';
  const topCh = G.pitcherChanges
    .filter((c) => c.half === 'top')
    .sort((a, b) => (a.inning !== b.inning ? a.inning - b.inning : a.order - b.order));
  const botCh = G.pitcherChanges
    .filter((c) => c.half === 'bottom')
    .sort((a, b) => (a.inning !== b.inning ? a.inning - b.inning : a.order - b.order));

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
    const applicable = changes.filter(
      (ch) => ch.inning < cell.inning || (ch.inning === cell.inning && ch.order <= cell.order)
    );
    const pitcher = applicable.length > 0 ? applicable[applicable.length - 1].name : initPitcher;
    const batterName = batter?.name || `${cell.order}번`;
    const inningLabel = `${cell.inning}회${cell.half === 'top' ? '초' : '말'}`;
    const inningKey = `${cell.inning}-${cell.half}`;

    const base = { no: 0, inningKey, inning: inningLabel, pitcher, batter: batterName };

    // ── 투구 · 이벤트 행 (eventLog FIFO 순수 입력순, 재정렬 없음) ──
    let batterShown = false; // 첫 투구/결과 행에만 타자명 표시
    if (cell.eventLog && cell.eventLog.length > 0) {
      let pitchSeq = 0;
      cell.eventLog.forEach((entry) => {
        if (entry.kind === 'pitch') {
          pitchSeq++;
          noMap[pitcher] = (noMap[pitcher] ?? 0) + 1;
          const isFirst = !batterShown;
          batterShown = true;
          rows.push({
            ...base,
            no: noMap[pitcher],
            paStart: isFirst,
            kind: 'pitch',
            pitchNum: `${pitchSeq}구`,
            label: PITCH_LABEL[entry.pitch] ?? entry.pitch,
            color: PITCH_COLOR[entry.pitch] ?? '#374151',
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
          rows.push({ ...base, no: noMap[pitcher], paStart: false, kind: 'runner', label });
        } else if (entry.kind === 'runner_cs') {
          const ro = entry.runOut || '';
          const causeLbl = ro.startsWith('X')
            ? '견제사'
            : ro.startsWith('CS')
              ? '도루아웃'
              : `주자아웃(${ro})`;
          rows.push({
            ...base,
            no: noMap[pitcher],
            paStart: false,
            kind: 'runner',
            label: `${entry.runnerName} ${causeLbl}`,
          });
        } else if (entry.kind === 'result') {
          noMap[pitcher] = (noMap[pitcher] ?? 0) + 1;
          const resultIsFirst = !batterShown;
          batterShown = true;
          rows.push({
            ...base,
            no: noMap[pitcher],
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
            no: noMap[pitcher],
            paStart: false,
            kind: 'runner',
            label: `${entry.runnerName} ${label}`,
          });
        } else {
          // 이벤트 (투수판이탈·마운드방문 등) — 타자명 표시 안 함
          const label =
            SIDE_NOTE_LABEL[(entry as { note: string }).note] ?? (entry as { note: string }).note;
          rows.push({ ...base, no: noMap[pitcher], paStart: false, kind: 'event', label });
        }
      });
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
        rows.push({ ...base, no: noMap[pitcher], paStart: false, kind: 'event', label });
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
        rows.push({ ...base, no: noMap[pitcher], paStart: false, kind: 'event', label });
      }
    }
  }

  return rows;
}

export default function PitcherLogPanel({ G }: { G: GameState }) {
  const [selInning, setSelInning] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const rows = buildPitcherLog(G);

  const inningKeys: string[] = [];
  const inningLabels: Record<string, string> = {};
  for (const r of rows) {
    if (!inningLabels[r.inningKey]) {
      inningKeys.push(r.inningKey);
      inningLabels[r.inningKey] = r.inning;
    }
  }

  const filtered = selInning ? rows.filter((r) => r.inningKey === selInning) : rows;

  // 새 행 추가될 때마다 자동 스크롤
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filtered.length]);

  return (
    <div className="plp">
      <div className="plp-head">
        {inningKeys.length > 0 && (
          <div style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>
            <select
              value={selInning ?? ''}
              onChange={(e) => setSelInning(e.target.value || null)}
              style={{
                fontSize: 11,
                padding: '2px 4px',
                borderRadius: 3,
                border: '1px solid var(--border)',
                width: '100%',
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
                  <div className="plp-cell" style={{ fontWeight: 700, color: '#059669' }}>
                    {r.label}
                  </div>
                </div>
              );
            }

            // ── 사이드 이벤트 행 ────────────────────────────────────────
            if (r.kind === 'event') {
              return (
                <div key={i} className="plp-row" style={{ background: '#fffbeb' }}>
                  <div className="plp-cell" style={{ color: '#94a3b8' }}>
                    {r.no}
                  </div>
                  <div className="plp-cell" />
                  <div className="plp-cell" />
                  <div className="plp-cell" />
                  <div className="plp-cell" />
                  <div className="plp-cell" style={{ fontWeight: 600, color: '#b45309' }}>
                    {r.label}
                  </div>
                </div>
              );
            }

            // ── 투구 / 결과 행 ──────────────────────────────────────────
            const isResult = r.kind === 'result';
            return (
              <div
                key={i}
                className="plp-row"
                style={{
                  borderTop: r.paStart ? '1px solid #cbd5e1' : undefined,
                  background: isResult ? '#f5f3ff' : undefined,
                }}
              >
                <div className="plp-cell" style={{ color: '#94a3b8' }}>
                  {r.no}
                </div>
                <div className="plp-cell">{r.paStart ? r.inning : ''}</div>
                <div className="plp-cell" style={{ fontWeight: 600 }}>
                  {r.paStart ? r.pitcher : ''}
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
                <div className="plp-cell">{r.paStart ? r.batter : ''}</div>
                <div
                  className="plp-cell"
                  style={{
                    fontWeight: 700,
                    color: isResult ? '#7c3aed' : (r as { color: string }).color,
                  }}
                >
                  {isResult
                    ? formatCellResult(
                        (r as Extract<LogRow, { kind: 'result' }>).result,
                        (r as Extract<LogRow, { kind: 'result' }>).ballType,
                        (r as Extract<LogRow, { kind: 'result' }>).isDP,
                        (r as Extract<LogRow, { kind: 'result' }>).isTP,
                        (r as Extract<LogRow, { kind: 'result' }>).hitData
                      )
                    : (r as { label: string }).label}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
