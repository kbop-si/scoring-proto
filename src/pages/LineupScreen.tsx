import { useState } from 'react';
import type { Player, GameSetup } from '../types';
import { POS_NAME, POS_ABBR, SAMPLE } from '../data/constants';

interface LineupState {
  awayLineup: Player[];
  homeLineup: Player[];
  awayBench: Player[];
  homeBench: Player[];
}

interface Props {
  setup: GameSetup;
  onUpdateLineups: (al: Player[], hl: Player[], ab: Player[], hb: Player[]) => void;
  onStart: () => void;
}

export default function LineupScreen({ setup, onUpdateLineups, onStart }: Props) {
  const [luTeam, setLuTeam] = useState<'away' | 'home'>('away');
  const [luSelIdx, setLuSelIdx] = useState<number | null>(null);
  const [benchSelIdx, setBenchSelIdx] = useState<number | null>(null);
  const [srchName, setSrchName] = useState('');
  const [srchNum, setSrchNum] = useState('');

  const [ls, setLs] = useState<LineupState>({
    awayLineup: setup.awayLineup,
    homeLineup: setup.homeLineup,
    awayBench: setup.awayBench,
    homeBench: setup.homeBench,
  });

  const BLUE = '#102C57';
  const REQUIRED_POSITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

  const lu = luTeam === 'away' ? ls.awayLineup : ls.homeLineup;
  const bench = luTeam === 'away' ? ls.awayBench : ls.homeBench;
  const luKey = luTeam === 'away' ? 'awayLineup' : 'homeLineup';
  const benchKey = luTeam === 'away' ? 'awayBench' : 'homeBench';

  const filteredBench = bench
    .map((p, originalIndex) => ({ p, originalIndex }))
    .filter(
      ({ p }) =>
        (!srchName || p.name.toLowerCase().includes(srchName.toLowerCase())) &&
        (!srchNum || String(p.num).includes(srchNum))
    );

  const updateLU = (newLu: Player[]) => setLs((s) => ({ ...s, [luKey]: newLu }));
  const updateBoth = (newLu: Player[], newBench: Player[]) =>
    setLs((s) => ({ ...s, [luKey]: newLu, [benchKey]: newBench }));

  const posLabel = (pos: number) => {
    if (pos === 0) return 'D 지명타자';
    return `${pos} ${POS_NAME[pos]}`;
  };

  const getMissingPositions = (lineup: Player[]) => {
    const used = new Set(lineup.map((p) => p.pos));
    return REQUIRED_POSITIONS.filter((pos) => !used.has(pos));
  };

  const validateLineup = (teamName: string, lineup: Player[]) => {
    const missing = getMissingPositions(lineup);

    if (missing.length > 0) {
      const message = missing.map((pos) => `${posLabel(pos)}가 없습니다`).join('\n');
      alert(`${teamName} 라인업에 ${message}`);
      return false;
    }

    return true;
  };

  const handleChangePOS = (idx: number, pos: number) => {
    const newLu = [...lu];
    newLu[idx] = { ...newLu[idx], pos };
    updateLU(newLu);
  };

  const handleChangeOrder = (idx: number, val: number) => {
    const num = Math.max(0, Math.min(9, isNaN(val) ? 0 : val));
    const newLu = [...lu];
    newLu[idx] = { ...newLu[idx], order: num, ...(num === 0 ? { pos: 1 } : {}) };
    updateLU(newLu);
  };

  const handleAddBench = (benchIdx: number, luIdx: number | null) => {
    const newLu = [...lu];
    const newBench = [...bench];
    const p = newBench[benchIdx];

    if (!p) return;

    if (luIdx !== null && luIdx < newLu.length) {
      const old = newLu[luIdx];
      newLu[luIdx] = { ...p, order: old.order, pos: old.pos };
      newBench.push({ ...old });
      newBench.splice(benchIdx, 1);
      setLuSelIdx(null);
    } else {
      if (newLu.length >= 10) return;
      newLu.push({ ...p, order: newLu.length + 1 });
      newBench.splice(benchIdx, 1);
    }

    setBenchSelIdx(null);
    updateBoth(newLu, newBench);
  };

  const handleDeleteLu = () => {
    if (luSelIdx === null) return;

    const newLu = [...lu];
    const newBench = [...bench];
    const [rm] = newLu.splice(luSelIdx, 1);

    newLu.forEach((p, i) => {
      p.order = i + 1;
    });

    newBench.push(rm);
    setLuSelIdx(null);
    updateBoth(newLu, newBench);
  };

  const handleAddPitcher = () => {
    if (lu.length >= 10) return;

    if (benchSelIdx !== null) {
      const newLu = [...lu];
      const newBench = [...bench];
      const p = newBench[benchSelIdx];

      if (!p) return;

      newLu.push({ ...p, order: 0, pos: 1 });
      newBench.splice(benchSelIdx, 1);
      setBenchSelIdx(null);
      updateBoth(newLu, newBench);
    } else {
      updateLU([
        ...lu,
        {
          name: '투수',
          num: 'P',
          pos: 1,
          order: 0,
          hitType: 0,
        },
      ]);
    }
  };

  const handleRestore = () => {
    if (!confirm('원래 라인업으로 복원?')) return;

    setLs({
      awayLineup: [
        ...SAMPLE.away.slice(0, 9).map((p, i) => ({ ...p, order: i + 1 })),
        { ...SAMPLE.away[9], order: 0 },
      ],
      homeLineup: [
        ...SAMPLE.home.slice(0, 9).map((p, i) => ({ ...p, order: i + 1 })),
        { ...SAMPLE.home[9], order: 0 },
      ],
      awayBench: SAMPLE.away.slice(10),
      homeBench: SAMPLE.home.slice(10),
    });

    setLuSelIdx(null);
    setBenchSelIdx(null);
  };

  const handleStart = () => {
    if (!validateLineup(setup.awayTeam || '원정팀', ls.awayLineup)) return;
    if (!validateLineup(setup.homeTeam || '홈팀', ls.homeLineup)) return;

    onUpdateLineups(ls.awayLineup, ls.homeLineup, ls.awayBench, ls.homeBench);
    onStart();
  };

  const switchTeam = (t: 'away' | 'home') => {
    setLuTeam(t);
    setLuSelIdx(null);
    setBenchSelIdx(null);
  };

  const panelStyle: React.CSSProperties = {
    border: `1px solid ${BLUE}`,
    borderRadius: 6,
    background: '#ffffff',
    padding: 14,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: BLUE,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: `1px solid ${BLUE}`,
  };

  const thStyle: React.CSSProperties = {
    borderBottom: `1px solid ${BLUE}`,
    color: '#ffffff',
    background: BLUE,
    fontSize: 12,
    fontWeight: 700,
    padding: '8px 6px',
    textAlign: 'center',
  };

  const tdStyle: React.CSSProperties = {
    borderBottom: `1px solid rgba(16,44,87,0.15)`,
    padding: '8px 6px',
    fontSize: 12,
    color: BLUE,
    textAlign: 'center',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 30,
    border: `1px solid ${BLUE}`,
    padding: '0 8px',
    boxSizing: 'border-box',
    color: BLUE,
    background: '#ffffff',
  };

  const smallBtn = (filled = false): React.CSSProperties => ({
    height: 32,
    padding: '0 12px',
    border: `1px solid ${BLUE}`,
    background: filled ? BLUE : '#ffffff',
    color: filled ? '#ffffff' : BLUE,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  return (
    <div
      className="screen active"
      id="s-lineup"
      style={{
        height: '100vh',
        background: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'stretch',
      }}
    >
      <div
        className="lineup-wrap"
        style={{
          width: '100%',
          maxWidth: 1400,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="lineup-toolbar"
          style={{
            background: BLUE,
            color: '#ffffff',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700 }}>라인업 입력</div>

          <span style={{ fontSize: 12, opacity: 0.95 }}>팀 선택:</span>

          <label style={{ cursor: 'pointer', fontSize: 12 }}>
            <input
              type="radio"
              name="lu-team"
              value="away"
              checked={luTeam === 'away'}
              onChange={() => switchTeam('away')}
            />{' '}
            {setup.awayTeam || '원정'}
          </label>

          <label style={{ cursor: 'pointer', fontSize: 12 }}>
            <input
              type="radio"
              name="lu-team"
              value="home"
              checked={luTeam === 'home'}
              onChange={() => switchTeam('home')}
            />{' '}
            {setup.homeTeam || '홈팀'}
          </label>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button style={smallBtn(false)}>라인업 로딩</button>
            <button style={smallBtn(false)}>라인업 저장</button>
            <button style={smallBtn(true)} onClick={handleStart}>
              ▶ 경기시작
            </button>
          </div>
        </div>

        <div
          className="lineup-body"
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '1.15fr 260px 1fr',
            gap: 16,
            padding: 16,
            boxSizing: 'border-box',
          }}
        >
          <div className="lu-pane" style={panelStyle}>
            <div style={sectionTitleStyle}>
              라인업{' '}
              <span
                style={{
                  display: 'inline-block',
                  marginLeft: 8,
                  background: BLUE,
                  color: '#ffffff',
                  padding: '2px 10px',
                  borderRadius: 3,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {luTeam === 'away' ? setup.awayTeam : setup.homeTeam}
              </span>
            </div>

            <table className="lu-tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>타순</th>
                  <th style={thStyle}>수비</th>
                  <th style={thStyle}>선수명</th>
                  <th style={thStyle}>등번호</th>
                </tr>
              </thead>
              <tbody>
                {lu.map((p, i) => {
                  const isSel = luSelIdx === i;

                  return (
                    <tr
                      key={i}
                      onClick={() => setLuSelIdx(luSelIdx === i ? null : i)}
                      style={{
                        background: isSel ? 'rgba(16,44,87,0.08)' : '#ffffff',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={tdStyle}>
                        <input
                          type="number"
                          min={0}
                          max={9}
                          value={p.order}
                          style={{
                            width: 42,
                            height: 28,
                            border: `1px solid ${BLUE}`,
                            textAlign: 'center',
                            color: BLUE,
                            background: '#ffffff',
                          }}
                          onChange={(e) => handleChangeOrder(i, parseInt(e.target.value))}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>

                      <td style={tdStyle}>
                        <select
                          value={p.pos}
                          onChange={(e) => handleChangePOS(i, +e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            height: 28,
                            border: `1px solid ${BLUE}`,
                            color: BLUE,
                            background: '#ffffff',
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

            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                style={smallBtn(false)}
                onClick={() => benchSelIdx !== null && handleAddBench(benchSelIdx, luSelIdx)}
              >
                선수추가
              </button>
              <button style={smallBtn(false)} onClick={handleAddPitcher}>
                투수타석
              </button>
              <button style={smallBtn(false)} onClick={handleDeleteLu}>
                삭제
              </button>
            </div>
          </div>

          <div className="lu-mid" style={panelStyle}>
            <div style={sectionTitleStyle}>선수 검색</div>

            <button
              style={{ ...smallBtn(false), width: '100%', marginBottom: 12 }}
              onClick={handleRestore}
            >
              원래대로
            </button>

            <div style={{ fontSize: 12, color: BLUE, fontWeight: 700, marginBottom: 4 }}>
              선수명
            </div>
            <input
              style={{ ...inputStyle, marginBottom: 10 }}
              value={srchName}
              onChange={(e) => setSrchName(e.target.value)}
            />

            <div style={{ fontSize: 12, color: BLUE, fontWeight: 700, marginBottom: 4 }}>
              등번호
            </div>
            <input
              style={{ ...inputStyle, marginBottom: 12 }}
              value={srchNum}
              onChange={(e) => setSrchNum(e.target.value)}
            />

            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ ...smallBtn(true), flex: 1 }}>검색</button>
              <button
                style={{ ...smallBtn(false), flex: 1 }}
                onClick={() => {
                  setSrchName('');
                  setSrchNum('');
                }}
              >
                초기화
              </button>
            </div>
          </div>

          <div className="lu-pane" style={panelStyle}>
            <div style={sectionTitleStyle}>벤치</div>

            <table className="lu-tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>선수명</th>
                  <th style={thStyle}>등번호</th>
                  <th style={thStyle}>포지션</th>
                  <th style={thStyle}>미출장</th>
                </tr>
              </thead>
              <tbody>
                {filteredBench.map(({ p, originalIndex }) => {
                  const isSel = benchSelIdx === originalIndex;

                  return (
                    <tr
                      key={originalIndex}
                      onClick={() =>
                        setBenchSelIdx(benchSelIdx === originalIndex ? null : originalIndex)
                      }
                      onDoubleClick={() => handleAddBench(originalIndex, luSelIdx)}
                      style={{
                        background: isSel ? 'rgba(16,44,87,0.08)' : '#ffffff',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={tdStyle}>{p.name}</td>
                      <td style={tdStyle}>{p.num}</td>
                      <td style={tdStyle}>{POS_ABBR[p.pos] || ''}</td>
                      <td style={tdStyle}>
                        <input type="checkbox" readOnly />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
