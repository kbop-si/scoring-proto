import { useState, useEffect } from 'react';
import type { GameState, CellData, HitData, Half, DeflectionInfo } from '../types';
import {
  KAN,
  RESULT_COL,
  RESULT_SYMBOL,
  BASE_LINES,
  getDuplicateNames,
  displayName,
} from '../data/constants';
import { cellKey, isOut, isOnBase } from '../store/gameReducer';
import { computePitcherRows, type PitcherRow } from '../utils/pitcherStats';
import { PitchMark } from './modals/PitchMark';

interface Props {
  G: GameState;
  onSelCell: (key: string) => void;
}

const BIDX: Record<string, number> = { '1B': 1, '2B': 2, '3B': 3, HOME: 4 };

function getStartBaseIdx(r: string | null): number {
  if (!r) return 0;
  if (['HR', 'GHR', 'GCW'].includes(r)) return 4;
  if (/^>>>[789]$/.test(r) || r === '>>>hit' || r === 'H3') return 3;
  if (/^>[789](-[789])?$/.test(r) || r === '>hit' || r === 'H2') return 2;
  if (isOnBase(r)) return 1;
  return 0;
}

// hitData zoneLbl 앞에 디플렉션 prefix(작은 번호 + ·) 를 붙여 SVG <text> 반환.
// 예: deflection.pos=7, zoneLbl='8' → "7·8" (7만 작게)
// 땅/뜬/라 마크는 prefix 위/아래에 작은 곡선으로 추가
function ZoneTextWithDefl({
  zoneLbl,
  deflection,
  x,
  y,
  fontSize,
  color,
}: {
  zoneLbl: string;
  deflection?: DeflectionInfo;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}) {
  if (!deflection) {
    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight="900"
        fontFamily="monospace"
        fill={color}
      >
        {zoneLbl}
      </text>
    );
  }
  const prefixFs = Math.max(fontSize * 0.55, 5.5) + 1;
  // 사용자가 조정한 prefix 끝(·) 위치
  const prefixX = x - fontSize * 0.2;
  // monospace 가정 — "·" 문자 폭 ≈ fontSize × 0.6
  const dotW = fontSize * 0.6;
  // dot center, small num center
  const dotCx = prefixX - dotW / 2;
  const smallCx = dotCx - dotW / 2 - prefixFs * 0.35;
  // ballType 마크 위치 — 작은 숫자 위/아래
  const markHalfW = prefixFs * 0.5;
  const markY = y - prefixFs * 0.85;
  const markYDown = y + prefixFs * 0.55;
  return (
    <g>
      {/* 본문(zoneLbl) */}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight="900"
        fontFamily="monospace"
        fill={color}
      >
        {zoneLbl}
      </text>
      {/* "·" — 본문과 작은 번호 사이 */}
      <text
        x={dotCx}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight="900"
        fontFamily="monospace"
        fill={color}
      >
        ·
      </text>
      {/* 작은 디플렉션 번호 */}
      <text
        x={smallCx}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={prefixFs}
        fontWeight="900"
        fontFamily="monospace"
        fill={color}
      >
        {deflection.pos}
      </text>
      {/* 작은 번호 위/아래의 ballType 마크 (땅/뜬/라) */}
      {deflection.ballType === '뜬' && (
        <path
          d={`M ${smallCx - markHalfW},${markY} Q ${smallCx},${markY - prefixFs * 0.6} ${smallCx + markHalfW},${markY}`}
          stroke={color}
          strokeWidth="0.9"
          fill="none"
          strokeLinecap="round"
        />
      )}
      {deflection.ballType === '라' && (
        <line
          x1={smallCx - markHalfW}
          y1={markY}
          x2={smallCx + markHalfW}
          y2={markY}
          stroke={color}
          strokeWidth="0.9"
          strokeLinecap="round"
        />
      )}
      {deflection.ballType === '땅' && (
        <path
          d={`M ${smallCx - markHalfW},${markYDown} Q ${smallCx},${markYDown + prefixFs * 0.45} ${smallCx + markHalfW},${markYDown}`}
          stroke={color}
          strokeWidth="0.9"
          fill="none"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

// 볼카운트(balls, strikes)에 해당하는 투구 수열 내 위치 계산 — 사다리 삽입 위치용
function computePinchSplitAt(pitches: string[], balls: number, strikes: number): number {
  if (balls === 0 && strikes === 0) return 0; // PA 시작 전 교체
  let rb = 0,
    rs = 0;
  for (let i = 0; i < pitches.length; i++) {
    const p = pitches[i];
    switch (p) {
      case 'S':
      case 'SW':
      case 'BS':
      case 'PC3':
        rs = Math.min(rs + 1, 3);
        break;
      case 'F':
      case 'FE':
        if (rs < 2) rs++;
        break;
      case 'BF':
        rs = Math.min(rs + 1, 3);
        break;
      case 'B':
      case 'PC1':
      case 'PC2':
        rb = Math.min(rb + 1, 4);
        break;
    }
    if (rb >= balls && rs >= strikes) return i + 1; // 해당 투구 이후
  }
  return pitches.length;
}

function ScoreCell({
  cell,
  isSel,
  isCur,
  outNum,
  pitcherChangeAt,
  pitcherChangeTip,
  pinchSubsAt,
}: {
  cell: CellData | null;
  isSel: boolean;
  isCur: boolean;
  outNum: number | undefined;
  pitcherChangeAt?: number; // 이 인덱스 직전(즉 midPitches만큼 던진 후)에 작은 가로 wave 삽입
  pitcherChangeTip?: string;
  pinchSubsAt?: { at: number; tip: string }[]; // 대타 사다리 삽입 위치 목록 (pitch count 기준)
}) {
  const pitches = cell?.pitches || [];
  const result = cell?.result || null;
  const notes = cell?.runnerNotes || [];
  const scored = cell?.scored || false;
  const earned = cell?.earned;
  const runOut = cell?.runOut || null;
  const lobCell = cell?.lobCell || false;
  const sideNotes = cell?.sideNotes || [];
  const hitData: HitData | undefined = cell?.hitData;
  const deflection = cell?.deflection;

  const SUP_DIGITS = ['¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
  // 한자+화살표+advCode 모두 이전 루 위치에 표시 (화살표로 간 방향 표시)
  const noteAtBase: Record<string, React.ReactNode> = {};
  type HomeNoteItem =
    | { kan: string; rbi?: boolean; arrow?: string; filled?: boolean }
    | { advLbl: React.ReactNode };
  const homeNoteItems: HomeNoteItem[] = [];
  const CHAIN_ARROW: Record<string, string> = { '2B': '↖', '3B': '↙', HOME: '↘' };
  if (result === 'GHR') noteAtBase['2B'] = 'GH'; // 구형 데이터

  // 연속플레이 화살표는 마지막(가장 멀리 진루한) chain note 1개에만 표시
  const CHAIN_RANK: Record<string, number> = { '1B': 1, '2B': 2, '3B': 3, HOME: 4 };
  let lastChainBase: string | null = null;
  let lastChainRank = 0;
  notes.forEach((n) => {
    // 타자 본인의 chain 진루는 causedBy 없이 chain=true만 기록되므로 함께 인정
    if (n.chain) {
      const rk = CHAIN_RANK[n.base] || 0;
      if (rk >= lastChainRank) {
        lastChainRank = rk;
        lastChainBase = n.base;
      }
    }
  });

  let noteIdx = 0;
  notes.forEach((n) => {
    const rawCode = n.advCode || '';

    const hasFielder = /\d/.test(rawCode);
    const sup =
      rawCode && !hasFielder && n.causedBy
        ? (SUP_DIGITS[n.causedBy - 1] ?? String(n.causedBy))
        : '';

    // advLbl을 ReactNode로 생성
    let advLbl: React.ReactNode | null = null;
    if (rawCode) {
      if (rawCode === 'SD') {
        advLbl = (
          <>
            <span style={{ textDecoration: 'underline' }}>S</span>
            {sup}
          </>
        );
      } else if (rawCode === '(SD)') {
        advLbl = (
          <>
            (<span style={{ textDecoration: 'underline' }}>S</span>
            {sup})
          </>
        );
      } else if (rawCode.endsWith(')')) {
        advLbl = (
          <>
            {rawCode.slice(0, -1)}
            {sup})
          </>
        );
      } else {
        advLbl = (
          <>
            {rawCode}
            {sup}
          </>
        );
      }
    }

    // 연속플레이 화살표: 마지막 chain note에만 표시
    const arrow =
      n.chain && n.causedBy && n.base === lastChainBase ? CHAIN_ARROW[n.base] || '' : '';

    // 화살표는 별도 위치(아래 chain-arrow div)에서 그려지므로 텍스트와 합치지 않음
    void arrow;
    if (n.base === 'HOME') {
      if (advLbl) {
        homeNoteItems.push({ advLbl });
      } else if (n.causedBy) {
        const kan = KAN[n.causedBy - 1] || String(n.causedBy);
        homeNoteItems.push({ kan, rbi: n.rbi });
      }
    } else {
      const ki = noteIdx++;
      if (advLbl) {
        const node = <span key={`n${ki}`}>{advLbl}</span>;
        noteAtBase[n.base] = noteAtBase[n.base] ? (
          <>
            {noteAtBase[n.base]}
            {node}
          </>
        ) : (
          node
        );
      } else if (n.causedBy) {
        const lbl = `(${KAN[n.causedBy - 1] || String(n.causedBy)})`;
        noteAtBase[n.base] = noteAtBase[n.base] ? (
          <>
            {noteAtBase[n.base]}
            {lbl}
          </>
        ) : (
          lbl
        );
      }
    }
  });

  const runOutBase = cell?.runOutBase || null;
  const runOutNum = cell?.runOutNum;
  const outLbl = outNum ? ['Ⅰ', 'Ⅱ', 'Ⅲ'][outNum - 1] : '';
  const onBase = isOnBase(result) && !runOutNum;

  // ↺ 2베이스 이상 이동 감지
  const multiBaseSkips: string[] = [];
  // HOME 도착 멀티스킵: 한자(causedBy)를 첫 중간 베이스로 이동, 큰 화살표는 HOME 변에 그림
  let homeSkipKanjiTarget: string | null = null;
  let homeSkipCausedBy: number | null = null;
  // 비-HOME 멀티스킵: 한자를 첫 중간(건너뛴) 베이스로 이동, 화살표는 그 다음 변에 그림
  // (예: 1B→3B → 한자 2B, 화살표 2B→3B / 규칙: 한자 먼저, 그 다음 화살표)
  let nonHomeSkipKanjiTarget: string | null = null;
  let nonHomeSkipKanjiFromBase: string | null = null;
  let nonHomeSkipCausedBy: number | null = null;
  if (onBase || scored) {
    const startIdx = getStartBaseIdx(result);
    let curIdx = startIdx;
    for (const n of notes) {
      const destIdx = BIDX[n.base] || 0;
      if (destIdx > curIdx && destIdx - curIdx >= 2) {
        const isHomeMulti = n.base === 'HOME' && !!n.causedBy && !n.advCode;
        const isNonHomeMulti = n.base !== 'HOME' && !!n.causedBy && !n.advCode;
        const firstIntermediate = ['', '1B', '2B', '3B', 'HOME'][curIdx + 1];
        if (isHomeMulti && firstIntermediate && firstIntermediate !== '1B') {
          // 첫 중간 베이스에 한자 표시 (HOME 한자 대신), 화살표는 HOME 변에
          homeSkipKanjiTarget = firstIntermediate;
          homeSkipCausedBy = n.causedBy!;
          // 첫 중간 베이스 다음부터 HOME까지 모두 화살표
          for (let i = curIdx + 2; i <= destIdx; i++) {
            const sb = ['', '1B', '2B', '3B', 'HOME'][i];
            if (sb) multiBaseSkips.push(sb);
          }
        } else if (isNonHomeMulti && firstIntermediate) {
          nonHomeSkipKanjiTarget = firstIntermediate;
          nonHomeSkipKanjiFromBase = n.base;
          nonHomeSkipCausedBy = n.causedBy!;
          for (let i = curIdx + 1; i < destIdx; i++) {
            const skipBase = ['', '1B', '2B', '3B', 'HOME'][i];
            if (skipBase) multiBaseSkips.push(skipBase);
          }
        } else {
          for (let i = curIdx + 1; i < destIdx; i++) {
            const skipBase = ['', '1B', '2B', '3B', 'HOME'][i];
            if (skipBase) multiBaseSkips.push(skipBase);
          }
        }
      }
      if (destIdx > curIdx) curIdx = destIdx;
    }
  }

  // HOME 멀티스킵: 한자를 첫 중간 베이스(curIdx+1)로 이동
  // - 2B → HOME (2 base): 한자 at 3B
  // - 1B → HOME (3 base): 한자 at 2B
  // HOME homeNoteItems의 한자 항목 제거 (이동되었으므로)
  if (homeSkipKanjiTarget && homeSkipCausedBy) {
    const targetKan = KAN[homeSkipCausedBy - 1] || String(homeSkipCausedBy);
    for (let i = 0; i < homeNoteItems.length; i++) {
      const it = homeNoteItems[i];
      if ('kan' in it && it.kan === targetKan) {
        homeNoteItems.splice(i, 1);
        break;
      }
    }
    if (!noteAtBase[homeSkipKanjiTarget]) {
      // 득점했으므로 ○ 안에 한자 (homeNoteItems과 동일한 스타일)
      noteAtBase[homeSkipKanjiTarget] = (
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          style={{ display: 'inline-block', verticalAlign: 'middle' }}
        >
          <circle cx="9" cy="9" r="8" fill="none" stroke="#111" strokeWidth="1.8" />
          <text
            x="9"
            y="13.5"
            textAnchor="middle"
            fontSize="12"
            fontWeight="900"
            fontFamily="serif"
            fill="#000"
            stroke="#000"
            strokeWidth="0.6"
            paintOrder="stroke"
          >
            {targetKan}
          </text>
        </svg>
      );
    }
  }

  // 비-HOME 멀티스킵: 한자를 도착 베이스에서 첫 중간 베이스로 이동
  if (nonHomeSkipKanjiTarget && nonHomeSkipCausedBy && nonHomeSkipKanjiFromBase) {
    const lbl = `(${KAN[nonHomeSkipCausedBy - 1] || String(nonHomeSkipCausedBy)})`;
    delete noteAtBase[nonHomeSkipKanjiFromBase];
    if (!noteAtBase[nonHomeSkipKanjiTarget]) {
      noteAtBase[nonHomeSkipKanjiTarget] = lbl;
    }
  }

  // 병살/삼중살 모두 동일 호(arc) 마크 — 타자/주자 셀 각각 ))
  // 병살: 타자 )) + 주자 )) = )) ))
  // 삼중살: 타자 )) + 주자 )) × 2 = )) )) ))
  const isDP = cell?.isDoublePlay || cell?.isTriplePlay || false;
  const isDPRunner = cell?.isDPRunner || false;
  const hasSteal = (cell?.eventLog || []).some((e) => e.kind === 'runner_steal');
  const fill = onBase ? '#eee' : 'none';
  const strokeC = '#888';
  const strokeW = isSel ? '1.5' : '0.8';
  const strokeDash = '3,3';
  const rcol = RESULT_COL[result || ''] || '#111';
  const isWalk = result === 'B' || result === 'IB' || result === 'IB2' || result === 'HP';
  const lines = !isWalk ? BASE_LINES[result || ''] || [] : [];
  const scoredCircle = scored || result === 'HR' || result === 'GHR';
  const earnedColor =
    result === 'HR' || result === 'GHR'
      ? '#111'
      : earned === 'half'
        ? '#111'
        : earned === false
          ? '#111'
          : '#111';

  const cls = ['sc', isSel ? 'sel' : '', isCur ? 'cur-bat' : ''].filter(Boolean).join(' ');

  const DIAMOND_SIZE = 48;

  const pitchMarkStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 12,
    height: 12,
  };
  const stealMarkStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 12,
    height: 12,
    fontSize: 11,
    color: '#111',
    fontWeight: 700,
    lineHeight: 1,
  };

  const eventLog = cell?.eventLog || [];

  const renderNote = (note: string, key: string | number): React.ReactNode => {
    if (STAR_NOTES.has(note)) return null;
    if (note === 'M_R') {
      return (
        <div key={key} style={{ fontSize: 10, fontWeight: 900, lineHeight: 1.2, color: '#fa0000' }}>
          M
        </div>
      );
    }
    if (note === 'M_B' || note === 'M_BD') {
      return (
        <div key={key} style={{ fontSize: 10, fontWeight: 900, lineHeight: 1.2, color: '#0004ff' }}>
          M
        </div>
      );
    }
    if (note === 'BT') {
      return (
        <div
          key={key}
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: '2px solid #0003cc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 8,
            fontWeight: 900,
            color: '#0003cc',
          }}
        >
          t
        </div>
      );
    }
    if (note === 'PL') {
      return (
        <div
          key={key}
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: '2px solid #00b909',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 8,
            fontWeight: 900,
            color: '#00b909',
            lineHeight: 1,
            boxSizing: 'border-box',
          }}
        >
          d
        </div>
      );
    }
    return (
      <div
        key={key}
        style={{
          fontSize: 8,
          fontWeight: 700,
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
          color: '#111',
        }}
      >
        {note}
      </div>
    );
  };

  // 대타 사다리 마크: H에 가로줄 하나 추가 = 사다리 모양
  const ladderMark = (tip: string) => (
    <span
      key="ph-ladder"
      title={tip}
      style={{
        display: 'inline-flex',
        width: 10,
        height: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="10" height="14" viewBox="0 0 10 14">
        <line
          x1="2"
          y1="1"
          x2="2"
          y2="13"
          stroke="#dc2626"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="8"
          y1="1"
          x2="8"
          y2="13"
          stroke="#dc2626"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="2"
          y1="5"
          x2="8"
          y2="5"
          stroke="#dc2626"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="2"
          y1="9"
          x2="8"
          y2="9"
          stroke="#dc2626"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );

  // 작은 가로 wave: 투구 칸 안 카운트 위치에 삽입
  const smallWave = (key: string) => (
    <span
      key={key}
      title={pitcherChangeTip}
      style={{
        display: 'inline-flex',
        width: 14,
        height: 5,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width="14" height="5" viewBox="0 0 14 5">
        <path
          d="M0 2.5 Q3.5 0 7 2.5 T14 2.5"
          stroke="#dc2626"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );

  const renderPitches = () => {
    if (eventLog.length > 0) {
      const items: React.ReactNode[] = [];
      let i = 0;
      let pitchCounter = 0;
      let pinchSubIdx = 0; // pinchSubsAt 배열 내 현재 인덱스
      while (i < eventLog.length) {
        const entry = eventLog[i];
        if (entry.kind === 'pitch') {
          if (pitcherChangeAt !== undefined && pitchCounter === pitcherChangeAt) {
            items.push(smallWave(`sw-${i}`));
          }
          // 대타 사다리: 이 투구 직전에 교체가 있으면 삽입
          while (
            pinchSubsAt &&
            pinchSubIdx < pinchSubsAt.length &&
            pinchSubsAt[pinchSubIdx].at === pitchCounter
          ) {
            items.push(ladderMark(pinchSubsAt[pinchSubIdx].tip));
            pinchSubIdx++;
          }
          const p = entry.pitch;
          items.push(
            <span
              key={i}
              className={`pm pm-${String(p).toLowerCase()}`}
              title={p}
              style={pitchMarkStyle}
            >
              <PitchMark code={p} size={12} />
            </span>
          );
          pitchCounter++;
          i++;
        } else if (entry.kind === 'runner_steal') {
          // 도루/이중도루 모두 '/' 1개. 이중도루는 연속 항목 묶어서 1개만 표시
          const nextEntry = eventLog[i + 1];
          items.push(
            <span key={i} title={entry.double ? '더블스틸' : '도루'} style={stealMarkStyle}>
              /
            </span>
          );
          if (entry.double && nextEntry?.kind === 'runner_steal' && nextEntry.double) {
            i += 2;
          } else {
            i++;
          }
        } else if (entry.kind === 'runner_cs') {
          // 도루실패(CS): 도루 성공과 동일하게 "/"
          // 견제사(X 시작): 세로선 + 가로줄 (1B:1개, 2B:2개, 3B:3개)
          const csBase = entry.base;
          const isCS = entry.runOut.startsWith('CS');
          if (isCS) {
            items.push(
              <span key={i} title={`도루실패(${csBase})`} style={stealMarkStyle}>
                /
              </span>
            );
          } else {
            const lineCount = csBase === '1B' ? 1 : csBase === '3B' ? 3 : 2;
            items.push(
              <span
                key={i}
                title={`견제사(${csBase})`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 12,
                  height: 12,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <line
                    x1="6"
                    y1="1"
                    x2="6"
                    y2="11"
                    stroke="#111"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                  {Array.from({ length: lineCount }, (_, j) => {
                    const y = lineCount === 1 ? 6 : lineCount === 2 ? 4.5 + j * 3 : 3.5 + j * 2.5;
                    return (
                      <line
                        key={j}
                        x1="2"
                        y1={y}
                        x2="10"
                        y2={y}
                        stroke="#111"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                      />
                    );
                  })}
                </svg>
              </span>
            );
          }
          i++;
        } else if (entry.kind === 'note') {
          items.push(renderNote(String(entry.note).trim(), `n${i}`));
          i++;
        } else {
          i++;
        }
      }
      // 끝까지 wave 미삽입 (PA 끝 직후 교체 ~ 미사용)
      if (pitcherChangeAt !== undefined && pitcherChangeAt === pitchCounter) {
        items.push(smallWave('sw-end'));
      }
      // 끝까지 사다리 미삽입 (PA 시작 전 교체 또는 모든 투구 이후)
      while (pinchSubsAt && pinchSubIdx < pinchSubsAt.length) {
        items.push(ladderMark(pinchSubsAt[pinchSubIdx].tip));
        pinchSubIdx++;
      }
      return <>{items}</>;
    }
    // 폴백 (eventLog 없는 구형 데이터)
    return (
      <>
        {pitches.map((p, i) => (
          <>
            {pitcherChangeAt !== undefined && pitcherChangeAt === i && smallWave(`sw-${i}`)}
            {pinchSubsAt?.some((s) => s.at === i) &&
              ladderMark(pinchSubsAt.find((s) => s.at === i)!.tip)}
            <span
              key={i}
              className={`pm pm-${String(p).toLowerCase()}`}
              title={p}
              style={pitchMarkStyle}
            >
              <PitchMark code={p} size={12} />
            </span>
          </>
        ))}
        {hasSteal && (
          <span title="도루" style={stealMarkStyle}>
            /
          </span>
        )}
      </>
    );
  };

  const bbChargedTo = cell?.bbChargedTo;
  const STAR_NOTES = new Set(['VR', 'CS', 'ME', 'GD', 'WE', 'UC']);
  const hasStarNote = sideNotes.some((n) => STAR_NOTES.has(String(n).trim()));
  return (
    <div className={cls}>
      {bbChargedTo && (
        <div
          title={`BB 책임: ${bbChargedTo} (전임 투수)`}
          style={{
            position: 'absolute',
            bottom: 1,
            left: 1,
            fontSize: 8,
            color: '#7c2d12',
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          ⤴{bbChargedTo}
        </div>
      )}
      {hasStarNote && (
        <div
          title="기타 이벤트 (목록에서 확인)"
          style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            fontSize: 10,
            color: '#7c3aed',
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          ★
        </div>
      )}
      <div className="sc-pitches">
        {renderPitches()}
        {result === 'HP' && (
          <span
            title="사구(맞은 투구)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 12,
              height: 12,
              fontSize: 11,
              color: '#111',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            —
          </span>
        )}
        {result &&
          !['B', 'IB', 'IB2', 'HP', 'K', 'K3B', 'KW', 'KP', 'KE'].includes(result) &&
          !/^ꓘ/.test(result) &&
          !/^#\dE$/.test(result) &&
          !/^Ob\dE$/.test(result) && (
            <span
              title={`타격완료: ${result}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 12,
                height: 12,
                fontSize: 10,
                color: '#111',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              θ
            </span>
          )}

        {!eventLog.some((e) => e.kind === 'note') &&
          sideNotes.map((n, i) => {
            const note = String(n).trim();

            if (STAR_NOTES.has(note)) return null;

            if (note === 'M_R') {
              return (
                <div
                  key={`n${i}`}
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    lineHeight: 1.2,
                    color: '#fa0000',
                  }}
                >
                  M
                </div>
              );
            }

            if (note === 'M_B' || note === 'M_BD') {
              return (
                <div
                  key={`n${i}`}
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    lineHeight: 1.2,
                    color: '#0004ff',
                  }}
                >
                  M
                </div>
              );
            }

            if (note === 'BT') {
              return (
                <div
                  key={i}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    border: '2px solid #0003cc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 8,
                    fontWeight: 900,
                    color: '#0003cc',
                  }}
                >
                  t
                </div>
              );
            }

            if (note === 'PL') {
              return (
                <div
                  key={`n${i}`}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    border: '2px solid #00b909',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 8,
                    fontWeight: 900,
                    color: '#00b909',
                    lineHeight: 1,
                    boxSizing: 'border-box',
                  }}
                >
                  d
                </div>
              );
            }

            return (
              <div
                key={`n${i}`}
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  lineHeight: 1.4,
                  whiteSpace: 'nowrap',
                  color: '#111',
                }}
              >
                {note}
              </div>
            );
          })}
      </div>

      <div
        className="sc-diamond"
        style={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ position: 'relative', width: DIAMOND_SIZE, height: DIAMOND_SIZE }}>
          <svg
            viewBox="0 0 40 40"
            overflow="visible"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: DIAMOND_SIZE,
              height: DIAMOND_SIZE,
            }}
          >
            <polygon
              points="20,2 38,20 20,38 2,20"
              fill={fill}
              stroke={strokeC}
              strokeWidth={strokeW}
              strokeDasharray={strokeDash}
            />
            <line
              x1="20"
              y1="2"
              x2="20"
              y2="-25"
              stroke="#888"
              strokeWidth="0.5"
              strokeDasharray="3,3"
            />
            <line
              x1="38"
              y1="20"
              x2="65"
              y2="20"
              stroke="#888"
              strokeWidth="0.5"
              strokeDasharray="3,3"
            />
            <line
              x1="20"
              y1="38"
              x2="20"
              y2="65"
              stroke="#888"
              strokeWidth="0.5"
              strokeDasharray="3,3"
            />
            <line
              x1="2"
              y1="20"
              x2="-25"
              y2="20"
              stroke="#888"
              strokeWidth="0.5"
              strokeDasharray="3,3"
            />

            {lines.map((l, i) => (
              <line
                key={i}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke={l.c}
                strokeWidth={l.w}
                strokeLinecap="round"
              />
            ))}

            {scoredCircle && (
              <text
                x="20"
                y="24"
                textAnchor="middle"
                fontSize="14"
                fontWeight="900"
                fill={earnedColor}
                fontFamily="serif"
              >
                {result === 'HR' || result === 'GHR'
                  ? '●'
                  : earned === false
                    ? '○'
                    : earned === 'half'
                      ? '○'
                      : '●'}
              </text>
            )}

            {outLbl && (
              <text
                x="20"
                y="24"
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fill="#111"
                fontFamily="serif"
              >
                {outLbl}
              </text>
            )}

            {lobCell && !outLbl && (
              <text
                x="20"
                y="25"
                textAnchor="middle"
                fontSize="11"
                fontStyle="italic"
                fontWeight="700"
                fill="#111"
              >
                ℓ
              </text>
            )}

            {/* 견제사 마크는 sc-pitches(볼카운트) 영역에 표시 */}

            {/* 병살/삼중살 호(arc) 마크 — 타자·주자 셀 각각 )) */}
            {isDP && (
              <>
                <path
                  d="M 42,13 A 8,8 0 0 1 42,27"
                  fill="none"
                  stroke="#111"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M 46,13 A 8,8 0 0 1 46,27"
                  fill="none"
                  stroke="#111"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </>
            )}
            {isDPRunner && (
              <>
                <path
                  d="M 42,13 A 8,8 0 0 1 42,27"
                  fill="none"
                  stroke="#111"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M 46,13 A 8,8 0 0 1 46,27"
                  fill="none"
                  stroke="#111"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </>
            )}

            {/* 2베이스 이상 이동: 건너뛴 루에 곡선 화살표 */}
            {multiBaseSkips.map((base, si) => {
              const allArrows: Record<string, { path: string; head: string }> = {
                '1B': {
                  path: 'M 22,34 Q 38,32 34,18',
                  head: 'M 34,18 L 37,22 L 31,21 Z',
                },
                '2B': {
                  path: 'M 34,18 Q 32,2 18,6',
                  head: 'M 18,6 L 22,3 L 21,9 Z',
                },
                '2B_shift': {
                  // 2B에 한자 있을 때 → 3B 변으로 이동
                  path: 'M 18,6 Q 2,8 6,22',
                  head: 'M 6,22 L 3,18 L 9,19 Z',
                },
                '3B': {
                  path: 'M 18,6 Q 2,8 6,22',
                  head: 'M 6,22 L 3,18 L 9,19 Z',
                },
                HOME: {
                  // 3B→홈 변
                  path: 'M 6,22 Q 8,38 18,34',
                  head: 'M 18,34 L 14,31 L 15,37 Z',
                },
              };
              let key = base;
              if (base === '2B' && noteAtBase['2B']) {
                key = '2B_shift';
                // 3B skip도 있으면 중복 방지
                if (multiBaseSkips.includes('3B')) return null;
              }
              const a = allArrows[key];
              if (!a) return null;
              return (
                <g key={`skip-${si}`}>
                  <path d={a.path} fill="none" stroke="#111" strokeWidth="1.2" />
                  <path d={a.head} fill="#111" stroke="none" />
                </g>
              );
            })}

            {hitData &&
              (() => {
                const zx = 33;
                const zy = 36;
                const zoneColor = '#111';
                const ht = hitData.hitType;
                const zoneLbl =
                  hitData.zone === 78 ? '7·8' : hitData.zone === 89 ? '8·9' : String(hitData.zone);

                // 그라운드홈런 / 캣워크: 우상단 GH/CW + 우하단 수비번호(언더라인)
                if (ht === 'GHR' || ht === 'GCW') {
                  const lbl = ht === 'GHR' ? 'GH' : 'CW';
                  return (
                    <g>
                      <text
                        x="38"
                        y="1"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="15"
                        fontWeight="900"
                        fontFamily="monospace"
                        fill={zoneColor}
                      >
                        {lbl}
                      </text>
                      <ZoneTextWithDefl
                        zoneLbl={zoneLbl}
                        deflection={deflection}
                        x={33}
                        y={32}
                        fontSize={9}
                        color={zoneColor}
                      />
                      <line
                        x1="28"
                        y1="37"
                        x2="38"
                        y2="37"
                        stroke={zoneColor}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </g>
                  );
                }

                // 홈런: 수비번호 + 비거리 + 타구방향
                if (ht === 'HR') {
                  const hrZx = 40,
                    hrZy = 40;
                  const hrDotMap = [
                    [
                      { dx: -5.5, dy: -9.0 },
                      { dx: 0.0, dy: -9.5 },
                      { dx: 5.5, dy: -9.0 },
                    ],
                    [
                      { dx: -7.5, dy: -1.5 },
                      { dx: 0.0, dy: -1.5 },
                      { dx: 7.5, dy: -1.5 },
                    ],
                    [
                      { dx: -5.5, dy: 5.5 },
                      { dx: 0.0, dy: 6.0 },
                      { dx: 5.5, dy: 5.5 },
                    ],
                  ];
                  const hrDot =
                    hitData.dirRow != null && hitData.dirCol != null
                      ? hrDotMap[hitData.dirRow]?.[hitData.dirCol]
                      : null;
                  return (
                    <g>
                      <ZoneTextWithDefl
                        zoneLbl={zoneLbl}
                        deflection={deflection}
                        x={hrZx}
                        y={hrZy}
                        fontSize={12}
                        color={zoneColor}
                      />
                      {!deflection && hrDot && (
                        <circle
                          cx={hrZx + hrDot.dx}
                          cy={hrZy + hrDot.dy - 1}
                          r="1.5"
                          fill={zoneColor}
                        />
                      )}
                      {!deflection && hitData.ballType === '뜬' && (
                        <path
                          d={`M ${hrZx - 4.5},${hrZy - 10.0} Q ${hrZx},${hrZy - 17.5} ${hrZx + 4.5},${hrZy - 10.0}`}
                          stroke={zoneColor}
                          strokeWidth="1.3"
                          fill="none"
                          strokeLinecap="round"
                        />
                      )}
                      {!deflection && hitData.ballType === '라' && (
                        <line
                          x1={hrZx - 4.5}
                          y1={hrZy - 13.0}
                          x2={hrZx + 4.5}
                          y2={hrZy - 13.0}
                          stroke={zoneColor}
                          strokeWidth="1.3"
                          strokeLinecap="round"
                        />
                      )}
                      {!deflection && hitData.ballType === '땅' && (
                        <path
                          d={`M ${hrZx - 4.5},${hrZy + 13.0} Q ${hrZx},${hrZy + 15.5} ${hrZx + 4.5},${hrZy + 13.0}`}
                          stroke={zoneColor}
                          strokeWidth="1.3"
                          fill="none"
                          strokeLinecap="round"
                        />
                      )}
                      {hitData.dist != null && (
                        <text
                          x="36"
                          y="4"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="11"
                          fontWeight="700"
                          fontFamily="monospace"
                          fill={zoneColor}
                        >
                          {hitData.dist}
                        </text>
                      )}
                    </g>
                  );
                }

                // 내야안타: /5) — 내야번트에서 물결 제거
                if (ht === 'INT') {
                  return (
                    <g>
                      <path
                        d="M 38,20 A 15,15 0 1 1 20,38"
                        stroke={zoneColor}
                        strokeWidth="1.3"
                        fill="none"
                        strokeLinecap="round"
                      />
                      <ZoneTextWithDefl
                        zoneLbl={zoneLbl}
                        deflection={deflection}
                        x={35}
                        y={38}
                        fontSize={18}
                        color={zoneColor}
                      />
                    </g>
                  );
                }

                // 내야번트: /4) — BASE_LINE이 / 그림, 여기선 ) 반원호 + 수비번호 + 지그재그
                if (ht === 'BUNT') {
                  return (
                    <g>
                      {/* ) 반원호 */}
                      <path
                        d="M 38,20 A 15,15 0 1 1 20,38"
                        stroke={zoneColor}
                        strokeWidth="1.3"
                        fill="none"
                        strokeLinecap="round"
                      />
                      {/* 수비번호 */}
                      <ZoneTextWithDefl
                        zoneLbl={zoneLbl}
                        deflection={deflection}
                        x={35}
                        y={38}
                        fontSize={18}
                        color={zoneColor}
                      />
                      {/* 지그재그 물결 */}
                      <path
                        d="M 20,49 L 23.85,45.8 L 27.7,49 L 31.55,45.8 L 35.4,49 L 39.25,45.8 L 43.1,49 L 46.95,45.8"
                        stroke="black"
                        stroke-width="3"
                        fill="none"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </g>
                  );
                }

                // 외야번트: 큰 수비번호 + 방향점 + 지그재그 물결
                if (ht === 'OBUNT') {
                  const cx = 35,
                    cy = 37;
                  const obDotMap = [
                    [
                      { dx: -3.5, dy: -5.5 },
                      { dx: 0, dy: -6.0 },
                      { dx: 3.5, dy: -5.5 },
                    ],
                    [
                      { dx: -4.5, dy: -1.0 },
                      { dx: 0, dy: -1.0 },
                      { dx: 4.5, dy: -1.0 },
                    ],
                    [
                      { dx: -3.0, dy: 3.2 },
                      { dx: 0, dy: 3.5 },
                      { dx: 3.0, dy: 3.2 },
                    ],
                  ];
                  const dot =
                    hitData.dirRow != null && hitData.dirCol != null
                      ? obDotMap[hitData.dirRow]?.[hitData.dirCol]
                      : null;
                  return (
                    <g>
                      <ZoneTextWithDefl
                        zoneLbl={zoneLbl}
                        deflection={deflection}
                        x={cx}
                        y={cy}
                        fontSize={11}
                        color={zoneColor}
                      />
                      {!deflection && dot && (
                        <circle cx={cx + dot.dx} cy={cy + dot.dy} r="1.2" fill={zoneColor} />
                      )}
                      {/* 지그재그 물결 */}
                      <path
                        d="M 20,49 L 23.85,45.8 L 27.7,49 L 31.55,45.8 L 35.4,49 L 39.25,45.8 L 43.1,49 L 46.95,45.8"
                        stroke="black"
                        stroke-width="3"
                        fill="none"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </g>
                  );
                }

                // 일반 루타/홈런: 기존 렌더링
                const dotMap = [
                  [
                    { dx: -4.8, dy: -7.6 },
                    { dx: 0.0, dy: -8.1 },
                    { dx: 4.8, dy: -7.6 },
                  ],
                  [
                    { dx: -6.2, dy: -1.5 },
                    { dx: 0.0, dy: -1.5 },
                    { dx: 6.2, dy: -1.5 },
                  ],
                  [
                    { dx: -4.2, dy: 4.1 },
                    { dx: 0.0, dy: 4.8 },
                    { dx: 4.2, dy: 4.1 },
                  ],
                ];

                const dot =
                  hitData.dirRow != null && hitData.dirCol != null
                    ? dotMap[hitData.dirRow]?.[hitData.dirCol]
                    : null;

                return (
                  <g>
                    {!deflection &&
                      hitData.ballType === '뜬' &&
                      (() => {
                        // 왼쪽·오른쪽 4 위로, ↘ 추가 3, ↙ 추가 3, ↖ 2 내림, ↓(row=2,col=1) 10 위로
                        const isSide = hitData.dirCol === 0 || hitData.dirCol === 2;
                        const isDownRight = hitData.dirRow === 2 && hitData.dirCol === 2;
                        const isDownLeft = hitData.dirRow === 2 && hitData.dirCol === 0;
                        const isUpLeft = hitData.dirRow === 0 && hitData.dirCol === 0;
                        const isDown = hitData.dirRow === 2 && hitData.dirCol === 1;
                        const upOffset =
                          (isSide ? 4 : 0) +
                          (isDownRight ? 3 : 0) +
                          (isDownLeft ? 3 : 0) -
                          (isUpLeft ? 2 : 0) +
                          (isDown ? 10 : 0);
                        const baseY = (dot?.dy ?? 0) - upOffset;
                        return (
                          <path
                            d={`M ${zx + 5 - 2.9},${zy + baseY} Q ${zx + 6},${zy + baseY - 6} ${zx + 6 + 2.9},${zy + baseY}`}
                            stroke={zoneColor}
                            strokeWidth="1.2"
                            fill="none"
                            strokeLinecap="round"
                          />
                        );
                      })()}
                    {!deflection && hitData.ballType === '라' && (
                      <line
                        x1={zx}
                        y1={zy - 6.0}
                        x2={zx + 10}
                        y2={zy - 6.0}
                        stroke={zoneColor}
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    )}

                    <ZoneTextWithDefl
                      zoneLbl={zoneLbl}
                      deflection={deflection}
                      x={zx + 4}
                      y={zy + 2}
                      fontSize={11}
                      color={zoneColor}
                    />

                    {!deflection &&
                      hitData.ballType === '땅' &&
                      (() => {
                        // 맨 아래(dirRow=2)와 오른쪽(dirCol=2)은 제외, 그 외 방향은 숫자와 겹치지 않게 더 내림
                        const isTop = hitData.dirRow === 0;
                        const isBottom = hitData.dirRow === 2;
                        const isRight = hitData.dirCol === 2;
                        const rightOffset = isRight ? 1.8 : 0;
                        const downOffset = !isBottom && !isRight ? 3.0 : 0;
                        const topOffset = isTop ? 8 : 0;
                        const baseY = (dot?.dy ?? 0) + 5.5 + rightOffset + downOffset + topOffset;
                        const ctrlY = (dot?.dy ?? 0) + 7.8 + rightOffset + downOffset + topOffset;
                        return (
                          <path
                            d={`M ${zx + 4 - 5},${zy + baseY} Q ${zx + 4},${zy + ctrlY} ${zx + 4 + 5},${zy + baseY}`}
                            stroke={zoneColor}
                            strokeWidth="1.2"
                            fill="none"
                            strokeLinecap="round"
                          />
                        );
                      })()}
                    {!deflection &&
                      dot &&
                      hitData.hitType !== '선행주자아웃' &&
                      hitData.hitType !== '→선행주자아웃' && (
                        <circle
                          cx={zx + dot.dx + 4}
                          cy={zy + dot.dy + 2}
                          r="1.35"
                          fill={zoneColor}
                        />
                      )}
                  </g>
                );
              })()}
          </svg>

          {/* 연속플레이 작은 화살표 — 마지막 chain 베이스의 다이아몬드 꼭지점 근처에 표시 */}
          {lastChainBase &&
            (() => {
              const arrowChar = CHAIN_ARROW[lastChainBase] || '';
              if (!arrowChar) return null;
              const apos: React.CSSProperties =
                lastChainBase === '2B'
                  ? { top: 16, left: 45 }
                  : lastChainBase === '3B'
                    ? { top: -10, left: 15 }
                    : lastChainBase === 'HOME'
                      ? { top: 22, left: -7 }
                      : { top: 18, left: 38 };
              return (
                <div
                  key="chain-arrow"
                  style={{
                    position: 'absolute',
                    pointerEvents: 'none',
                    fontSize: 10,
                    fontWeight: 900,
                    color: '#111',
                    lineHeight: 1,
                    ...apos,
                  }}
                >
                  {arrowChar}
                </div>
              );
            })()}

          {/* 대주자 Ⓡ — 대주자 기용된 베이스 꼭지점 위치에 표시 */}
          {cell?.pinchRunnerMark &&
            (() => {
              const m = cell.pinchRunnerMark;
              if (!m) return null;
              const pos: React.CSSProperties =
                m.base === '1B'
                  ? { top: 12, left: 40 }
                  : m.base === '2B'
                    ? { top: -10, left: 12 }
                    : { top: 12, left: -16 };
              return (
                <div
                  title={`대주자 ${m.pinchName}${m.mid ? ` (${m.mid.balls}B${m.mid.strikes}S 후)` : ''}`}
                  style={{
                    position: 'absolute',
                    width: 14,
                    height: 14,
                    lineHeight: '12px',
                    textAlign: 'center',
                    fontSize: 10,
                    fontWeight: 900,
                    borderRadius: '50%',
                    border: '1.5px solid #b91c1c',
                    color: '#b91c1c',
                    background: '#fff',
                    pointerEvents: 'none',
                    ...pos,
                  }}
                >
                  R
                </div>
              );
            })()}

          {/* 진루 노트 — 이전 루 위치에 한자+화살표 함께 표시 */}
          {(['1B', '2B', '3B', 'HOME'] as const).map((base) => {
            if (!noteAtBase[base]) return null;
            // 다이아몬드(48x48) 꼭지점: 2B=top(24,2) 1B=right(46,24) 3B=left(2,24) HOME=bottom(24,46)
            // 각 변 중점 근처에 배치 (top/left 픽셀 지정)
            const pos: React.CSSProperties =
              base === '2B'
                ? { top: -10, left: 30 }
                : base === '3B'
                  ? { top: -10, left: -10 }
                  : base === 'HOME'
                    ? { top: 34, left: -2 }
                    : { top: 34, left: 30 };
            return (
              <div
                key={`note-${base}`}
                style={{
                  position: 'absolute',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  ...pos,
                }}
              >
                <span style={{ fontSize: 13, color: '#111', fontWeight: 800, lineHeight: 1 }}>
                  {noteAtBase[base]}
                </span>
              </div>
            );
          })}

          {homeNoteItems.length > 0 && (
            <div
              style={{
                position: 'absolute',
                bottom: -8,
                left: -8,
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                gap: 1,
              }}
            >
              {homeNoteItems.map((item, i) => {
                if ('advLbl' in item) {
                  return (
                    <span
                      key={i}
                      style={{ fontSize: 13, color: '#111', fontWeight: 800, lineHeight: 1 }}
                    >
                      {item.advLbl}
                    </span>
                  );
                }
                const ringColor = '#111';
                const hasArrow = 'arrow' in item && item.arrow;
                return (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: 'block' }}>
                      <circle
                        cx="9"
                        cy="9"
                        r="8"
                        fill="none"
                        stroke={ringColor}
                        strokeWidth="1.8"
                      />
                      <text
                        x="9"
                        y="13.5"
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="900"
                        fontFamily="serif"
                        fill="#000"
                        stroke="#000"
                        strokeWidth="0.6"
                        paintOrder="stroke"
                      >
                        {item.kan}
                      </text>
                    </svg>
                    {hasArrow && (
                      <span style={{ fontSize: 13, color: '#111', fontWeight: 800, lineHeight: 1 }}>
                        {item.arrow}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {result && !hitData && (
        <div
          className="sc-result"
          style={{
            color: rcol,
            fontSize: 18,
            fontWeight: 'bold',
            fontFamily: result.startsWith('SF') ? "'IBM Plex Mono', monospace" : undefined,
            whiteSpace: 'nowrap',
          }}
        >
          {deflection && (
            <>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  marginRight: 2,
                  marginLeft: 2,
                  display: 'inline-block',
                  position: 'relative',
                  color: rcol,
                  verticalAlign: 'baseline',
                }}
              >
                {deflection.ballType === '뜬' && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -8,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: 9,
                      lineHeight: 1,
                    }}
                  >
                    ⌒
                  </span>
                )}
                {deflection.ballType === '라' && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -6,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: 9,
                      lineHeight: 1,
                    }}
                  >
                    —
                  </span>
                )}
                {deflection.pos}
                {deflection.ballType === '땅' && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -6,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: 9,
                      lineHeight: 1,
                    }}
                  >
                    ⌣
                  </span>
                )}
              </span>
              <span style={{ fontSize: 14 }}>·</span>
            </>
          )}
          {result.startsWith('SF') ? (
            // 희생플라이: 네모 안에 NF(외야)/Nf(내야)/NL(라인)
            (() => {
              const seq = result.slice(2);
              const lastN = parseInt((seq.match(/\d+/g) ?? []).pop() ?? '0');
              const bt = cell?.ballType;
              const sfx = bt === '라' ? 'L' : lastN >= 7 ? 'F' : 'f';
              return (
                <span
                  style={{
                    display: 'inline-block',
                    border: `1.5px solid ${rcol}`,
                    padding: '0 2px',
                    lineHeight: 1,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {seq}
                  {sfx}
                </span>
              );
            })()
          ) : /^FC/.test(result) && cell?.ballType ? (
            // FC류: prefix(FC/FC번트) + 숫자 부분에만 위/아래 ballType 마크 (땅⌣ / 뜬⌒ / 라—)
            (() => {
              const m = result.match(/^(FC번트|FC)(.*)$/);
              const prefix = m?.[1] ?? 'FC';
              const numSeq = m?.[2] ?? '';
              const bt = cell.ballType;
              return (
                <>
                  <span>{prefix}</span>
                  <span
                    style={{
                      display: 'inline-block',
                      position: 'relative',
                      lineHeight: 1,
                    }}
                  >
                    {(bt === '뜬' || bt === '라') && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -8,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontSize: 11,
                          lineHeight: 1,
                          color: rcol,
                        }}
                      >
                        {bt === '뜬' ? '⌒' : '—'}
                      </span>
                    )}
                    {numSeq}
                    {bt === '땅' && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: -8,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          fontSize: 11,
                          lineHeight: 1,
                          color: rcol,
                        }}
                      >
                        ⌣
                      </span>
                    )}
                  </span>
                </>
              );
            })()
          ) : result.startsWith('SH') && result !== 'SH진루' ? (
            // 희생번트 아웃: ⊓ 아치 안에 수비수번호(+뜬공이면 F/f/L) + 아래 ~ wave
            (() => {
              const seq = result.slice(2);
              const bt = cell?.ballType;
              const lastN = parseInt((seq.match(/\d+/g) ?? []).pop() ?? '0');
              const flySfx = bt === '뜬' ? (lastN >= 7 ? 'F' : 'f') : bt === '라' ? 'L' : '';
              return (
                <span
                  style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                    lineHeight: 1,
                  }}
                >
                  <span
                    style={{
                      borderTop: `1.5px solid ${rcol}`,
                      borderLeft: `1.5px solid ${rcol}`,
                      borderRight: `1.5px solid ${rcol}`,
                      padding: '2px 4px 4px',
                      fontSize: 12,
                      lineHeight: 1,
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontWeight: 700,
                    }}
                  >
                    {seq}
                    {flySfx}
                  </span>
                  {/* ~ 물결 */}
                  <svg width="18" height="6" viewBox="0 0 18 6">
                    <path
                      d="M0,3 Q4.5,0 9,3 Q13.5,6 18,3"
                      stroke={rcol}
                      fill="none"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              );
            })()
          ) : result.startsWith('BU') ? (
            // 번트 아웃(희생 아님): 수비수번호+suffix + ~~~ wave (네모/arch 없음)
            // suffix: 뜬→내야f/외야F, 라→L, 땅→없음
            (() => {
              const seq = result.slice(2);
              const lastN = parseInt((seq.match(/\d+/g) ?? []).pop() ?? '0');
              const bt = cell?.ballType;
              const sfx = bt === '라' ? 'L' : bt === '뜬' ? (lastN >= 7 ? 'F' : 'f') : '';
              return (
                <span
                  style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                    lineHeight: 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {seq}
                    {sfx}
                  </span>
                  {/* ~~~ 물결 (3주기) */}
                  <svg width="24" height="6" viewBox="0 0 24 6">
                    <path
                      d="M0,3 Q4,0 8,3 Q12,6 16,3 Q20,0 24,3"
                      stroke={rcol}
                      fill="none"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              );
            })()
          ) : /^F\d/.test(result) ? (
            // 페어 플라이아웃: 수비수번호 + F (대문자 고정 — f 파울과 구분)
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {result.slice(1)}F
            </span>
          ) : /^f\d/.test(result) ? (
            // 내야플라이(팝업): 수비수번호 + f
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {result.slice(1)}f
            </span>
          ) : /^L\d/.test(result) ? (
            // 라인드라이브 아웃: 수비수번호 + L
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {result.slice(1)}L
            </span>
          ) : (
            (RESULT_SYMBOL[result] ?? result.replace(/^(\d([-→]\d)*)U$/, '$1A'))
          )}
        </div>
      )}

      {runOut && runOutNum && (
        <div
          style={{
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 15,
            fontWeight: 700,
            color: '#111',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            gap: 1,
            ...(runOutBase === '2B'
              ? { top: 0, left: 57 }
              : runOutBase === '3B'
                ? { top: 0, left: 20 }
                : runOutBase === 'HOME'
                  ? { bottom: 2, left: 20 }
                  : { bottom: 2, left: 22 }),
          }}
        >
          {deflection && (
            <span
              style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                fontSize: 8,
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              {deflection.ballType === '뜬' && (
                <span style={{ fontSize: 7, lineHeight: 0.6 }}>⌒</span>
              )}
              {deflection.ballType === '라' && (
                <span style={{ fontSize: 7, lineHeight: 0.6 }}>—</span>
              )}
              <span>{deflection.pos}</span>
              {deflection.ballType === '땅' && (
                <span style={{ fontSize: 7, lineHeight: 0.6 }}>⌣</span>
              )}
            </span>
          )}
          {deflection && <span style={{ fontSize: 12, lineHeight: 1 }}>·</span>}
          {runOut.startsWith('X') ? runOut.slice(1) + 'T' : runOut}
        </div>
      )}

      {isCur && !result && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            right: 3,
            transform: 'translateY(-50%)',
            color: '#111',
            fontSize: 8,
            animation: 'blink 1s step-start infinite',
          }}
        >
          ▶
        </div>
      )}
    </div>
  );
}

const isKResult = (r: string) =>
  r === 'K' ||
  r === 'K3B' ||
  r === 'KT' ||
  r === 'KW' ||
  r === 'KP' ||
  r === 'KE' ||
  (/^ꓘ[\d-]+T?$/.test(r) && !/[보자E]/.test(r));

function calcStats(
  G: GameState,
  half: 'top' | 'bottom',
  ord: number,
  fromInn?: number,
  toInn?: number
) {
  const cs = Object.values(G.cells).filter((c) => {
    if (c.half !== half || c.order !== ord || !c.result) return false;
    // 2스트라이크 후 대타 교체 시 K → 원래 타자(toInn 경계) 귀속
    const is2StrikeSubstK = isKResult(c.result) && (c.pinchHitter?.mid?.strikes ?? 0) >= 2;
    if (fromInn !== undefined && c.inning < fromInn) return false;
    if (toInn !== undefined && c.inning >= toInn) {
      // toInn 이닝 K이고 2스트라이크 교체면 원래 타자에게 포함
      if (c.inning === toInn && is2StrikeSubstK) return true;
      return false;
    }
    // 대타(fromInn 기준)는 진입 이닝의 2스트라이크 K 제외 — 원래 타자 몫
    if (fromInn !== undefined && c.inning === fromInn && is2StrikeSubstK) return false;
    return true;
  });
  let ab = 0,
    h = 0,
    hr = 0,
    d = 0,
    t = 0,
    bb = 0,
    ibb = 0,
    hbp = 0,
    k = 0,
    run = 0,
    sh = 0,
    sf = 0,
    dp = 0,
    rbi = 0,
    sb = 0,
    caught = 0;
  // 타수 제외: 볼넷, 사구, 타격방해, 주루방해, 희생번트, 희생플라이 (record.md §1-1)
  const noAB = new Set([
    'B',
    'IB',
    'IB2',
    'HP',
    'BUNT',
    'SH진루',
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `#${n}E`),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `Ob${n}E`),
  ]);

  cs.forEach((c) => {
    const r = c.result!;
    const isSF = r.startsWith('SF');
    if (!noAB.has(r) && !isSF) ab++;
    const is1B =
      /^\/[789]$/.test(r) ||
      r === '/hit' ||
      r === 'H1' ||
      r === 'INT' ||
      r === 'BUNT' ||
      r === 'OBUNT';
    const is2B = /^>[789](-[789])?$/.test(r) || r === '>hit' || r === 'H2';
    const is3B = /^>>>[789]$/.test(r) || r === '>>>hit' || r === 'H3';
    if (is1B || is2B || is3B || r === 'HR' || r === 'GHR' || r === 'GCW') h++;
    if (r === 'HR' || r === 'GHR' || r === 'GCW') hr++;
    if (is2B) d++;
    if (is3B) t++;
    if (r === 'B') bb++;
    if (r === 'IB' || r === 'IB2') {
      bb++;
      ibb++;
    }
    if (r === 'HP') hbp++;
    // 낫아웃(KW/KP/KE)도 삼진으로 집계 (record.md §1-17); KT/KSG(ꓘ prefix, 아웃)도 포함
    if (isKResult(r)) k++;
    if (r === 'BUNT') sh++;
    if (isSF) sf++;
    if (c.scored) run++;
    if (c.isDoublePlay) dp++;
    if (c.rbi) rbi++;

    // 도루/도루실패: runnerNotes에 'S' 포함 여부로 집계
    (c.runnerNotes || []).forEach((n) => {
      if (n.base && String(n.base).startsWith('S')) sb++;
      if (n.base && String(n.base).startsWith('CS')) caught++;
    });
  });

  // 도루: 같은 half의 모든 셀에서 이 타자가 주자로 있던 시점 집계 (sideNotes 기반)
  const sbCount = Object.values(G.cells)
    .filter((c) => {
      if (c.half !== half) return false;
      if (fromInn !== undefined && c.inning < fromInn) return false;
      if (toInn !== undefined && c.inning >= toInn) return false;
      return true;
    })
    .reduce(
      (acc, c) =>
        acc + (c.sideNotes || []).filter((n) => n === `SB${ord}` || n === `S${ord}`).length,
      0
    );

  const lob = cs.filter((c) => c.lobCell).length;
  return {
    ab,
    h,
    hr,
    d,
    t,
    bb,
    ibb,
    hbp,
    k,
    run,
    sh,
    sf,
    dp,
    rbi,
    sb: sb + sbCount,
    cs: caught,
    lob,
  };
}

function calcFieldingStats(
  G: GameState,
  scoreHalf: 'top' | 'bottom',
  defPos: number,
  fromInn?: number,
  toInn?: number
) {
  // scoreHalf='top'(갑지=원정팀) → 원정팀이 수비하는 건 상대(홈)팀 공격 시 = half='bottom'
  const fieldHalf: 'top' | 'bottom' = scoreHalf === 'top' ? 'bottom' : 'top';
  let fo = 0,
    pa = 0,
    err = 0;
  Object.values(G.cells).forEach((c) => {
    if (c.half !== fieldHalf) return;
    const battInning = c.inning;
    if (fromInn !== undefined && battInning < fromInn) return;
    if (toInn !== undefined && battInning >= toInn) return;
    (c.defRoles || []).forEach((r) => {
      if (r.pos !== defPos) return;
      if (r.putout) fo++;
      if (r.assist) pa++;
      if (r.error) err++;
    });
    if (c.runOutDefRoles?.length) {
      const runInning = c.runOutInning ?? c.inning;
      if (
        (fromInn === undefined || runInning >= fromInn) &&
        (toInn === undefined || runInning < toInn)
      ) {
        c.runOutDefRoles.forEach((r) => {
          if (r.pos !== defPos) return;
          if (r.putout) fo++;
          if (r.assist) pa++;
          if (r.error) err++;
        });
      }
    }
  });
  return { fo, pa, err };
}

export default function ScoreSheet({ G, onSelCell }: Props) {
  const [viewHalf, setViewHalf] = useState<'top' | 'bottom'>(G.half);
  const [zoom, setZoom] = useState(1);

  const MIN_ZOOM = 0.6;
  const MAX_ZOOM = 1.8;
  const ZOOM_STEP = 0.1;

  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)));
  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)));
  const zoomReset = () => setZoom(1);

  useEffect(() => {
    setViewHalf(G.half);
  }, [G.half]);

  useEffect(() => {
    const beforePrint = () => {
      const wrap = document.getElementById('ss-wrap');
      if (!wrap) return;
      const tbl = wrap.querySelector<HTMLTableElement>('.ss-tbl');
      const tblW = tbl ? tbl.offsetWidth : wrap.scrollWidth;
      // 하단 섹션 너비를 ss-tbl 실측 너비로 강제 맞춤 (PDF에서 상/하단 너비 통일)
      const hdan = document.getElementById('ss-hdan');
      if (hdan) hdan.style.width = tblW + 'px';
      // A4 landscape @page margin 2mm → content ≈ 1060px (브라우저 기본 여백 포함)
      const a4ContentPx = 1060;
      const z = Math.min(1, a4ContentPx / tblW);
      document.documentElement.style.setProperty('--print-zoom', z.toFixed(5));
    };
    const afterPrint = () => {
      document.documentElement.style.removeProperty('--print-zoom');
      const hdan = document.getElementById('ss-hdan');
      if (hdan) hdan.style.width = '';
    };
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, []);

  const lu = (viewHalf === 'top' ? G.awayLineup : G.homeLineup).filter((p) => p.order > 0);
  const half = viewHalf;
  // 동명이인 검출 — 현재 viewHalf 팀의 라인업+벤치 통합
  const sheetDupes = getDuplicateNames([
    ...(viewHalf === 'top' ? G.awayLineup : G.homeLineup),
    ...(viewHalf === 'top' ? G.awayBench : G.homeBench),
  ]);
  // 기록지.pdf 표준 — 항상 15회까지 빈 셀로 보여줌 (인쇄 시 우측 공백 방지)
  const maxInn = 15;
  const inns = Array.from({ length: maxInn }, (_, i) => i + 1);

  // 타자일순(같은 이닝에 같은 타자가 2번째 이상 들어옴) — 이닝 별 최대 appearance 추적해서 컬럼 추가
  // 데이터 레이어(reducer)는 이미 appearance 1+ 셀을 G.cells 에 저장하므로 표시만 추가하면 됨
  const maxAppByInn: Record<number, number> = {};
  Object.values(G.cells).forEach((c) => {
    if (c.half !== half) return;
    const cur = maxAppByInn[c.inning] ?? 0;
    if (c.appearance > cur) maxAppByInn[c.inning] = c.appearance;
  });
  // 평면화된 컬럼 리스트 — 각 항목 = {inn, app}. 한 이닝이 일순 돌았으면 같은 inn 이 여러 번 등장
  const innCols: { inn: number; app: number }[] = [];
  inns.forEach((inn) => {
    const maxApp = maxAppByInn[inn] ?? 0;
    for (let a = 0; a <= maxApp; a++) innCols.push({ inn, app: a });
  });

  const outMap: Record<string, number> = {};
  const outByInn: Record<number, number> = {};
  // cells 삽입 순서 = chronological (가장 신뢰할 수 있는 시간 순)
  const insertSeq: Record<string, number> = {};
  Object.keys(G.cells).forEach((k, i) => {
    insertSeq[k] = i;
  });
  const seqOf = (c: CellData) => {
    const k = cellKey(c.inning, c.order, c.appearance, c.half);
    return insertSeq[k] ?? 0;
  };
  const sorted = Object.values(G.cells)
    .filter((c) => c.half === half)
    // 이닝 → 삽입 순(=시간 순) — 타순으로 폴백하지 않음
    .sort((a, b) => a.inning - b.inning || seqOf(a) - seqOf(b));

  // 이닝이 runOutNum=3 (견제사·도루실패·DP 마지막 주자)으로 끝난 경우 표시
  const inningEndedByRunOut: Record<number, string> = {};
  sorted.forEach((c) => {
    if (c.runOutNum === 3 && c.runOutInning) {
      if (!inningEndedByRunOut[c.runOutInning]) {
        inningEndedByRunOut[c.runOutInning] = cellKey(c.inning, c.order, c.appearance, half);
      }
    }
  });

  // 종료선 별도 플래그 (outMap 값은 셀의 chronological 아웃번호 보존)
  const inningEndLine: Record<string, boolean> = {};
  // cellOutNum=3 셀(병살/삼중살로 batter가 3아웃 종결)에 종료선 표시
  sorted.forEach((c) => {
    if (c.cellOutNum === 3) {
      inningEndLine[cellKey(c.inning, c.order, c.appearance, half)] = true;
    }
  });
  // 1차 패스: 이닝별 이미 점유된 out 번호 수집 (runOutNum + cellOutNum)
  const takenByInn: Record<number, Set<number>> = {};
  sorted.forEach((c) => {
    if (c.runOutNum && c.runOutInning) {
      (takenByInn[c.runOutInning] ||= new Set()).add(c.runOutNum);
    }
    if (c.cellOutNum && c.inning) {
      (takenByInn[c.inning] ||= new Set()).add(c.cellOutNum);
    }
  });

  // 2차 패스: chronological 순(sorted)으로 isOut 셀 처리, cellOutNum 없으면 takenByInn에 없는 다음 슬롯 부여
  const usedByInn: Record<number, Set<number>> = {};
  sorted.forEach((c) => {
    if (!isOut(c.result)) return;
    if (!outByInn[c.inning]) outByInn[c.inning] = 0;
    outByInn[c.inning]++;
    const cap = inningEndedByRunOut[c.inning] ? 2 : 3;
    let num: number;
    if (c.cellOutNum != null) {
      num = Math.min(c.cellOutNum, cap);
    } else {
      // 점유되지 않은 1·2·3 중 가장 작은 번호 부여
      const taken = takenByInn[c.inning] || new Set();
      const used = (usedByInn[c.inning] ||= new Set());
      num = 1;
      while (num <= 3 && (taken.has(num) || used.has(num))) num++;
      num = Math.min(num, cap);
      used.add(num);
    }
    outMap[cellKey(c.inning, c.order, c.appearance, half)] = num;
  });

  // runOut으로 이닝이 끝난 경우 종료선은 그 이닝의 마지막 타자 셀에 별도 플래그로 표시
  // (outMap 값은 cellOutNum을 보존; 종료선만 inningEndLine으로 표시)
  Object.keys(inningEndedByRunOut).forEach((innStr) => {
    const inn = Number(innStr);
    const innCells = sorted.filter((c) => c.inning === inn && c.result !== null);
    if (innCells.length > 0) {
      const last = innCells[innCells.length - 1];
      const ck = cellKey(last.inning, last.order, last.appearance, half);
      inningEndLine[ck] = true;
    }
  });

  // 견제사/도루실패로 3아웃 시: 해당 이닝에서 마지막 result 있는 타자 셀에 종료선 (별도 플래그)
  Object.entries(outByInn).forEach(([innStr, outs]) => {
    if (outs < 3) return;
    const inn = Number(innStr);
    const prefix = `${half}-${inn}-`;
    const hasLine = Object.keys(inningEndLine).some((k) => k.startsWith(prefix));
    if (hasLine) return;
    // 이 이닝의 마지막 result 있는 셀 찾기
    const innCells = sorted.filter((c) => c.inning === inn && c.result !== null);
    if (innCells.length > 0) {
      const last = innCells[innCells.length - 1];
      const ck = cellKey(last.inning, last.order, last.appearance, half);
      inningEndLine[ck] = true;
    }
  });

  const awayTeamLabel = G.awayTeam || '원정';
  const homeTeamLabel = G.homeTeam || '홈';

  const pitcherLU = viewHalf === 'top' ? G.homeLineup : G.awayLineup;
  const pitcherFromLU = pitcherLU.find((p) => p.pos === 1);
  const isLive = viewHalf === G.half;
  const activePitcherName = isLive ? G.pitcher.name : pitcherFromLU?.name || '—';
  const activePitcherNum = isLive ? G.pitcher.num : pitcherFromLU?.num || '';
  const activePitchCount = isLive ? G.pitcher.pitchCount : 0;
  const activeBallCount = isLive ? G.pitchBalls : 0;
  const activeStrikeCount = isLive ? G.pitchStrikes : 0;
  const activeBatterName = isLive
    ? lu.find((p) => p.order === G.curBatterOrder)?.name || '—'
    : null;

  return (
    <div className="ss-area" id="ss-area">
      <div className="ss-top" id="ss-top">
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setViewHalf('top')}
            style={{
              padding: '2px 10px',
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 2,
              cursor: 'pointer',
              background: viewHalf === 'top' ? 'var(--blue)' : '#fff',
              color: viewHalf === 'top' ? '#fff' : 'var(--text)',
              border: `1px solid ${viewHalf === 'top' ? 'var(--blue)' : 'var(--border)'}`,
            }}
          >
            갑 {awayTeamLabel}
          </button>
          <button
            onClick={() => setViewHalf('bottom')}
            style={{
              padding: '2px 10px',
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 2,
              cursor: 'pointer',
              background: viewHalf === 'bottom' ? 'var(--blue)' : '#fff',
              color: viewHalf === 'bottom' ? '#fff' : 'var(--text)',
              border: `1px solid ${viewHalf === 'bottom' ? 'var(--blue)' : 'var(--border)'}`,
            }}
          >
            을 {homeTeamLabel}
          </button>
        </div>

        <span>
          {G.inning}회 <b style={{ color: '#111' }}>{G.half === 'top' ? '초' : '말'}</b>
        </span>

        {isLive && (
          <>
            <span>
              아웃 <b style={{ color: '#111' }}>{G.outs}</b>
            </span>
            <span>
              볼카운트{' '}
              <b>
                {G.balls}B-{G.strikes}S
              </b>
            </span>
            <span>
              타자 <b>{activeBatterName}</b>
            </span>
          </>
        )}

        <span style={{ marginLeft: 4, borderLeft: '1px solid var(--border2)', paddingLeft: 8 }}>
          투수 <b>{activePitcherName}</b>
          {activePitcherNum && <span style={{ color: '#111', fontSize: 9 }}></span>}
          {isLive && (
            <span style={{ color: '#111', fontSize: 9 }}> &nbsp;{activePitchCount}구</span>
          )}
        </span>

        {isLive && (
          <span style={{ color: '#111', fontSize: 9 }}>
            볼 {activeBallCount} / 스트 {activeStrikeCount}
          </span>
        )}

        <span
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            paddingLeft: 8,
            borderLeft: '1px solid var(--border2)',
          }}
        >
          <button
            type="button"
            onClick={zoomOut}
            style={{
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 2,
              cursor: 'pointer',
              background: '#fff',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
            title="축소"
          >
            -
          </button>

          <button
            type="button"
            onClick={zoomReset}
            style={{
              minWidth: 56,
              padding: '2px 8px',
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 2,
              cursor: 'pointer',
              background: '#fff',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
            title="기본 배율"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={zoomIn}
            style={{
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 2,
              cursor: 'pointer',
              background: '#fff',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
            title="확대"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              padding: '2px 10px',
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 2,
              cursor: 'pointer',
              background: '#fff',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              marginLeft: 4,
            }}
            title="인쇄 (A4)"
          >
            인쇄
          </button>
        </span>
      </div>

      <div
        style={{
          overflow: 'auto',
          width: '100%',
          height: '100%',
        }}
      >
        <div
          style={{
            zoom: `${zoom}`,
          }}
        >
          <div id="ss-wrap" style={{ width: 'max-content', minWidth: '100%' }}>
            <table className="ss-tbl">
              <thead>
                {/* 날짜 / 팀명 / 날씨 행 */}
                <tr>
                  <th
                    colSpan={25 + innCols.length}
                    style={{
                      background: '#e8e8e8',
                      border: '1px solid #b0b5bd',
                      padding: 0,
                      fontWeight: 'normal',
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
                      {/* 좌: 날짜 + 팀명 / 날씨 */}
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '4px 10px',
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>{G.date || '----년 --월 --일'}</span>
                        {viewHalf === 'top' ? (
                          <span
                            style={{
                              borderLeft: '1px solid #b0b5bd',
                              paddingLeft: 10,
                              marginLeft: 4,
                            }}
                          >
                            <span style={{ fontSize: 10, color: '#666', marginRight: 4 }}>(Y)</span>
                            <b style={{ fontSize: 14 }}>{awayTeamLabel}</b>
                            <span style={{ margin: '0 8px' }}>대</span>
                            <span style={{ fontSize: 10, color: '#666', marginRight: 4 }}>(H)</span>
                            <b style={{ fontSize: 14 }}>{homeTeamLabel}</b>
                          </span>
                        ) : (
                          <>
                            <span
                              style={{
                                borderLeft: '1px solid #b0b5bd',
                                paddingLeft: 10,
                                marginLeft: 4,
                              }}
                            >
                              <b style={{ fontSize: 14 }}>{awayTeamLabel}</b>
                              <span style={{ margin: '0 8px', fontWeight: 700 }}>VS</span>
                              <b style={{ fontSize: 14 }}>{homeTeamLabel}</b>
                            </span>
                            <div
                              style={{
                                display: 'flex',
                                flex: 1,
                                justifyContent: 'space-between',
                                marginLeft: 16,
                                fontSize: 11,
                              }}
                            >
                              <span>
                                구장명 : <b>{G.stadium || ''}</b>
                              </span>
                              <span>
                                온도 : <b>{G.temperature || ''}</b> ℃
                              </span>
                              <span>
                                습도 : <b>{G.humidity || ''}</b> %
                              </span>
                              <span>
                                일기 : <b>{G.weatherLog || ''}</b>
                              </span>
                              <span>
                                풍향 : <b>{G.windDir || ''}</b>
                              </span>
                              <span>
                                풍속 : <b>{G.windSpeed || ''}</b> m/sec
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      {/* 우(갑지만): 이닝별 점수 */}
                      {viewHalf === 'top' &&
                        (() => {
                          const INN_MAX = 15;
                          const innHeaders = Array.from({ length: INN_MAX }, (_, i) => i + 1);
                          const awayInnRuns = Array(INN_MAX).fill(null) as (number | null)[];
                          const homeInnRuns = Array(INN_MAX).fill(null) as (number | null)[];
                          Object.values(G.cells).forEach((c) => {
                            if (c.inning > INN_MAX) return;
                            if (c.scored) {
                              if (c.half === 'top')
                                awayInnRuns[c.inning - 1] = (awayInnRuns[c.inning - 1] || 0) + 1;
                              else homeInnRuns[c.inning - 1] = (homeInnRuns[c.inning - 1] || 0) + 1;
                            }
                            if (c.result === 'HR' || c.result === 'GHR') {
                              if (c.half === 'top')
                                awayInnRuns[c.inning - 1] = (awayInnRuns[c.inning - 1] || 0) + 1;
                              else homeInnRuns[c.inning - 1] = (homeInnRuns[c.inning - 1] || 0) + 1;
                            }
                          });
                          const BD = '1px solid #b0b5bd';
                          const tdN: React.CSSProperties = {
                            border: BD,
                            padding: '2px 0',
                            minWidth: 24,
                            textAlign: 'center',
                            background: '#fff',
                            fontSize: 10,
                          };
                          const tdT: React.CSSProperties = {
                            ...tdN,
                            minWidth: 34,
                            fontWeight: 700,
                            background: '#fef9c3',
                          };
                          return (
                            <div
                              style={{
                                borderLeft: '1px solid #b0b5bd',
                                padding: '3px 8px',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              <table
                                style={{
                                  borderCollapse: 'collapse',
                                  fontSize: 10,
                                  border: '1px solid #b0b5bd',
                                }}
                              >
                                <thead>
                                  <tr>
                                    <th
                                      style={{
                                        border: BD,
                                        padding: '2px 6px',
                                        background: '#e8e8e8',
                                        minWidth: 42,
                                        fontSize: 10,
                                      }}
                                    >
                                      팀
                                    </th>
                                    {innHeaders.map((i) => (
                                      <th
                                        key={i}
                                        style={{ ...tdN, background: '#e8e8e8', fontWeight: 700 }}
                                      >
                                        {i}
                                      </th>
                                    ))}
                                    <th style={{ ...tdT, background: '#d1fae5' }}>합계</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td
                                      style={{
                                        border: BD,
                                        padding: '2px 6px',
                                        fontWeight: 700,
                                        background: '#fff',
                                        textAlign: 'center',
                                        fontSize: 10,
                                      }}
                                    >
                                      {awayTeamLabel}
                                    </td>
                                    {innHeaders.map((i) => {
                                      const v = awayInnRuns[i - 1];
                                      return (
                                        <td key={i} style={tdN}>
                                          {i <= G.inning ? (v ?? 0) : ''}
                                        </td>
                                      );
                                    })}
                                    <td style={tdT}>{G.awayR}</td>
                                  </tr>
                                  <tr>
                                    <td
                                      style={{
                                        border: BD,
                                        padding: '2px 6px',
                                        fontWeight: 700,
                                        background: '#fff',
                                        textAlign: 'center',
                                        fontSize: 10,
                                      }}
                                    >
                                      {homeTeamLabel}
                                    </td>
                                    {innHeaders.map((i) => {
                                      const v = homeInnRuns[i - 1];
                                      const started =
                                        i < G.inning || (i === G.inning && G.half === 'bottom');
                                      return (
                                        <td key={i} style={tdN}>
                                          {started ? (v ?? 0) : ''}
                                        </td>
                                      );
                                    })}
                                    <td style={tdT}>{G.homeR}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                    </div>
                  </th>
                </tr>
                {/* 컬럼 헤더 */}
                <tr>
                  <th
                    rowSpan={2}
                    style={{
                      width: 14,
                      writingMode: 'vertical-rl',
                      fontSize: 9,
                      padding: '4px 0',
                    }}
                  >
                    풋아웃
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      width: 14,
                      writingMode: 'vertical-rl',
                      fontSize: 9,
                      padding: '4px 0',
                    }}
                  >
                    어시스트
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      width: 14,
                      writingMode: 'vertical-rl',
                      fontSize: 9,
                      padding: '4px 0',
                    }}
                  >
                    실책
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      width: 14,
                      writingMode: 'vertical-rl',
                      fontSize: 9,
                      padding: '4px 0',
                    }}
                  >
                    병살
                  </th>
                  <th rowSpan={2} style={{ width: 22 }}>
                    수비
                  </th>
                  <th rowSpan={2} style={{ minWidth: 80 }}>
                    선수명
                  </th>
                  <th rowSpan={2} style={{ minWidth: 26 }}>
                    타순
                  </th>
                  {innCols.map(({ inn, app }) => (
                    <th
                      key={`${inn}-${app}`}
                      rowSpan={2}
                      className={inn === G.inning && half === G.half ? 'cur-inn-h' : ''}
                      style={{ minWidth: 80, width: 80, position: 'relative' }}
                    >
                      {inn}
                    </th>
                  ))}
                  <th className="ss-stat" rowSpan={2}>
                    타수
                  </th>
                  <th className="ss-stat" rowSpan={2}>
                    득점
                  </th>
                  <th className="ss-stat" colSpan={4}>
                    안타
                  </th>
                  <th className="ss-stat" rowSpan={2}>
                    루타수
                  </th>
                  <th className="ss-stat" rowSpan={2}>
                    타점
                  </th>
                  <th className="ss-stat" rowSpan={2}>
                    희타
                  </th>
                  <th className="ss-stat" rowSpan={2}>
                    희비
                  </th>
                  <th className="ss-stat" rowSpan={2}>
                    도루
                  </th>
                  <th className="ss-stat" rowSpan={2}>
                    도실
                  </th>
                  <th className="ss-stat" rowSpan={2}>
                    4구
                  </th>
                  <th className="ss-stat" rowSpan={2}>
                    고사
                  </th>
                  <th className="ss-stat" rowSpan={2} style={{ minWidth: 30 }}>
                    사구
                  </th>
                  <th className="ss-stat" rowSpan={2}>
                    삼진
                  </th>
                  <th className="ss-stat" rowSpan={2}>
                    병살
                  </th>
                  <th className="ss-stat" rowSpan={2}>
                    잔루
                  </th>
                </tr>
                <tr>
                  <th className="ss-stat">계</th>
                  <th className="ss-stat">2루타</th>
                  <th className="ss-stat">3루타</th>
                  <th className="ss-stat">홈런</th>
                </tr>
              </thead>

              <tbody>
                {lu.flatMap((p) => {
                  const ord = p.order;
                  // 같은 타순(ord)에 발생한 모든 교체 이벤트 → layers 배열 (test.html 형식)
                  const tableSide: 'away' | 'home' = half === 'top' ? 'away' : 'home';
                  const orderSubs = (G.substitutions || [])
                    .filter((s) => s.side === tableSide && s.order === ord)
                    .sort((a, b) => {
                      if (a.inning !== b.inning) return a.inning - b.inning;
                      if (a.half !== b.half) return a.half === 'top' ? -1 : 1;
                      return 0; // 같은 inning+half 면 삽입 순서 유지 (R 입장 → autoD 순)
                    });
                  type Layer = {
                    left: string;
                    name: string;
                    num: string;
                    inning?: number;
                    atOrder?: number;
                  };
                  const layers: Layer[] = [];
                  const starterName = orderSubs[0]?.oldName || p.name;
                  const starterNum = orderSubs[0]?.oldNum || p.num;
                  const starterPos = p.pos === 0 ? 'D' : String(orderSubs[0] ? '' : p.pos || '');
                  layers.push({ left: starterPos || '', name: starterName, num: starterNum });
                  for (const s of orderSubs) {
                    const left = s.kind === 'R' ? 'R' : s.kind === 'H' ? 'H' : String(s.pos);
                    const lastIdx = layers.length - 1;
                    const last = layers[lastIdx];
                    // 직전 layer 가 같은 선수의 R/H 입장이고 이번이 D 면 → 새 행 추가하지 않고
                    // 그 layer 의 left 를 새 수비 포지션 숫자로 갱신 (이닝/타순 표시는 입장 시점 유지)
                    if (
                      s.kind === 'D' &&
                      last.name === s.newName &&
                      (last.left === 'R' || last.left === 'H')
                    ) {
                      layers[lastIdx] = { ...last, left: String(s.pos) };
                      continue;
                    }
                    if (last.left !== left || last.name !== s.newName) {
                      layers.push({
                        left,
                        name: s.newName,
                        num: s.newNum,
                        inning: s.inning,
                        atOrder: s.atOrder,
                      });
                    }
                  }
                  const SUB_ROWS = Math.max(3, layers.length);
                  const fmtTs = (l: Layer) => {
                    if (!l.inning) return '';
                    if (l.atOrder) return `(${l.inning},${l.atOrder})`;
                    return `(${l.inning})`;
                  };
                  const orderNums = Array.from({ length: SUB_ROWS }, (_, i) => ord + i * 10);

                  return Array.from({ length: SUB_ROWS }, (_, sub) => {
                    const layer = layers[sub];
                    return (
                      <tr
                        key={`${ord}-sub${sub}`}
                        className={[sub > 0 ? 'ss-row-sublayer' : ''].filter(Boolean).join(' ')}
                      >
                        {/* 풋아웃/어시스트/실책/병살 — 각 sub-row */}
                        {(() => {
                          const defPos = parseInt(layer?.left ?? '');
                          const fs = isNaN(defPos)
                            ? { fo: 0, pa: 0, err: 0 }
                            : calcFieldingStats(
                                G,
                                half,
                                defPos,
                                layers[sub]?.inning,
                                layers[sub + 1]?.inning
                              );
                          const cell = (v: number) => (
                            <td
                              className="ss-stat"
                              style={{ width: 14, borderRight: '1px solid #b0b5bd' }}
                            >
                              {v || ''}
                            </td>
                          );
                          return (
                            <>
                              {cell(fs.fo)}
                              {cell(fs.pa)}
                              {cell(fs.err)}
                              <td style={{ width: 14 }} />
                            </>
                          );
                        })()}
                        {/* 수비위치 — 각 sub-row */}
                        <td
                          style={{
                            width: 22,
                            textAlign: 'center',
                            fontSize: 10,
                            fontWeight: 700,
                            fontFamily: 'monospace',
                          }}
                        >
                          {layer?.left ?? ''}
                        </td>
                        {/* 선수명 + (이닝,타순) — 각 sub-row */}
                        <td
                          style={{
                            minWidth: 80,
                            padding: '1px 4px',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            const lastKey = [...innCols]
                              .reverse()
                              .map(({ inn, app }) => cellKey(inn, ord, app, half))
                              .find((k) => !!G.cells[k]?.result);
                            if (lastKey) onSelCell(lastKey);
                          }}
                        >
                          {layer ? (
                            <span style={{ fontSize: 13, fontWeight: 600 }}>
                              {displayName(layer.name, layer.num, sheetDupes)}
                              {sub > 0 && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 500,
                                    color: '#374151',
                                    marginLeft: 2,
                                  }}
                                >
                                  {fmtTs(layer)}
                                </span>
                              )}
                            </span>
                          ) : (
                            ''
                          )}
                        </td>
                        {/* 타순 — 각 sub-row */}
                        <td
                          style={{
                            textAlign: 'center',
                            fontSize: 11,
                            fontWeight: sub === 0 ? 700 : 400,
                            color: layer ? '#111' : '#9ca3af',
                          }}
                        >
                          {orderNums[sub]}
                        </td>

                        {sub === 0 &&
                          innCols.map(({ inn, app }) => {
                            const ck = cellKey(inn, ord, app, half);
                            const c = G.cells[ck] || null;
                            const iS = G.selCellKey === ck;
                            const iC =
                              ck === G.selCellKey &&
                              !c?.result &&
                              half === G.half &&
                              ord === G.curBatterOrder &&
                              inn === G.inning;
                            const oNum = outMap[ck];

                            return (
                              <td
                                key={`${inn}-${app}`}
                                rowSpan={SUB_ROWS}
                                className={inn === G.inning && half === G.half ? 'cur-inn-col' : ''}
                                onClick={() => onSelCell(ck)}
                                style={{
                                  width: 80,
                                  minWidth: 80,
                                  position: 'relative',
                                  borderBottom: inningEndLine[ck]
                                    ? '2px solid var(--blue)'
                                    : undefined,
                                }}
                              >
                                {(() => {
                                  const _pc = (G.pitcherChanges || []).find(
                                    (pc) =>
                                      pc.half === half &&
                                      pc.inning === inn &&
                                      pc.order === ord &&
                                      app === 0
                                  );
                                  // 작은 가로 ~ 는 PA 도중 교체(_pc.mid 존재)일 때만 사용
                                  const _pcAt = _pc?.mid
                                    ? (_pc.mid.balls ?? 0) + (_pc.mid.strikes ?? 0)
                                    : undefined;
                                  const _pcTip = _pc
                                    ? `투수 교체: ${_pc.oldName ?? ''} → ${_pc.name}${
                                        _pc.mid ? ` (${_pc.mid.balls}B${_pc.mid.strikes}S 후)` : ''
                                      }`
                                    : undefined;
                                  // 대타 사다리 위치: G.substitutions에서 이 셀의 교체 목록 계산
                                  const _cellPitches = c?.pitches || [];
                                  const _pinchSubsAt = (G.substitutions || [])
                                    .filter(
                                      (s) =>
                                        s.kind === 'H' &&
                                        s.inning === inn &&
                                        s.half === half &&
                                        s.atOrder === ord
                                    )
                                    .map((s) => ({
                                      at: s.mid
                                        ? computePinchSplitAt(
                                            _cellPitches,
                                            s.mid.balls,
                                            s.mid.strikes
                                          )
                                        : 0,
                                      tip: `대타: ${s.oldName} → ${s.newName}${s.mid ? ` (${s.mid.balls}B${s.mid.strikes}S 후)` : ''}`,
                                    }))
                                    .sort((a, b) => a.at - b.at);
                                  return (
                                    <ScoreCell
                                      cell={c}
                                      isSel={iS}
                                      isCur={iC}
                                      outNum={oNum ?? c?.runOutNum}
                                      pitcherChangeAt={_pcAt}
                                      pitcherChangeTip={_pcTip}
                                      pinchSubsAt={
                                        _pinchSubsAt.length > 0 ? _pinchSubsAt : undefined
                                      }
                                    />
                                  );
                                })()}
                                {(() => {
                                  // 투수 교체 물결선 — 3가지 패턴
                                  // 경우 1) 일반 교대 (mid 없음): (一) 셀 좌측 벽 + 하단 가로 (ㄴ가 (一) 감쌈)
                                  //   이닝 시작 첫 타석 교체일 때(같은 이닝에 (一) 없음): (二) 셀 상단 가로만
                                  // 경우 2) 볼카운트 중, 책임=현임: (二) 셀 안 ㄴ — 내부 가로 + 좌측 벽 세로(그 아래)
                                  // 경우 3) 볼카운트 중, BB 책임=전임: (二) 셀 좌측 벽 + 하단 가로 (외곽 ㄴ)
                                  const pcThis = (G.pitcherChanges || []).find(
                                    (pc) =>
                                      pc.half === half &&
                                      pc.inning === inn &&
                                      pc.order === ord &&
                                      app === 0
                                  );
                                  if (!pcThis) return null;

                                  const buildVWave = (
                                    fromY: number,
                                    toY: number,
                                    cxPos: number
                                  ) => {
                                    const step = 8;
                                    let d = `M ${cxPos} ${fromY}`;
                                    let y = fromY;
                                    let t = 0;
                                    while (y < toY) {
                                      const next = Math.min(y + step, toY);
                                      const cx = t % 2 === 0 ? cxPos + 4 : cxPos - 4;
                                      const cy = (y + next) / 2;
                                      d += ` Q ${cx} ${cy} ${cxPos} ${next}`;
                                      y = next;
                                      t++;
                                    }
                                    return d;
                                  };
                                  const buildHWave = (
                                    fromX: number,
                                    toX: number,
                                    cyPos: number
                                  ) => {
                                    const step = 6;
                                    let d = `M ${fromX} ${cyPos}`;
                                    let x = fromX;
                                    let t = 0;
                                    while (x < toX) {
                                      const next = Math.min(x + step, toX);
                                      const cx = (x + next) / 2;
                                      const cy = t % 2 === 0 ? cyPos + 4 : cyPos - 4;
                                      d += ` Q ${cx} ${cy} ${next} ${cyPos}`;
                                      x = next;
                                      t++;
                                    }
                                    return d;
                                  };

                                  const tip = `투수 교체: ${pcThis.oldName ?? ''} → ${pcThis.name}${
                                    pcThis.mid
                                      ? ` (${pcThis.mid.balls}B${pcThis.mid.strikes}S 후)`
                                      : ''
                                  }`;

                                  const hasMid = !!pcThis?.mid;
                                  const isCase3 = hasMid && !!c?.bbChargedTo;
                                  const isCase2 = hasMid && !isCase3;
                                  // 이닝 시작 첫 타석 교체 (같은 이닝에 (一) 없음 = ord-1 셀에 PA 없음)
                                  const prevCellSameInn =
                                    pcThis && pcThis.order > 1
                                      ? G.cells[cellKey(inn, pcThis.order - 1, 0, half)]
                                      : null;
                                  const isCase1Start = pcThis && !pcThis.mid && !prevCellSameInn;

                                  // 볼카운트 컬럼은 셀 좌측 18px 세로 strip — 우측 벽 x≈12 viewBox
                                  // 셀(.sc) 92px wide × 88px tall, viewBox 60×60 매핑
                                  const internalArmX = 12; // 볼카운트 컬럼 우측 벽 (border-right)
                                  // 볼카운트 영역 Y 길이: 던진 투구 수에 비례 (각 투구 ~9 viewBox Y)
                                  const midPitches = hasMid
                                    ? (pcThis!.mid!.balls ?? 0) + (pcThis!.mid!.strikes ?? 0)
                                    : 0;
                                  const internalArmY = Math.min(50, 2 + midPitches * 9);

                                  // 부분폭 (이미지 기준 — 약 60-70%)
                                  const partialArmX = 40;

                                  return (
                                    <>
                                      {/* 경우 1 일반: (二) 셀 상단 가로(타석칸 끝까지) + 좌측 벽 세로(아래로) */}
                                      {pcThis && !pcThis.mid && !isCase1Start && (
                                        <>
                                          <svg
                                            width="100%"
                                            height="8"
                                            viewBox="0 0 60 6"
                                            preserveAspectRatio="none"
                                            style={{
                                              position: 'absolute',
                                              top: -4,
                                              left: 0,
                                              pointerEvents: 'none',
                                              zIndex: 10,
                                            }}
                                          >
                                            <title>{tip}</title>
                                            <path
                                              d={buildHWave(0, 60, 3)}
                                              stroke="#dc2626"
                                              strokeWidth="1.2"
                                              fill="none"
                                              strokeLinecap="round"
                                            />
                                          </svg>
                                          <svg
                                            width="10"
                                            height="100%"
                                            viewBox="0 0 10 60"
                                            preserveAspectRatio="none"
                                            style={{
                                              position: 'absolute',
                                              top: 0,
                                              left: -5,
                                              pointerEvents: 'none',
                                              zIndex: 10,
                                            }}
                                          >
                                            <title>{tip}</title>
                                            <path
                                              d={buildVWave(0, 60, 5)}
                                              stroke="#dc2626"
                                              strokeWidth="1.2"
                                              fill="none"
                                              strokeLinecap="round"
                                            />
                                          </svg>
                                        </>
                                      )}

                                      {/* 경우 1 이닝 시작 fallback: (二) 셀 상단 가로만 (벽 없이) */}
                                      {isCase1Start && (
                                        <svg
                                          width="100%"
                                          height="8"
                                          viewBox="0 0 60 6"
                                          preserveAspectRatio="none"
                                          style={{
                                            position: 'absolute',
                                            top: -4,
                                            left: 0,
                                            pointerEvents: 'none',
                                            zIndex: 10,
                                          }}
                                        >
                                          <title>{tip}</title>
                                          <path
                                            d={buildHWave(0, 60, 3)}
                                            stroke="#dc2626"
                                            strokeWidth="1.2"
                                            fill="none"
                                            strokeLinecap="round"
                                          />
                                        </svg>
                                      )}

                                      {/* 경우 2: 볼카운트 우측을 타고 위로 + 셀 상단 우측으로
                                          path: (internalArmX, internalArmY) → (internalArmX, 0) → (60, 0) */}
                                      {isCase2 && (
                                        <svg
                                          width="100%"
                                          height="100%"
                                          viewBox="0 0 60 60"
                                          preserveAspectRatio="none"
                                          style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            pointerEvents: 'none',
                                            zIndex: 10,
                                            overflow: 'visible',
                                          }}
                                        >
                                          <title>{tip}</title>
                                          <path
                                            d={`${buildVWave(0, internalArmY, internalArmX)} ${buildHWave(internalArmX, 60, 0)}`}
                                            stroke="#dc2626"
                                            strokeWidth="1.2"
                                            fill="none"
                                            strokeLinecap="round"
                                          />
                                        </svg>
                                      )}

                                      {/* 경우 3: (二) 셀 외곽 ㄴ — 좌측 벽 세로 + 하단 가로
                                          (BB 책임 전임 투수) */}
                                      {isCase3 && (
                                        <>
                                          <svg
                                            width="10"
                                            height="100%"
                                            viewBox="0 0 10 60"
                                            preserveAspectRatio="none"
                                            style={{
                                              position: 'absolute',
                                              top: 0,
                                              left: -5,
                                              pointerEvents: 'none',
                                              zIndex: 10,
                                            }}
                                          >
                                            <title>{tip}</title>
                                            <path
                                              d={buildVWave(0, 60, 5)}
                                              stroke="#dc2626"
                                              strokeWidth="1.2"
                                              fill="none"
                                              strokeLinecap="round"
                                            />
                                          </svg>
                                          <svg
                                            width={`${(partialArmX / 60) * 100}%`}
                                            height="8"
                                            viewBox={`0 0 ${partialArmX} 6`}
                                            preserveAspectRatio="none"
                                            style={{
                                              position: 'absolute',
                                              bottom: -4,
                                              left: 0,
                                              pointerEvents: 'none',
                                              zIndex: 10,
                                            }}
                                          >
                                            <title>{tip}</title>
                                            <path
                                              d={buildHWave(0, partialArmX, 3)}
                                              stroke="#dc2626"
                                              strokeWidth="1.2"
                                              fill="none"
                                              strokeLinecap="round"
                                            />
                                          </svg>
                                        </>
                                      )}
                                    </>
                                  );
                                })()}
                                {inningEndLine[ck] && (
                                  <span
                                    style={{
                                      position: 'absolute',
                                      right: 1,
                                      bottom: -8,
                                      fontSize: 11,
                                      fontWeight: 900,
                                      color: 'var(--blue)',
                                      lineHeight: 1,
                                      pointerEvents: 'none',
                                    }}
                                  >
                                    //
                                  </span>
                                )}
                              </td>
                            );
                          })}

                        {(() => {
                          if (!layer) {
                            return (
                              <>
                                {Array.from({ length: 18 }, (_, i) => (
                                  <td key={i} className="ss-stat" />
                                ))}
                              </>
                            );
                          }
                          const st = calcStats(
                            G,
                            half,
                            ord,
                            layers[sub]?.inning,
                            layers[sub + 1]?.inning
                          );
                          const tb = st.h - st.d - st.t - st.hr + 2 * st.d + 3 * st.t + 4 * st.hr;
                          return (
                            <>
                              <td className="ss-stat" style={{}}>
                                {st.ab || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {st.run || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {st.h || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {st.d || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {st.t || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {st.hr || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {tb || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {st.rbi || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {st.sh || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {st.sf || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {st.sb || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {st.cs || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {st.bb || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {st.ibb || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {st.hbp || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {st.k || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {st.dp || ''}
                              </td>
                              <td className="ss-stat" style={{}}>
                                {st.lob || ''}
                              </td>
                            </>
                          );
                        })()}
                      </tr>
                    );
                  });
                })}

                {(() => {
                  // 합계 행 (라인업 직후, 교대란 직전): 명 count 두 줄 + 이닝별 득점
                  const sideR: 'away' | 'home' = half === 'top' ? 'away' : 'home';
                  const myLineupR = sideR === 'away' ? G.awayLineup : G.homeLineup;
                  const myPitchHalfR: Half = half === 'top' ? 'bottom' : 'top';
                  const fset = new Set<string>();
                  myLineupR.forEach((p) => {
                    if (p.pos !== 1 && p.name) fset.add(`${p.num}|${p.name}`);
                  });
                  (G.substitutions || []).forEach((s) => {
                    if (s.side !== sideR) return;
                    if (s.kind === 'D' && s.pos === 1) return;
                    if (s.newName) fset.add(`${s.newNum}|${s.newName}`);
                    if (s.oldName) fset.add(`${s.oldNum}|${s.oldName}`);
                  });
                  const pset = new Set<string>();
                  const sp = myLineupR.find((p) => p.pos === 1);
                  if (sp && sp.name) pset.add(`${sp.num}|${sp.name}`);
                  (G.pitcherChanges || [])
                    .filter((pc) => pc.half === myPitchHalfR)
                    .forEach((pc) => {
                      pset.add(`${pc.num ?? ''}|${pc.name}`);
                      if (pc.oldName) pset.add(`${pc.oldNum ?? ''}|${pc.oldName}`);
                    });
                  (G.substitutions || []).forEach((s) => {
                    if (s.side !== sideR) return;
                    if (s.kind === 'D' && s.pos === 1) {
                      pset.add(`${s.newNum}|${s.newName}`);
                      if (s.oldName) pset.add(`${s.oldNum}|${s.oldName}`);
                    }
                  });
                  const fCount = fset.size;
                  const pCount = pset.size;
                  return (
                    <tr style={{ height: 28, borderTop: '2px solid var(--border)' }}>
                      <td colSpan={4} style={{ borderTop: '2px solid var(--border)' }} />
                      <td style={{ borderTop: '2px solid var(--border)' }} />
                      <td
                        style={{
                          minWidth: 80,
                          borderTop: '2px solid var(--border)',
                          fontSize: 11,
                          fontWeight: 700,
                          textAlign: 'center',
                          lineHeight: 1.2,
                          padding: '2px 0',
                        }}
                        title={`야수 ${fCount}명 / 투수 ${pCount}명 (변경 포함)`}
                      >
                        <div>합계</div>
                      </td>
                      <td
                        style={{
                          borderTop: '2px solid var(--border)',
                          fontSize: 10,
                          textAlign: 'center',
                          lineHeight: 1.2,
                          padding: '2px 0',
                        }}
                      >
                        <div>{fCount}명</div>
                        <div>{pCount}명</div>
                      </td>
                      <td colSpan={inns.length} style={{ borderTop: '2px solid var(--border)' }} />
                      {(() => {
                        // 우측 stat 컬럼 팀 합계 — 라인업의 모든 타순 합산
                        const totals = {
                          ab: 0,
                          run: 0,
                          h: 0,
                          d: 0,
                          t: 0,
                          hr: 0,
                          rbi: 0,
                          sh: 0,
                          sf: 0,
                          sb: 0,
                          cs: 0,
                          bb: 0,
                          ibb: 0,
                          hbp: 0,
                          k: 0,
                          dp: 0,
                          lob: 0,
                        };
                        lu.forEach((p) => {
                          const s = calcStats(G, half, p.order);
                          totals.ab += s.ab;
                          totals.run += s.run;
                          totals.h += s.h;
                          totals.d += s.d;
                          totals.t += s.t;
                          totals.hr += s.hr;
                          totals.rbi += s.rbi;
                          totals.sh += s.sh;
                          totals.sf += s.sf;
                          totals.sb += s.sb;
                          totals.cs += s.cs;
                          totals.bb += s.bb;
                          totals.ibb += s.ibb;
                          totals.hbp += s.hbp;
                          totals.k += s.k;
                          totals.dp += s.dp;
                          totals.lob += s.lob;
                        });
                        const tb =
                          totals.h -
                          totals.d -
                          totals.t -
                          totals.hr +
                          2 * totals.d +
                          3 * totals.t +
                          4 * totals.hr;
                        const tStyle: React.CSSProperties = {
                          borderTop: '2px solid var(--border)',
                          textAlign: 'center',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 2px',
                        };
                        const order: number[] = [
                          totals.ab,
                          totals.run,
                          totals.h,
                          totals.d,
                          totals.t,
                          totals.hr,
                          tb,
                          totals.rbi,
                          totals.sh,
                          totals.sf,
                          totals.sb,
                          totals.cs,
                          totals.bb,
                          totals.ibb,
                          totals.hbp,
                          totals.k,
                          totals.dp,
                          totals.lob,
                        ];
                        return order.map((v, i) => (
                          <td key={`total-${i}`} style={tStyle}>
                            {v || ''}
                          </td>
                        ));
                      })()}
                    </tr>
                  );
                })()}
                {(() => {
                  const tableSide: 'away' | 'home' = half === 'top' ? 'away' : 'home';
                  const subsForSide = (G.substitutions || []).filter((s) => s.side === tableSide);
                  const subsByInn: Record<number, typeof subsForSide> = {};
                  for (const s of subsForSide) {
                    (subsByInn[s.inning] ||= []).push(s);
                  }
                  const formatSub = (s: (typeof subsForSide)[number]): string => {
                    const kindLabel = s.kind === 'H' ? 'H' : s.kind === 'R' ? 'R' : 'D';
                    const where = s.kind === 'R' ? `${s.base ?? ''}` : '';
                    const mid = s.mid ? `${s.mid.balls}B${s.mid.strikes}S` : '';
                    const head = `${kindLabel}${where ? `(${where})` : ''}${mid ? `[${mid}]` : ''}`;
                    return `${head} ${s.newName}${s.oldName ? `←${s.oldName}` : ''}`;
                  };
                  return Array.from({ length: 4 }, (_, ri) => (
                    <tr key={`subst-${ri}`} style={{ height: 18 }}>
                      {ri === 0 && (
                        <>
                          <td
                            colSpan={4}
                            rowSpan={4}
                            style={{
                              fontSize: 9,
                              color: '#111',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              borderTop: '1px solid var(--border)',
                            }}
                          >
                            교<br />대<br />란
                          </td>
                          <td
                            style={{ width: 22, borderTop: '1px solid var(--border)' }}
                            rowSpan={4}
                          />
                          <td
                            style={{ minWidth: 80, borderTop: '1px solid var(--border)' }}
                            rowSpan={4}
                          />
                          <td rowSpan={4} style={{ borderTop: '1px solid var(--border)' }} />
                        </>
                      )}
                      {inns.map((inn) => {
                        const sub = (subsByInn[inn] || [])[ri];
                        const span = (maxAppByInn[inn] ?? 0) + 1;
                        return (
                          <td
                            key={inn}
                            colSpan={span}
                            style={{
                              width: 80 * span,
                              minWidth: 80,
                              borderTop: ri === 0 ? '1px solid var(--border)' : undefined,
                              height: 18,
                              fontSize: 9,
                              color: '#111',
                              padding: '0 2px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={sub ? formatSub(sub) : undefined}
                          >
                            {sub ? formatSub(sub) : ''}
                          </td>
                        );
                      })}
                      {ri === 0 && (
                        <td
                          colSpan={18}
                          rowSpan={4}
                          style={{ borderTop: '1px solid var(--border)' }}
                        />
                      )}
                    </tr>
                  ));
                })()}
              </tbody>

              <tfoot>
                {(() => {
                  // 합계: 이닝별 득점 (offense side per inning)
                  const innRuns: (number | null)[] = half === 'top' ? G.awayInn : G.homeInn;

                  // 이닝별 통계 계산: 안타, 실책, 어시스트, 투구수
                  type Stat = { h: number; e: number; a: number; p: number };
                  const innStat: Record<number, Stat> = {};
                  inns.forEach((i) => (innStat[i] = { h: 0, e: 0, a: 0, p: 0 }));
                  const isHit = (r: string) =>
                    /^\/[789]$/.test(r) ||
                    ['H1', '/hit', 'INT', 'BUNT', 'OBUNT'].includes(r) ||
                    /^>[789]/.test(r) ||
                    r === 'H2' ||
                    r === '>hit' ||
                    /^>>>[789]$/.test(r) ||
                    r === 'H3' ||
                    r === '>>>hit' ||
                    r === 'HR' ||
                    r === 'GHR';
                  const errCount = (r: string) => {
                    let n = 0;
                    if (/E\d/.test(r)) n += (r.match(/E\d/g) || []).length;
                    if (/^E$/.test(r)) n += 1;
                    if (/^#\dE/.test(r)) n += 1;
                    return n;
                  };
                  // 어시스트: result에 '-' 으로 연결된 fielder seq가 2명 이상이면 마지막 putout 이전 fielder 수
                  const assistCount = (r: string) => {
                    const m = r.match(/^[\d-]+$/);
                    if (!m) return 0;
                    const parts = r.split('-').filter((x) => x.length > 0);
                    return Math.max(0, parts.length - 1);
                  };
                  Object.values(G.cells).forEach((c) => {
                    if (c.half !== half) return;
                    const s = innStat[c.inning];
                    if (!s) return;
                    if (c.result) {
                      if (isHit(c.result)) s.h += 1;
                      s.e += errCount(c.result);
                      s.a += assistCount(c.result);
                    }
                    s.p += (c.pitches || []).length;
                  });
                  // 누적값
                  const cumStat: Record<number, Stat> = {};
                  let cH = 0,
                    cE = 0,
                    cA = 0,
                    cP = 0;
                  inns.forEach((i) => {
                    cH += innStat[i].h;
                    cE += innStat[i].e;
                    cA += innStat[i].a;
                    cP += innStat[i].p;
                    cumStat[i] = { h: cH, e: cE, a: cA, p: cP };
                  });

                  // 좌/우 분할 cell 렌더 helper
                  const splitCellLR = (
                    cur: number,
                    cum: number,
                    key: string | number,
                    colSpan = 1
                  ) => (
                    <td
                      key={key}
                      colSpan={colSpan}
                      style={{
                        width: 80 * colSpan,
                        padding: 0,
                        fontSize: 9,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', height: '100%' }}>
                        <div
                          style={{
                            flex: 1,
                            borderRight: '1px solid var(--border2)',
                            padding: '2px 0',
                          }}
                          title={`현재 ${cur}`}
                        >
                          {cur || ''}
                        </div>
                        <div
                          style={{ flex: 1, padding: '2px 0', color: '#6b7280' }}
                          title={`누적 ${cum}`}
                        >
                          {cum || ''}
                        </div>
                      </div>
                    </td>
                  );
                  // 상/하 분할 cell 렌더 helper (안타용)
                  // 안타 전용: 좌측 작은(현재/누적 상하) + 우측 큰(이닝 점수)
                  const splitCellAnta = (
                    cur: number,
                    cum: number,
                    runs: number | null | undefined,
                    key: string | number,
                    colSpan = 1
                  ) => (
                    <td
                      key={key}
                      colSpan={colSpan}
                      style={{
                        width: 80 * colSpan,
                        padding: 0,
                        fontSize: 9,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', height: '100%' }}>
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            borderRight: '1px solid var(--border2)',
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              borderBottom: '1px solid var(--border2)',
                              padding: '1px 0',
                            }}
                            title={`현재 안타 ${cur}`}
                          >
                            {cur || ''}
                          </div>
                          <div
                            style={{ flex: 1, padding: '1px 0', color: '#6b7280' }}
                            title={`누적 안타 ${cum}`}
                          >
                            {cum || ''}
                          </div>
                        </div>
                        <div
                          style={{
                            flex: 2,
                            fontSize: 16,
                            fontWeight: 700,
                            color: '#111',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title={`이닝 점수 ${runs ?? '-'}`}
                        >
                          {runs != null ? runs : ''}
                        </div>
                      </div>
                    </td>
                  );

                  return (
                    <>
                      {/* 안타: 위 현재 / 아래 누적 */}
                      <tr style={{ height: 22, borderTop: '1px solid var(--border)' }}>
                        <td
                          colSpan={7}
                          style={{
                            fontSize: 9,
                            color: '#111',
                            textAlign: 'right',
                            paddingRight: 4,
                            borderTop: '1px solid var(--border)',
                          }}
                        >
                          안타
                        </td>
                        {inns.map((i) =>
                          splitCellAnta(
                            innStat[i].h,
                            cumStat[i].h,
                            innRuns[i - 1],
                            `h-${i}`,
                            (maxAppByInn[i] ?? 0) + 1
                          )
                        )}
                        <td colSpan={18} style={{ borderTop: '1px solid var(--border)' }} />
                      </tr>
                      {/* 어시스트: 좌 현재 / 우 누적 */}
                      <tr style={{ height: 18 }}>
                        <td
                          colSpan={7}
                          style={{
                            fontSize: 9,
                            color: '#111',
                            textAlign: 'right',
                            paddingRight: 4,
                          }}
                        >
                          어시스트
                        </td>
                        {inns.map((i) =>
                          splitCellLR(
                            innStat[i].a,
                            cumStat[i].a,
                            `a-${i}`,
                            (maxAppByInn[i] ?? 0) + 1
                          )
                        )}
                        <td colSpan={18} />
                      </tr>
                      {/* 실책: 좌 현재 / 우 누적 */}
                      <tr style={{ height: 18 }}>
                        <td
                          colSpan={7}
                          style={{
                            fontSize: 9,
                            color: '#111',
                            textAlign: 'right',
                            paddingRight: 4,
                          }}
                        >
                          실책
                        </td>
                        {inns.map((i) =>
                          splitCellLR(
                            innStat[i].e,
                            cumStat[i].e,
                            `e-${i}`,
                            (maxAppByInn[i] ?? 0) + 1
                          )
                        )}
                        <td colSpan={18} />
                      </tr>
                      {/* 투구수: 좌 현재 / 우 누적 */}
                      <tr style={{ height: 18 }}>
                        <td
                          colSpan={7}
                          style={{
                            fontSize: 9,
                            color: '#111',
                            textAlign: 'right',
                            paddingRight: 4,
                          }}
                        >
                          투구수
                        </td>
                        {inns.map((i) =>
                          splitCellLR(
                            innStat[i].p,
                            cumStat[i].p,
                            `p-${i}`,
                            (maxAppByInn[i] ?? 0) + 1
                          )
                        )}
                        <td colSpan={18} />
                      </tr>
                    </>
                  );
                })()}
              </tfoot>
            </table>
          </div>

          {viewHalf === 'top' ? (
            <div
              id="ss-hdan"
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                borderTop: '2px solid #b0b5bd',
                background: '#fff',
                fontSize: 10,
                width: '100%',
              }}
            >
              {/* 갑 좌측: 경기시간 + 심판 테이블 */}
              <div style={{ flex: '0 0 320px', display: 'flex', gap: 10 }}>
                {(() => {
                  const BD = '1px solid #b0b5bd';
                  const calcSoyo = () => {
                    if (!G.startTime || !G.endTime) return '';
                    const parse = (s: string) => {
                      const [h, m] = s.split(':').map((v) => parseInt(v) || 0);
                      return h * 60 + m;
                    };
                    let diff = parse(G.endTime) - parse(G.startTime);
                    if (diff < 0) diff += 1440;
                    return `${Math.floor(diff / 60)}시간 ${String(diff % 60).padStart(2, '0')}분`;
                  };
                  const cellL: React.CSSProperties = {
                    border: BD,
                    padding: '2px 4px',
                    fontSize: 9,
                    background: '#e8e8e8',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  };
                  const cellR: React.CSSProperties = {
                    border: BD,
                    padding: '2px 4px',
                    fontSize: 9,
                  };
                  return (
                    <>
                      {/* time-table (60%) */}
                      <table
                        style={{
                          width: '60%',
                          borderCollapse: 'collapse',
                          border: BD,
                          fontSize: 9,
                        }}
                      >
                        <tbody>
                          <tr>
                            <td style={cellL}>개 시</td>
                            <td style={cellR}>{G.startTime || '시 분'}</td>
                          </tr>
                          <tr>
                            <td style={cellL}>종 료</td>
                            <td style={cellR}>{G.endTime || '시 분'}</td>
                          </tr>
                          <tr>
                            <td colSpan={2} style={{ ...cellR, fontSize: 8 }}>
                              ( 제외시간 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 분)
                            </td>
                          </tr>
                          <tr>
                            <td style={{ ...cellL, fontSize: 8 }}>
                              소 요<br />시 간
                            </td>
                            <td style={cellR}>{calcSoyo() || '시간 분'}</td>
                          </tr>
                          <tr>
                            <td colSpan={2} style={{ ...cellR, fontSize: 8 }}>
                              정규이닝(9회)종료 : 시 분
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={2} style={{ ...cellR, fontSize: 8 }}>
                              정규이닝 소요시간 : 시간 분
                            </td>
                          </tr>
                          <tr>
                            <td rowSpan={2} style={{ ...cellL, height: 52 }}>
                              공 식<br />
                              기록원
                            </td>
                            <td style={cellR}>{G.recorder1 || ''}</td>
                          </tr>
                          <tr>
                            <td style={{ ...cellR, borderTop: `1px solid ${BD}` }}>
                              {G.recorder2 || ''}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      {/* umpire-table (40%) */}
                      <table
                        style={{
                          width: '40%',
                          borderCollapse: 'collapse',
                          border: BD,
                          fontSize: 9,
                        }}
                      >
                        <tbody>
                          {(
                            [
                              ['주 심', G.umpireHome],
                              ['1루심', G.umpire1B],
                              ['2루심', G.umpire2B],
                              ['3루심', G.umpire3B],
                              ['좌선심', G.umpireLeft],
                              ['우선심', G.umpireRight],
                              ['대기심', G.umpireStandby],
                            ] as [string, string | undefined][]
                          ).map(([label, value]) => (
                            <tr key={label}>
                              <td style={{ ...cellL, fontSize: 8, width: '40%' }}>{label}</td>
                              <td style={{ ...cellR, textAlign: 'left' }}>{value || ''}</td>
                            </tr>
                          ))}
                          <tr>
                            <td
                              style={{
                                ...cellR,
                                background: '#e6e6e6',
                                color: '#333',
                                textAlign: 'left',
                                height: 28,
                              }}
                            >
                              관중수 :{' '}
                              <span style={{ float: 'right' }}>
                                {G.attendance ? `${G.attendance}명` : '명'}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  );
                })()}
              </div>

              {/* 2. 비디오판독 table (갑지.html 구조: thead + rowspan tbody) */}
              {(() => {
                const vrEvents = (G.gameEvents || []).filter(
                  (e) => e.type === 'video_review' || e.type === 'check_swing'
                );
                const calcDur = (s: string, e: string) => {
                  if (!s || !e) return '';
                  const [sh, sm] = s.split(':').map(Number);
                  const [eh, em] = e.split(':').map(Number);
                  let d = eh * 60 + em - (sh * 60 + sm);
                  if (d < 0) d += 1440;
                  return d < 60 ? `${d}분` : `${Math.floor(d / 60)}시간${d % 60}분`;
                };
                const thV: React.CSSProperties = {
                  border: '1px solid #b0b5bd',
                  padding: '2px 4px',
                  fontWeight: 'normal',
                };
                const tdV: React.CSSProperties = {
                  border: '1px solid #b0b5bd',
                  padding: '1px 3px',
                  overflow: 'hidden',
                };
                const rows = [...vrEvents, ...Array(Math.max(0, 10 - vrEvents.length)).fill(null)];
                return (
                  <table
                    style={{
                      width: 480,
                      flexShrink: 0,
                      borderCollapse: 'collapse',
                      border: '2px solid #b0b5bd',
                      fontSize: 9,
                      textAlign: 'center',
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ ...thV, width: 25 }} />
                        <th style={{ ...thV, width: 35 }}>회</th>
                        <th style={{ ...thV, width: 35 }}>타순</th>
                        <th style={{ ...thV, width: 35 }}>요청</th>
                        <th style={thV}>내 용</th>
                        <th style={{ ...thV, width: 40 }}>최초</th>
                        <th style={{ ...thV, width: 40 }}>최종</th>
                        <th style={{ ...thV, width: 130 }}>소요시간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((ev, i) => (
                        <tr key={i} style={{ height: 18 }}>
                          {i === 0 && (
                            <td
                              rowSpan={10}
                              style={{
                                ...tdV,
                                fontSize: 13,
                                letterSpacing: 2,
                                width: 25,
                                lineHeight: 1.4,
                                writingMode: 'vertical-rl',
                              }}
                            >
                              비디오판독
                            </td>
                          )}
                          <td style={tdV}>{ev ? `${ev.inning}회` : ''}</td>
                          <td style={tdV}>{ev && 'order' in ev ? ev.order : ''}</td>
                          <td style={tdV}>
                            {ev
                              ? ev.type === 'check_swing'
                                ? `체크스윙 (${(ev as { umpire?: string }).umpire ?? ''})`
                                : ((ev as { situation?: string }).situation ?? '')
                              : ''}
                          </td>
                          <td style={{ ...tdV, maxWidth: 160 }}>
                            {ev ? ((ev as { content?: string }).content ?? '') : ''}
                          </td>
                          <td style={tdV}>
                            {ev ? ((ev as { firstCall?: string }).firstCall ?? '') : ''}
                          </td>
                          <td style={tdV}>
                            {ev ? ((ev as { result?: string }).result ?? '') : ''}
                          </td>
                          <td style={tdV}>
                            {ev
                              ? calcDur(
                                  (ev as { startTime?: string }).startTime ?? '',
                                  (ev as { endTime?: string }).endTime ?? ''
                                )
                              : ': ~ : ( 분)'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}

              <div style={{ flex: 1, minWidth: 0 }}>
                {(() => {
                  const headers = [
                    { label: '승패\nS.H', w: 30 },
                    { label: 'B\nS', w: 30 },
                    { label: '투수', w: 100 },
                    { label: '투구\n횟수', w: 50 },
                    { label: '타자', w: 30 },
                    { label: '투구수', w: 40 },
                    { label: '타수', w: 30 },
                    { label: '피안타', w: 40 },
                    { label: '피홈런', w: 40 },
                    { label: '희타', w: 30 },
                    { label: '희비', w: 30 },
                    { label: '4구', w: 30 },
                    { label: '고의\n4구', w: 36 },
                    { label: '사구', w: 30 },
                    { label: '탈삼진', w: 40 },
                    { label: '폭투', w: 30 },
                    { label: '보크', w: 30 },
                    { label: '실점', w: 30 },
                    { label: '자책점', w: 36 },
                  ];
                  const formatIP = (outs: number) => {
                    if (outs <= 0) return '0/3';
                    const full = Math.floor(outs / 3);
                    const rem = outs % 3;
                    if (full === 0) return `${rem}/3`;
                    if (rem === 0) return `${full}`;
                    return `${full} ${rem}/3`;
                  };

                  const rows = computePitcherRows(G, half, activePitcherName);

                  // 투수 판정 마크 (W/L/S/H/BS) — half='top'(원정 공격) → HOME 투수
                  const decisionTeam: 'away' | 'home' = half === 'top' ? 'home' : 'away';
                  const decision = G.gameDecisions?.[decisionTeam];
                  const markOf = (name: string): string => {
                    if (!decision || !name) return '';
                    if (name === decision.win) return '승';
                    if (name === decision.loss) return '패';
                    if (name === decision.save) return 'S';
                    if (decision.holds.includes(name)) return 'H';
                    if (decision.bs.includes(name)) return 'BS';
                    return '';
                  };

                  const totalRows = 10;
                  const blankCount = Math.max(0, totalRows - rows.length);

                  return (
                    <table
                      style={{
                        width: '100%',
                        tableLayout: 'fixed',
                        borderCollapse: 'collapse',
                        border: '2px solid #b0b5bd',
                        fontSize: 9,
                        textAlign: 'center',
                      }}
                    >
                      <colgroup>
                        {headers.map((h, i) => (
                          <col key={i} style={{ width: h.w }} />
                        ))}
                      </colgroup>
                      <thead>
                        <tr style={{ background: '#e8e8e8' }}>
                          {headers.map((h, i) => (
                            <th
                              key={i}
                              style={{
                                padding: '2px 2px',
                                borderBottom: '1px solid #b0b5bd',
                                borderRight:
                                  i < headers.length - 1 ? '1px solid #b0b5bd' : undefined,
                                width: h.w,
                                whiteSpace: 'pre-line',
                                lineHeight: 1.1,
                                fontSize: 9,
                              }}
                            >
                              {h.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => {
                          const cells = [
                            markOf(row.name), // 승패/S/H/BS
                            '', // B/S (예비)
                            i === 0 ? row.name : `${row.name} (${row.entryInn},${row.entryOrd})`,
                            formatIP(row.outs),
                            row.bf || '',
                            row.np || '',
                            row.ab || '',
                            row.h || '',
                            row.hr || '',
                            row.sh || '',
                            row.sf || '',
                            row.bb || '',
                            row.ibb || '',
                            row.hbp || '',
                            row.so || '',
                            row.wp || '',
                            row.bk || '',
                            row.r || '',
                            row.er || '',
                          ];
                          return (
                            <tr key={i} style={{ height: 20 }}>
                              {cells.map((v, j) => (
                                <td
                                  key={j}
                                  style={{
                                    padding: '2px 2px',
                                    borderRight:
                                      j < cells.length - 1 ? '1px solid #b0b5bd' : undefined,
                                    borderBottom: '1px solid #b0b5bd',
                                    textAlign: j === 2 ? 'left' : j === 3 ? 'right' : 'center',
                                    whiteSpace: 'nowrap',
                                    paddingLeft: j === 2 ? 4 : 2,
                                    paddingRight: j === 3 ? 4 : 2,
                                  }}
                                >
                                  {v}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                        {Array.from({ length: blankCount }, (_, i) => (
                          <tr key={`b-${i}`} style={{ height: 20 }}>
                            {headers.map((__, j) => (
                              <td
                                key={j}
                                style={{
                                  borderRight:
                                    j < headers.length - 1 ? '1px solid #b0b5bd' : undefined,
                                  borderBottom: '1px solid #b0b5bd',
                                }}
                              />
                            ))}
                          </tr>
                        ))}
                        {(() => {
                          // 합계(누적) 행: 컬럼별 합산
                          const sum = (k: keyof PitcherRow) =>
                            rows.reduce((a, x) => a + (x[k] as number), 0);
                          const totalOuts = sum('outs');
                          const totals = [
                            '', // 승패 S.H
                            '', // B/S
                            '', // 투수
                            formatIP(totalOuts),
                            sum('bf') || '',
                            sum('np') || '',
                            sum('ab') || '',
                            sum('h') || '',
                            sum('hr') || '',
                            sum('sh') || '',
                            sum('sf') || '',
                            sum('bb') || '',
                            sum('ibb') || '',
                            sum('hbp') || '',
                            sum('so') || '',
                            sum('wp') || '',
                            sum('bk') || '',
                            sum('r') || '',
                            sum('er') || '',
                          ];
                          return (
                            <tr
                              style={{
                                height: 22,
                                borderTop: '2px solid #b0b5bd',
                                fontWeight: 700,
                              }}
                            >
                              {totals.map((v, j) => (
                                <td
                                  key={j}
                                  style={{
                                    padding: '2px 2px',
                                    borderTop: '2px solid #b0b5bd',
                                    borderRight:
                                      j < totals.length - 1 ? '1px solid #b0b5bd' : undefined,
                                    textAlign: j === 2 ? 'left' : j === 3 ? 'right' : 'center',
                                    whiteSpace: 'nowrap',
                                    paddingLeft: j === 2 ? 4 : 2,
                                    paddingRight: j === 3 ? 4 : 2,
                                    background: '#e8e8e8',
                                  }}
                                >
                                  {v}
                                </td>
                              ))}
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div
              id="ss-hdan"
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: 0,
                width: '100%',
                background: '#fff',
                color: '#111',
                fontSize: 10,
              }}
            >
              {/* ---- 을지 하단 ---- */}
              {(() => {
                const thS: React.CSSProperties = {
                  border: '1px solid #b0b5bd',
                  height: 22,
                  padding: 2,
                  fontWeight: 'normal',
                  textAlign: 'center',
                  background: '#e8e8e8',
                  whiteSpace: 'nowrap',
                  fontSize: 11,
                  boxSizing: 'border-box',
                };
                const tdS: React.CSSProperties = {
                  border: '1px solid #b0b5bd',
                  height: 22,
                  padding: 2,
                  textAlign: 'center',
                  fontSize: 11,
                  boxSizing: 'border-box',
                };

                /* ── 데이터 준비 ── */
                // 홈런
                const hrs = Object.values(G.cells)
                  .filter((c) => c.result === 'HR' || c.result === 'GHR')
                  .sort(
                    (a, b) =>
                      a.inning - b.inning ||
                      (a.half === b.half ? 0 : a.half === 'top' ? -1 : 1) ||
                      a.order - b.order
                  );
                const hrRuns = (hrCell: (typeof hrs)[number]) => {
                  let runs = 1;
                  Object.values(G.cells).forEach((c) => {
                    if (c.half !== hrCell.half || c.inning !== hrCell.inning) return;
                    (c.runnerNotes || []).forEach((n) => {
                      if (n.base === 'HOME' && n.causedBy === hrCell.order) runs += 1;
                    });
                  });
                  return runs;
                };
                const fmtTime = (ts?: number) => {
                  if (!ts) return '';
                  const d = new Date(ts);
                  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                };
                const hrKind = (runs: number) =>
                  runs === 1
                    ? '솔로'
                    : runs === 2
                      ? '2점'
                      : runs === 3
                        ? '3점'
                        : runs >= 4
                          ? '만루'
                          : '';

                // D/P
                const teamFor = (h: string) => (h === 'top' ? G.awayTeam : G.homeTeam);
                const lineupFor = (h: string) => (h === 'top' ? G.awayLineup : G.homeLineup);
                const dpItems = Object.values(G.cells)
                  .filter((c) => c.isDoublePlay || c.isTriplePlay)
                  .sort(
                    (a, b) =>
                      a.inning - b.inning ||
                      (a.half === b.half ? 0 : a.half === 'top' ? -1 : 1) ||
                      a.order - b.order
                  );
                const pItems: {
                  inning: number;
                  half: string;
                  runnerName: string;
                  code?: string;
                }[] = [];
                Object.values(G.cells).forEach((c) => {
                  (c.eventLog || []).forEach((e) => {
                    if (
                      e.kind === 'runner_steal' &&
                      (e.advCode === 'W' ||
                        e.advCode === '(W)' ||
                        e.advCode === 'P' ||
                        e.advCode === '(P)')
                    ) {
                      pItems.push({
                        inning: c.inning,
                        half: c.half,
                        runnerName: e.runnerName,
                        code: e.advCode,
                      });
                    }
                  });
                });
                pItems.sort(
                  (a, b) =>
                    a.inning - b.inning || (a.half === b.half ? 0 : a.half === 'top' ? -1 : 1)
                );
                const sItems = Object.values(G.cells)
                  .filter(
                    (c) =>
                      c.result &&
                      (c.result === 'SH' ||
                        c.result === 'SF' ||
                        c.result === '/SF' ||
                        c.result.includes('SH'))
                  )
                  .sort(
                    (a, b) =>
                      a.inning - b.inning ||
                      (a.half === b.half ? 0 : a.half === 'top' ? -1 : 1) ||
                      a.order - b.order
                  );

                // 출전타자
                const tableSide: 'away' | 'home' = half === 'top' ? 'away' : 'home';
                const subs = (G.substitutions || [])
                  .filter((s) => s.side === tableSide)
                  .sort((a, b) => a.inning - b.inning);
                const subTeam = half === 'top' ? G.awayTeam : G.homeTeam;

                // 비디오판독
                const vrEvents = (G.gameEvents || []).filter(
                  (e) => e.type === 'video_review' || e.type === 'check_swing'
                );
                const calcDur = (s: string, e: string) => {
                  if (!s || !e) return '';
                  const [sh, sm] = s.split(':').map(Number);
                  const [eh, em] = e.split(':').map(Number);
                  let d = eh * 60 + em - (sh * 60 + sm);
                  if (d < 0) d += 1440;
                  return d < 60 ? `${d}분` : `${Math.floor(d / 60)}시간${d % 60}분`;
                };

                // 경기중단
                const delayEvents = (G.gameEvents || []).filter((e) => e.type === 'game_delay');

                // 투수
                const headers = [
                  { label: '승패\nS.H', w: 30 },
                  { label: 'B\nS', w: 22 },
                  { label: '투 수', w: 70 },
                  { label: '투구\n횟수', w: 32 },
                  { label: '타\n자', w: 24 },
                  { label: '투구\n수', w: 28 },
                  { label: '타\n수', w: 24 },
                  { label: '피\n안타', w: 28 },
                  { label: '피\n홈런', w: 28 },
                  { label: '희\n타', w: 24 },
                  { label: '희\n비', w: 24 },
                  { label: '4\n구', w: 24 },
                  { label: '고의\n4구', w: 28 },
                  { label: '사\n구', w: 24 },
                  { label: '탈삼진', w: 28 },
                  { label: '폭\n투', w: 24 },
                  { label: '보\n크', w: 24 },
                  { label: '실\n점', w: 24 },
                  { label: '자책\n점', w: 28 },
                ];
                const formatIP = (outs: number) => {
                  if (outs <= 0) return '0/3';
                  const full = Math.floor(outs / 3);
                  const rem = outs % 3;
                  if (full === 0) return `${rem}/3`;
                  if (rem === 0) return `${full}`;
                  return `${full} ${rem}/3`;
                };
                const pitcherRows = computePitcherRows(G, half, activePitcherName);
                const decisionTeam: 'away' | 'home' = half === 'top' ? 'home' : 'away';
                const decision = G.gameDecisions?.[decisionTeam];
                const markOf = (name: string) => {
                  if (!decision || !name) return '';
                  if (name === decision.win) return '승';
                  if (name === decision.loss) return '패';
                  if (name === decision.save) return 'S';
                  if (decision.holds.includes(name)) return 'H';
                  if (decision.bs.includes(name)) return 'BS';
                  return '';
                };

                return (
                  <>
                    {/* 1. 홈런 타자 */}
                    <table
                      style={{
                        border: '2px solid #b0b5bd',
                        borderCollapse: 'collapse',
                        width: 250,
                        flexShrink: 0,
                      }}
                    >
                      <thead>
                        <tr>
                          <th colSpan={5} style={{ ...thS, borderRight: undefined }}>
                            홈런 타자
                          </th>
                        </tr>
                        <tr>
                          {['시 각', '소 속', '성 명', '회', '점 수'].map((h, i, arr) => (
                            <th
                              key={h}
                              style={{
                                ...thS,
                                borderRight: i < arr.length - 1 ? '1px solid #b0b5bd' : undefined,
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...hrs, ...Array(Math.max(0, 10 - hrs.length)).fill(null)].map((c, i) => {
                          const tn = c ? (c.half === 'top' ? G.awayTeam : G.homeTeam) : '';
                          const lu = c ? (c.half === 'top' ? G.awayLineup : G.homeLineup) : null;
                          const p = c && lu ? lu[c.order - 1] : null;
                          const runs = c ? hrRuns(c) : 0;
                          return (
                            <tr key={i}>
                              <td style={tdS}>{c ? fmtTime(c.timestamp) : ':'}</td>
                              <td style={{ ...tdS, textAlign: 'left' }}>{tn}</td>
                              <td style={{ ...tdS, textAlign: 'left' }}>{p?.name || ''}</td>
                              <td style={tdS}>{c ? `${c.inning}회` : '회'}</td>
                              <td style={tdS}>{c ? hrKind(runs) : '점'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* 2. D/P · P · (S) */}
                    {(() => {
                      const dRows = Math.max(5, dpItems.length);
                      const pRows = Math.max(3, pItems.length);
                      const sRows = Math.max(1, sItems.length);
                      const renderDPRow = (
                        label: string | null,
                        rowSpan: number | undefined,
                        teamName: string,
                        content: string,
                        inn: number | string,
                        key: string
                      ) => (
                        <tr key={key}>
                          {label !== null && (
                            <td
                              rowSpan={rowSpan}
                              style={{
                                ...tdS,
                                borderRight: '1px solid #b0b5bd',
                                width: 25,
                                fontSize: 13,
                                verticalAlign: 'middle',
                              }}
                              dangerouslySetInnerHTML={{ __html: label.replace('\n', '<br/>') }}
                            />
                          )}
                          <td style={{ ...tdS, textAlign: 'left' }}>{teamName}</td>
                          <td
                            style={{
                              ...tdS,
                              textAlign: 'left',
                              maxWidth: 80,
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {content}
                          </td>
                          <td style={tdS}>{inn}</td>
                        </tr>
                      );
                      const dpBodyRows: React.ReactNode[] = [];
                      for (let i = 0; i < dRows; i++) {
                        const item = dpItems[i];
                        const p2 = item ? lineupFor(item.half)[item.order - 1] : null;
                        dpBodyRows.push(
                          renderDPRow(
                            i === 0 ? 'D\nP' : null,
                            i === 0 ? dRows : undefined,
                            item ? teamFor(item.half) : '',
                            item ? p2?.name || '' : '',
                            item ? item.inning : '',
                            `d-${i}`
                          )
                        );
                      }
                      for (let i = 0; i < pRows; i++) {
                        const item = pItems[i];
                        dpBodyRows.push(
                          renderDPRow(
                            i === 0 ? 'P' : null,
                            i === 0 ? pRows : undefined,
                            item ? teamFor(item.half) : '',
                            item ? `${item.runnerName}${item.code ? ` ${item.code}` : ''}` : '',
                            item ? item.inning : '',
                            `p-${i}`
                          )
                        );
                      }
                      for (let i = 0; i < sRows; i++) {
                        const item = sItems[i];
                        const p2 = item ? lineupFor(item.half)[item.order - 1] : null;
                        dpBodyRows.push(
                          renderDPRow(
                            i === 0 ? '(S)' : null,
                            i === 0 ? sRows : undefined,
                            item ? teamFor(item.half) : '',
                            item ? `${p2?.name || ''} ${item.result || ''}` : '',
                            item ? item.inning : '',
                            `s-${i}`
                          )
                        );
                      }
                      return (
                        <table
                          style={{
                            border: '2px solid #b0b5bd',
                            borderCollapse: 'collapse',
                            width: 160,
                            flexShrink: 0,
                          }}
                        >
                          <thead>
                            <tr>
                              <th style={{ ...thS, width: 25 }} />
                              {['소속', '내용 / 선수명', '회'].map((h, i, arr) => (
                                <th
                                  key={h}
                                  style={{
                                    ...thS,
                                    borderRight:
                                      i < arr.length - 1 ? '1px solid #b0b5bd' : undefined,
                                  }}
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>{dpBodyRows}</tbody>
                        </table>
                      );
                    })()}

                    {/* 3. center-section */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        flex: '0 0 320px',
                      }}
                    >
                      <table
                        style={{
                          border: '2px solid #b0b5bd',
                          borderCollapse: 'collapse',
                          width: '100%',
                          flex: 1,
                        }}
                      >
                        {/* 출전타자 */}
                        <thead>
                          <tr>
                            {['소속', '회', '타순', '성 명', '내 용'].map((h, i, arr) => (
                              <th
                                key={h}
                                style={{
                                  ...thS,
                                  width: i === 4 ? '50%' : undefined,
                                  borderRight: i < arr.length - 1 ? '1px solid #b0b5bd' : undefined,
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...subs, ...Array(Math.max(0, 3 - subs.length)).fill(null)].map(
                            (s, i) => (
                              <tr key={i}>
                                <td style={{ ...tdS, textAlign: 'left' }}>{s ? subTeam : ''}</td>
                                <td style={tdS}>{s ? s.inning : ''}</td>
                                <td style={tdS}>{s ? (s.order ?? '') : ''}</td>
                                <td style={{ ...tdS, textAlign: 'left' }}>{s ? s.newName : ''}</td>
                                <td style={{ ...tdS, textAlign: 'left' }}>
                                  {s
                                    ? `${s.kind === 'H' ? '대타' : s.kind === 'R' ? '대주자' : '수비교대'}${s.oldName ? ` ←${s.oldName}` : ''}`
                                    : ''}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                        {/* 비디오판독 / 경기중단 */}
                        <thead>
                          <tr>
                            <th style={{ ...thS, borderTop: '3px solid #333' }} />
                            {['회', '타순', '내 용', '소요시간'].map((h) => (
                              <th
                                key={h}
                                style={{
                                  ...thS,
                                  borderTop: '3px solid #333',
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...vrEvents, ...Array(Math.max(0, 2 - vrEvents.length)).fill(null)].map(
                            (ev, i) => (
                              <tr key={`vr-${i}`}>
                                <td style={tdS} />
                                <td style={tdS}>{ev ? `${ev.inning}회` : ''}</td>
                                <td style={tdS}>{ev && 'order' in ev ? ev.order : ''}</td>
                                <td style={{ ...tdS, textAlign: 'left' }}>
                                  {ev
                                    ? ev.type === 'check_swing'
                                      ? `체크스윙 ${(ev as { result?: string }).result ?? ''}`
                                      : ((ev as { content?: string }).content ?? '')
                                    : ''}
                                </td>
                                <td style={tdS}>
                                  {ev
                                    ? calcDur(
                                        (ev as { startTime?: string }).startTime ?? '',
                                        (ev as { endTime?: string }).endTime ?? ''
                                      )
                                    : ''}
                                </td>
                              </tr>
                            )
                          )}
                          <tr>
                            <td
                              rowSpan={2}
                              style={{
                                ...tdS,
                                borderRight: '1px solid #b0b5bd',
                                verticalAlign: 'middle',
                                lineHeight: 1.4,
                              }}
                            >
                              경기
                              <br />
                              중단
                            </td>
                            <td style={tdS}>
                              {delayEvents[0] && 'inning' in delayEvents[0]
                                ? `${delayEvents[0].inning}회`
                                : ''}
                            </td>
                            <td style={tdS} />
                            <td style={{ ...tdS, textAlign: 'left' }}>
                              {delayEvents[0] && 'content' in delayEvents[0]
                                ? (delayEvents[0] as { content: string }).content
                                : ''}
                            </td>
                            <td style={tdS}>
                              {delayEvents[0] && 'duration' in delayEvents[0]
                                ? (delayEvents[0] as { duration: string }).duration
                                : ': ~ : ( 분)'}
                            </td>
                          </tr>
                          <tr>
                            <td style={tdS}>
                              {delayEvents[1] && 'inning' in delayEvents[1]
                                ? `${delayEvents[1].inning}회`
                                : ''}
                            </td>
                            <td style={tdS} />
                            <td style={{ ...tdS, textAlign: 'left' }}>
                              {delayEvents[1] && 'content' in delayEvents[1]
                                ? (delayEvents[1] as { content: string }).content
                                : ''}
                            </td>
                            <td style={tdS}>
                              {delayEvents[1] && 'duration' in delayEvents[1]
                                ? (delayEvents[1] as { duration: string }).duration
                                : ': ~ : ( 분)'}
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* 비고 */}
                      <div
                        style={{
                          border: '2px solid #b0b5bd',
                          height: 120,
                          padding: 5,
                          fontSize: 11,
                        }}
                      >
                        <div
                          style={{
                            borderBottom: '1px dashed #ccc',
                            paddingBottom: 3,
                            marginBottom: 5,
                          }}
                        >
                          비고
                        </div>
                        <div style={{ fontSize: 10, lineHeight: 1.8 }}>
                          {(G.gameEvents || [])
                            .filter((e) => e.type === 'memo_input')
                            .map((e, i) => (
                              <div key={i}>
                                [{e.inning}회{'order' in e && e.order ? ` ${e.order}번` : ''}
                                {'player' in e && e.player ? ` ${e.player}` : ''}]{' '}
                                {'memo' in e ? (e as { memo: string }).memo : ''}
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>

                    {/* 4. 투수 기록표 */}
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 5,
                        minWidth: 0,
                      }}
                    >
                      <table
                        style={{
                          border: '2px solid #b0b5bd',
                          borderCollapse: 'collapse',
                          width: '100%',
                          tableLayout: 'fixed',
                        }}
                      >
                        <colgroup>
                          {headers.map((h, i) => (
                            <col key={i} style={{ width: h.w }} />
                          ))}
                        </colgroup>
                        <thead>
                          <tr>
                            {headers.map((h, i, arr) => (
                              <th
                                key={i}
                                style={{
                                  ...thS,
                                  whiteSpace: 'pre-line',
                                  lineHeight: 1.1,
                                  fontSize: 9,
                                  borderRight: i < arr.length - 1 ? '1px solid #b0b5bd' : undefined,
                                }}
                              >
                                {h.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ...pitcherRows,
                            ...Array(Math.max(0, 10 - pitcherRows.length)).fill(null),
                          ].map((row, i) => {
                            const cells2 = row
                              ? [
                                  markOf(row.name),
                                  '',
                                  i === 0
                                    ? row.name
                                    : `${row.name} (${row.entryInn},${row.entryOrd})`,
                                  formatIP(row.outs),
                                  row.bf || '',
                                  row.np || '',
                                  row.ab || '',
                                  row.h || '',
                                  row.hr || '',
                                  row.sh || '',
                                  row.sf || '',
                                  row.bb || '',
                                  row.ibb || '',
                                  row.hbp || '',
                                  row.so || '',
                                  row.wp || '',
                                  row.bk || '',
                                  row.r || '',
                                  row.er || '',
                                ]
                              : Array(19).fill('');
                            if (row && i > 0) cells2[1] = '/3';
                            if (!row) cells2[3] = '/3';
                            return (
                              <tr key={i}>
                                {cells2.map((v, j, arr2) => (
                                  <td
                                    key={j}
                                    style={{
                                      ...tdS,
                                      textAlign: j === 2 ? 'left' : 'center',
                                      fontSize: 9,
                                      borderRight:
                                        j < arr2.length - 1 ? '1px dashed #ccc' : undefined,
                                    }}
                                  >
                                    {v}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                          {(() => {
                            const sum = (k: keyof PitcherRow) =>
                              pitcherRows.reduce((a, x) => a + (x[k] as number), 0);
                            const tots = [
                              '',
                              '',
                              '',
                              formatIP(sum('outs')),
                              sum('bf') || '',
                              sum('np') || '',
                              sum('ab') || '',
                              sum('h') || '',
                              sum('hr') || '',
                              sum('sh') || '',
                              sum('sf') || '',
                              sum('bb') || '',
                              sum('ibb') || '',
                              sum('hbp') || '',
                              sum('so') || '',
                              sum('wp') || '',
                              sum('bk') || '',
                              sum('r') || '',
                              sum('er') || '',
                            ];
                            return (
                              <tr style={{ fontWeight: 700 }}>
                                {tots.map((v, j, arr2) => (
                                  <td
                                    key={j}
                                    style={{
                                      ...tdS,
                                      borderTop: '2px solid #b0b5bd',
                                      textAlign: j === 2 ? 'left' : 'center',
                                      fontSize: 9,
                                      background: '#e8e8e8',
                                      borderRight:
                                        j < arr2.length - 1 ? '1px dashed #ccc' : undefined,
                                    }}
                                  >
                                    {v}
                                  </td>
                                ))}
                              </tr>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
