import { useState } from 'react';
import type { Base, Player } from '../../types';

interface Props {
  open: boolean;
  runnerBase: Base | null;
  runnerName: string;
  selectedReason: string | null;
  selectedDest: Base | 'HOME' | null;
  earned: boolean | 'half';
  rbi: boolean;
  pitcher: string;
  pitcherList: Player[];
  fielder: number | null;
  defLU: Player[];
  onSelectReason: (v: string) => void;
  onSelectDest: (d: Base | 'HOME') => void;
  onSetEarned: (v: boolean | 'half') => void;
  onSetRbi: (v: boolean) => void;
  onSetPitcher: (v: string) => void;
  onSelectFielder: (f: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}

function getValidDests(from: Base | null): (Base | 'HOME')[] {
  if (from === '1B') return ['2B', '3B', 'HOME'];
  if (from === '2B') return ['3B', 'HOME'];
  if (from === '3B') return ['HOME'];
  return ['2B', '3B', 'HOME'];
}

const DEST_LABEL: Record<string, string> = { '2B': '2루', '3B': '3루', HOME: '홈(득점)' };

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
      style={{ textAlign: 'left', fontSize: 11, opacity: disabled ? 0.4 : 1, ...style }}
    >
      {label}
    </button>
  );
}

export default function RunAdvModal({
  open,
  runnerBase,
  runnerName,
  selectedReason,
  selectedDest,
  earned,
  rbi,
  pitcher,
  pitcherList,
  onSelectReason,
  onSelectDest,
  onSetEarned,
  onSetRbi,
  onSetPitcher,
  onConfirm,
  onClose,
}: Props) {
  const validDests = getValidDests(runnerBase);
  const canConfirm = !!selectedReason && !!selectedDest && (selectedDest !== 'HOME' || !!pitcher);

  // 오른쪽 패널 로컬 상태
  const [연결동작, set연결동작] = useState(false);
  const [견제삽입, set견제삽입] = useState(false);
  const [견제루, set견제루] = useState<1 | 2 | 3>(1);
  const [도루자기록, set도루자기록] = useState(false);
  const [단독홈도루, set단독홈도루] = useState(false);

  return (
    <div className={`ov${open ? ' open' : ''}`} id="ov-run-adv">
      <div className="ov-card" style={{ minWidth: 560 }}>
        <div className="modal-title">
          주자 진루 —{' '}
          <span style={{ color: 'var(--blue)' }}>
            {runnerBase}: {runnerName}
          </span>
        </div>

        <div style={{ display: 'flex' }}>
          {/* ── 메인 영역 ── */}
          <div style={{ flex: 1 }}>
            {/* STEP 1: 진루 사유 */}
            <div
              style={{
                padding: '6px 12px 2px',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text3)',
                borderBottom: '1px solid var(--border2)',
              }}
            >
              ① 진루 사유
            </div>

            {/* 일반 진루 */}
            <div style={{ padding: '4px 10px 4px', borderBottom: '1px solid var(--border2)' }}>
              <div className="rs-title" style={{ marginBottom: 4 }}>
                일반 진루
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <Btn
                  label="타자의 도움"
                  sel={selectedReason === '타자의 도움'}
                  onClick={() => onSelectReason('타자의 도움')}
                />
                <Btn
                  label="ob 주루 방해"
                  sel={selectedReason === 'ob 주루방해'}
                  onClick={() => onSelectReason('ob 주루방해')}
                />
                <Btn
                  label="E 실책"
                  sel={selectedReason === 'E 실책'}
                  onClick={() => onSelectReason('E 실책')}
                />
                <Btn
                  label="(E) 기록된 실책"
                  sel={selectedReason === '(E) 기록실책'}
                  onClick={() => onSelectReason('(E) 기록실책')}
                />
                <Btn
                  label="→ 다른 주자 수비"
                  sel={selectedReason === '다른주자수비'}
                  onClick={() => onSelectReason('다른주자수비')}
                />
                <Btn
                  label="← 기타"
                  sel={selectedReason === '기타'}
                  onClick={() => onSelectReason('기타')}
                />
              </div>
            </div>

            {/* 도루 진루 */}
            <div style={{ padding: '4px 10px 4px', borderBottom: '1px solid var(--border2)' }}>
              <div className="rs-title" style={{ marginBottom: 4 }}>
                도루 진루
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <Btn
                  label="S 도루"
                  sel={selectedReason === 'S 도루'}
                  onClick={() => onSelectReason('S 도루')}
                />
                <Btn
                  label="(S) 무관심 도루"
                  sel={selectedReason === '(S) 무관심도루'}
                  onClick={() => onSelectReason('(S) 무관심도루')}
                />
                <Btn
                  label="S 이중도루"
                  sel={selectedReason === '이중도루'}
                  onClick={() => onSelectReason('이중도루')}
                />
                <Btn
                  label="(S) 무관심 이중 도루"
                  sel={selectedReason === '(S) 무관심이중도루'}
                  onClick={() => onSelectReason('(S) 무관심이중도루')}
                />
                <Btn
                  label="삼중도루"
                  sel={selectedReason === '삼중도루'}
                  onClick={() => onSelectReason('삼중도루')}
                />
                <Btn
                  label="(S) 이중실패"
                  sel={selectedReason === '(S) 이중실패'}
                  onClick={() => onSelectReason('(S) 이중실패')}
                />
                <div />
                <Btn
                  label="(S) 삼중실패"
                  sel={selectedReason === '(S) 삼중실패'}
                  onClick={() => onSelectReason('(S) 삼중실패')}
                />
              </div>
            </div>

            {/* 폭투, 포일, 보크 */}
            <div style={{ padding: '4px 10px 6px' }}>
              <div className="rs-title" style={{ marginBottom: 4 }}>
                폭투, 포일, 보크
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <Btn
                  label="W 폭투"
                  sel={selectedReason === 'W 폭투'}
                  onClick={() => onSelectReason('W 폭투')}
                />
                <Btn
                  label="(W) 기록된 폭투"
                  sel={selectedReason === '(W) 기록된폭투'}
                  onClick={() => onSelectReason('(W) 기록된폭투')}
                />
                <Btn
                  label="P 포일"
                  sel={selectedReason === 'P 포일'}
                  onClick={() => onSelectReason('P 포일')}
                />
                <Btn
                  label="(P) 기록된 포일"
                  sel={selectedReason === '(P) 기록된포일'}
                  onClick={() => onSelectReason('(P) 기록된포일')}
                />
                <Btn
                  label="BK 보크"
                  sel={selectedReason === 'BK 보크'}
                  onClick={() => onSelectReason('BK 보크')}
                />
                <Btn
                  label="(BK) 기록된 보크"
                  sel={selectedReason === '(BK) 기록된보크'}
                  onClick={() => onSelectReason('(BK) 기록된보크')}
                />
                <Btn
                  label="✓BK 피치클락 보크"
                  sel={selectedReason === '✓BK 피치클락보크'}
                  onClick={() => onSelectReason('✓BK 피치클락보크')}
                />
                <Btn
                  label="✓(BK) 기록된 피치클락 보크"
                  sel={selectedReason === '✓(BK) 기록된피치클락보크'}
                  onClick={() => onSelectReason('✓(BK) 기록된피치클락보크')}
                  style={{ fontSize: 10 }}
                />
              </div>
            </div>

            {/* STEP 2: 목적 베이스 */}
            <div
              style={{
                padding: '6px 12px 4px',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text3)',
                borderTop: '1px solid var(--border2)',
                borderBottom: '1px solid var(--border2)',
              }}
            >
              ② 목적 베이스
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '8px 12px' }}>
              {validDests.map((d) => (
                <button
                  key={d}
                  onClick={() => onSelectDest(d)}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    fontWeight: 700,
                    fontSize: 13,
                    border: `2px solid ${selectedDest === d ? (d === 'HOME' ? 'var(--red)' : 'var(--blue)') : 'var(--border)'}`,
                    background:
                      selectedDest === d ? (d === 'HOME' ? 'var(--red)' : 'var(--blue)') : '#fff',
                    color: selectedDest === d ? '#fff' : 'var(--text)',
                    borderRadius: 3,
                    cursor: 'pointer',
                  }}
                >
                  {DEST_LABEL[d]}
                </button>
              ))}
            </div>

            {/* STEP 4: 득점 처리 (HOME 선택 시) */}
            {selectedDest === 'HOME' && (
              <>
                <div
                  style={{
                    padding: '6px 12px 4px',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--text3)',
                    borderTop: '1px solid var(--border2)',
                    borderBottom: '1px solid var(--border2)',
                  }}
                >
                  ④ 자책/비자책 선택
                </div>
                <div
                  style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', minWidth: 60 }}
                    >
                      타점인정
                    </span>
                    <button
                      onClick={() => onSetRbi(!rbi)}
                      style={{
                        padding: '4px 16px',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 3,
                        cursor: 'pointer',
                        border: `2px solid ${rbi ? 'var(--blue)' : 'var(--border)'}`,
                        background: rbi ? 'var(--blue)' : '#fff',
                        color: rbi ? '#fff' : 'var(--text)',
                      }}
                    >
                      {rbi ? '✓ 타점인정' : '타점 없음'}
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['비자책', '자책인정', '반자책'] as const).map((lbl, i) => {
                      const val = i === 0 ? false : i === 1 ? true : ('half' as const);
                      const isSelected = earned === val;
                      const colors = ['var(--blue)', 'var(--red)', '#d97706'];
                      return (
                        <button
                          key={lbl}
                          onClick={() => onSetEarned(val)}
                          style={{
                            flex: 1,
                            padding: '7px 4px',
                            fontWeight: 700,
                            fontSize: 11,
                            borderRadius: 3,
                            cursor: 'pointer',
                            border: `2px solid ${isSelected ? colors[i] : 'var(--border)'}`,
                            background: isSelected ? colors[i] : '#fff',
                            color: isSelected ? '#fff' : 'var(--text)',
                          }}
                        >
                          {lbl}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', minWidth: 70 }}
                    >
                      실점투수 선택 →
                    </span>
                    <select
                      value={pitcher}
                      onChange={(e) => onSetPitcher(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '5px 8px',
                        fontSize: 11,
                        border: `2px solid ${pitcher ? 'var(--blue)' : 'var(--border)'}`,
                        borderRadius: 3,
                        background: '#fff',
                        color: 'var(--text)',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">투수 선택...</option>
                      {pitcherList.map((p, i) => (
                        <option key={i} value={`${p.name}(${p.num})`}>
                          {p.name}({p.num})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── 오른쪽 패널 ── */}
          <div
            style={{
              width: 110,
              borderLeft: '1px solid var(--border2)',
              padding: '12px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
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

            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  cursor: 'pointer',
                  marginBottom: 4,
                }}
              >
                <input
                  type="checkbox"
                  checked={견제삽입}
                  onChange={(e) => set견제삽입(e.target.checked)}
                  style={{ accentColor: 'var(--blue)' }}
                />
                견제삽입
              </label>
              {견제삽입 && (
                <div style={{ paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {([1, 2, 3] as const).map((n) => (
                    <label
                      key={n}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="견제루"
                        checked={견제루 === n}
                        onChange={() => set견제루(n)}
                        style={{ accentColor: 'var(--blue)' }}
                      />
                      {n}루견제
                    </label>
                  ))}
                </div>
              )}
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={도루자기록}
                onChange={(e) => set도루자기록(e.target.checked)}
                style={{ accentColor: 'var(--blue)' }}
              />
              도루자기록
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={단독홈도루}
                onChange={(e) => set단독홈도루(e.target.checked)}
                style={{ accentColor: 'var(--blue)' }}
              />
              단독홈도루
            </label>

            <div style={{ flex: 1 }} />

            <button
              className="btn-ok"
              onClick={onConfirm}
              disabled={!canConfirm}
              style={{ opacity: canConfirm ? 1 : 0.4 }}
            >
              확인
            </button>
            <button className="btn-cancel" onClick={onClose}>
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
