import { useState } from 'react';
import type { HitData, Player } from '../../types';

interface Props {
  open: boolean;
  selected: string | null;
  onSelect: (v: string, ballType?: '땅' | '뜬' | '라') => void;
  onConfirm: () => void;
  onAutoConfirm: (
    result: string,
    ballType?: '땅' | '뜬' | '라',
    hitData?: HitData,
    chain?: boolean
  ) => void;
  onClose: () => void;
  selectedHit: HitData | null;
  onSelectHit: (data: HitData) => void;
  defLU?: Player[];
}

type BallType = '땅볼' | '뜬공' | '라이너';

const FPOS: { key: number; x: number; y: number; r: number }[] = [
  { key: 8, x: 130, y: 32, r: 13 },
  { key: 78, x: 80, y: 40, r: 13 },
  { key: 89, x: 180, y: 40, r: 13 },
  { key: 7, x: 44, y: 62, r: 13 },
  { key: 9, x: 216, y: 62, r: 13 },
  { key: 6, x: 104, y: 108, r: 13 },
  { key: 4, x: 156, y: 108, r: 13 },
  { key: 5, x: 78, y: 128, r: 13 },
  { key: 3, x: 182, y: 128, r: 13 },
  { key: 1, x: 130, y: 130, r: 13 },
  { key: 2, x: 130, y: 182, r: 13 },
];

const POS_NAME: Record<number, string> = {
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  78: '7·8',
  89: '8·9',
};

const HIT_LABEL: Record<string, string> = {
  '1B': '1루타',
  '2B': '2루타',
  '3B': '3루타',
  HR: '홈런',
  GHR: '그라운드홈런',
  GCW: '캣워크',
  INT: '내야안타',
  BUNT: '번트안타',
  OBUNT: '외야번트',
  선행주자아웃: '선행주자아웃',
  '→선행주자아웃': '→선행주자아웃',
};

// 수비위치+타구방향+구질이 필요한 결과 (선행주자아웃류 포함 — 안타가 아니지만 동일 UI 사용)
const NEEDS_HIT = new Set([
  '1B',
  '2B',
  '3B',
  'HR',
  'GHR',
  'GCW',
  'INT',
  'BUNT',
  'OBUNT',
  '선행주자아웃',
  '→선행주자아웃',
]);
// 실책 수비수 번호가 필요한 결과 — 필드 클릭 한 번으로 바로 확정
const NEEDS_FIELDER = new Set(['E', 'E번트', 'KE', '#', 'ob']);

const GHR_DISTS = [90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150];

const DIR_LABEL: Record<string, string> = {
  '0-0': '↖',
  '0-1': '↑',
  '0-2': '↗',
  '1-0': '←',
  '1-2': '→',
  '2-0': '↙',
  '2-1': '↓',
  '2-2': '↘',
};

function toBallTypeShort(b: BallType): '땅' | '뜬' | '라' {
  return b === '땅볼' ? '땅' : b === '뜬공' ? '뜬' : '라';
}

function basesForType(hitType: string): 0 | 1 | 2 | 3 | 4 {
  if (
    hitType === '1B' ||
    hitType === 'INT' ||
    hitType === 'BUNT' ||
    hitType === 'OBUNT' ||
    hitType === '선행주자아웃' ||
    hitType === '→선행주자아웃'
  )
    return 1;
  if (hitType === '2B') return 2;
  if (hitType === '3B') return 3;
  return 4; // HR, GHR, GCW
}

function buildErrorResult(base: string, seq: number[]): string {
  const lastPos = seq[seq.length - 1];
  if (base === '#') return `#${lastPos}E`;
  if (base === 'ob') return `Ob${lastPos}E`;
  return `E${seq.join('-')}`;
}

interface DefRow {
  pos: number;
  assist: boolean;
  putout: boolean;
  error: boolean;
}

function Btn({
  label,
  sel,
  onClick,
  disabled,
  style,
}: {
  label: string;
  sel?: boolean;
  onClick: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`r-btn${sel ? ' sel' : ''}`}
      style={{ textAlign: 'left', fontSize: 12, ...(disabled ? { opacity: 0.4 } : {}), ...style }}
    >
      {label}
    </button>
  );
}

export default function BatAdvModal({
  open,
  onAutoConfirm,
  onClose,
  onSelectHit,
  defLU = [],
}: Props) {
  const [pendingResult, setPendingResult] = useState<string | null>(null);
  const [selDirRow, setSelDirRow] = useState<number | null>(null);
  const [selDirCol, setSelDirCol] = useState<number | null>(null);
  const [selBall, setSelBall] = useState<BallType | null>(null);
  const [deflection, setDeflection] = useState(false);
  const [defSeq, setDefSeq] = useState<DefRow[]>([]);
  const [연결동작, set연결동작] = useState(false);
  const [장외홈런, set장외홈런] = useState(false);
  const [hrDist, setHrDist] = useState(110);
  const [ghrDist, setGhrDist] = useState(110);
  const [ghrH, setGhrH] = useState(0);
  const [ghrM, setGhrM] = useState(0);

  // ── 안타 상태 업데이트만 (자동완료 없음, 확인 버튼으로 처리) ───────────────
  const tryAutoHit = (
    zone: number | null,
    row: number | null,
    col: number | null,
    ball: BallType | null,
    defl: boolean,
    hitType: string
  ) => {
    if (zone === null || row === null || col === null || !ball) return;
    const bases = basesForType(hitType);
    const hd: HitData = {
      zone,
      hitType,
      dirRow: row,
      dirCol: col,
      ballType: toBallTypeShort(ball),
      deflection: defl,
      bases,
    };
    onSelectHit(hd);
    // 자동확정 없음 — 확인 버튼으로만 처리
  };

  // 방향은 방향 버튼으로만 선택 (필드 클릭 비활성)

  // ── 방향 버튼 클릭 ────────────────────────────────────────────────────────
  const handleDir = (row: number, col: number) => {
    if (!pendingResult || !NEEDS_HIT.has(pendingResult)) return;
    setSelDirRow(row);
    setSelDirCol(col);
    const zone = defSeq[defSeq.length - 1]?.pos ?? null;
    tryAutoHit(zone, row, col, selBall, deflection, pendingResult);
  };

  // ── 구질 선택 ─────────────────────────────────────────────────────────────
  const handleBall = (b: BallType) => {
    if (!pendingResult || !NEEDS_HIT.has(pendingResult)) return;
    setSelBall(b);
    const zone = defSeq[defSeq.length - 1]?.pos ?? null;
    tryAutoHit(zone, selDirRow, selDirCol, b, deflection, pendingResult);
  };

  // ── 필드 수비수 번호 클릭 ─────────────────────────────────────────────────
  const handlePosClick = (pos: number) => {
    if (!pendingResult) return;

    setDefSeq((prev) => {
      const idx = prev.findIndex((r) => r.pos === pos);
      let next: DefRow[];
      if (idx >= 0) {
        next = prev.filter((_, i) => i !== idx);
      } else {
        next = [...prev, { pos, assist: false, putout: false, error: false }];
      }
      if (NEEDS_HIT.has(pendingResult)) {
        const zone = next[next.length - 1]?.pos ?? null;
        tryAutoHit(zone, selDirRow, selDirCol, selBall, deflection, pendingResult);
      }
      return next;
    });
  };

  // ── 결과 버튼 선택 ────────────────────────────────────────────────────────
  const pick = (v: string) => {
    setPendingResult(v);
    setDefSeq([]);
    setSelDirRow(null);
    setSelDirCol(null);
    setSelBall(null);
    setDeflection(false);
  };

  // ── 비-안타 확인 ──────────────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!pendingResult) return;
    if (NEEDS_FIELDER.has(pendingResult)) {
      if (!defSeq.length) return;
      const seq = defSeq.map((r) => r.pos);
      onAutoConfirm(buildErrorResult(pendingResult, seq), undefined, undefined, 연결동작);
    } else {
      onAutoConfirm(pendingResult, undefined, undefined, 연결동작);
    }
  };

  // ── 닫기 ─────────────────────────────────────────────────────────────────
  const handleClose = () => {
    setPendingResult(null);
    setDefSeq([]);
    setSelDirRow(null);
    setSelDirCol(null);
    setSelBall(null);
    setDeflection(false);
    set장외홈런(false);
    setHrDist(110);
    setGhrDist(110);
    setGhrH(0);
    setGhrM(0);
    set연결동작(false);
    onClose();
  };

  const s = (v: string) => pendingResult === v;
  const defSeqLabel = defSeq.map((r) => r.pos).join('-');
  const zone = defSeq[defSeq.length - 1]?.pos ?? null;
  const hitReady =
    pendingResult &&
    NEEDS_HIT.has(pendingResult) &&
    zone !== null &&
    selDirRow !== null &&
    selDirCol !== null &&
    selBall !== null;

  if (!open) return null;

  return (
    <div
      className="ov open"
      id="ov-bat-adv"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        style={{
          width: '95vw',
          maxWidth: 1200,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0,0,0,.25)',
          display: 'grid',
          gridTemplateColumns: '520px 1fr',
          maxHeight: '92vh',
          overflow: 'hidden',
        }}
      >
        {/* ── 좌측: 필드 + 수비 테이블 ── */}
        <section
          style={{
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              background: 'var(--panel2)',
              borderBottom: '1px solid var(--border)',
              padding: '8px 10px',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            수비 + 타구 정보
          </div>

          {/* 필드 + 방향 그리드 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 130px',
              gap: 14,
              alignItems: 'start',
              padding: 10,
              borderBottom: '1px solid var(--border2)',
            }}
          >
            <div>
              <div
                style={{ fontSize: 11, color: '#5b6777', marginBottom: 6, fontWeight: 600 }}
              ></div>
              <div style={{ background: '#f3f5f7', display: 'flex', justifyContent: 'center' }}>
                <svg viewBox="0 0 260 210" style={{ width: '100%', maxWidth: 400, height: 'auto' }}>
                  <path d="M130 200 L22 65 Q120 -38 240 65 Z" fill="#3f7a3d" />
                  <circle cx="130" cy="144" r="58" fill="#b79a77" opacity="0.45" />
                  <polygon points="130,92 172,132 130,172 88,132" fill="#52884d" />
                  {FPOS.map(({ key, x, y }) => {
                    const inSeq = defSeq.some((d) => d.pos === key);
                    const isZone = zone === key;
                    return (
                      <g
                        key={key}
                        style={{ cursor: pendingResult ? 'pointer' : 'default' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePosClick(key);
                        }}
                      >
                        <circle
                          cx={x}
                          cy={y}
                          r={17}
                          fill={isZone ? '#1d4ed8' : inSeq ? '#3b82f6' : 'rgba(255,255,255,0.2)'}
                          stroke={inSeq ? '#60a5fa' : 'rgba(255,255,255,0.55)'}
                          strokeWidth={inSeq ? 2 : 1}
                        />
                        <text
                          x={x}
                          y={y + 6}
                          textAnchor="middle"
                          fontSize={key > 9 ? '10' : '16'}
                          fontWeight="700"
                          fill="#fff"
                          pointerEvents="none"
                        >
                          {POS_NAME[key] ?? key}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* 방향 그리드 + 구질 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 22 }}>
              <div>
                <div style={{ fontSize: 11, color: '#5b6777', marginBottom: 5, fontWeight: 600 }}>
                  타구 방향
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 36px)',
                    gridTemplateRows: 'repeat(3, 36px)',
                    gap: 3,
                  }}
                >
                  {[0, 1, 2].flatMap((row) =>
                    [0, 1, 2].map((col) => {
                      const isCenter = row === 1 && col === 1;
                      const key = `${row}-${col}`;
                      const isSel = selDirRow === row && selDirCol === col;
                      if (isCenter)
                        return (
                          <div
                            key={key}
                            style={{
                              width: 36,
                              height: 36,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'var(--panel2)',
                              border: '1px solid var(--border2)',
                              fontSize: 12,
                              fontWeight: 900,
                              color: zone ? 'var(--blue)' : 'var(--text3)',
                              fontFamily: 'monospace',
                            }}
                          >
                            {zone ? (POS_NAME[zone] ?? zone) : '—'}
                          </div>
                        );
                      return (
                        <button
                          key={key}
                          onClick={() => handleDir(row, col)}
                          disabled={!pendingResult || !NEEDS_HIT.has(pendingResult)}
                          style={{
                            width: 36,
                            height: 36,
                            padding: 0,
                            border: `1px solid ${isSel ? '#2563eb' : 'var(--border)'}`,
                            background: isSel ? '#2563eb' : '#f7f9fb',
                            color: isSel ? '#fff' : '#444',
                            fontSize: 18,
                            cursor: 'pointer',
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: !pendingResult || !NEEDS_HIT.has(pendingResult) ? 0.3 : 1,
                          }}
                        >
                          {DIR_LABEL[key]}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(['땅볼', '뜬공', '라이너', '번트'] as BallType[]).map((b) => (
                  <label
                    key={b}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      fontSize: 12,
                      opacity: !pendingResult || !NEEDS_HIT.has(pendingResult) ? 0.3 : 1,
                    }}
                  >
                    <input
                      type="radio"
                      name="batadv_ball"
                      checked={selBall === b}
                      disabled={!pendingResult || !NEEDS_HIT.has(pendingResult)}
                      onChange={() => handleBall(b)}
                      style={{ accentColor: 'var(--blue)' }}
                    />
                    {b}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 수비 리스트 테이블 — 루타/홈런일 때는 숨김 */}
          {(!pendingResult || !NEEDS_HIT.has(pendingResult)) && (
            <div style={{ padding: 10, flex: 1, overflow: 'auto' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                <span>
                  수비 리스트
                  {defSeqLabel ? (
                    <span style={{ color: 'var(--blue)', marginLeft: 6 }}>{defSeqLabel}</span>
                  ) : (
                    ''
                  )}
                </span>
                {defSeq.length > 0 && (
                  <button
                    onClick={() => setDefSeq([])}
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      border: '1px solid var(--border)',
                      background: '#fff',
                      cursor: 'pointer',
                      borderRadius: 2,
                    }}
                  >
                    초기화
                  </button>
                )}
              </div>
              {defSeq.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                  <thead>
                    <tr>
                      {['수비', '선수명', '보살', '자살', '실책', ''].map((h) => (
                        <th
                          key={h}
                          style={{
                            background: '#dce7f4',
                            border: '1px solid var(--border2)',
                            padding: '5px 4px',
                            fontWeight: 700,
                            fontSize: 11,
                            textAlign: 'center',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {defSeq.map((row, i) => {
                      const player = defLU.find((p) => p.pos === row.pos);
                      const toggle = (f: 'assist' | 'putout' | 'error') =>
                        setDefSeq((prev) =>
                          prev.map((r, j) => (j === i ? { ...r, [f]: !r[f] } : r))
                        );
                      return (
                        <tr key={i}>
                          <td
                            style={{
                              border: '1px solid var(--border2)',
                              padding: '5px 4px',
                              textAlign: 'center',
                              fontSize: 12,
                            }}
                          >
                            {POS_NAME[row.pos]}
                          </td>
                          <td
                            style={{
                              border: '1px solid var(--border2)',
                              padding: '5px 6px',
                              fontSize: 12,
                            }}
                          >
                            {player?.name || `#${row.pos}`}
                          </td>
                          <td
                            style={{
                              border: '1px solid var(--border2)',
                              padding: '5px 4px',
                              textAlign: 'center',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={row.assist}
                              onChange={() => toggle('assist')}
                            />
                          </td>
                          <td
                            style={{
                              border: '1px solid var(--border2)',
                              padding: '5px 4px',
                              textAlign: 'center',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={row.putout}
                              onChange={() => toggle('putout')}
                            />
                          </td>
                          <td
                            style={{
                              border: '1px solid var(--border2)',
                              padding: '5px 4px',
                              textAlign: 'center',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={row.error}
                              onChange={() => toggle('error')}
                            />
                          </td>
                          <td
                            style={{
                              border: '1px solid var(--border2)',
                              padding: '2px 4px',
                              textAlign: 'center',
                            }}
                          >
                            <button
                              onClick={() => setDefSeq((prev) => prev.filter((_, j) => j !== i))}
                              style={{
                                fontSize: 12,
                                lineHeight: 1,
                                padding: '1px 5px',
                                border: '1px solid #f87171',
                                background: '#fff',
                                color: '#ef4444',
                                cursor: 'pointer',
                                borderRadius: 2,
                              }}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: 'var(--text3)', fontSize: 11, padding: '8px 0' }}>
                  {pendingResult
                    ? NEEDS_FIELDER.has(pendingResult)
                      ? '실책 수비수를 클릭하면 바로 기록됩니다'
                      : '수비 번호를 클릭해 관련 수비수를 추가하세요'
                    : '결과를 먼저 선택하세요'}
                </div>
              )}
            </div>
          )}

          {/* 하단 확인/취소 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 14,
              padding: '12px 10px 14px',
              borderTop: '1px solid var(--border2)',
            }}
          >
            {pendingResult && !NEEDS_HIT.has(pendingResult) && (
              <button
                className="btn-ok"
                onClick={handleConfirm}
                disabled={NEEDS_FIELDER.has(pendingResult) && defSeq.length === 0}
                style={{
                  opacity: NEEDS_FIELDER.has(pendingResult) && defSeq.length === 0 ? 0.4 : 1,
                }}
              >
                확인
              </button>
            )}
            {pendingResult && NEEDS_HIT.has(pendingResult) && (
              <button
                className="btn-ok"
                onClick={() => {
                  if (!hitReady) return;
                  const hd: HitData = {
                    zone: zone!,
                    hitType: pendingResult,
                    dirRow: selDirRow!,
                    dirCol: selDirCol!,
                    ballType: toBallTypeShort(selBall!),
                    deflection,
                    bases: basesForType(pendingResult),
                    ...(pendingResult === 'HR' ? { dist: hrDist } : {}),
                    ...(pendingResult === 'GHR' ? { dist: ghrDist } : {}),
                  };
                  onAutoConfirm('HIT', undefined, hd, 연결동작);
                }}
                disabled={!hitReady}
                style={{ opacity: hitReady ? 1 : 0.4 }}
              >
                확인 ({HIT_LABEL[pendingResult]})
              </button>
            )}
            <button className="btn-cancel" onClick={handleClose}>
              취소
            </button>
          </div>
        </section>

        {/* ── 우측: 진루 결과 선택 ── */}
        <section style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            style={{
              background: 'var(--panel2)',
              borderBottom: '1px solid var(--border)',
              padding: '8px 10px',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            타자 진루
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '5px 10px',
              borderBottom: '1px solid var(--border2)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={연결동작}
                onChange={(e) => set연결동작(e.target.checked)}
                style={{ accentColor: 'var(--blue)' }}
              />
              연결동작
            </label>
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, overflow: 'auto' }}
          >
            {/* 왼쪽 열 */}
            <div style={{ borderRight: '1px solid var(--border2)' }}>
              <div style={{ padding: '10px', borderBottom: '1px solid var(--border2)' }}>
                <div className="rs-title">루타, 홈런</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Btn label="1루타" sel={s('1B')} onClick={() => pick('1B')} />
                  <Btn label="2루타" sel={s('2B')} onClick={() => pick('2B')} />
                  <Btn label="3루타" sel={s('3B')} onClick={() => pick('3B')} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    <Btn label="내야안타" sel={s('INT')} onClick={() => pick('INT')} />
                    <Btn label="내야번트" sel={s('BUNT')} onClick={() => pick('BUNT')} />
                    <Btn label="외야번트" sel={s('OBUNT')} onClick={() => pick('OBUNT')} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Btn
                      label="홈런"
                      sel={s('HR')}
                      onClick={() => pick('HR')}
                      style={{ flex: 1 }}
                    />
                    <select
                      value={hrDist}
                      onChange={(e) => setHrDist(Number(e.target.value))}
                      style={{
                        fontSize: 10,
                        border: '1px solid var(--border)',
                        borderRadius: 2,
                        padding: '2px 2px',
                      }}
                    >
                      {GHR_DISTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 10,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={장외홈런}
                        onChange={(e) => set장외홈런(e.target.checked)}
                        style={{ accentColor: 'var(--blue)' }}
                      />
                      장외홈런
                    </label>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Btn
                      label="그라운드 홈런"
                      sel={s('GHR')}
                      onClick={() => pick('GHR')}
                      style={{ flex: 1 }}
                    />
                  </div>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 4 }}
                  ></div>
                  <Btn label="캣워크 홈런" sel={s('GCW')} onClick={() => pick('GCW')} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--text3)',
                        whiteSpace: 'nowrap',
                        fontWeight: 'bold',
                      }}
                    >
                      홈런시각
                    </span>

                    {/* 시간 입력 (시) */}
                    <input
                      type="number"
                      value={ghrH}
                      min={0}
                      max={23}
                      onChange={(e) => setGhrH(Number(e.target.value))}
                      placeholder="00"
                      style={{
                        width: 32,
                        fontSize: 11,
                        border: '1px solid var(--border)',
                        borderRadius: 2,
                        padding: '2px 0',
                        textAlign: 'center',
                        backgroundColor: 'var(--bg-input)', // 배경색은 환경에 맞춰 조절하세요
                      }}
                    />

                    <span style={{ fontSize: 11, fontWeight: 'bold' }}>:</span>

                    {/* 시간 입력 (분) */}
                    <input
                      type="number"
                      value={ghrM}
                      min={0}
                      max={59}
                      onChange={(e) => setGhrM(Number(e.target.value))}
                      placeholder="00"
                      style={{
                        width: 32,
                        fontSize: 11,
                        border: '1px solid var(--border)',
                        borderRadius: 2,
                        padding: '2px 0',
                        textAlign: 'center',
                        backgroundColor: 'var(--bg-input)',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ padding: '10px' }}>
                <div className="rs-title">실책, 기타 진루</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <Btn label="E 실책" sel={s('E')} onClick={() => pick('E')} />
                  <Btn label="병살 실책" sel={s('DP_E')} onClick={() => pick('DP_E')} />
                  <Btn label="[E] 실책" sel={s('E기록')} onClick={() => pick('E기록')} />
                  <Btn label="삼중살 실책" sel={false} onClick={() => {}} disabled />
                  <Btn
                    label="□ 선행주자 아웃"
                    sel={s('선행주자아웃')}
                    onClick={() => pick('선행주자아웃')}
                  />
                  <Btn label="병살 아웃 수비" sel={false} onClick={() => {}} disabled />
                  <Btn label="FC 야수 선택" sel={s('FC')} onClick={() => pick('FC')} />
                  <Btn label="# 타격 방해" sel={s('#')} onClick={() => pick('#')} />
                  <Btn
                    label="→ 선행주자 아웃"
                    sel={s('→선행주자아웃')}
                    onClick={() => pick('→선행주자아웃')}
                  />
                  <Btn label="ob 주루 방해" sel={s('ob')} onClick={() => pick('ob')} />
                </div>
              </div>
            </div>

            {/* 오른쪽 열 */}
            <div>
              <div style={{ padding: '10px', borderBottom: '1px solid var(--border2)' }}>
                <div className="rs-title">4구, 사구 진루</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Btn label="B 4구" sel={s('B')} onClick={() => pick('B')} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    <Btn label="X 자동 고의4구" sel={s('IB2')} onClick={() => pick('IB2')} />
                    <Btn label="IB 고의 4구" sel={s('IB')} onClick={() => pick('IB')} />
                  </div>
                  <Btn label="HP 몸에 맞는 볼" sel={s('HP')} onClick={() => pick('HP')} />
                </div>
              </div>

              <div style={{ padding: '10px' }}>
                <div className="rs-title">희생번트 진루</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Btn label="FC 야수선택 번트" sel={s('FC번트')} onClick={() => pick('FC번트')} />
                  <Btn label="E 실책 번트" sel={s('E번트')} onClick={() => pick('E번트')} />
                  <Btn label="희생타 진루" sel={s('SH진루')} onClick={() => pick('SH진루')} />
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '12px 10px 14px',
              borderTop: '1px solid var(--border2)',
            }}
          >
            <button className="btn-cancel" onClick={handleClose}>
              취소
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
