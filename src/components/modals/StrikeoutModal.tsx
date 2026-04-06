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

type OutType = 'K' | 'KT' | 'KSG'; // 직접아웃 / 태그아웃 / 송구아웃

export default function StrikeoutModal({ open, pitchType, defLU, onConfirm, onClose }: Props) {
  const [outType, setOutType] = useState<OutType>('K');
  const [seq, setSeq] = useState<number[]>([]);

  const isSwing = pitchType === 'SW' || pitchType === 'BS';

  const reset = () => {
    setOutType('K');
    setSeq([]);
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const addPos = (pos: number) => {
    if (outType === 'KT' && seq.length >= 1) return; // 태그는 1명
    if (outType === 'KSG' && seq.length >= 3) return; // 송구는 최대 3명
    setSeq((prev) => (prev.includes(pos) ? prev : [...prev, pos]));
  };

  const buildResult = (): string | null => {
    if (outType === 'K') return 'K';
    if (outType === 'KT') return seq.length ? `KT${seq[0]}` : null;
    if (outType === 'KSG') return seq.length >= 1 ? `K${seq.join('-')}` : null;
    return null;
  };

  const handleConfirm = (code?: string) => {
    const result = code ?? buildResult();
    if (!result) return;
    reset();
    onConfirm(result);
  };

  const needsFielder = outType === 'KT' || outType === 'KSG';
  const result = buildResult();

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
      <div className="ov-card" style={{ minWidth: 320 }}>
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

          {/* 수비수 선택 (KT/K송구 시) */}
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
                  const inSeq = seq.includes(pos);
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
                      {pos}({p?.num ?? POS_NAME[pos]})
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
        <div style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}>
            낫아웃 진루
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { code: 'KW', label: 'KW  폭투 낫아웃', sub: '타자 1루 진루', color: 'var(--green)' },
              { code: 'KP', label: 'KP  포일 낫아웃', sub: '타자 1루 진루', color: 'var(--green)' },
              { code: 'KE', label: 'KE  실책 낫아웃', sub: '타자 1루 진루', color: 'var(--green)' },
            ].map(({ code, label, sub, color }) => (
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
                  border: `2px solid ${color}`,
                  background: '#fff',
                  color: 'var(--text)',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = color;
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
          </div>
        </div>

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
