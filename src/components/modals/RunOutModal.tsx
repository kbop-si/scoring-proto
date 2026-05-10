import { useState, useEffect } from 'react';
import type { Base, DeflectionInfo, Player } from '../../types';
import DeflectionPicker from './DeflectionPicker';

interface Props {
  open: boolean;
  runnerBase: Base | null;
  runnerName: string;
  selected: string | null;
  defLU: Player[];
  onSelect: (v: string) => void;
  onConfirm: (seq: number[], deflection?: DeflectionInfo) => void;
  onClose: () => void;
}

interface DefRow {
  pos: number;
  assist: boolean;
  putout: boolean;
  error: boolean;
  throwDir: string;
  recvDir: string;
  shift: boolean;
}

// 수비 위치 SVG 좌표 (viewBox 0 0 200 210)
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

const SEQ_LABEL = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
const DIR_OPTS = ['중앙', '좌', '우', '내야', '외야', '—'];

type PickoffBase = '1' | '2' | '3';

export default function RunOutModal({
  open,
  runnerBase,
  runnerName,
  selected,
  defLU,
  onSelect,
  onConfirm,
  onClose,
}: Props) {
  const [defSeq, setDefSeq] = useState<DefRow[]>([]);
  const seq = defSeq.map((r) => r.pos);
  const [wInsert, setWInsert] = useState(false);
  const [pInsert, setPInsert] = useState(false);
  const [csRecord, setCsRecord] = useState(false);
  const [pickoffBase, setPickoffBase] = useState<PickoffBase>('1');
  const [deflection, setDeflection] = useState<DeflectionInfo | null>(null);

  const reset = () => {
    setDefSeq([]);
    setWInsert(false);
    setPInsert(false);
    setCsRecord(false);
    setPickoffBase('1');
    setDeflection(null);
  };

  // 모달이 열릴 때마다 초기화
  useEffect(() => {
    if (open) reset();
  }, [open]);
  const handleClose = () => {
    reset();
    onClose();
  };
  const handleConfirm = () => {
    onConfirm(seq, deflection ?? undefined);
    reset();
  };

  const addPos = (pos: number) =>
    setDefSeq((prev) => {
      const updated = prev.map((r) => ({ ...r, putout: false, assist: true }));
      return [
        ...updated,
        {
          pos,
          assist: false,
          putout: true,
          error: false,
          throwDir: '중앙',
          recvDir: '중앙',
          shift: false,
        },
      ];
    });

  const B = (v: string, l: string) => (
    <button key={v} className={`r-btn${selected === v ? ' sel' : ''}`} onClick={() => onSelect(v)}>
      {l}
    </button>
  );

  return (
    <div className={`ov${open ? ' open' : ''}`} id="ov-run-out">
      <div
        style={{
          width: '92vw',
          maxWidth: 1100,
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0,0,0,.25)',
          display: 'grid',
          gridTemplateColumns: '560px 1fr',
          maxHeight: '92vh',
          overflow: 'hidden',
        }}
      >
        {/* ── 좌측: 필드 + 수비 리스트 ── */}
        <section
          style={{
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* 헤더 */}
          <div
            style={{
              background: 'var(--panel2)',
              borderBottom: '1px solid var(--border)',
              padding: '8px 10px',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            주자 아웃 —{' '}
            <span style={{ color: 'var(--red)', fontWeight: 400, fontSize: 13 }}>
              {runnerBase}: {runnerName}
            </span>
          </div>

          {/* SVG 다이아몬드 */}
          <div style={{ padding: '8px 10px 4px', borderBottom: '1px solid var(--border2)' }}>
            <svg
              viewBox="0 0 200 210"
              style={{ width: '100%', maxWidth: 300, display: 'block', margin: '0 auto' }}
            >
              <path d="M100,175 L5,50 Q100,0 195,50 Z" fill="#3a7a3a" />
              <circle cx="100" cy="135" r="68" fill="#7a5c38" opacity=".45" />
              <line
                x1="100"
                y1="175"
                x2="5"
                y2="60"
                stroke="#fff"
                strokeWidth=".7"
                strokeDasharray="4,3"
                opacity=".5"
              />
              <line
                x1="100"
                y1="175"
                x2="195"
                y2="60"
                stroke="#fff"
                strokeWidth=".7"
                strokeDasharray="4,3"
                opacity=".5"
              />
              <polygon
                points="100,91 131,122 100,153 69,122"
                fill="#4a7a4a"
                stroke="#fff"
                strokeWidth=".8"
                opacity=".9"
              />
              <polygon points="100,175 94,181 96,187 104,187 106,181" fill="#fff" opacity=".85" />

              {FPOS.map(({ pos, x, y }) => {
                const count = seq.filter((p) => p === pos).length;
                const inSeq = count > 0;
                const idx = seq.indexOf(pos);
                const player = defLU.find((pl) => pl.pos === pos);
                return (
                  <g key={pos} style={{ cursor: 'pointer' }} onClick={() => addPos(pos)}>
                    <circle
                      cx={x}
                      cy={y}
                      r={12}
                      fill={inSeq ? '#1d4ed8' : 'rgba(255,255,255,0.18)'}
                      stroke={inSeq ? '#60a5fa' : 'rgba(255,255,255,0.6)'}
                      strokeWidth={inSeq ? 2 : 1}
                    />
                    {inSeq && (
                      <text
                        x={x}
                        y={y - 1}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="700"
                        fill="#fff"
                        style={{ pointerEvents: 'none' }}
                      >
                        {count > 1 ? `×${count}` : SEQ_LABEL[idx]}
                      </text>
                    )}
                    <text
                      x={x}
                      y={y + (inSeq ? 8 : 4)}
                      textAnchor="middle"
                      fontSize={inSeq ? '7' : '10'}
                      fontWeight="700"
                      fill={inSeq ? '#bfdbfe' : '#fff'}
                      style={{ pointerEvents: 'none' }}
                    >
                      {POS_NAME[pos]}
                    </text>
                    {!inSeq && player && (
                      <text
                        x={x}
                        y={y + 13}
                        textAnchor="middle"
                        fontSize="6"
                        fill="rgba(255,255,255,0.55)"
                        style={{ pointerEvents: 'none' }}
                      >
                        {player.num}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* 수비 리스트 테이블 */}
          <div style={{ padding: 10, flex: 1, overflow: 'auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <span>
                수비 리스트
                {seq.length > 0 && (
                  <span style={{ color: 'var(--blue)', marginLeft: 6, fontFamily: 'monospace' }}>
                    {seq.join(' → ')}
                  </span>
                )}
              </span>
              {defSeq.length > 0 && (
                <button
                  onClick={() => setDefSeq([])}
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
              )}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
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
                        padding: '5px 4px',
                        fontWeight: 700,
                        fontSize: 11,
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {defSeq.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        border: '1px solid var(--border2)',
                        padding: '8px 4px',
                        textAlign: 'center',
                        color: 'var(--text3)',
                        fontSize: 11,
                      }}
                    >
                      수비 번호를 클릭해 추가하세요
                    </td>
                  </tr>
                ) : (
                  defSeq.map((row, i) => {
                    const player = defLU.find((p) => p.pos === row.pos);
                    const toggle = (f: 'assist' | 'putout' | 'error' | 'shift') =>
                      setDefSeq((prev) => prev.map((r, j) => (j === i ? { ...r, [f]: !r[f] } : r)));
                    const upd = (patch: Partial<DefRow>) =>
                      setDefSeq((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
                    const td: React.CSSProperties = {
                      border: '1px solid var(--border2)',
                      padding: '3px 4px',
                      textAlign: 'center',
                      fontSize: 11,
                    };
                    return (
                      <tr key={i}>
                        <td style={{ ...td, fontWeight: 700 }}>{POS_NAME[row.pos]}</td>
                        <td style={{ ...td, textAlign: 'left', paddingLeft: 6 }}>
                          {player?.name || `#${row.pos}`}
                        </td>
                        <td style={td}>
                          <input
                            type="checkbox"
                            checked={row.assist}
                            onChange={() => toggle('assist')}
                            style={{ accentColor: 'var(--blue)' }}
                          />
                        </td>
                        <td style={td}>
                          <input
                            type="checkbox"
                            checked={row.putout}
                            onChange={() => toggle('putout')}
                            style={{ accentColor: 'var(--blue)' }}
                          />
                        </td>
                        <td style={td}>
                          <input
                            type="checkbox"
                            checked={row.error}
                            onChange={() => toggle('error')}
                            style={{ accentColor: '#ef4444' }}
                          />
                        </td>
                        <td style={td}>
                          <select
                            value={row.throwDir}
                            onChange={(e) => upd({ throwDir: e.target.value })}
                            style={{
                              fontSize: 10,
                              border: '1px solid var(--border2)',
                              borderRadius: 2,
                              padding: '1px 2px',
                            }}
                          >
                            {DIR_OPTS.map((d) => (
                              <option key={d}>{d}</option>
                            ))}
                          </select>
                        </td>
                        <td style={td}>
                          <select
                            value={row.recvDir}
                            onChange={(e) => upd({ recvDir: e.target.value })}
                            style={{
                              fontSize: 10,
                              border: '1px solid var(--border2)',
                              borderRadius: 2,
                              padding: '1px 2px',
                            }}
                          >
                            {DIR_OPTS.map((d) => (
                              <option key={d}>{d}</option>
                            ))}
                          </select>
                        </td>
                        <td style={td}>
                          <input
                            type="checkbox"
                            checked={row.shift}
                            onChange={() => toggle('shift')}
                          />
                        </td>
                        <td style={{ ...td, padding: '2px 4px' }}>
                          <button
                            onClick={() =>
                              setDefSeq((prev) => {
                                const next = prev.filter((_, j) => j !== i);
                                if (next.length > 0)
                                  return next.map((r, j) => ({
                                    ...r,
                                    putout: j === next.length - 1,
                                    assist: j < next.length - 1,
                                  }));
                                return next;
                              })
                            }
                            style={{
                              fontSize: 11,
                              padding: '1px 5px',
                              border: '1px solid var(--border)',
                              background: '#fff',
                              borderRadius: 2,
                              cursor: 'pointer',
                              color: 'var(--red)',
                            }}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 하단 확인/취소 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 12px 12px',
              borderTop: '1px solid var(--border2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: 15,
                  color: seq.length ? 'var(--blue)' : 'var(--text3)',
                }}
              >
                {seq.length ? seq.join('-') : '—'}
              </span>
              <DeflectionPicker
                value={deflection}
                defLU={defLU}
                onChange={(v) => setDeflection(v)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-ok"
                disabled={!selected}
                style={{ opacity: selected ? 1 : 0.4 }}
                onClick={handleConfirm}
              >
                확인
              </button>
              <button className="btn-cancel" onClick={handleClose}>
                취소
              </button>
            </div>
          </div>
        </section>

        {/* ── 우측: 아웃 유형 + 옵션 ── */}
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
            아웃 유형
          </div>
          <div style={{ flex: 1, display: 'flex', overflow: 'auto' }}>
            {/* 아웃 유형 열 */}
            <div style={{ flex: 1, borderRight: '1px solid var(--border2)' }}>
              <div style={{ borderBottom: '1px solid var(--border2)' }}>
                <div className="rg">
                  <div className="rs-title">일반 아웃</div>
                  {B('포스아웃', '● 포스 아웃')}
                  {B('T 태그아웃', 'T  태그 아웃')}
                  {B('X 견제사', 'X  견제사')}
                  {B('CS 도루실패', 'CS 도루실패')}
                </div>
              </div>
              <div style={{ borderBottom: '1px solid var(--border2)' }}>
                <div className="rg">
                  <div className="rs-title">터치, 공과 아웃</div>
                  <button
                    className={`r-btn${selected === 'A 1루터치' ? ' sel' : ''}`}
                    style={{ gridColumn: '1 / -1' }}
                    onClick={() => onSelect('A 1루터치')}
                  >
                    A 1루 터치 아웃
                  </button>
                  {B('B 2루터치', 'B  2루 터치 아웃')}
                  {B('B 2루공과', 'B  2루 공과')}
                  {B('C 3루터치', 'C  3루 터치 아웃')}
                  {B('C 3루공과', 'C  3루 공과')}
                  {B('H 홈터치', 'H  홈 터치 아웃')}
                  {B('H 홈공과', 'H  홈 공과')}
                </div>
              </div>
              <div>
                <div className="rg">
                  <div className="rs-title">기타 아웃</div>
                  {B('X 타구맞음', 'X  타구 맞음')}
                  {B('IP 부정주루', 'IP  부정 주루')}
                </div>
              </div>
            </div>

            {/* 옵션 열 */}
            <div
              style={{
                width: 110,
                padding: '10px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={wInsert}
                  onChange={() => setWInsert((v) => !v)}
                  style={{ accentColor: 'var(--blue)' }}
                />
                폭투삽입
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={pInsert}
                  onChange={() => setPInsert((v) => !v)}
                  style={{ accentColor: 'var(--blue)' }}
                />
                포일삽입
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={csRecord}
                  onChange={() => setCsRecord((v) => !v)}
                  style={{ accentColor: 'var(--blue)' }}
                />
                도루자기록
              </label>
              <div style={{ borderTop: '1px solid var(--border2)', paddingTop: 8, marginTop: 2 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>견제</div>
                {(['1', '2', '3'] as PickoffBase[]).map((b) => (
                  <label
                    key={b}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 10,
                      cursor: 'pointer',
                      marginBottom: 2,
                    }}
                  >
                    <input
                      type="radio"
                      name="runOutPickoff"
                      checked={pickoffBase === b}
                      onChange={() => setPickoffBase(b)}
                      style={{ accentColor: 'var(--blue)' }}
                    />
                    {b}루견제
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
