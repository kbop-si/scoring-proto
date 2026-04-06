import { useState } from 'react';
import type { GameSetup } from '../types';
import { KBO_TEAMS, WEEK } from '../data/constants';
import Calendar from '../components/Calendar';

interface Props {
  setup: GameSetup;
  onConfirm: (awayTeam: string, homeTeam: string, date: string) => void;
  onBack: () => void;
}

function fmtDate(y: number, m: number, d: number): string {
  const dt = new Date(y, m - 1, d);
  return `${y}년 ${String(m).padStart(2, '0')}월 ${String(d).padStart(2, '0')}일 (${WEEK[dt.getDay()]})`;
}

export default function CreateScreen({ setup, onConfirm, onBack }: Props) {
  const today = new Date();
  const [date, setDate] = useState(() =>
    fmtDate(today.getFullYear(), today.getMonth() + 1, today.getDate())
  );
  const [awayTeam, setAwayTeam] = useState(setup.awayTeam || KBO_TEAMS[0]);
  const [homeTeam, setHomeTeam] = useState(setup.homeTeam || KBO_TEAMS[1]);
  const [calOpen, setCalOpen] = useState(false);

  const BLUE = '#102C57';

  const handlePickDate = (y: number, m: number, d: number) => {
    setDate(fmtDate(y, m, d));
    setCalOpen(false);
  };

  const labelStyle: React.CSSProperties = {
    padding: '8px 6px',
    color: BLUE,
    fontWeight: 700,
    fontSize: 13,
    whiteSpace: 'nowrap',
    width: 110,
  };

  const fieldWrapStyle: React.CSSProperties = {
    padding: '8px 6px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 32,
    border: `1px solid ${BLUE}`,
    padding: '0 10px',
    background: '#ffffff',
    color: BLUE,
    boxSizing: 'border-box',
    outline: 'none',
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    height: 32,
    border: `1px solid ${BLUE}`,
    padding: '0 10px',
    background: '#ffffff',
    color: BLUE,
    boxSizing: 'border-box',
    outline: 'none',
  };

  return (
    <div
      className="screen active"
      id="s-create"
      style={{
        height: '100vh',
        background: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        className="modal-box"
        style={{
          width: 520,
          maxWidth: '92vw',
          border: `1px solid ${BLUE}`,
          borderRadius: 6,
          background: '#ffffff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}
      >
        {/* 타이틀 바 */}
        <div
          style={{
            background: BLUE,
            color: '#ffffff',
            fontSize: 16,
            fontWeight: 700,
            padding: '12px 16px',
          }}
        >
          경기 생성
        </div>

        {/* 본문 */}
        <div
          className="modal-body"
          style={{
            padding: '18px 22px 14px 22px',
          }}
        >
          <table
            className="form-tbl"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
            }}
          >
            <tbody>
              <tr>
                <td style={labelStyle}>서기</td>
                <td style={{ ...fieldWrapStyle, position: 'relative' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="text"
                      value={date}
                      readOnly
                      onClick={() => setCalOpen((v) => !v)}
                      style={{
                        ...inputStyle,
                        cursor: 'pointer',
                      }}
                    />
                    <button
                      onClick={() => setCalOpen((v) => !v)}
                      style={{
                        width: 38,
                        height: 32,
                        border: `1px solid ${BLUE}`,
                        background: '#ffffff',
                        color: BLUE,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      📅
                    </button>
                  </div>

                  {calOpen && (
                    <Calendar
                      selectedDate={date}
                      onPick={handlePickDate}
                      onClose={() => setCalOpen(false)}
                    />
                  )}
                </td>
              </tr>

              <tr>
                <td style={labelStyle}>원정팀</td>
                <td style={fieldWrapStyle}>
                  <select
                    value={awayTeam}
                    onChange={(e) => setAwayTeam(e.target.value)}
                    style={selectStyle}
                  >
                    {KBO_TEAMS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </td>
              </tr>

              <tr>
                <td style={labelStyle}>홈팀</td>
                <td style={fieldWrapStyle}>
                  <select
                    value={homeTeam}
                    onChange={(e) => setHomeTeam(e.target.value)}
                    style={selectStyle}
                  >
                    {KBO_TEAMS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </td>
              </tr>

              <tr>
                <td style={labelStyle}>더블헤더(DH)</td>
                <td style={fieldWrapStyle}>
                  <select style={selectStyle}>
                    <option>--------</option>
                    <option>1차전</option>
                    <option>2차전</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 버튼 영역 */}
          <div
            className="modal-footer"
            style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: `1px solid ${BLUE}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            <button
              onClick={() => onConfirm(awayTeam, homeTeam, date)}
              style={{
                minWidth: 72,
                height: 34,
                background: BLUE,
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              확인
            </button>

            <button
              onClick={onBack}
              style={{
                minWidth: 72,
                height: 34,
                background: '#ffffff',
                color: BLUE,
                border: `1px solid ${BLUE}`,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}