import { useEffect, useState } from 'react';
import type { Player } from '../../types';
import { POS_NAME } from '../../data/constants';

const REQUIRED_POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

interface Props {
  open: boolean;
  teamName: string;
  lineup: Player[];
  bench: Player[]; // 투입 가능한 벤치 (재출전 불가 선수 제외됨)
  onChangePos: (idx: number, pos: number) => void;
  onSubstitute: (idx: number, player: Player) => void; // 수비 안 들어감 → 벤치 선수로 교체
  onClose: () => void;
}

function getMissingPositions(lineup: Player[]): number[] {
  const used = new Set(lineup.map((p) => p.pos));
  return REQUIRED_POSITIONS.filter((pos) => !used.has(pos));
}

export default function LineupReviewModal({
  open,
  teamName,
  lineup,
  bench,
  onChangePos,
  onSubstitute,
  onClose,
}: Props) {
  // "없음(수비 안 들어감)" 선택 시 벤치 선수 선택 탭이 열리는 행 인덱스
  const [pickingIdx, setPickingIdx] = useState<number | null>(null);
  useEffect(() => {
    if (open) setPickingIdx(null);
  }, [open]);

  if (!open) return null;
  const missing = getMissingPositions(lineup);

  const thStyle: React.CSSProperties = {
    background: 'var(--panel2)',
    fontWeight: 700,
    fontSize: 11,
    padding: '6px 8px',
    border: '1px solid var(--border2)',
    textAlign: 'center',
  };
  const tdStyle: React.CSSProperties = {
    border: '1px solid var(--border2)',
    padding: '4px 8px',
    fontSize: 12,
    textAlign: 'center',
  };

  return (
    <div className="ov open" id="ov-lineup-review">
      <div className="ov-card" style={{ minWidth: 480 }}>
        <div className="modal-title">{teamName} 라인업 — 수비 포지션 확인</div>

        {missing.length > 0 && (
          <div
            style={{
              padding: '8px 12px',
              background: '#fee2e2',
              color: '#991b1b',
              fontSize: 12,
              fontWeight: 700,
              borderBottom: '1px solid var(--border2)',
            }}
          >
            비어있는 포지션: {missing.map((pos) => POS_NAME[pos] || `#${pos}`).join(', ')}
          </div>
        )}

        <div style={{ padding: '10px 12px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <table style={{ borderCollapse: 'collapse', flex: 1 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 40 }}>타순</th>
                <th style={{ ...thStyle, width: 130 }}>수비</th>
                <th style={thStyle}>선수명</th>
                <th style={{ ...thStyle, width: 60 }}>등번호</th>
              </tr>
            </thead>
            <tbody>
              {lineup.map((p, i) => {
                const isReview = !!p.needsPosReview;
                const rowBg =
                  pickingIdx === i
                    ? '#fef9c3'
                    : isReview
                      ? '#fee2e2'
                      : i % 2 === 0
                        ? '#fff'
                        : '#f8fafc';
                return (
                  <tr key={i} style={{ background: rowBg }}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>
                      {p.order === 0 ? '투' : p.order}
                    </td>
                    <td style={tdStyle}>
                      <select
                        value={pickingIdx === i ? -1 : p.pos}
                        onChange={(e) => {
                          const v = +e.target.value;
                          if (v === -1) {
                            // 수비 안 들어감 — 우측 패널에서 대신 들어갈 선수 선택
                            setPickingIdx(i);
                            return;
                          }
                          setPickingIdx(null);
                          onChangePos(i, v);
                        }}
                        style={{
                          height: 24,
                          fontSize: 11,
                          border: '1px solid var(--border2)',
                          borderRadius: 2,
                          padding: '0 4px',
                          width: '100%',
                        }}
                      >
                        {REQUIRED_POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>
                            {pos === 0 ? 'D' : pos} {POS_NAME[pos]}
                          </option>
                        ))}
                        {/* 대타/대주자로 들어온 선수가 수비에 안 들어가는 경우 */}
                        {isReview && <option value={-1}>없음 (수비 안 들어감)</option>}
                      </select>
                    </td>
                    <td style={tdStyle}>{p.name}</td>
                    <td style={tdStyle}>{p.num}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ── 우측 패널: 없음 선택 시 대신 들어갈 선수 목록 ── */}
          {pickingIdx !== null && (
            <div
              style={{
                width: 190,
                border: '1px solid var(--border2)',
                borderRadius: 4,
                background: '#fffbeb',
                padding: 10,
                alignSelf: 'stretch',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>
                {lineup[pickingIdx]?.name} 대신 수비 투입
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8 }}>
                남은 선수 (교체돼 빠진 선수 제외)
              </div>
              {bench.length === 0 ? (
                <div style={{ fontSize: 12, color: '#991b1b', fontWeight: 700 }}>
                  투입 가능한 벤치 선수가 없습니다
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {bench.map((b) => (
                    <button
                      key={`${b.num}-${b.name}`}
                      onClick={() => {
                        const idx = pickingIdx;
                        setPickingIdx(null);
                        if (idx !== null) onSubstitute(idx, b);
                      }}
                      style={{
                        fontSize: 13,
                        padding: '6px 8px',
                        border: '1px solid var(--border2)',
                        borderRadius: 4,
                        background: '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontWeight: 600,
                      }}
                    >
                      <span style={{ color: '#6b7280', marginRight: 6 }}>{b.num}</span>
                      {b.name}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => setPickingIdx(null)}
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  padding: '3px 8px',
                  border: '1px solid var(--border2)',
                  borderRadius: 4,
                  background: '#f8fafc',
                  cursor: 'pointer',
                }}
              >
                닫기
              </button>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn-ok"
            onClick={onClose}
            disabled={missing.length > 0}
            title={missing.length > 0 ? '비어있는 포지션을 먼저 채워주세요' : undefined}
            style={missing.length > 0 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
