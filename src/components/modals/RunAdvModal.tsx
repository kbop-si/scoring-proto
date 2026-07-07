import { useState, useEffect } from 'react';
import type { Base, DeflectionInfo, Player } from '../../types';
import DeflectionPicker from './DeflectionPicker';

// BatAdvModal과 동일한 FPOS (78·89 복합 포함)
const RFPOS: { key: number; x: number; y: number }[] = [
  { key: 8, x: 130, y: 32 },
  { key: 78, x: 80, y: 40 },
  { key: 89, x: 180, y: 40 },
  { key: 7, x: 44, y: 62 },
  { key: 9, x: 216, y: 62 },
  { key: 6, x: 104, y: 108 },
  { key: 4, x: 156, y: 108 },
  { key: 5, x: 78, y: 128 },
  { key: 3, x: 182, y: 128 },
  { key: 1, x: 130, y: 130 },
  { key: 2, x: 130, y: 182 },
];

const RPOS_NAME: Record<number, string> = {
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

// 수비수 선택이 필요한 사유 (타자의 도움 제외)
const 수비수필요사유 = new Set(['ob 주루방해', 'E 실책', '(E) 기록실책', '다른주자수비']);

export type FielderEntry = {
  pos: number;
  assist: boolean;
  putout: boolean;
  error: boolean;
  throwDir: '좌' | '중' | '우' | '';
  throwHeight: '저' | '중' | '고' | '';
  shift: boolean;
};

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
  defLU: Player[];
  inDpPlay?: boolean; // 직전 타자가 병살(또는 삼중살)을 친 상황 — RBI 자동 제외
  onSelectReason: (v: string) => void;
  onSelectDest: (d: Base | 'HOME') => void;
  onSetEarned: (v: boolean | 'half') => void;
  onSetRbi: (v: boolean) => void;
  onSetPitcher: (v: string) => void;
  onConfirm: (
    chain: boolean,
    fielderSeq: FielderEntry[],
    deflection?: DeflectionInfo,
    pickoff?: 1 | 2 | 3 // 견제삽입 — n루견제 시도 마크 (/-, /--, /---)
  ) => void;
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
  defLU,
  inDpPlay = false,
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

  // 수비수 시퀀스 로컬 상태 (한도 없음, 중복 허용)
  const [defSeq, setDefSeq] = useState<FielderEntry[]>([]);
  const fielderSeq = defSeq;

  // 사유 변경 시 수비수 초기화
  const handleSelectReason = (v: string) => {
    if (v !== selectedReason) setDefSeq([]);
    onSelectReason(v);
  };

  const addPos = (pos: number) =>
    setDefSeq((prev) => [
      ...prev,
      {
        pos,
        assist: false,
        putout: false,
        error: false,
        throwDir: '',
        throwHeight: '',
        shift: false,
      },
    ]);

  const toggleField = (idx: number, field: 'assist' | 'putout' | 'error' | 'shift') =>
    setDefSeq((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: !r[field] } : r)));

  const setSelectField = (idx: number, field: 'throwDir' | 'throwHeight', val: string) =>
    setDefSeq((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: r[field] === val ? '' : val } : r))
    );

  const removeEntry = (idx: number) => setDefSeq((prev) => prev.filter((_, i) => i !== idx));

  // 오른쪽 패널 로컬 상태
  const [연속플레이, set연속플레이] = useState(false);
  const [견제삽입, set견제삽입] = useState(false);
  const [견제루, set견제루] = useState<1 | 2 | 3>(1);
  const [도루자기록, set도루자기록] = useState(false);
  const [단독홈도루, set단독홈도루] = useState(false);
  const [deflection, setDeflection] = useState<DeflectionInfo | null>(null);

  // 모달이 열릴 때마다 로컬 상태 초기화 (이전 입력 잔재 방지)
  useEffect(() => {
    if (open) {
      setDefSeq([]);
      set연속플레이(false);
      set견제삽입(false);
      set견제루(1);
      set도루자기록(false);
      set단독홈도루(false);
      setDeflection(null);
    }
  }, [open]);

  // 디플렉션 적용 가능: '일반 진루'에서 '다른주자수비' 제외
  const DEFL_REASONS = new Set(['타자의 도움', 'ob 주루방해', 'E 실책', '(E) 기록실책']);
  const canDefl = !!selectedReason && DEFL_REASONS.has(selectedReason);

  // 타점에서 제외되는 진루 사유 — 도루/폭투/포일/보크/실책 (병살은 BAT_OUT 흐름에서 처리)
  const NO_RBI_REASONS = new Set([
    'S 도루',
    '(S) 무관심도루',
    '이중도루',
    '(S) 무관심이중도루',
    '삼중도루',
    '(S) 이중실패',
    '(S) 삼중실패',
    'W 폭투',
    '(W) 기록된폭투',
    'P 포일',
    '(P) 기록된포일',
    'BK 보크',
    '(BK) 기록된보크',
    '✓BK 피치클락보크',
    '✓(BK) 기록된피치클락보크',
    'E 실책',
    '(E) 기록실책',
  ]);
  const rbiBlocked = inDpPlay || (!!selectedReason && NO_RBI_REASONS.has(selectedReason));

  // 사유가 타점 제외에 해당하면 자동으로 rbi=false 강제
  useEffect(() => {
    if (rbiBlocked && rbi) onSetRbi(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rbiBlocked]);

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
                  onClick={() => handleSelectReason('타자의 도움')}
                />
                <Btn
                  label="ob 주루 방해"
                  sel={selectedReason === 'ob 주루방해'}
                  onClick={() => handleSelectReason('ob 주루방해')}
                />
                <Btn
                  label="E 실책"
                  sel={selectedReason === 'E 실책'}
                  onClick={() => handleSelectReason('E 실책')}
                />
                <Btn
                  label="(E) 기록된 실책"
                  sel={selectedReason === '(E) 기록실책'}
                  onClick={() => handleSelectReason('(E) 기록실책')}
                />
                <Btn
                  label="→ 다른 주자 수비"
                  sel={selectedReason === '다른주자수비'}
                  onClick={() => handleSelectReason('다른주자수비')}
                  style={{ gridColumn: '1 / -1' }}
                />
              </div>

              {/* 수비수 선택 — BatAdvModal 스타일 다이아몬드 + 테이블 */}
              {selectedReason && 수비수필요사유.has(selectedReason) && (
                <div style={{ borderTop: '1px solid var(--border2)', marginTop: 4 }}>
                  {/* 다이아몬드 SVG */}
                  <div style={{ background: '#f3f5f7', display: 'flex', justifyContent: 'center' }}>
                    <svg
                      viewBox="0 0 260 210"
                      style={{ width: '100%', maxWidth: 360, height: 'auto' }}
                    >
                      <path d="M130 200 L22 65 Q120 -38 240 65 Z" fill="#3f7a3d" />
                      <circle cx="130" cy="144" r="58" fill="#b79a77" opacity="0.45" />
                      <polygon points="130,92 172,132 130,172 88,132" fill="#52884d" />
                      {RFPOS.map(({ key, x, y }) => {
                        const inSeq = defSeq.some((d) => d.pos === key);
                        return (
                          <g key={key} style={{ cursor: 'pointer' }} onClick={() => addPos(key)}>
                            <circle
                              cx={x}
                              cy={y}
                              r={17}
                              fill={inSeq ? '#3b82f6' : 'rgba(255,255,255,0.2)'}
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
                              {RPOS_NAME[key] ?? key}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* 수비 리스트 테이블 */}
                  <div style={{ padding: '4px 8px 8px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700 }}>
                        수비 리스트
                        {defSeq.length > 0 && (
                          <span style={{ color: 'var(--blue)', marginLeft: 6 }}>
                            {defSeq
                              .map((f) => f.pos + (f.assist ? '보' : '') + (f.putout ? '자' : ''))
                              .join('-')}
                          </span>
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
                            borderRadius: 2,
                            cursor: 'pointer',
                          }}
                        >
                          초기화
                        </button>
                      )}
                    </div>
                    {defSeq.length > 0 ? (
                      <div style={{ overflowX: 'auto' }}>
                        <table
                          style={{
                            borderCollapse: 'collapse',
                            background: '#fff',
                            fontSize: 10,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <thead>
                            <tr>
                              {[
                                '수비',
                                '선수명',
                                '보살',
                                '자살',
                                '실책',
                                '송구방향',
                                '송구높이',
                                '시프트',
                                '',
                              ].map((h) => (
                                <th
                                  key={h}
                                  style={{
                                    background: '#dce7f4',
                                    border: '1px solid var(--border2)',
                                    padding: '3px 4px',
                                    fontWeight: 700,
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
                              const player = defLU?.find((p) => p.pos === row.pos);
                              const chk = (field: 'assist' | 'putout' | 'error' | 'shift') => (
                                <input
                                  type="checkbox"
                                  checked={row[field] as boolean}
                                  onChange={() => toggleField(i, field)}
                                />
                              );
                              const mini3 = (field: 'throwDir' | 'throwHeight', opts: string[]) => (
                                <div style={{ display: 'flex', gap: 1 }}>
                                  {opts.map((o) => (
                                    <button
                                      key={o}
                                      onClick={() => setSelectField(i, field, o)}
                                      style={{
                                        fontSize: 9,
                                        padding: '1px 3px',
                                        border: `1px solid ${row[field] === o ? 'var(--blue)' : 'var(--border)'}`,
                                        background: row[field] === o ? 'var(--blue)' : '#fff',
                                        color: row[field] === o ? '#fff' : 'var(--text)',
                                        borderRadius: 2,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {o}
                                    </button>
                                  ))}
                                </div>
                              );
                              return (
                                <tr key={i}>
                                  <td
                                    style={{
                                      border: '1px solid var(--border2)',
                                      padding: '3px 5px',
                                      textAlign: 'center',
                                      fontWeight: 700,
                                    }}
                                  >
                                    {RPOS_NAME[row.pos] ?? row.pos}
                                  </td>
                                  <td
                                    style={{
                                      border: '1px solid var(--border2)',
                                      padding: '3px 6px',
                                    }}
                                  >
                                    {player?.name || `#${row.pos}`}
                                  </td>
                                  <td
                                    style={{
                                      border: '1px solid var(--border2)',
                                      padding: '3px',
                                      textAlign: 'center',
                                    }}
                                  >
                                    {chk('assist')}
                                  </td>
                                  <td
                                    style={{
                                      border: '1px solid var(--border2)',
                                      padding: '3px',
                                      textAlign: 'center',
                                    }}
                                  >
                                    {chk('putout')}
                                  </td>
                                  <td
                                    style={{
                                      border: '1px solid var(--border2)',
                                      padding: '3px',
                                      textAlign: 'center',
                                    }}
                                  >
                                    {chk('error')}
                                  </td>
                                  <td
                                    style={{
                                      border: '1px solid var(--border2)',
                                      padding: '3px 4px',
                                    }}
                                  >
                                    {mini3('throwDir', ['좌', '중', '우'])}
                                  </td>
                                  <td
                                    style={{
                                      border: '1px solid var(--border2)',
                                      padding: '3px 4px',
                                    }}
                                  >
                                    {mini3('throwHeight', ['저', '중', '고'])}
                                  </td>
                                  <td
                                    style={{
                                      border: '1px solid var(--border2)',
                                      padding: '3px',
                                      textAlign: 'center',
                                    }}
                                  >
                                    {chk('shift')}
                                  </td>
                                  <td
                                    style={{
                                      border: '1px solid var(--border2)',
                                      padding: '2px 4px',
                                      textAlign: 'center',
                                    }}
                                  >
                                    <button
                                      onClick={() => removeEntry(i)}
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
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text3)', fontSize: 11, padding: '4px 0' }}>
                        수비 번호를 클릭해 수비수를 추가하세요
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                      onClick={() => !rbiBlocked && onSetRbi(!rbi)}
                      disabled={rbiBlocked}
                      title={
                        rbiBlocked
                          ? inDpPlay
                            ? '병살타 상황 — 타점 제외'
                            : '도루/폭투/포일/보크/실책 진루는 타점 제외'
                          : undefined
                      }
                      style={{
                        padding: '4px 16px',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 3,
                        cursor: rbiBlocked ? 'not-allowed' : 'pointer',
                        border: `2px solid ${rbi ? 'var(--blue)' : 'var(--border)'}`,
                        background: rbi ? 'var(--blue)' : '#fff',
                        color: rbi ? '#fff' : 'var(--text)',
                        opacity: rbiBlocked ? 0.5 : 1,
                      }}
                    >
                      {rbi ? '✓ 타점인정' : rbiBlocked ? '타점 제외' : '타점 없음'}
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
                checked={연속플레이}
                onChange={(e) => set연속플레이(e.target.checked)}
                style={{ accentColor: 'var(--blue)' }}
              />
              연속플레이
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

            {canDefl && (
              <DeflectionPicker
                value={deflection}
                defLU={defLU}
                onChange={(v) => setDeflection(v)}
              />
            )}

            <div style={{ flex: 1 }} />

            <button
              className="btn-ok"
              onClick={() =>
                onConfirm(
                  연속플레이,
                  fielderSeq,
                  canDefl ? (deflection ?? undefined) : undefined,
                  견제삽입 ? 견제루 : undefined
                )
              }
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
