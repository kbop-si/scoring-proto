import { useEffect, useMemo, useState } from 'react';
import type { GameState, GameDecisions } from '../../types';
import { autoDecide, listPitchersForDecision } from '../../utils/pitcherDecisions';
import type { PitcherRow } from '../../utils/pitcherStats';

interface Props {
  open: boolean;
  G: GameState;
  onConfirm: (decisions: GameDecisions) => void;
  onClose: () => void;
}

type Mark = '' | 'W' | 'L' | 'S' | 'H' | 'BS';
const MARKS: Mark[] = ['', 'W', 'L', 'S', 'H', 'BS'];
const MARK_LABEL: Record<Mark, string> = {
  '': '없음',
  W: '승',
  L: '패',
  S: 'S(세)',
  H: 'H(홀)',
  BS: 'BS(블론)',
};

function rowsToInitialPicks(
  rows: PitcherRow[],
  team: 'away' | 'home',
  decisions: GameDecisions
): Mark[] {
  const td = decisions[team];
  return rows.map((r) => {
    if (r.name && r.name === td.win) return 'W';
    if (r.name && r.name === td.loss) return 'L';
    if (r.name && r.name === td.save) return 'S';
    if (r.name && td.holds.includes(r.name)) return 'H';
    if (r.name && td.bs.includes(r.name)) return 'BS';
    return '';
  });
}

function picksToDecisions(
  awayRows: PitcherRow[],
  awayPicks: Mark[],
  homeRows: PitcherRow[],
  homePicks: Mark[]
): GameDecisions {
  const build = (rows: PitcherRow[], picks: Mark[]) => {
    const td = { holds: [], bs: [] } as GameDecisions['away'];
    rows.forEach((r, i) => {
      const m = picks[i];
      if (!m || !r.name) return;
      if (m === 'W' && !td.win) td.win = r.name;
      else if (m === 'L' && !td.loss) td.loss = r.name;
      else if (m === 'S' && !td.save) td.save = r.name;
      else if (m === 'H') td.holds.push(r.name);
      else if (m === 'BS') td.bs.push(r.name);
    });
    return td;
  };
  return {
    away: build(awayRows, awayPicks),
    home: build(homeRows, homePicks),
  };
}

export default function GameEndModal({ open, G, onConfirm, onClose }: Props) {
  const { away: awayRows, home: homeRows } = useMemo(() => listPitchersForDecision(G), [G]);
  const initial = useMemo(() => autoDecide(G), [G]);

  const [awayPicks, setAwayPicks] = useState<Mark[]>(() =>
    rowsToInitialPicks(awayRows, 'away', initial)
  );
  const [homePicks, setHomePicks] = useState<Mark[]>(() =>
    rowsToInitialPicks(homeRows, 'home', initial)
  );

  // 모달 open 될 때마다 자동산정 재계산 후 초기화
  useEffect(() => {
    if (open) {
      setAwayPicks(rowsToInitialPicks(awayRows, 'away', initial));
      setHomePicks(rowsToInitialPicks(homeRows, 'home', initial));
    }
  }, [open, awayRows, homeRows, initial]);

  const handleConfirm = () => {
    onConfirm(picksToDecisions(awayRows, awayPicks, homeRows, homePicks));
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '2px 5px',
    fontSize: 10,
    fontWeight: 700,
    borderRadius: 3,
    cursor: 'pointer',
    border: `1px solid ${active ? 'var(--blue)' : 'var(--border)'}`,
    background: active ? 'var(--blue)' : '#fff',
    color: active ? '#fff' : 'var(--text)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    lineHeight: 1.2,
  });

  const renderTeam = (
    label: string,
    rows: PitcherRow[],
    picks: Mark[],
    setPicks: (p: Mark[]) => void
  ) => (
    <div style={{ flex: 1, minWidth: 280 }}>
      <div
        style={{
          fontWeight: 700,
          padding: '6px 8px',
          background: 'var(--panel3)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {label}
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 8px',
              borderBottom: '1px solid var(--border2)',
            }}
          >
            <div
              style={{
                flex: 1,
                fontWeight: 600,
                fontSize: 12,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {r.name || '—'}
            </div>
            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              {MARKS.map((m) => (
                <button
                  key={m}
                  style={btnStyle(picks[i] === m)}
                  onClick={() => {
                    const next = [...picks];
                    next[i] = m;
                    setPicks(next);
                  }}
                >
                  {MARK_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div style={{ padding: 12, color: 'var(--text2)', fontSize: 12 }}>등판 투수 없음</div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`ov${open ? ' open' : ''}`} id="ov-game-end">
      <div className="ov-card" style={{ minWidth: 720, maxWidth: 880 }}>
        <div className="modal-title">투수 기록</div>
        <div style={{ display: 'flex', gap: 10, padding: '0 10px 10px' }}>
          {renderTeam(`원정 ${G.awayTeam || ''}`, awayRows, awayPicks, setAwayPicks)}
          {renderTeam(`홈 ${G.homeTeam || ''}`, homeRows, homePicks, setHomePicks)}
        </div>
        <div className="modal-footer">
          <button className="btn-ok" onClick={handleConfirm}>
            확인
          </button>
          <button className="btn-cancel" onClick={onClose}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
