import { useState, useEffect } from 'react';
import type { GameState, CellData, HitData } from '../types';
import { KAN, RESULT_COL, RESULT_SYMBOL, BASE_LINES } from '../data/constants';
import { cellKey, isOut, isOnBase, parseKey } from '../store/gameReducer';
import { PitchMark } from './modals/PitchMark';

interface Props {
  G: GameState;
  onSelCell: (key: string) => void;
}

function getMaxRows(G: GameState, half: 'top' | 'bottom', ord: number): number {
  const mx = Object.values(G.cells)
    .filter((c) => c.half === half && c.order === ord)
    .reduce((m, c) => Math.max(m, c.appearance), -1);

  try {
    const [sh, , so, sa] = parseKey(G.selCellKey);
    if (sh === half && so === ord) {
      return Math.max(mx + 1, sa + 1, 1);
    }
  } catch {
    // ignore
  }

  return Math.max(mx + 1, 1);
}

function ScoreCell({
  cell,
  isSel,
  isCur,
  outNum,
}: {
  cell: CellData | null;
  isSel: boolean;
  isCur: boolean;
  outNum: number | undefined;
}) {
  const pitches = cell?.pitches || [];
  const result = cell?.result || null;
  const notes = cell?.runnerNotes || [];
  const scored = cell?.scored || false;
  const earned = cell?.earned;
  const ballType = cell?.ballType;
  const runOut = cell?.runOut || null;
  const lobCell = cell?.lobCell || false;
  const sideNotes = cell?.sideNotes || [];
  const hitData: HitData | undefined = cell?.hitData;

  const SUP_DIGITS = ['¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
  const noteAtBase: Record<string, string> = {};
  type HomeNoteItem = { kan: string; rbi?: boolean } | { advLbl: string };
  const homeNoteItems: HomeNoteItem[] = [];

  if (result === 'GHR') noteAtBase['2B'] = 'GH'; // 구형 데이터

  notes.forEach((n) => {
    // 수비수 번호가 이미 advCode에 포함된 경우(E3, 6 등) sup 생략
    const hasFielder = /\d/.test(n.advCode || '');
    const sup = n.advCode && !hasFielder && n.causedBy ? (SUP_DIGITS[n.causedBy - 1] ?? String(n.causedBy)) : '';
    const advLbl = n.advCode
      ? n.advCode.endsWith(')')
        ? n.advCode.slice(0, -1) + sup + ')'
        : n.advCode + sup
      : null;

    if (n.base === 'HOME') {
      if (advLbl) {
        homeNoteItems.push({ advLbl });
      } else if (n.causedBy) {
        const kan = KAN[n.causedBy - 1] || String(n.causedBy);
        homeNoteItems.push({ kan, rbi: n.rbi });
      }
    } else {
      const lbl = advLbl ?? (n.causedBy ? `(${KAN[n.causedBy - 1] || String(n.causedBy)})` : '');
      if (lbl) noteAtBase[n.base] = noteAtBase[n.base] ? noteAtBase[n.base] + lbl : lbl;
    }
  });

  const runOutBase = cell?.runOutBase || null;
  const runOutNum = cell?.runOutNum;
  const outLbl = outNum ? ['Ⅰ', 'Ⅱ', 'Ⅲ'][outNum - 1] : '';
  const onBase = isOnBase(result) && !runOutNum;
  const fill = onBase ? '#eee' : 'none';
  const strokeC = '#888';
  const strokeW = isSel ? '1.5' : '0.8';
  const strokeDash = '3,3';
  const isKDef = /^ꓘ[\d-]+$/.test(result || '');
  const rcol = RESULT_COL[result || ''] || '#111';
  const isWalk = result === 'B' || result === 'IB' || result === 'IB2';
  const lines = !isWalk
    ? isKDef
      ? [{ x1: 20, y1: 38, x2: 38, y2: 20, c: '#111', w: 2.5 }]
      : BASE_LINES[result || ''] || []
    : [];
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
  const NOTE_GROUP_WIDTH = 28;
  const NOTE_GROUP_HEIGHT = 18;

  const getBasePosition = (base: string) => {
    switch (base) {
      case '2B':
        return {
          top: -10,
          left: 27,
        };
      case '3B':
        return {
          top: -10,
          left: -7,
        };
      case 'HOME':
        return {
          bottom: -5,
          left: -5,
        };
      default:
        return {
          top: 14,
          left: 14,
        };
    }
  };

  const getNoteGroupStyle = (base: string) => ({
    position: 'absolute' as const,
    width: NOTE_GROUP_WIDTH,
    height: NOTE_GROUP_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none' as const,
    ...getBasePosition(base),
  });

  return (
    <div className={cls}>
      <div className="sc-pitches">
        {pitches.map((p, i) => (
          <span
            key={i}
            className={`pm pm-${String(p).toLowerCase()}`}
            title={p}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 12,
              height: 12,
            }}
          >
            <PitchMark code={p} size={12} />
          </span>
        ))}
        {result &&
          !['B', 'IB', 'IB2', 'HP', 'K', 'K3B', 'KW', 'KP', 'KE'].includes(result) &&
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

        {sideNotes.map((n, i) => {
          const note = String(n).trim();

          if (note === 'M_R') {
            return (
              <div
                key={`n${i}`}
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  lineHeight: 1.2,
                  color: '#111',
                }}
              >
                M
              </div>
            );
          }

          if (note === 'M_B') {
            return (
              <div
                key={`n${i}`}
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  lineHeight: 1.2,
                  color: '#111',
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
                  border: '2px solid #111',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 8,
                  fontWeight: 900,
                  color: '#111',
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
                  border: '2px solid #111',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 8,
                  fontWeight: 900,
                  color: '#111',
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
                      ? '⊕'
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

            {!hitData && ballType === '땅' && (
              <path
                d="M 4,30 Q 8,34 12,30"
                fill="none"
                stroke="#111"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}
            {!hitData && ballType === '뜬' && (
              <path
                d="M 2,36 Q 7,31 12,36"
                fill="none"
                stroke="#111"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}
            {!hitData && ballType === '라' && (
              <line
                x1="2"
                y1="36"
                x2="12"
                y2="36"
                stroke="#111"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}

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
                      <text
                        x="33"
                        y="32"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="9"
                        fontWeight="900"
                        fontFamily="monospace"
                        fill={zoneColor}
                      >
                        {zoneLbl}
                      </text>
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
                      <text
                        x={hrZx}
                        y={hrZy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="18"
                        fontWeight="900"
                        fontFamily="monospace"
                        fill={zoneColor}
                      >
                        {zoneLbl}
                      </text>
                      {hrDot && (
                        <circle
                          cx={hrZx + hrDot.dx}
                          cy={hrZy + hrDot.dy - 1}
                          r="1.5"
                          fill={zoneColor}
                        />
                      )}
                      {hitData.ballType === '뜬' && (
                        <path
                          d={`M ${hrZx - 4.5},${hrZy - 10.0} Q ${hrZx},${hrZy - 17.5} ${hrZx + 4.5},${hrZy - 10.0}`}
                          stroke={zoneColor}
                          strokeWidth="1.3"
                          fill="none"
                          strokeLinecap="round"
                        />
                      )}
                      {hitData.ballType === '라' && (
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
                      {hitData.ballType === '땅' && (
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
                      <text
                        x="35"
                        y="38"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="18"
                        fontWeight="900"
                        fontFamily="monospace"
                        fill={zoneColor}
                      >
                        {zoneLbl}
                      </text>
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
                      <text
                        x="35"
                        y="38"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="18"
                        fontWeight="900"
                        fontFamily="monospace"
                        fill={zoneColor}
                      >
                        {zoneLbl}
                      </text>
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
                      <text
                        x={cx}
                        y={cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="11"
                        fontWeight="900"
                        fontFamily="monospace"
                        fill={zoneColor}
                      >
                        {zoneLbl}
                      </text>
                      {dot && <circle cx={cx + dot.dx} cy={cy + dot.dy} r="1.2" fill={zoneColor} />}
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
                    {hitData.ballType === '뜬' && (
                      <path
                        /* x축 중심을 zx + 4에서 zx + 6으로 더 오른쪽으로 이동 */
                        d={`M ${zx + 5 - 2.9},${zy + (dot?.dy ?? 0)} Q ${zx + 6},${zy + (dot?.dy ?? 0) - 6} ${zx + 6 + 2.9},${zy + (dot?.dy ?? 0)}`}
                        stroke={zoneColor}
                        strokeWidth="1.2"
                        fill="none"
                        strokeLinecap="round"
                      />
                    )}
                    {hitData.ballType === '라' && (
                      <line
                        x1={zx - 7}
                        y1={zy - 6.0}
                        x2={zx + 7}
                        y2={zy - 6.0}
                        stroke={zoneColor}
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    )}

                    <text
                      x={zx + 4}
                      y={zy + 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="11"
                      fontWeight="900"
                      fontFamily="monospace"
                      fill={zoneColor}
                    >
                      {zoneLbl}
                    </text>

                    {hitData.ballType === '땅' && (
                      <path
                        /* x축은 zx + 4 유지 */
                        /* 시작/끝점 y좌표를 +7.5로, 제어점 y좌표를 +9.8로 더 하향 조정 */
                        d={`M ${zx + 4 - 5},${zy + (dot?.dy ?? 0) + 7.5} Q ${zx + 4},${zy + (dot?.dy ?? 0) + 9.8} ${zx + 4 + 5},${zy + (dot?.dy ?? 0) + 7.5}`}
                        stroke={zoneColor}
                        strokeWidth="1.2"
                        fill="none"
                        strokeLinecap="round"
                      />
                    )}
                    {dot && (
                      <circle cx={zx + dot.dx + 4} cy={zy + dot.dy} r="1.35" fill={zoneColor} />
                    )}
                  </g>
                );
              })()}
          </svg>

          {(['2B', '3B'] as const).map((base) => {
            if (!noteAtBase[base]) return null;
            return (
              <div key={base} style={getNoteGroupStyle(base)}>
                <span
                  style={{
                    fontSize: 11,
                    color: '#111',
                    fontWeight: 800,
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {noteAtBase[base]}
                </span>
              </div>
            );
          })}

          {homeNoteItems.length > 0 && (
            <div
              style={{ ...getNoteGroupStyle('HOME'), width: 'auto', gap: 1, flexWrap: 'nowrap' }}
            >
              {homeNoteItems.map((item, i) => {
                if ('advLbl' in item) {
                  return (
                    <span
                      key={i}
                      style={{ fontSize: 10, color: '#111', fontWeight: 800, lineHeight: 1 }}
                    >
                      {item.advLbl}
                    </span>
                  );
                }
                // 동그라미 안에 한자
                const ringColor = '#111';
                return (
                  <svg
                    key={i}
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    style={{ display: 'block' }}
                  >
                    <circle cx="9" cy="9" r="8" fill="none" stroke={ringColor} strokeWidth="1.8" />
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
                );
              })}
            </div>
          )}
        </div>
      </div>

      {result && !hitData && !runOut && (
        <div className="sc-result" style={{ color: rcol, fontSize: 20, fontWeight: 'bold' }}>
          {RESULT_SYMBOL[result] ?? result}
        </div>
      )}

      {runOut && runOutNum && (
        <div
          style={{
            position: 'absolute',
            width: NOTE_GROUP_WIDTH,
            height: NOTE_GROUP_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 15,
            fontWeight: 700,
            color: '#111',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            ...getBasePosition(runOutBase || '1B'),
          }}
        >
          {runOut}
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

function calcStats(G: GameState, half: 'top' | 'bottom', ord: number) {
  const cs = Object.values(G.cells).filter((c) => c.half === half && c.order === ord && c.result);
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
    // 낫아웃(KW/KP/KE)도 삼진으로 집계 (record.md §1-17)
    if (r === 'K' || r === 'K3B' || r === 'KT' || r === 'KW' || r === 'KP' || r === 'KE') k++;
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
    .filter((c) => c.half === half)
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

  const lu = (viewHalf === 'top' ? G.awayLineup : G.homeLineup).filter((p) => p.order > 0);
  const half = viewHalf;
  const maxInn = Math.min(Math.max(G.inning + 1, 9), 15);
  const inns = Array.from({ length: maxInn }, (_, i) => i + 1);

  const outMap: Record<string, number> = {};
  const outByInn: Record<number, number> = {};
  const sorted = Object.values(G.cells)
    .filter((c) => c.half === half)
    .sort((a, b) => a.inning - b.inning || a.order - b.order || a.appearance - b.appearance);

  sorted.forEach((c) => {
    if (c.isDPRunner && c.runOutNum && c.runOutInning) {
      if (!outByInn[c.runOutInning]) outByInn[c.runOutInning] = 0;
      outByInn[c.runOutInning] = Math.max(outByInn[c.runOutInning], c.runOutNum);
    }
    if (!outByInn[c.inning]) outByInn[c.inning] = 0;
    if (isOut(c.result)) {
      outByInn[c.inning]++;
      outMap[cellKey(c.inning, c.order, c.appearance, half)] = Math.min(outByInn[c.inning], 3);
    }
  });

  const pitchChangeInns = new Set(
    (G.pitcherChanges || []).filter((c) => c.half === half).map((c) => c.inning)
  );

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
          {activePitcherNum && (
            <span style={{ color: '#111', fontSize: 9 }}> #{activePitcherNum}</span>
          )}
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
          <div id="ss-wrap">
            <table className="ss-tbl">
              <thead>
                <tr>
                  <th style={{ width: 14 }}>풋</th>
                  <th style={{ width: 14 }}>보</th>
                  <th style={{ width: 14 }}>실</th>
                  <th style={{ width: 22 }}>수비</th>
                  <th style={{ minWidth: 80 }}>선수명</th>
                  <th style={{ minWidth: 26 }}>타순</th>
                  {inns.map((i) => (
                    <th
                      key={i}
                      className={i === G.inning && half === G.half ? 'cur-inn-h' : ''}
                      style={{ minWidth: 80, width: 80, position: 'relative' }}
                    >
                      {i}
                      {pitchChangeInns.has(i) && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: 8,
                            color: '#111',
                            lineHeight: 1,
                          }}
                        >
                          〜
                        </span>
                      )}
                    </th>
                  ))}
                  <th className="ss-stat">타수</th>
                  <th className="ss-stat">득점</th>
                  <th className="ss-stat">안타</th>
                  <th className="ss-stat">타점</th>
                  <th className="ss-stat">희타</th>
                  <th className="ss-stat">희비</th>
                  <th className="ss-stat">도루</th>
                  <th className="ss-stat">도실</th>
                  <th className="ss-stat">4구</th>
                  <th className="ss-stat">고사</th>
                  <th className="ss-stat">삼진</th>
                  <th className="ss-stat">병살</th>
                  <th className="ss-stat">잔루</th>
                </tr>
              </thead>

              <tbody>
                {lu.map((p) => {
                  const ord = p.order;
                  const maxRows = getMaxRows(G, half, ord);

                  return Array.from({ length: maxRows }, (_, app) => {
                    const isCurBat = half === G.half && ord === G.curBatterOrder;
                    return (
                      <tr
                        key={`${ord}-${app}`}
                        className={[isCurBat ? 'ss-row-cur' : '', app > 0 ? 'ss-row-overflow' : '']
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {app === 0 && (
                          <>
                            <td style={{ width: 14 }} rowSpan={maxRows} />
                            <td style={{ width: 14 }} rowSpan={maxRows} />
                            <td style={{ width: 14 }} rowSpan={maxRows} />
                            <td style={{ width: 22 }} rowSpan={maxRows}>
                              <div
                                style={{
                                  textAlign: 'center',
                                  padding: 2,
                                  fontSize: 10,
                                  color: '#111',
                                  fontWeight: 900,
                                  fontFamily: 'monospace',
                                }}
                              >
                                {p.pos === 0 ? 'D' : p.pos || ''}
                              </div>
                            </td>
                            <td style={{ minWidth: 80 }} rowSpan={maxRows}>
                              <div className="ss-player-col">
                                <div style={{ fontSize: 20, fontWeight: 600 }}>{p.name}</div>
                              </div>
                            </td>
                            <td rowSpan={maxRows}>
                              <div className="ss-order-col">
                                <div className="ss-ord-main">{ord}</div>
                                <div className="ss-ord-sub">{ord + 10}</div>
                                <div className="ss-ord-sub">{ord + 20}</div>
                                <div className="ss-ord-sub">{ord + 30}</div>
                              </div>
                            </td>
                          </>
                        )}

                        {inns.map((inn) => {
                          const ck = cellKey(inn, ord, app, half);
                          const c = G.cells[ck] || null;
                          const iS = G.selCellKey === ck;
                          const iC =
                            half === G.half &&
                            ord === G.curBatterOrder &&
                            inn === G.inning &&
                            app === 0 &&
                            !c?.result;
                          const oNum = outMap[ck];

                          return (
                            <td
                              key={inn}
                              className={inn === G.inning && half === G.half ? 'cur-inn-col' : ''}
                              onClick={() => onSelCell(ck)}
                              style={{
                                width: 80,
                                minWidth: 80,
                                borderBottom:
                                  oNum === 3 || c?.runOutNum === 3 ? '2px solid #111' : undefined,
                              }}
                            >
                              <ScoreCell
                                cell={c}
                                isSel={iS}
                                isCur={iC}
                                outNum={oNum ?? c?.runOutNum}
                              />
                            </td>
                          );
                        })}

                        {app === 0 &&
                          (() => {
                            const st = calcStats(G, half, ord);
                            return (
                              <>
                                <td className="ss-stat" rowSpan={maxRows}>
                                  {st.ab || ''}
                                </td>
                                <td className="ss-stat" rowSpan={maxRows}>
                                  {st.run || ''}
                                </td>
                                <td className="ss-stat" rowSpan={maxRows}>
                                  {st.h || ''}
                                </td>
                                <td className="ss-stat" rowSpan={maxRows}>
                                  {st.rbi || ''}
                                </td>
                                <td className="ss-stat" rowSpan={maxRows}>
                                  {st.sh || ''}
                                </td>
                                <td className="ss-stat" rowSpan={maxRows}>
                                  {st.sf || ''}
                                </td>
                                <td className="ss-stat" rowSpan={maxRows}>
                                  {st.sb || ''}
                                </td>
                                <td className="ss-stat" rowSpan={maxRows}>
                                  {st.cs || ''}
                                </td>
                                <td className="ss-stat" rowSpan={maxRows}>
                                  {st.bb || ''}
                                </td>
                                <td className="ss-stat" rowSpan={maxRows}>
                                  {st.ibb || ''}
                                </td>
                                <td className="ss-stat" rowSpan={maxRows}>
                                  {st.k || ''}
                                </td>
                                <td className="ss-stat" rowSpan={maxRows}>
                                  {st.dp || ''}
                                </td>
                                <td className="ss-stat" rowSpan={maxRows}>
                                  {st.lob || ''}
                                </td>
                              </>
                            );
                          })()}
                      </tr>
                    );
                  });
                })}

                {Array.from({ length: 4 }, (_, ri) => (
                  <tr key={`subst-${ri}`} style={{ height: 18 }}>
                    {ri === 0 && (
                      <>
                        <td
                          colSpan={3}
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
                    {inns.map((inn) => (
                      <td
                        key={inn}
                        style={{
                          width: 80,
                          minWidth: 80,
                          borderTop: ri === 0 ? '1px solid var(--border)' : undefined,
                          height: 18,
                        }}
                      />
                    ))}
                    {ri === 0 && (
                      <td
                        colSpan={13}
                        rowSpan={4}
                        style={{ borderTop: '1px solid var(--border)' }}
                      />
                    )}
                  </tr>
                ))}
              </tbody>

              <tfoot>
                {(() => {
                  const innHits: Record<number, number> = {};
                  const innBB: Record<number, number> = {};

                  Object.values(G.cells)
                    .filter((c) => c.half === half && c.result)
                    .forEach((c) => {
                      const r = c.result!;
                      const isH =
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
                      const isBB = ['B', 'IB', 'IB2', 'HP'].includes(r);
                      if (isH) innHits[c.inning] = (innHits[c.inning] || 0) + 1;
                      if (isBB) innBB[c.inning] = (innBB[c.inning] || 0) + 1;
                    });

                  return (
                    <>
                      <tr style={{ height: 18 }}>
                        <td
                          colSpan={6}
                          style={{
                            fontSize: 9,
                            color: '#111',
                            textAlign: 'right',
                            paddingRight: 4,
                            borderTop: '1px solid var(--border)',
                          }}
                        >
                          연타
                        </td>
                        {inns.map((i) => (
                          <td
                            key={i}
                            style={{
                              width: 80,
                              textAlign: 'center',
                              fontSize: 9,
                              borderTop: '1px solid var(--border)',
                            }}
                          >
                            {innHits[i] || ''}
                          </td>
                        ))}
                        <td colSpan={13} style={{ borderTop: '1px solid var(--border)' }} />
                      </tr>
                      <tr style={{ height: 18 }}>
                        <td
                          colSpan={6}
                          style={{
                            fontSize: 9,
                            color: '#111',
                            textAlign: 'right',
                            paddingRight: 4,
                          }}
                        >
                          여신수
                        </td>
                        {inns.map((i) => (
                          <td key={i} style={{ width: 80, textAlign: 'center', fontSize: 9 }}>
                            {innBB[i] || ''}
                          </td>
                        ))}
                        <td colSpan={13} />
                      </tr>
                      <tr style={{ height: 20, borderTop: '2px solid var(--border)' }}>
                        <td
                          colSpan={3}
                          style={{
                            fontSize: 9,
                            textAlign: 'center',
                            fontWeight: 700,
                            borderTop: '2px solid var(--border)',
                          }}
                        >
                          합계
                        </td>
                        <td style={{ borderTop: '2px solid var(--border)' }} />
                        <td style={{ minWidth: 80, borderTop: '2px solid var(--border)' }} />
                        <td
                          style={{
                            fontSize: 9,
                            textAlign: 'center',
                            borderTop: '2px solid var(--border)',
                          }}
                        >
                          {lu.length}명
                        </td>
                        {inns.map((i) => {
                          const innScore = half === 'top' ? G.awayInn[i - 1] : G.homeInn[i - 1];
                          return (
                            <td
                              key={i}
                              style={{
                                width: 80,
                                textAlign: 'center',
                                fontSize: 9,
                                fontWeight: 700,
                                borderTop: '2px solid var(--border)',
                              }}
                            >
                              {innScore != null ? innScore : ''}
                            </td>
                          );
                        })}
                        <td
                          colSpan={13}
                          style={{
                            fontSize: 9,
                            textAlign: 'center',
                            borderTop: '2px solid var(--border)',
                          }}
                        >
                          투구수 {isLive ? activePitchCount : '—'}
                        </td>
                      </tr>
                    </>
                  );
                })()}
              </tfoot>
            </table>
          </div>

          {viewHalf === 'top' ? (
            <div
              style={{
                display: 'flex',
                gap: 0,
                borderTop: '2px solid var(--border)',
                background: 'var(--panel2)',
                fontSize: 10,
              }}
            >
              <div
                style={{
                  flex: '0 0 220px',
                  borderRight: '1px solid var(--border2)',
                  padding: '4px 8px',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr',
                    gap: '2px 4px',
                    alignItems: 'center',
                  }}
                >
                  {[
                    ['개시', G.startTime],
                    ['종료', G.endTime],
                    ['소요시간', ''],
                    ['공식기록원', G.recorder1],
                    ['관중수', G.attendance ? `${G.attendance}명` : ''],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'contents' }}>
                      <span style={{ color: '#111', textAlign: 'right' }}>{label}</span>
                      <span
                        style={{
                          fontWeight: val ? 600 : 400,
                          color: '#111',
                        }}
                      >
                        {val || '—'}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 6, borderTop: '1px solid var(--border2)', paddingTop: 4 }}>
                  {[
                    ['주심', G.umpireHome],
                    ['1루심', G.umpire1B],
                    ['2루심', G.umpire2B],
                    ['3루심', G.umpire3B],
                    ['좌선심', G.umpireLeft],
                    ['우선심', G.umpireRight],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', gap: 6, marginBottom: 1 }}>
                      <span style={{ color: '#111', width: 38, textAlign: 'right' }}>{label}</span>
                      <span style={{ fontWeight: val ? 600 : 400 }}>{val || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  borderRight: '1px solid var(--border2)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    padding: '2px 6px',
                    fontWeight: 700,
                    fontSize: 9,
                    borderBottom: '1px solid var(--border2)',
                    background: 'var(--panel3)',
                  }}
                >
                  비디오판독
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, flex: 1 }}>
                  <thead>
                    <tr style={{ background: 'var(--panel3)' }}>
                      {['회', '타순', '요점', '내 용', '최초', '최종', '소요시간'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '2px 4px',
                            borderBottom: '1px solid var(--border2)',
                            borderRight: '1px solid var(--border2)',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 7 }, (_, i) => (
                      <tr key={i} style={{ height: 18 }}>
                        {Array.from({ length: 7 }, (__, j) => (
                          <td
                            key={j}
                            style={{
                              borderRight: '1px solid var(--border2)',
                              borderBottom: '1px solid var(--border2)',
                              padding: 0,
                            }}
                          >
                            {null}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ flex: '0 0 auto', minWidth: 280, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                  <thead>
                    <tr style={{ background: 'var(--panel3)' }}>
                      <th
                        style={{
                          padding: '2px 4px',
                          borderBottom: '1px solid var(--border2)',
                          borderRight: '1px solid var(--border2)',
                          minWidth: 50,
                        }}
                      >
                        성명
                      </th>
                      <th
                        style={{
                          padding: '2px 4px',
                          borderBottom: '1px solid var(--border2)',
                          borderRight: '1px solid var(--border2)',
                        }}
                      >
                        교대
                      </th>
                      <th
                        style={{
                          padding: '2px 4px',
                          borderBottom: '1px solid var(--border2)',
                          borderRight: '1px solid var(--border2)',
                        }}
                      >
                        B
                      </th>
                      <th
                        style={{
                          padding: '2px 4px',
                          borderBottom: '1px solid var(--border2)',
                          borderRight: '1px solid var(--border2)',
                        }}
                      >
                        S
                      </th>
                      <th
                        style={{
                          padding: '2px 4px',
                          borderBottom: '1px solid var(--border2)',
                          borderRight: '1px solid var(--border2)',
                        }}
                      >
                        투구수
                      </th>
                      <th
                        style={{
                          padding: '2px 4px',
                          borderBottom: '1px solid var(--border2)',
                          borderRight: '1px solid var(--border2)',
                        }}
                      >
                        타수
                      </th>
                      <th
                        style={{
                          padding: '2px 4px',
                          borderBottom: '1px solid var(--border2)',
                          borderRight: '1px solid var(--border2)',
                        }}
                      >
                        안타
                      </th>
                      <th
                        style={{
                          padding: '2px 4px',
                          borderBottom: '1px solid var(--border2)',
                          borderRight: '1px solid var(--border2)',
                        }}
                      >
                        볼넷
                      </th>
                      <th
                        style={{
                          padding: '2px 4px',
                          borderBottom: '1px solid var(--border2)',
                          borderRight: '1px solid var(--border2)',
                        }}
                      >
                        삼진
                      </th>
                      <th
                        style={{
                          padding: '2px 4px',
                          borderBottom: '1px solid var(--border2)',
                          borderRight: '1px solid var(--border2)',
                        }}
                      >
                        실점
                      </th>
                      <th style={{ padding: '2px 4px', borderBottom: '1px solid var(--border2)' }}>
                        자책
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const changes = (G.pitcherChanges || []).filter((c) => c.half === half);
                      const pitcherRows: {
                        name: string;
                        entryInn: number;
                        entryOrd: number;
                        exitInn?: number;
                      }[] = [];
                      const defLU = half === 'top' ? G.homeLineup : G.awayLineup;
                      const starterName = defLU.find((p) => p.pos === 1)?.name || activePitcherName;
                      pitcherRows.push({
                        name: starterName,
                        entryInn: 1,
                        entryOrd: 1,
                        exitInn: changes[0]?.inning,
                      });
                      changes.forEach((ch, i) => {
                        pitcherRows.push({
                          name: ch.name,
                          entryInn: ch.inning,
                          entryOrd: ch.order,
                          exitInn: changes[i + 1]?.inning,
                        });
                      });
                      const totalRows = 8;
                      const blankCount = Math.max(0, totalRows - pitcherRows.length);

                      return (
                        <>
                          {pitcherRows.map((row, i) => (
                            <tr key={i} style={{ height: 18 }}>
                              <td
                                style={{
                                  padding: '2px 4px',
                                  fontWeight: 600,
                                  borderRight: '1px solid var(--border2)',
                                  borderBottom: '1px solid var(--border2)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {row.name}
                              </td>
                              <td
                                style={{
                                  padding: '2px 4px',
                                  textAlign: 'center',
                                  borderRight: '1px solid var(--border2)',
                                  borderBottom: '1px solid var(--border2)',
                                  fontSize: 8,
                                }}
                              >
                                {row.entryInn > 1 ? `${row.entryInn}회` : '선발'}
                              </td>
                              {Array.from({ length: 9 }, (__, j) => (
                                <td
                                  key={j}
                                  style={{
                                    padding: '2px 4px',
                                    textAlign: 'center',
                                    borderRight: j < 8 ? '1px solid var(--border2)' : undefined,
                                    borderBottom: '1px solid var(--border2)',
                                  }}
                                />
                              ))}
                            </tr>
                          ))}
                          {Array.from({ length: blankCount }, (_, i) => (
                            <tr key={`b-${i}`} style={{ height: 18 }}>
                              {Array.from({ length: 11 }, (__, j) => (
                                <td
                                  key={j}
                                  style={{
                                    borderRight: j < 10 ? '1px solid var(--border2)' : undefined,
                                    borderBottom: '1px solid var(--border2)',
                                  }}
                                />
                              ))}
                            </tr>
                          ))}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 0,
                borderTop: '2px solid var(--border)',
                background: 'var(--panel2)',
                fontSize: 10,
              }}
            >
              <div style={{ flex: '0 0 220px', borderRight: '1px solid var(--border2)' }}>
                <div
                  style={{
                    padding: '3px 6px',
                    fontWeight: 700,
                    borderBottom: '1px solid var(--border2)',
                    background: 'var(--panel3)',
                  }}
                >
                  홈런 타자
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr>
                      {['시각', '소속', '성명', '회', '환수'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '2px 4px',
                            borderBottom: '1px solid var(--border2)',
                            fontWeight: 600,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const hrs = Object.values(G.cells)
                        .filter((c) => (c.result === 'HR' || c.result === 'GHR') && c.half === half)
                        .sort((a, b) => a.inning - b.inning || a.order - b.order);
                      const lu2 = half === 'top' ? G.awayLineup : G.homeLineup;

                      return [...hrs, ...Array(Math.max(0, 6 - hrs.length)).fill(null)].map(
                        (c, i) => {
                          const p = c ? lu2[c.order - 1] : null;
                          return (
                            <tr key={i} style={{ height: 18 }}>
                              <td style={{ padding: '2px 4px' }} />
                              <td style={{ padding: '2px 4px' }}>
                                {c ? (half === 'top' ? G.awayTeam : G.homeTeam) : ''}
                              </td>
                              <td style={{ padding: '2px 4px', fontWeight: p ? 600 : 400 }}>
                                {p?.name || ''}
                              </td>
                              <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                                {c ? c.inning : ''}
                              </td>
                              <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                                {c?.result === 'GHR' ? '만' : c ? '솔' : ''}
                              </td>
                            </tr>
                          );
                        }
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              <div style={{ flex: '0 0 160px', borderRight: '1px solid var(--border2)' }}>
                {[
                  ['D', '병살'],
                  ['P', '폭투/패스트볼'],
                  ['(S)', '희타/희비'],
                ].map(([code, label]) => (
                  <div
                    key={code}
                    style={{
                      borderBottom: '1px solid var(--border2)',
                      padding: '3px 6px',
                      minHeight: 36,
                    }}
                  >
                    <span style={{ fontWeight: 700, marginRight: 6, color: '#111' }}>{code}</span>
                    <span style={{ color: '#111', fontSize: 9 }}>{label}</span>
                  </div>
                ))}
                <div style={{ padding: '3px 6px', minHeight: 36 }}>
                  <div style={{ fontSize: 9, color: '#111', marginBottom: 2 }}>결기종단</div>
                  <div style={{ fontSize: 9 }}>{G.endTime ? `종료 ${G.endTime}` : '—'}</div>
                </div>
              </div>

              <div style={{ flex: 1, padding: '4px 8px' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>비고</div>
                <div style={{ fontSize: 9, color: '#111', lineHeight: 1.8 }} />
              </div>
            </div>
          )}

          {(() => {
            const cells = Object.values(G.cells).filter((c) => c.half === half && c.result);
            const bf = cells.length;
            const ha = cells.filter((c) => {
              const r = c.result!;
              return (
                /^\/[789]$/.test(r) ||
                r === '/hit' ||
                r === 'H1' ||
                /^>[789](-[789])?$/.test(r) ||
                r === '>hit' ||
                r === 'H2' ||
                /^>>>[789]$/.test(r) ||
                r === 'H3' ||
                r === '>>>hit' ||
                r === 'HR' ||
                r === 'GHR' ||
                r === 'INT' ||
                r === 'BUNT' ||
                r === 'OBUNT'
              );
            }).length;
            const bb = cells.filter((c) => ['B', 'IB', 'IB2'].includes(c.result!)).length;
            const hbp = cells.filter((c) => c.result === 'HP').length;
            const ks = cells.filter((c) => c.result === 'K').length;
            const er = half === 'top' ? G.awayER : G.homeER;
            const r = half === 'top' ? G.awayR : G.homeR;

            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  borderTop: '2px solid var(--border)',
                  background: 'var(--panel2)',
                  fontSize: 10,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontWeight: 700, color: '#111', marginRight: 4 }}>투수</span>
                <span style={{ fontWeight: 700 }}>{activePitcherName}</span>
                {activePitcherNum && <span style={{ color: '#111' }}>#{activePitcherNum}</span>}
                <span
                  style={{
                    borderLeft: '1px solid var(--border2)',
                    paddingLeft: 6,
                    color: '#111',
                  }}
                >
                  투구수 <b style={{ color: '#111' }}>{isLive ? activePitchCount : '—'}</b>
                </span>
                {isLive && (
                  <>
                    <span style={{ color: '#111' }}>
                      볼 <b>{activeBallCount}</b>
                    </span>
                    <span style={{ color: '#111' }}>
                      스트 <b>{activeStrikeCount}</b>
                    </span>
                  </>
                )}
                <span
                  style={{
                    borderLeft: '1px solid var(--border2)',
                    paddingLeft: 6,
                    color: '#111',
                  }}
                >
                  상대타자 <b>{bf}</b>
                </span>
                <span style={{ color: '#111' }}>
                  피안타 <b>{ha}</b>
                </span>
                <span style={{ color: '#111' }}>
                  볼넷 <b>{bb}</b>
                </span>
                {hbp > 0 && (
                  <span style={{ color: '#111' }}>
                    사구 <b>{hbp}</b>
                  </span>
                )}
                <span style={{ color: '#111' }}>
                  삼진 <b>{ks}</b>
                </span>
                <span
                  style={{
                    borderLeft: '1px solid var(--border2)',
                    paddingLeft: 6,
                    color: '#111',
                  }}
                >
                  실점 <b style={{ color: '#111' }}>{r}</b>
                </span>
                <span style={{ color: '#111' }}>
                  자책 <b style={{ color: '#111' }}>{er}</b>
                </span>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
