import { useState, useEffect } from 'react';
import type { Player } from '../../types';

const POS_NAME: Record<number, string> = {
  1: '투수', 2: '포수', 3: '1루수', 4: '2루수', 5: '3루수',
  6: '유격수', 7: '좌익수', 8: '중견수', 9: '우익수',
};

const DIR_OPTS = ['중앙', '좌', '우', '내야', '외야', '—'];

interface FielderRow {
  pos: number;
  assist: boolean;    // 보살
  putout: boolean;    // 자살
  error: boolean;     // 실책
  throwDir: string;   // 송구방향
  recvDir: string;    // 수구방향
  defl: boolean;      // 디플렉션
  shift: boolean;     // 시프트
}

interface Props {
  open: boolean;
  result: string;        // e.g., "6-3", "DP6-4-3"
  defLU: Player[];
  onClose: () => void;
}

function parseFielders(result: string): number[] {
  // Extract digit sequences from result (e.g., "DP6-4-3" → [6,4,3], "F8" → [8], "6-3" → [6,3])
  const digits = result.replace(/[^0-9-]/g, '').split('-').map(Number).filter((n) => n >= 1 && n <= 9);
  return [...new Set(digits)]; // unique positions in order
}

function makeInitialRows(positions: number[], defLU: Player[]): FielderRow[] {
  return positions.map((pos, i) => ({
    pos,
    assist: i < positions.length - 1,  // all but last get assist by default
    putout: i === positions.length - 1, // last gets putout by default
    error: false,
    throwDir: '중앙',
    recvDir: '중앙',
    defl: false,
    shift: false,
  }));
}

export default function DefenseListModal({ open, result, defLU, onClose }: Props) {
  const positions = parseFielders(result);
  const [rows, setRows] = useState<FielderRow[]>([]);
  const [수비시정, set수비시정] = useState(false);

  useEffect(() => {
    if (open) {
      setRows(makeInitialRows(positions, defLU));
      set수비시정(false);
    }
  }, [open, result]);

  const update = (i: number, patch: Partial<FielderRow>) => {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };

  const toggle = (i: number, field: 'assist' | 'putout' | 'error' | 'defl' | 'shift') => {
    update(i, { [field]: !rows[i][field] } as Partial<FielderRow>);
  };

  if (!open) return null;

  const tdStyle: React.CSSProperties = {
    border: '1px solid var(--border2)', padding: '3px 5px', textAlign: 'center', fontSize: 11, whiteSpace: 'nowrap',
  };
  const thStyle: React.CSSProperties = {
    ...tdStyle, background: 'var(--panel2)', fontWeight: 700, fontSize: 10,
  };

  return (
    <div className="ov open" id="ov-def-list">
      <div className="ov-card" style={{ minWidth: 560 }}>
        {/* Title */}
        <div className="modal-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>수비 리스트 {result}</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 400, cursor: 'pointer' }}>
            <input type="checkbox" checked={수비시정} onChange={(e) => set수비시정(e.target.checked)}
              style={{ accentColor: 'var(--blue)' }} />
            수비 시정
          </label>
        </div>

        {/* Table */}
        <div style={{ padding: '10px 12px' }}>
          {positions.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
              수비 수비수가 없습니다.
            </div>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, minWidth: 54 }}>수비</th>
                  <th style={{ ...thStyle, minWidth: 54 }}>선수명</th>
                  <th style={thStyle}>보살</th>
                  <th style={thStyle}>자살</th>
                  <th style={thStyle}>실책</th>
                  <th style={{ ...thStyle, minWidth: 70 }}>송구방향</th>
                  <th style={{ ...thStyle, minWidth: 70 }}>수구방향</th>
                  <th style={thStyle}>디플렉션</th>
                  <th style={thStyle}>시프트</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const p = defLU.find((pl) => pl.pos === row.pos);
                  const rowBg = i % 2 === 0 ? '#fff' : '#f8fafc';
                  const selBg = '#dbeafe';
                  return (
                    <tr key={i} style={{ background: rowBg }}>
                      <td style={{ ...tdStyle, background: selBg, fontWeight: 700 }}>{POS_NAME[row.pos] || row.pos}</td>
                      <td style={{ ...tdStyle, background: selBg }}>{p?.name || '—'}</td>
                      <td style={tdStyle}>
                        <input type="checkbox" checked={row.assist} onChange={() => toggle(i, 'assist')}
                          style={{ accentColor: 'var(--blue)' }} />
                      </td>
                      <td style={tdStyle}>
                        <input type="checkbox" checked={row.putout} onChange={() => toggle(i, 'putout')}
                          style={{ accentColor: 'var(--blue)' }} />
                      </td>
                      <td style={tdStyle}>
                        <input type="checkbox" checked={row.error} onChange={() => toggle(i, 'error')}
                          style={{ accentColor: 'var(--red)' }} />
                      </td>
                      <td style={tdStyle}>
                        <select value={row.throwDir} onChange={(e) => update(i, { throwDir: e.target.value })}
                          style={{ fontSize: 10, border: '1px solid var(--border2)', borderRadius: 2, padding: '1px 2px' }}>
                          {DIR_OPTS.map((d) => <option key={d}>{d}</option>)}
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <select value={row.recvDir} onChange={(e) => update(i, { recvDir: e.target.value })}
                          style={{ fontSize: 10, border: '1px solid var(--border2)', borderRadius: 2, padding: '1px 2px' }}>
                          {DIR_OPTS.map((d) => <option key={d}>{d}</option>)}
                        </select>
                      </td>
                      <td style={tdStyle}>
                        <input type="checkbox" checked={row.defl} onChange={() => toggle(i, 'defl')}
                          style={{ accentColor: 'var(--purple)' }} />
                      </td>
                      <td style={tdStyle}>
                        <input type="checkbox" checked={row.shift} onChange={() => toggle(i, 'shift')}
                          style={{ accentColor: 'var(--text3)' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-ok" onClick={onClose}>확인</button>
          <button className="btn-cancel" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}
