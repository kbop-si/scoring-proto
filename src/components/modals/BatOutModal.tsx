import { useState } from 'react';
import type { Player } from '../../types';

interface Props {
  open: boolean;
  defLU: Player[];
  onResult: (result: string, dp?: boolean, tp?: boolean) => void;
  onClose: () => void;
}

// 수비 위치 SVG 좌표 (viewBox 0 0 200 210)
const FPOS: { pos: number; x: number; y: number }[] = [
  { pos: 8, x: 100, y: 22  },
  { pos: 7, x: 25,  y: 52  },
  { pos: 9, x: 175, y: 52  },
  { pos: 6, x: 72,  y: 105 },
  { pos: 4, x: 128, y: 105 },
  { pos: 5, x: 36,  y: 125 },
  { pos: 3, x: 164, y: 125 },
  { pos: 1, x: 100, y: 128 },
  { pos: 2, x: 100, y: 193 },
];

const POS_NAME: Record<number, string> = {
  1: '투', 2: '포', 3: '1루', 4: '2루', 5: '3루', 6: '유', 7: '좌', 8: '중', 9: '우',
};

const SEQ_LABEL = ['①', '②', '③', '④', '⑤'];

type HitType = '땅' | 'BU' | 'SH' | 'F' | 'f' | 'L';
type GMode   = '송구' | '태그' | '루터치';
type DpMode  = '송구' | '태그' | '리버스';

function buildResult(
  seq: number[], type: HitType,
  gMode: GMode, dp: boolean, tp: boolean,
  dpMode: DpMode, dpBunt: boolean, fSac: boolean,
): string | null {
  if (!seq.length) return null;
  const s = seq.join('-');
  if (type === 'F') return (fSac ? 'SF' : 'F') + s;
  if (type === 'f') return 'f' + s;
  if (type === 'L') return 'L' + s;
  // 땅볼 계열
  const prefix =
    type === 'BU' ? 'BU' :
    type === 'SH' ? 'SH' :
    dp ? (dpBunt ? 'BU' : '') :   // 병살: DP 접두사 제거 (수비 번호만 기록)
    tp ? '' : '';                  // 삼중살: TP 접두사 제거
  const suffix =
    (type === '땅' && !dp && !tp)
      ? (gMode === '태그' ? 'T' : gMode === '루터치' ? 'U' : '')
      : (dp || tp) ? (dpMode === '리버스' ? 'R' : '') : '';
  return prefix + s + suffix;
}

// ── 다이아몬드 수비 위치 선택기 ──────────────────────────────────────────────
function FieldPicker({
  seq, maxSeq, defLU, onAdd,
}: {
  seq: number[]; maxSeq: number; defLU: Player[]; onAdd: (pos: number) => void;
}) {
  return (
    <svg viewBox="0 0 200 210" style={{ width: '100%', maxWidth: 200, display: 'block', margin: '0 auto' }}>
      {/* 외야 배경 */}
      <path d="M100,175 L5,60 Q100,0 195,60 Z" fill="#3a7a3a" />
      {/* 내야 흙 */}
      <circle cx="100" cy="140" r="55" fill="#7a5c38" opacity=".45" />
      {/* 파울 라인 */}
      <line x1="100" y1="175" x2="5"   y2="60" stroke="#fff" strokeWidth=".7" strokeDasharray="4,3" opacity=".5" />
      <line x1="100" y1="175" x2="195" y2="60" stroke="#fff" strokeWidth=".7" strokeDasharray="4,3" opacity=".5" />
      {/* 베이스 다이아몬드 */}
      <polygon points="100,91 131,122 100,153 69,122" fill="#4a7a4a" stroke="#fff" strokeWidth=".8" opacity=".9" />
      {/* 홈플레이트 */}
      <polygon points="100,175 94,181 96,187 104,187 106,181" fill="#fff" opacity=".85" />

      {FPOS.map(({ pos, x, y }) => {
        const idx = seq.indexOf(pos);
        const inSeq = idx >= 0;
        const canAdd = seq.length < maxSeq && !inSeq;
        const p = defLU.find((pl) => pl.pos === pos);
        const numLabel = p ? p.num : POS_NAME[pos];

        return (
          <g key={pos} style={{ cursor: canAdd ? 'pointer' : inSeq ? 'default' : 'not-allowed' }}
            onClick={() => canAdd && onAdd(pos)}>
            <circle cx={x} cy={y} r={12}
              fill={inSeq ? '#1d4ed8' : canAdd ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'}
              stroke={inSeq ? '#60a5fa' : canAdd ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'}
              strokeWidth={inSeq ? 2 : 1}
            />
            {/* 수비 순서 번호 (선택됐을 때) */}
            {inSeq && (
              <text x={x} y={y - 1} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff"
                style={{ pointerEvents: 'none' }}>
                {SEQ_LABEL[idx]}
              </text>
            )}
            {/* 포지션 번호 */}
            <text x={x} y={y + (inSeq ? 8 : 4)} textAnchor="middle" fontSize={inSeq ? '7' : '10'}
              fontWeight="700" fill={inSeq ? '#bfdbfe' : canAdd ? '#fff' : 'rgba(255,255,255,0.3)'}
              style={{ pointerEvents: 'none' }}>
              {pos}
            </text>
            {/* 선수 번호 (선택 안됐을 때 작게) */}
            {!inSeq && p && (
              <text x={x} y={y + 13} textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.55)"
                style={{ pointerEvents: 'none' }}>
                {numLabel}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function BatOutModal({ open, defLU, onResult, onClose }: Props) {
  const [seq, setSeq]       = useState<number[]>([]);
  const [type, setType]     = useState<HitType>('땅');
  const [gMode, setGMode]   = useState<GMode>('송구');
  const [dp, setDp]         = useState(false);
  const [tp, setTp]         = useState(false);
  const [dpMode, setDpMode] = useState<DpMode>('송구');
  const [dpBunt, setDpBunt] = useState(false);
  const [fSac, setFSac]     = useState(false);
  const [fBunt, setFBunt]   = useState(false);

  const reset = () => {
    setSeq([]); setType('땅'); setGMode('송구');
    setDp(false); setTp(false); setDpMode('송구'); setDpBunt(false);
    setFSac(false); setFBunt(false);
  };
  const handleClose  = () => { reset(); onClose(); };
  const handleResult = (r: string, isDp: boolean, isTp: boolean) => { onResult(r, isDp, isTp); reset(); onClose(); };

  const isFlat = type === 'F' || type === 'f' || type === 'L';
  const maxSeq = isFlat ? 1 : 5;

  const selectType = (t: HitType) => {
    setType(t);
    if (t === 'F' || t === 'f' || t === 'L') setSeq((s) => s.slice(0, 1));
    if (t !== '땅') { setDp(false); setTp(false); }
  };

  const addPos = (pos: number) => setSeq((prev) => prev.length < maxSeq ? [...prev, pos] : prev);

  const code = buildResult(seq, type, gMode, dp, tp, dpMode, dpBunt, fSac);
  const isGround = type === '땅' || type === 'BU' || type === 'SH';

  return (
    <div className={`ov${open ? ' open' : ''}`} id="ov-bat-out">
      <div className="ov-card" style={{ minWidth: 480 }}>
        <div className="modal-title">타자 아웃</div>

        <div style={{ display: 'flex', gap: 0 }}>

          {/* 좌측: 다이아몬드 + 순서 표시 */}
          <div style={{ width: 220, borderRight: '1px solid var(--border2)', padding: '10px 8px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', marginBottom: 4, textAlign: 'center' }}>
              수비 위치 클릭 (최대 {maxSeq}명)
            </div>
            <FieldPicker seq={seq} maxSeq={maxSeq} defLU={defLU} onAdd={addPos} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <span style={{
                flex: 1, fontSize: 15, fontWeight: 700, color: seq.length ? 'var(--blue)' : 'var(--text3)',
                fontFamily: 'monospace', textAlign: 'center',
              }}>
                {seq.length ? seq.join(' → ') : '—'}
              </span>
              <button onClick={() => setSeq((s) => s.slice(0, -1))}
                style={{ padding: '2px 7px', fontSize: 10, border: '1px solid var(--border)', background: '#fff', borderRadius: 2 }}>
                ← 취소
              </button>
              <button onClick={() => setSeq([])}
                style={{ padding: '2px 7px', fontSize: 10, border: '1px solid var(--border)', background: '#fff', borderRadius: 2 }}>
                초기화
              </button>
            </div>
          </div>

          {/* 우측: 타구 유형 + 옵션 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

            {/* 우측: 두 열 (타구유형 | 옵션) */}
            <div style={{ flex: 1, display: 'flex' }}>

              {/* 타구 유형 열 */}
              <div style={{ flex: 1, borderRight: '1px solid var(--border2)' }}>
                <div className="rg" style={{ paddingBottom: 4 }}>
                  <div className="rs-title">일반 아웃</div>
                  {(['땅', 'BU', 'SH'] as HitType[]).map((t) => {
                    const lbl = t === '땅' ? '땅볼 아웃' : t === 'BU' ? '번트아웃' : '희생번트 아웃';
                    return <button key={t} className={`r-btn${type === t && !dp && !tp ? ' sel' : ''}`} onClick={() => selectType(t)}>{lbl}</button>;
                  })}

                  <div className="rs-title">플라이 아웃</div>
                  {(['F', 'f', 'L'] as HitType[]).map((t) => {
                    const lbl = t === 'F' ? 'F 플라이' : t === 'f' ? 'f 파울 플라이' : 'L 라인 드라이브';
                    return <button key={t} className={`r-btn${type === t ? ' sel' : ''}`} onClick={() => selectType(t)}>{lbl}</button>;
                  })}
                  <button className="r-btn" style={{ gridColumn: '1 / -1' }} onClick={() => handleResult('IF', false, false)}>
                    IF 인필드 플라이
                  </button>

                  <div className="rs-title">병살, 삼중살</div>
                  <button className={`r-btn${type === '땅' && dp ? ' sel' : ''}`}
                    onClick={() => { selectType('땅'); setDp((v) => !v); setTp(false); }}>
                    병살타
                  </button>
                  <button className={`r-btn${type === '땅' && tp ? ' sel' : ''}`}
                    onClick={() => { selectType('땅'); setTp((v) => !v); setDp(false); }}>
                    삼중살
                  </button>
                  <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer', paddingLeft: 2 }}>
                    <input type="checkbox" checked={dpBunt} onChange={() => setDpBunt((v) => !v)}
                      style={{ accentColor: 'var(--blue)' }} />
                    번트타구
                  </label>
                </div>

                {/* 기타 아웃 */}
                <div style={{ borderTop: '1px solid var(--border2)', padding: '4px 10px 6px' }}>
                  <div className="rs-title" style={{ marginBottom: 4 }}>기타 아웃</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    <button className="r-btn" onClick={() => handleResult('x2', false, false)}>× 타구 맞음</button>
                    <button className="r-btn" onClick={() => handleResult('xBU', false, false)}>×∿ 번트타구맞음</button>
                    <button className="r-btn" onClick={() => handleResult('IP', false, false)}>IP 부정 타격</button>
                    <button className="r-btn" onClick={() => handleResult('IP0', false, false)}>IP 부정타격(투구없음)</button>
                    <button className="r-btn" onClick={() => handleResult('K3B', false, false)} style={{ opacity: 0.5 }}>K 쓰리번트</button>
                    <button className="r-btn" onClick={() => handleResult('A', false, false)}>A 1루 공과</button>
                  </div>
                </div>
              </div>

              {/* 옵션 열 (우측) */}
              <div style={{ width: 90, padding: '10px 8px' }}>
                {isGround && !dp && !tp && type === '땅' && (
                  <>
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4, fontWeight: 700 }}>아웃 방식</div>
                    {(['송구', '태그', '루터치'] as GMode[]).map((m) => (
                      <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer', marginBottom: 4 }}>
                        <input type="radio" name="gmode" checked={gMode === m} onChange={() => setGMode(m)}
                          style={{ accentColor: 'var(--blue)' }} />
                        {m}
                      </label>
                    ))}
                  </>
                )}
                {type === '땅' && (dp || tp) && (
                  <>
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4, fontWeight: 700 }}>아웃 방식</div>
                    {(['송구', '태그', '리버스'] as DpMode[]).map((m) => (
                      <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer', marginBottom: 4 }}>
                        <input type="radio" name="dpmode" checked={dpMode === m} onChange={() => setDpMode(m)}
                          style={{ accentColor: 'var(--blue)' }} />
                        {m}
                      </label>
                    ))}
                  </>
                )}
                {isFlat && (
                  <>
                    <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4, fontWeight: 700 }}>옵션</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer', marginBottom: 4 }}>
                      <input type="checkbox" checked={fSac} onChange={() => setFSac((v) => !v)}
                        style={{ accentColor: 'var(--blue)' }} />
                      희생타기록
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                      <input type="checkbox" checked={fBunt} onChange={() => setFBunt((v) => !v)}
                        style={{ accentColor: 'var(--blue)' }} />
                      번트타구
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: code ? 'var(--blue)' : 'var(--text3)' }}>
            {code ?? '—'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ok" disabled={!code} style={{ opacity: code ? 1 : 0.4 }}
              onClick={() => { if (code) handleResult(code, dp, tp); }}>
              확인
            </button>
            <button className="btn-cancel" onClick={handleClose}>취소</button>
          </div>
        </div>
      </div>
    </div>
  );
}
