import type { GameState } from '../types';
import { TEAM_FLAG } from '../data/constants';

interface Props {
  G: GameState;
  showSheet?: boolean;
  onToggleSheet?: () => void;
  onOpenSheetWindow?: () => void;
  onOpenScoreReview?: () => void;
}

const MAX_INN = 15;

export default function Scoreboard({ G, onOpenSheetWindow, onOpenScoreReview }: Props) {
  const inns = Array.from({ length: MAX_INN }, (_, i) => i + 1);

  // Compute per-inning runs from cells
  const awayInnRuns = Array(MAX_INN).fill(null) as (number | null)[];
  const homeInnRuns = Array(MAX_INN).fill(null) as (number | null)[];
  let awayBB = 0,
    homeBB = 0;
  Object.values(G.cells).forEach((c) => {
    if (c.scored) {
      if (c.half === 'top') awayInnRuns[c.inning - 1] = (awayInnRuns[c.inning - 1] || 0) + 1;
      else homeInnRuns[c.inning - 1] = (homeInnRuns[c.inning - 1] || 0) + 1;
    }
    if (c.result === 'HR' || c.result === 'GHR') {
      if (c.half === 'top') awayInnRuns[c.inning - 1] = (awayInnRuns[c.inning - 1] || 0) + 1;
      else homeInnRuns[c.inning - 1] = (homeInnRuns[c.inning - 1] || 0) + 1;
    }
    if (c.result === 'B' || c.result === 'IB') {
      if (c.half === 'top') awayBB++;
      else homeBB++;
    }
  });

  return (
    <div className="scoreboard">
      <div className="sb-flag">
        {TEAM_FLAG[G.awayTeam] ? (
          <img
            src={TEAM_FLAG[G.awayTeam]}
            alt={G.awayTeam}
            style={{ width: 42, height: 42, objectFit: 'contain' }}
          />
        ) : (
          '⚾'
        )}
      </div>
      <div className="sb-team">
        <div className="sb-team-name">{G.awayTeam || '원정'}</div>
        <div className="sb-team-score">{G.awayR}</div>
      </div>

      <div className="sb-innings">
        <div className="sb-inn-group">
          {/* Header row */}
          <div className="sb-inn-row">
            <div className="sb-inn-cell hd">팀</div>
            {inns.map((i) => (
              <div key={i} className={`sb-inn-cell hd${i === G.inning ? ' cur' : ''}`}>
                {i}
              </div>
            ))}
            {['R', 'H', 'E', 'B'].map((l) => (
              <div key={l} className="sb-inn-cell hd" style={{ color: '#fbbf24' }}>
                {l}
              </div>
            ))}
          </div>
          {/* Away row */}
          <div className="sb-inn-row">
            <div className="sb-inn-cell" style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>
              원
            </div>
            {inns.map((i) => {
              const val = awayInnRuns[i - 1];
              const isCur = i === G.inning && G.half === 'top';
              // 원정(초) 이닝 시작 여부: 현재 이닝 이하면 시작됨
              const started = i <= G.inning;
              return (
                <div
                  key={i}
                  className={`sb-inn-cell${isCur ? ' cur' : ''}${started && val !== null ? ' score' : ''}`}
                >
                  {started ? (val ?? 0) : '-'}
                </div>
              );
            })}
            <div className="sb-inn-cell score">{G.awayR}</div>
            <div className="sb-inn-cell score">{G.awayH}</div>
            <div className="sb-inn-cell score">{G.awayE}</div>
            <div className="sb-inn-cell score">{awayBB}</div>
          </div>
          {/* Home row */}
          <div className="sb-inn-row">
            <div className="sb-inn-cell" style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>
              홈
            </div>
            {inns.map((i) => {
              const val = homeInnRuns[i - 1];
              const isCur = i === G.inning && G.half === 'bottom';
              // 홈(말) 이닝 시작 여부: 이전 이닝이거나 현재 이닝 말이면 시작됨
              const started = i < G.inning || (i === G.inning && G.half === 'bottom');
              return (
                <div
                  key={i}
                  className={`sb-inn-cell${isCur ? ' cur' : ''}${started && val !== null ? ' score' : ''}`}
                >
                  {started ? (val ?? 0) : '-'}
                </div>
              );
            })}
            <div className="sb-inn-cell score">{G.homeR}</div>
            <div className="sb-inn-cell score">{G.homeH}</div>
            <div className="sb-inn-cell score">{G.homeE}</div>
            <div className="sb-inn-cell score">{homeBB}</div>
          </div>
        </div>
      </div>

      <div className="sb-flag">
        {TEAM_FLAG[G.homeTeam] ? (
          <img
            src={TEAM_FLAG[G.homeTeam]}
            alt={G.homeTeam}
            style={{ width: 42, height: 42, objectFit: 'contain' }}
          />
        ) : (
          '⚾'
        )}
      </div>
      <div className="sb-team">
        <div className="sb-team-name">{G.homeTeam || '홈팀'}</div>
        <div className="sb-team-score">{G.homeR}</div>
      </div>

      {/*기록지보기 버튼 */}
      {/* {onToggleSheet && (
        <button
          className={`sb-sheet-btn${showSheet ? ' active' : ''}`}
          onClick={onToggleSheet}
        >
          <span style={{ fontSize: 14 }}>{showSheet ? '◀' : ''}</span>
          <span>{showSheet ? '돌아가기' : '기록지 보기'}</span>
        </button>
      )} */}
      {onOpenSheetWindow && (
        <button className="sb-sheet-btn" onClick={onOpenSheetWindow} title="새 창으로 열기">
          <span>기록지 보기</span>
        </button>
      )}
      {onOpenScoreReview && (
        <button
          className="sb-sheet-btn"
          onClick={onOpenScoreReview}
          title="자책점 검토"
          style={{ marginLeft: 4 }}
        >
          <span>자책점 검토</span>
        </button>
      )}
    </div>
  );
}
