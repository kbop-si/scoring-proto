import { useState } from 'react';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import type { GameSetup } from '../types';

interface Props {
  setup: GameSetup;
  onConfirm: (extra: Partial<GameSetup>) => void;
  onBack: () => void;
}

export default function GameInfoScreen({ setup, onConfirm, onBack }: Props) {
  const BLUE = '#102C57';

  const gameKey = `${setup.date
    .replace(/[년월일 (요일)]/g, '')
    .substring(0, 8)}${setup.awayTeam.substring(0, 2)}${setup.homeTeam.substring(0, 2)}0`;

  const [gameNum, setGameNum] = useState(setup.gameNum ?? '1');
  const [startTime, setStartTime] = useState(setup.startTime ?? '');
  const [endTime, setEndTime] = useState(setup.endTime ?? '');
  const [stadium, setStadium] = useState(setup.stadium ?? '');
  const [attendance, setAttendance] = useState(setup.attendance ?? '');
  const [temperature, setTemperature] = useState(setup.temperature ?? '');
  const [humidity, setHumidity] = useState(setup.humidity ?? '');
  const [windDir, setWindDir] = useState(setup.windDir ?? '');
  const [windSpeed, setWindSpeed] = useState(setup.windSpeed ?? '');
  const [umpireHome, setUmpireHome] = useState(setup.umpireHome ?? '');
  const [umpire1B, setUmpire1B] = useState(setup.umpire1B ?? '');
  const [umpire2B, setUmpire2B] = useState(setup.umpire2B ?? '');
  const [umpire3B, setUmpire3B] = useState(setup.umpire3B ?? '');
  const [umpireLeft, setUmpireLeft] = useState(setup.umpireLeft ?? '');
  const [umpireRight, setUmpireRight] = useState(setup.umpireRight ?? '');
  const [umpireStandby, setUmpireStandby] = useState(setup.umpireStandby ?? '');
  const [recorder1, setRecorder1] = useState(setup.recorder1 ?? '');
  const [recorder2, setRecorder2] = useState(setup.recorder2 ?? '');

  // 심판 기록원 리스트 임시
  const officialOptions = [
    '',
    '김철수',
    '이영희',
    '박민수',
    '최지훈',
    '정우성',
    '강동원',
    '오시현',
    '윤태훈',
  ];

  const handleConfirm = () => {
    onConfirm({
      gameNum,
      startTime,
      endTime,
      stadium,
      attendance,
      temperature,
      humidity,
      windDir,
      windSpeed,
      umpireHome,
      umpire1B,
      umpire2B,
      umpire3B,
      umpireLeft,
      umpireRight,
      umpireStandby,
      recorder1,
      recorder2,
    });
  };

  const sectionTitleStyle: CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: BLUE,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottom: `1px solid ${BLUE}`,
  };

  const tdLabel: CSSProperties = {
    padding: '5px 8px 5px 0',
    color: BLUE,
    fontWeight: 700,
    fontSize: 12,
    whiteSpace: 'nowrap',
    width: 72,
  };

  const tdInput: CSSProperties = { padding: '5px 0' };

  const inputSt: CSSProperties = {
    width: '100%',
    height: 30,
    border: `1px solid ${BLUE}`,
    padding: '0 8px',
    background: '#ffffff',
    color: BLUE,
    boxSizing: 'border-box',
    outline: 'none',
    fontSize: 12,
  };

  const readonlySt: CSSProperties = {
    ...inputSt,
    background: '#f1f5f9',
    color: '#64748b',
  };

  const selectSt: CSSProperties = {
    ...inputSt,
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    cursor: 'pointer',
  };

  const renderSelectRow = (
    label: string,
    value: string,
    setter: Dispatch<SetStateAction<string>>
  ) => (
    <tr key={label}>
      <td style={tdLabel}>{label}</td>
      <td style={tdInput}>
        <select value={value} onChange={(e) => setter(e.target.value)} style={selectSt}>
          <option value="">선택</option>
          {officialOptions
            .filter((name) => name !== '')
            .map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
        </select>
      </td>
    </tr>
  );

  return (
    <div
      className="screen active"
      id="s-gameinfo"
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
          width: 820,
          maxWidth: '95vw',
          border: `1px solid ${BLUE}`,
          borderRadius: 6,
          background: '#ffffff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: BLUE,
            color: '#ffffff',
            fontSize: 15,
            fontWeight: 700,
            padding: '11px 16px',
          }}
        >
          게임정보입력
        </div>

        <div
          style={{
            padding: '16px 20px 12px',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 100px)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 20,
              alignItems: 'start',
            }}
          >
            <div>
              <div style={sectionTitleStyle}>명칭</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
                <tbody>
                  <tr>
                    <td style={tdLabel}>게임키</td>
                    <td style={tdInput}>
                      <input value={gameKey} readOnly style={readonlySt} />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>차전</td>
                    <td style={tdInput}>
                      <input
                        value={gameNum}
                        onChange={(e) => setGameNum(e.target.value)}
                        style={inputSt}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>구장명</td>
                    <td style={tdInput}>
                      <input
                        value={stadium}
                        onChange={(e) => setStadium(e.target.value)}
                        style={inputSt}
                        placeholder="구장 입력"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={sectionTitleStyle}>시간</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
                <tbody>
                  <tr>
                    <td style={tdLabel}>서기</td>
                    <td style={tdInput}>
                      <input value={setup.date} readOnly style={readonlySt} />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>시합개시</td>
                    <td style={tdInput}>
                      <input
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        style={inputSt}
                        placeholder="HH:MM"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>경기종료</td>
                    <td style={tdInput}>
                      <input
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        style={inputSt}
                        placeholder="HH:MM"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>관중수</td>
                    <td style={tdInput}>
                      <input
                        value={attendance}
                        onChange={(e) => setAttendance(e.target.value)}
                        style={inputSt}
                        placeholder="명"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={sectionTitleStyle}>기상</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={tdLabel}>온도</td>
                    <td style={tdInput}>
                      <input
                        value={temperature}
                        onChange={(e) => setTemperature(e.target.value)}
                        style={inputSt}
                        placeholder="℃"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>습도</td>
                    <td style={tdInput}>
                      <input
                        value={humidity}
                        onChange={(e) => setHumidity(e.target.value)}
                        style={inputSt}
                        placeholder="%"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>바람방향</td>
                    <td style={tdInput}>
                      <input
                        value={windDir}
                        onChange={(e) => setWindDir(e.target.value)}
                        style={inputSt}
                        placeholder="예: 북동"
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>풍속</td>
                    <td style={tdInput}>
                      <input
                        value={windSpeed}
                        onChange={(e) => setWindSpeed(e.target.value)}
                        style={inputSt}
                        placeholder="m/s"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <div style={sectionTitleStyle}>심판</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {renderSelectRow('주심', umpireHome, setUmpireHome)}
                  {renderSelectRow('1루심', umpire1B, setUmpire1B)}
                  {renderSelectRow('2루심', umpire2B, setUmpire2B)}
                  {renderSelectRow('3루심', umpire3B, setUmpire3B)}
                  {renderSelectRow('좌선심', umpireLeft, setUmpireLeft)}
                  {renderSelectRow('우선심', umpireRight, setUmpireRight)}
                  {renderSelectRow('대기심', umpireStandby, setUmpireStandby)}
                </tbody>
              </table>
            </div>

            <div>
              <div style={sectionTitleStyle}>기록원</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
                <tbody>
                  {renderSelectRow('기록원1', recorder1, setRecorder1)}
                  {renderSelectRow('기록원2', recorder2, setRecorder2)}
                </tbody>
              </table>

              <div style={sectionTitleStyle}>경기 정보</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={tdLabel}>리그</td>
                    <td style={tdInput}>
                      <input value={setup.league} readOnly style={readonlySt} />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>원정</td>
                    <td style={tdInput}>
                      <input value={setup.awayTeam} readOnly style={readonlySt} />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>홈</td>
                    <td style={tdInput}>
                      <input value={setup.homeTeam} readOnly style={readonlySt} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: `1px solid ${BLUE}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            <button
              onClick={handleConfirm}
              style={{
                minWidth: 72,
                height: 32,
                background: BLUE,
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              확인
            </button>
            <button
              onClick={onBack}
              style={{
                minWidth: 72,
                height: 32,
                background: '#ffffff',
                color: BLUE,
                border: `1px solid ${BLUE}`,
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 13,
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
