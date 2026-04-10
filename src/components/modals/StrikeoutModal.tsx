import { useState } from 'react';
import type { Player, PitchType } from '../../types';

interface Props {
  open: boolean;
  pitchType: PitchType | null;
  defLU: Player[];
  onConfirm: (result: string) => void;
  onClose: () => void;
}

const POS_NAME: Record<number, string> = {
  1: '투',
  2: '포',
  3: '1루',
  4: '2루',
  5: '3루',
  6: '유',
  7: '좌',
  8: '중',
  9: '우',
};

const FPOS: { pos: number; x: number; y: number }[] = [
  { pos: 8, x: 100, y: 32 },
  { pos: 7, x: 30, y: 45 },
  { pos: 9, x: 170, y: 45 },
  { pos: 6, x: 68, y: 100 },
  { pos: 4, x: 132, y: 100 },
  { pos: 5, x: 46, y: 126 },
  { pos: 3, x: 154, y: 126 },
  { pos: 1, x: 100, y: 122 },
  { pos: 2, x: 100, y: 190 },
];

interface DefRow {
  pos: number;
  assist: boolean;
  putout: boolean;
  error: boolean;
  deflection: boolean;
  shift: boolean;
}

type OutType = 'K' | 'KT' | 'KSG';

export default function StrikeoutModal({ open, pitchType, defLU, onConfirm, onClose }: Props) {
  const [outType, setOutType] = useState<OutType>('K');
  const [seq, setSeq] = useState<number[]>([]);
  const [showDefPanel, setShowDefPanel] = useState(false);
  const [defSeq, setDefSeq] = useState<DefRow[]>([]);

  const isSwing = pitchType === 'SW' || pitchType === 'BS';

  const reset = () => {
    setOutType('K');
    setSeq([]);
    setShowDefPanel(false);
    setDefSeq([]);
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const addPos = (pos: number) => {
    setSeq((prev) => [...prev, pos]);
  };

  const toggleDefPos = (pos: number) => {
    setDefSeq((prev) => {
      const exists = prev.find((r) => r.pos === pos);
      if (exists) return prev.filter((r) => r.pos !== pos);
      return [
        ...prev,
        { pos, assist: false, putout: false, error: false, deflection: false, shift: false },
      ];
    });
  };

  const toggleField = (
    pos: number,
    field: 'assist' | 'putout' | 'error' | 'deflection' | 'shift'
  ) => {
    setDefSeq((prev) => prev.map((r) => (r.pos === pos ? { ...r, [field]: !r[field] } : r)));
  };

  const buildResult = (): string | null => {
    if (outType === 'K') return 'K';
    if (outType === 'KT') return seq.length ? `KT${seq[0]}` : null;
    if (outType === 'KSG') return seq.length >= 1 ? `K${seq.join('-')}` : null;
    return null;
  };

  const buildKDef = (): string | null => {
    if (defSeq.length === 0) return null;
    return `ꓘ${defSeq.map((r) => (r.error ? 'E' : '') + r.pos + (r.assist ? '보' : '') + (r.putout ? '자' : '')).join('-')}`;
  };

  const handleConfirm = (code?: string) => {
    const result = code ?? buildResult();
    if (!result) return;
    reset();
    onConfirm(result);
  };

  const needsFielder = outType === 'KT' || outType === 'KSG';
  const result = buildResult();
  const kdefResult = buildKDef();

  const btnSel = (active: boolean, color = 'var(--red)'): React.CSSProperties => ({
    flex: 1,
    padding: '9px 4px',
    fontWeight: 700,
    fontSize: 12,
    borderRadius: 3,
    cursor: 'pointer',
    border: `2px solid ${active ? color : 'var(--border)'}`,
    background: active ? color : '#fff',
    color: active ? '#fff' : 'var(--text)',
  });

  return (
    <div className={`ov${open ? ' open' : ''}`} id="ov-strikeout">
      <div className="ov-card" style={{ minWidth: showDefPanel ? 620 : 320 }}>
        <div className="modal-title">
          삼진 결과 —{' '}
          <span style={{ color: 'var(--text3)', fontSize: 11 }}>
            {isSwing ? '스윙 삼진' : '낫아웃(루킹)'}
          </span>
        </div>

        {/* ── 아웃 방식 ── */}
        <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}>
            스트라이크 아웃상세
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: needsFielder ? 10 : 0 }}>
            <button
              style={btnSel(outType === 'K')}
              onClick={() => {
                setOutType('K');
                setSeq([]);
              }}
            >
              K 스트라이크 아웃
            </button>
            <button
              style={btnSel(outType === 'KT')}
              onClick={() => {
                setOutType('KT');
                setSeq([]);
              }}
            >
              KT 태그 아웃
            </button>
            <button
              style={btnSel(outType === 'KSG')}
              onClick={() => {
                setOutType('KSG');
                setSeq([]);
              }}
            >
              K송구 아웃
            </button>
          </div>

          {needsFielder && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 5 }}>
                수비수 선택 {outType === 'KT' ? '(태그한 수비수)' : '(송구 순서)'}
                {seq.length > 0 && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontFamily: 'monospace',
                      color: 'var(--blue)',
                      fontWeight: 700,
                    }}
                  >
                    {outType === 'KT' ? seq[0] : seq.join(' → ')}
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((pos) => {
                  const p = defLU.find((x) => x.pos === pos);
                  const count = seq.filter((n) => n === pos).length;
                  const inSeq = count > 0;
                  return (
                    <button
                      key={pos}
                      onClick={() => addPos(pos)}
                      style={{
                        padding: '5px 2px',
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 3,
                        cursor: 'pointer',
                        border: `2px solid ${inSeq ? 'var(--blue)' : 'var(--border)'}`,
                        background: inSeq ? 'var(--blue)' : '#fff',
                        color: inSeq ? '#fff' : 'var(--text)',
                      }}
                    >
                      {pos}({p?.num ?? POS_NAME[pos]}){count > 1 ? ` ×${count}` : ''}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                <button
                  onClick={() => setSeq((s) => s.slice(0, -1))}
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    border: '1px solid var(--border)',
                    background: '#fff',
                    borderRadius: 2,
                    cursor: 'pointer',
                  }}
                >
                  ← 취소
                </button>
                <button
                  onClick={() => setSeq([])}
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    border: '1px solid var(--border)',
                    background: '#fff',
                    borderRadius: 2,
                    cursor: 'pointer',
                  }}
                >
                  초기화
                </button>
                {result && (
                  <span
                    style={{
                      marginLeft: 4,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: 'var(--red)',
                      fontSize: 13,
                      alignSelf: 'center',
                    }}
                  >
                    {result}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── 낫아웃 진루 ── */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}>
            낫아웃 진루
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { code: 'KW', label: 'KW  폭투 낫아웃', sub: '타자 1루 진루' },
              { code: 'KP', label: 'KP  포일 낫아웃', sub: '타자 1루 진루' },
              { code: 'KE', label: 'KE  실책 낫아웃', sub: '타자 1루 진루' },
            ].map(({ code, label, sub }) => (
              <button
                key={code}
                onClick={() => handleConfirm(code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 14px',
                  fontWeight: 700,
                  fontSize: 12,
                  borderRadius: 3,
                  cursor: 'pointer',
                  border: '2px solid #111',
                  background: '#fff',
                  color: 'var(--text)',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#111';
                  (e.currentTarget as HTMLButtonElement).style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#fff';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
                }}
              >
                <span style={{ fontFamily: 'monospace' }}>{label}</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{sub}</span>
              </button>
            ))}

            {/* 다른주자수비 출루 */}
            <button
              onClick={() => setShowDefPanel((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 14px',
                fontWeight: 700,
                fontSize: 12,
                borderRadius: 3,
                cursor: 'pointer',
                border: `2px solid ${showDefPanel ? 'var(--blue)' : '#111'}`,
                background: showDefPanel ? 'var(--blue)' : '#fff',
                color: showDefPanel ? '#fff' : 'var(--text)',
              }}
            >
              <span style={{ fontFamily: 'monospace' }}>ꓘ수비수 다른주자수비 출루</span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>
                {showDefPanel ? '▲ 접기' : '▼ 수비정보'}
              </span>
            </button>
          </div>
        </div>

        {/* ── 수비정보 패널 ── */}
        {showDefPanel && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border2)' }}>
            {/* 다이아몬드 */}
            <div
              style={{
                width: 240,
                borderRight: '1px solid var(--border2)',
                padding: 10,
                flexShrink: 0,
              }}
            >
              <div
                style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}
              >
                수비 위치
                {defSeq.length > 0 && (
                  <span style={{ marginLeft: 8, color: 'var(--blue)', fontFamily: 'monospace' }}>
                    ꓘ{defSeq.map((r) => r.pos).join('-')}
                  </span>
                )}
              </div>
              <div style={{ background: '#1a4a2e', borderRadius: 4 }}>
                <svg viewBox="0 0 200 210" style={{ width: '100%', height: 'auto' }}>
                  <path d="M100 200 L10 60 Q95 -30 190 60 Z" fill="#2d6a4f" />
                  <circle cx="100" cy="140" r="45" fill="#8b6914" opacity="0.4" />
                  <polygon
                    points="100,91 131,122 100,153 69,122"
                    fill="#3d7a38"
                    stroke="#fff"
                    strokeWidth="0.8"
                    opacity="0.9"
                  />
                  <polygon
                    points="100,175 94,181 96,187 104,187 106,181"
                    fill="#fff"
                    opacity=".85"
                  />
                  {FPOS.map(({ pos, x, y }) => {
                    const inSeq = defSeq.some((r) => r.pos === pos);
                    const p = defLU.find((pl) => pl.pos === pos);
                    return (
                      <g key={pos} style={{ cursor: 'pointer' }} onClick={() => toggleDefPos(pos)}>
                        <circle
                          cx={x}
                          cy={y}
                          r={15}
                          fill={inSeq ? '#1d4ed8' : 'rgba(255,255,255,0.2)'}
                          stroke={inSeq ? '#60a5fa' : 'rgba(255,255,255,0.55)'}
                          strokeWidth={inSeq ? 2 : 1}
                        />
                        <text
                          x={x}
                          y={y + 5}
                          textAnchor="middle"
                          fontSize="13"
                          fontWeight="700"
                          fill="#fff"
                          pointerEvents="none"
                        >
                          {pos}
                        </text>
                        {p && (
                          <text
                            x={x}
                            y={y + 16}
                            textAnchor="middle"
                            fontSize="7"
                            fill="rgba(255,255,255,0.7)"
                            pointerEvents="none"
                          >
                            {p.num}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
              {defSeq.length > 0 && (
                <button
                  onClick={() => setDefSeq([])}
                  style={{
                    marginTop: 6,
                    fontSize: 10,
                    padding: '2px 8px',
                    border: '1px solid var(--border)',
                    background: '#fff',
                    borderRadius: 2,
                    cursor: 'pointer',
                  }}
                >
                  초기화
                </button>
              )}
            </div>

            {/* 수비 리스트 */}
            <div style={{ flex: 1, padding: 10, minWidth: 0 }}>
              <div
                style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}
              >
                수비 리스트
              </div>
              {defSeq.length > 0 ? (
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    background: '#fff',
                    fontSize: 11,
                  }}
                >
                  <thead>
                    <tr>
                      {['수비', '선수명', '보살', '자살', '실책', '디플', '시프트', ''].map((h) => (
                        <th
                          key={h}
                          style={{
                            background: '#dce7f4',
                            border: '1px solid var(--border2)',
                            padding: '4px 5px',
                            fontWeight: 700,
                            textAlign: 'center',
                            fontSize: 10,
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
                      return (
                        <tr key={i}>
                          <td
                            style={{
                              border: '1px solid var(--border2)',
                              padding: '4px 6px',
                              textAlign: 'center',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {POS_NAME[row.pos]}({row.pos})
                          </td>
                          <td style={{ border: '1px solid var(--border2)', padding: '4px 6px' }}>
                            {player?.name ?? '—'}
                          </td>
                          <td
                            style={{
                              border: '1px solid var(--border2)',
                              padding: '4px',
                              textAlign: 'center',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={row.assist}
                              onChange={() => toggleField(row.pos, 'assist')}
                            />
                          </td>
                          <td
                            style={{
                              border: '1px solid var(--border2)',
                              padding: '4px',
                              textAlign: 'center',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={row.putout}
                              onChange={() => toggleField(row.pos, 'putout')}
                            />
                          </td>
                          <td
                            style={{
                              border: '1px solid var(--border2)',
                              padding: '4px',
                              textAlign: 'center',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={row.error}
                              onChange={() => toggleField(row.pos, 'error')}
                            />
                          </td>
                          <td
                            style={{
                              border: '1px solid var(--border2)',
                              padding: '4px',
                              textAlign: 'center',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={row.deflection}
                              onChange={() => toggleField(row.pos, 'deflection')}
                            />
                          </td>
                          <td
                            style={{
                              border: '1px solid var(--border2)',
                              padding: '4px',
                              textAlign: 'center',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={row.shift}
                              onChange={() => toggleField(row.pos, 'shift')}
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
                                fontSize: 11,
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
                  수비 번호를 클릭해 추가하세요
                </div>
              )}

              <button
                className="btn-ok"
                disabled={!kdefResult}
                onClick={() => kdefResult && handleConfirm(kdefResult)}
                style={{ marginTop: 12, width: '100%', opacity: kdefResult ? 1 : 0.4 }}
              >
                확인 ({kdefResult ?? 'ꓘ수비수'})
              </button>
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button
            className="btn-ok"
            disabled={outType !== 'K' && !result}
            style={{ opacity: outType === 'K' || result ? 1 : 0.4 }}
            onClick={() => handleConfirm()}
          >
            확인
          </button>
          <button className="btn-cancel" onClick={handleClose}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
