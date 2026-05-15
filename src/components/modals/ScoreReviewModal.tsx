import { useState, useEffect } from 'react';
import type { CellData, Half, Player } from '../../types';

// 한 행에 표시할 득점 정보 — cellKey 기준
export interface ScoredRunRow {
  cellKey: string;
  runnerName: string; // 득점한 주자 이름
  runnerOrder: number; // 득점 주자의 타순
  causedByName: string; // 시점 타자 이름 (없을 수 있음 — 도루 등)
  causedByOrder?: number;
  earned: boolean | 'half';
  scorePitcher: string;
}

interface Props {
  open: boolean;
  inning: number;
  half: Half;
  rows: ScoredRunRow[]; // 표시할 득점 행
  pitcherList: Player[]; // 해당 half에서 등판 가능한 투수 목록
  onSave: (
    edits: { cellKey: string; newEarned: boolean | 'half'; newScorePitcher?: string }[]
  ) => void;
  onClose: () => void;
}

interface RowState {
  cellKey: string;
  earned: boolean | 'half';
  scorePitcher: string;
}

const halfLabel = (h: Half) => (h === 'top' ? '초' : '말');

export default function ScoreReviewModal({
  open,
  inning,
  half,
  rows,
  pitcherList,
  onSave,
  onClose,
}: Props) {
  const [state, setState] = useState<RowState[]>([]);

  // 모달 열릴 때만 props 기준으로 초기화 — rows reference가 부모 렌더마다 바뀌므로
  // [open]만 의존: open 트랜지션(false→true)에서 1회만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) {
      setState(
        rows.map((r) => ({
          cellKey: r.cellKey,
          earned: r.earned,
          scorePitcher: r.scorePitcher,
        }))
      );
    }
  }, [open]);

  const update = (idx: number, patch: Partial<RowState>) =>
    setState((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  // 변경된 행만 추출
  const handleConfirm = () => {
    const edits = state
      .map((s, i) => {
        const orig = rows[i];
        if (!orig) return null;
        if (s.earned === orig.earned && s.scorePitcher === orig.scorePitcher) return null;
        return {
          cellKey: s.cellKey,
          newEarned: s.earned,
          newScorePitcher: s.scorePitcher,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    onSave(edits);
  };

  // 합계
  const sum = state.reduce(
    (acc, r) => {
      if (r.earned === true) acc.er++;
      else if (r.earned === 'half') acc.half++;
      else acc.uer++;
      return acc;
    },
    { er: 0, uer: 0, half: 0 }
  );

  if (!open) return null;

  return (
    <div className="ov open" id="ov-score-review">
      <div
        className="ov-card"
        style={{ minWidth: 640, maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto' }}
      >
        <div className="modal-title">
          이닝 득점 검토 — {inning}회 {halfLabel(half)}
        </div>

        <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text2)' }}>
          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20 }}>이 이닝에 득점 없음</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['#', '득점 주자', '시점 타자', '자책 여부', '실점 투수'].map((h) => (
                    <th
                      key={h}
                      style={{
                        background: '#dce7f4',
                        border: '1px solid var(--border2)',
                        padding: '5px 6px',
                        fontWeight: 700,
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
                {rows.map((r, i) => {
                  const s = state[i];
                  if (!s) return null;
                  return (
                    <tr key={r.cellKey}>
                      <td
                        style={{
                          border: '1px solid var(--border2)',
                          padding: '5px 6px',
                          textAlign: 'center',
                          fontWeight: 700,
                        }}
                      >
                        {i + 1}
                      </td>
                      <td style={{ border: '1px solid var(--border2)', padding: '5px 8px' }}>
                        {r.runnerName} ({r.runnerOrder})
                      </td>
                      <td style={{ border: '1px solid var(--border2)', padding: '5px 8px' }}>
                        {r.causedByName
                          ? `${r.causedByName}${r.causedByOrder ? ` (${r.causedByOrder})` : ''}`
                          : '—'}
                      </td>
                      <td
                        style={{
                          border: '1px solid var(--border2)',
                          padding: '5px 6px',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          {(
                            [
                              { v: false, lbl: '비자책', col: 'var(--blue)' },
                              { v: true, lbl: '자책', col: 'var(--red)' },
                              { v: 'half', lbl: '반자책', col: '#d97706' },
                            ] as { v: boolean | 'half'; lbl: string; col: string }[]
                          ).map(({ v, lbl, col }) => {
                            const sel = s.earned === v;
                            return (
                              <button
                                key={lbl}
                                type="button"
                                onClick={() => update(i, { earned: v })}
                                style={{
                                  flex: 1,
                                  padding: '3px 4px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  border: `1.5px solid ${sel ? col : 'var(--border)'}`,
                                  background: sel ? col : '#fff',
                                  color: sel ? '#fff' : 'var(--text)',
                                  borderRadius: 3,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {lbl}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td style={{ border: '1px solid var(--border2)', padding: '5px 6px' }}>
                        <select
                          value={s.scorePitcher}
                          onChange={(e) => update(i, { scorePitcher: e.target.value })}
                          style={{
                            width: '100%',
                            fontSize: 11,
                            padding: '3px 4px',
                            border: '1px solid var(--border)',
                            borderRadius: 2,
                          }}
                        >
                          <option value="">투수 선택...</option>
                          {pitcherList.map((p, j) => {
                            const v = `${p.name}(${p.num})`;
                            return (
                              <option key={j} value={v}>
                                {v}
                              </option>
                            );
                          })}
                          {/* 현재 등록된 실점투수가 목록에 없으면 임시 옵션으로 표시 (이전 등판 투수 등) */}
                          {s.scorePitcher &&
                            !pitcherList.find((p) => `${p.name}(${p.num})` === s.scorePitcher) && (
                              <option value={s.scorePitcher}>{s.scorePitcher}</option>
                            )}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {rows.length > 0 && (
          <div
            style={{
              padding: '8px 12px',
              fontSize: 12,
              borderTop: '1px solid var(--border2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text2)' }}>
              합계: <span style={{ color: 'var(--red)', fontWeight: 700 }}>자책 {sum.er}</span>
              {' / '}
              <span style={{ color: 'var(--blue)', fontWeight: 700 }}>비자책 {sum.uer}</span>
              {' / '}
              <span style={{ color: '#d97706', fontWeight: 700 }}>반자책 {sum.half}</span>
            </span>
          </div>
        )}

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

// CellData 들에서 ScoredRunRow 추출 헬퍼
export function buildScoredRunRows(
  cells: Record<string, CellData>,
  inning: number,
  half: Half,
  lineup: Player[]
): ScoredRunRow[] {
  const lineupAway = lineup; // host 측에서 적절히 전달
  const findName = (order?: number) => {
    if (!order) return '';
    const p = lineupAway.find((x) => x.order === order);
    return p?.name || '';
  };
  return Object.values(cells)
    .filter((c) => c.scored && c.inning === inning && c.half === half)
    .map((c) => {
      // HOME runnerNote에서 causedBy 찾기
      const homeNote = (c.runnerNotes || []).find((n) => n.base === 'HOME');
      const causedBy = homeNote?.causedBy;
      return {
        cellKey: `${c.half}-${c.inning}-${c.order}-${c.appearance}`,
        runnerName: findName(c.order),
        runnerOrder: c.order,
        causedByName: causedBy ? findName(causedBy) : '',
        causedByOrder: causedBy,
        earned: c.earned ?? false,
        scorePitcher: c.scorePitcher || '',
      };
    });
}
