import type { Player } from '../../types';
import { POS_NAME } from '../../data/constants';

const REQUIRED_POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

interface Props {
  open: boolean;
  teamName: string;
  lineup: Player[];
  onChangePos: (idx: number, pos: number) => void;
  onClose: () => void;
}

function getMissingPositions(lineup: Player[]): number[] {
  const used = new Set(lineup.map((p) => p.pos));
  return REQUIRED_POSITIONS.filter((pos) => !used.has(pos));
}

export default function LineupReviewModal({ open, teamName, lineup, onChangePos, onClose }: Props) {
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

        <div style={{ padding: '10px 12px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
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
                const rowBg = isReview ? '#fee2e2' : i % 2 === 0 ? '#fff' : '#f8fafc';
                return (
                  <tr key={i} style={{ background: rowBg }}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>
                      {p.order === 0 ? '투' : p.order}
                    </td>
                    <td style={tdStyle}>
                      <select
                        value={p.pos}
                        onChange={(e) => onChangePos(i, +e.target.value)}
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
                      </select>
                    </td>
                    <td style={tdStyle}>{p.name}</td>
                    <td style={tdStyle}>{p.num}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
