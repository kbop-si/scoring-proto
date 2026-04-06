import { useState } from 'react';
import type { GameState, PitchType } from '../types';

const PITCH_LABEL: Record<PitchType, string> = {
  S:   'S',
  SW:  'SW',
  B:   'B',
  F:   'F',
  FE:  'FE',
  BS:  'BS',
  BF:  'BF',
  PC1: 'PC볼',
  PC2: 'PC볼',
  PC3: 'PCS',
};

const PITCH_COLOR: Record<PitchType, string> = {
  S:   '#1e40af',
  SW:  '#1e40af',
  B:   '#15803d',
  F:   '#92400e',
  FE:  '#92400e',
  BS:  '#1e40af',
  BF:  '#92400e',
  PC1: '#15803d',
  PC2: '#15803d',
  PC3: '#1e40af',
};

function buildPitcherLog(G: GameState) {
  const cells = Object.values(G.cells)
    .filter(c => c.pitches.length > 0 || c.result)
    .sort((a, b) => {
      if (a.inning !== b.inning) return a.inning - b.inning;
      if (a.half !== b.half) return a.half === 'top' ? -1 : 1;
      if (a.order !== b.order) return a.order - b.order;
      return a.appearance - b.appearance;
    });

  const topInit = G.homeLineup.find(p => p.pos === 1)?.name || '—';
  const botInit = G.awayLineup.find(p => p.pos === 1)?.name || '—';
  const topCh = G.pitcherChanges
    .filter(c => c.half === 'top')
    .sort((a, b) => a.inning !== b.inning ? a.inning - b.inning : a.order - b.order);
  const botCh = G.pitcherChanges
    .filter(c => c.half === 'bottom')
    .sort((a, b) => a.inning !== b.inning ? a.inning - b.inning : a.order - b.order);

  const pitcherNoMap: Record<string, number> = {};
  const rows: {
    no: number;
    inningKey: string;
    inning: string;
    pitcher: string;
    pitchNum: string;
    batter: string;
    label: string;
    color: string;
    isResult: boolean;
    paResult: string | null;
    paStart: boolean;
  }[] = [];

  for (const cell of cells) {
    const battingLU = cell.half === 'top' ? G.awayLineup : G.homeLineup;
    const batter = battingLU.find(p => p.order === cell.order);
    const changes = cell.half === 'top' ? topCh : botCh;
    const initPitcher = cell.half === 'top' ? topInit : botInit;
    const applicable = changes.filter(ch =>
      ch.inning < cell.inning || (ch.inning === cell.inning && ch.order <= cell.order)
    );
    const pitcher = applicable.length > 0 ? applicable[applicable.length - 1].name : initPitcher;
    const batterName = batter?.name || `${cell.order}번`;
    const inningLabel = `${cell.inning}회${cell.half === 'top' ? '초' : '말'}`;
    const inningKey = `${cell.inning}-${cell.half}`;

    cell.pitches.forEach((pitch, pitchIdx) => {
      pitcherNoMap[pitcher] = (pitcherNoMap[pitcher] ?? 0) + 1;
      rows.push({
        no: pitcherNoMap[pitcher],
        inningKey,
        inning: inningLabel,
        pitcher,
        pitchNum: `${pitchIdx + 1}구`,
        batter: batterName,
        label: PITCH_LABEL[pitch] ?? pitch,
        color: PITCH_COLOR[pitch] ?? '#374151',
        isResult: false,
        paResult: null,
        paStart: pitchIdx === 0,
      });
    });

    if (cell.result) {
      pitcherNoMap[pitcher] = (pitcherNoMap[pitcher] ?? 0) + 1;
      rows.push({
        no: pitcherNoMap[pitcher],
        inningKey,
        inning: inningLabel,
        pitcher,
        pitchNum: `${cell.pitches.length + 1}구`,
        batter: batterName,
        label: 'θ',
        color: '#111',
        isResult: true,
        paResult: cell.result,
        paStart: cell.pitches.length === 0,
      });
    }
  }

  return rows;
}

export default function PitcherLogPanel({ G }: { G: GameState }) {
  const [selInning, setSelInning] = useState<string | null>(null);

  const rows = buildPitcherLog(G);

  // 존재하는 이닝 목록 (순서 유지)
  const inningKeys: string[] = [];
  const inningLabels: Record<string, string> = {};
  for (const r of rows) {
    if (!inningLabels[r.inningKey]) {
      inningKeys.push(r.inningKey);
      inningLabels[r.inningKey] = r.inning;
    }
  }

  const filtered = selInning ? rows.filter(r => r.inningKey === selInning) : rows;

  return (
    <div className="plp">
      <div className="plp-head">
        {inningKeys.length > 0 && (
          <div style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>
            <select
              value={selInning ?? ''}
              onChange={e => setSelInning(e.target.value || null)}
              style={{ fontSize: 11, padding: '2px 4px', borderRadius: 3, border: '1px solid var(--border)', width: '100%', cursor: 'pointer' }}
            >
              <option value=''>전체</option>
              {inningKeys.map(key => (
                <option key={key} value={key}>{inningLabels[key]}</option>
              ))}
            </select>
          </div>
        )}
        <div className="plp-row plp-hdr">
          <div className="plp-cell">no</div>
          <div className="plp-cell">이닝</div>
          <div className="plp-cell">투수</div>
          <div className="plp-cell">투구</div>
          <div className="plp-cell">타자</div>
          <div className="plp-cell">결과</div>
        </div>
      </div>
      <div className="plp-body">
        {filtered.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>기록 없음</div>
        ) : (
          filtered.map((r, i) => (
            <div
              key={i}
              className="plp-row"
              style={{
                borderTop: r.paStart ? '1px solid #cbd5e1' : undefined,
                background: r.isResult ? '#f5f3ff' : undefined,
              }}
            >
              <div className="plp-cell" style={{ color: '#94a3b8' }}>{r.no}</div>
              <div className="plp-cell">{r.paStart ? r.inning : ''}</div>
              <div className="plp-cell" style={{ fontWeight: 600 }}>{r.paStart ? r.pitcher : ''}</div>
              <div className="plp-cell" style={{ color: r.isResult ? '#7c3aed' : '#64748b', fontWeight: r.isResult ? 700 : 400 }}>{r.pitchNum}</div>
              <div className="plp-cell">{r.paStart ? r.batter : ''}</div>
              <div className="plp-cell" style={{ fontWeight: 700, color: r.isResult ? '#7c3aed' : r.color }}>
                {r.paResult ?? r.label}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
