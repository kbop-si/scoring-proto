import { useState } from 'react';
import type { Base } from '../../types';

interface Props {
  open: boolean;
  runnerBase: Base | null;
  runnerName: string;
  selected: string | null;
  onSelect: (v: string) => void;
  onConfirm: (seq: number[]) => void;
  onClose: () => void;
}

// 수비 위치 SVG 좌표 (viewBox 0 0 200 210)
const FPOS: { pos: number; x: number; y: number }[] = [
  { pos: 8, x: 100, y: 42 },
  { pos: 7, x: 25, y: 52 },
  { pos: 9, x: 175, y: 52 },
  { pos: 6, x: 72, y: 105 },
  { pos: 4, x: 128, y: 105 },
  { pos: 5, x: 36, y: 125 },
  { pos: 3, x: 164, y: 125 },
  { pos: 1, x: 100, y: 128 },
  { pos: 2, x: 100, y: 193 },
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

const SEQ_LABEL = ['①', '②', '③', '④'];

type PickoffBase = '1' | '2' | '3';

export default function RunOutModal({
  open,
  runnerBase,
  runnerName,
  selected,
  onSelect,
  onConfirm,
  onClose,
}: Props) {
  const [seq, setSeq] = useState<number[]>([]);
  const [wInsert, setWInsert] = useState(false);
  const [pInsert, setPInsert] = useState(false);
  const [csRecord, setCsRecord] = useState(false);
  const [pickoffBase, setPickoffBase] = useState<PickoffBase>('1');

  const reset = () => {
    setSeq([]);
    setWInsert(false);
    setPInsert(false);
    setCsRecord(false);
    setPickoffBase('1');
  };
  const handleClose = () => {
    reset();
    onClose();
  };
  const handleConfirm = () => {
    onConfirm(seq);
    reset();
  };

  const addPos = (pos: number) => setSeq((prev) => (prev.length < 4 ? [...prev, pos] : prev));

  const B = (v: string, l: string) => (
    <button key={v} className={`r-btn${selected === v ? ' sel' : ''}`} onClick={() => onSelect(v)}>
      {l}
    </button>
  );

  return (
    <div className={`ov${open ? ' open' : ''}`} id="ov-run-out">
      <div className="ov-card" style={{ minWidth: 580 }}>
        <div className="modal-title">
          주자 아웃 —{' '}
          <span style={{ color: 'var(--red)' }}>
            {runnerBase}: {runnerName}
          </span>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border2)' }}>
          {/* 좌측: 다이아몬드 수비 선택 */}
          <div style={{ width: 300, borderRight: '1px solid var(--border2)', padding: '10px 8px' }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text3)',
                marginBottom: 4,
                textAlign: 'center',
              }}
            >
              수비 위치 클릭
            </div>
            <svg viewBox="0 0 200 290" style={{ width: '100%', display: 'block' }}>
              {/* 외야 */}
              <path d="M100,175 L2,50 Q100,0 195,50 Z" fill="#3a7a3a" />
              {/* 내야 흙 */}
              <circle cx="100" cy="140" r="80" fill="#7a5c38" opacity=".45" />
              {/* 파울 라인 */}
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
              {/* 베이스 다이아몬드 */}
              <polygon
                points="100,91 131,122 100,153 69,122"
                fill="#4a7a4a"
                stroke="#fff"
                strokeWidth=".8"
                opacity=".9"
              />
              {/* 홈플레이트 */}
              <polygon points="100,175 94,181 96,187 104,187 106,181" fill="#fff" opacity=".85" />

              {FPOS.map(({ pos, x, y }) => {
                const idx = seq.indexOf(pos);
                const inSeq = idx >= 0;
                const canAdd = seq.length < 4 && !inSeq;
                return (
                  <g
                    key={pos}
                    style={{ cursor: canAdd ? 'pointer' : inSeq ? 'default' : 'not-allowed' }}
                    onClick={() => canAdd && addPos(pos)}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={15}
                      fill={
                        inSeq
                          ? '#1d4ed8'
                          : canAdd
                            ? 'rgba(255,255,255,0.22)'
                            : 'rgba(255,255,255,0.07)'
                      }
                      stroke={
                        inSeq
                          ? '#60a5fa'
                          : canAdd
                            ? 'rgba(255,255,255,0.7)'
                            : 'rgba(255,255,255,0.2)'
                      }
                      strokeWidth={inSeq ? 2 : 1.5}
                    />
                    {inSeq && (
                      <text
                        x={x}
                        y={y - 2}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="700"
                        fill="#fff"
                        style={{ pointerEvents: 'none' }}
                      >
                        {SEQ_LABEL[idx]}
                      </text>
                    )}
                    <text
                      x={x}
                      y={y + (inSeq ? 9 : 4)}
                      textAnchor="middle"
                      fontSize={inSeq ? '8' : pos > 9 ? '9' : '12'}
                      fontWeight="700"
                      fill={inSeq ? '#bfdbfe' : canAdd ? '#fff' : 'rgba(255,255,255,0.3)'}
                      style={{ pointerEvents: 'none' }}
                    >
                      {POS_NAME[pos] ?? pos}
                    </text>
                    {!inSeq && pos <= 9 && (
                      <text
                        x={x}
                        y={y + 15}
                        textAnchor="middle"
                        fontSize="8"
                        fill="rgba(255,255,255,0.65)"
                        style={{ pointerEvents: 'none' }}
                      >
                        {POS_NAME[pos]}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  textAlign: 'center',
                  color: seq.length ? 'var(--blue)' : 'var(--text3)',
                }}
              >
                {seq.length ? seq.join(' → ') : '—'}
              </span>
              <button
                onClick={() => setSeq((s) => s.slice(0, -1))}
                style={{
                  padding: '2px 6px',
                  fontSize: 10,
                  border: '1px solid var(--border)',
                  background: '#fff',
                  borderRadius: 2,
                }}
              >
                ←
              </button>
              <button
                onClick={() => setSeq([])}
                style={{
                  padding: '2px 6px',
                  fontSize: 10,
                  border: '1px solid var(--border)',
                  background: '#fff',
                  borderRadius: 2,
                }}
              >
                초기화
              </button>
            </div>
          </div>

          {/* 중앙: 아웃 유형 버튼 */}
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

          {/* 우측: 옵션 패널 */}
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

        <div className="modal-footer">
          <button className="btn-ok" onClick={handleConfirm}>
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
