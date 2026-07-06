import { useState, useMemo, useRef, useEffect } from 'react';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import type { GameSetup } from '../types';

const BLUE = '#102C57';

// --- 스타일 정의 ---
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
const readonlySt: CSSProperties = { ...inputSt, background: '#f1f5f9', opacity: 0.8 };
const timeInputSt: CSSProperties = {
  width: 45,
  height: 30,
  border: `1px solid ${BLUE}`,
  textAlign: 'center',
  fontSize: 12,
  outline: 'none',
};

const SearchableInput = ({
  label,
  value,
  setter,
  options,
}: {
  label: string;
  value: string;
  setter: Dispatch<SetStateAction<string>>;
  options: string[];
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);
  const filtered = options.filter((n) => n.includes(value));
  return (
    <tr>
      <td style={tdLabel}>{label}</td>
      <td style={tdInput}>
        <div ref={containerRef} style={{ position: 'relative' }}>
          <input
            value={value}
            onChange={(e) => setter(e.target.value)}
            onFocus={() => setIsOpen(true)}
            style={inputSt}
            placeholder="이름 검색"
            autoComplete="off"
          />
          {isOpen && filtered.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 31,
                left: 0,
                right: 0,
                maxHeight: 120,
                overflowY: 'auto',
                background: '#fff',
                border: `1px solid ${BLUE}`,
                zIndex: 999,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              {filtered.map((name) => (
                <div
                  key={name}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setter(name);
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '6px 10px',
                    fontSize: 12,
                    cursor: 'pointer',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  {name}
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};

export default function GameInfoScreen({
  setup,
  onConfirm,
  onBack,
}: {
  setup: GameSetup;
  onConfirm: (extra: Partial<GameSetup>) => void;
  onBack: () => void;
}) {
  // 경기 중 재진입 시 기존 입력값(setup)으로 초기화 — 그대로 보이고 바로 수정 가능
  const initTime = (t?: string): [string, string] => {
    if (!t || !t.includes(':')) return ['', ''];
    const [h, m] = t.split(':');
    return [h || '', m || ''];
  };
  const [initStartH, initStartM] = initTime(setup.startTime);
  const [initEndH, initEndM] = initTime(setup.endTime);

  const [gameNum, setGameNum] = useState(setup.gameNum || '1');
  const [stadium, setStadium] = useState(setup.stadium ?? '');
  const [spectators, setSpectators] = useState(setup.attendance ?? '');
  const [startH, setStartH] = useState(initStartH);
  const [startM, setStartM] = useState(initStartM);
  const [regEndH, setRegEndH] = useState('');
  const [regEndM, setRegEndM] = useState('');
  const [endH, setEndH] = useState(initEndH);
  const [endM, setEndM] = useState(initEndM);
  const [isExtra, setIsExtra] = useState(false);
  const [delayRegManual, setDelayRegManual] = useState('0');
  const [delayExt, setDelayExt] = useState('0');
  const [temp, setTemp] = useState(setup.temperature ?? '');
  const [hum, setHum] = useState(setup.humidity ?? '');
  const [weatherLog, setWeatherLog] = useState(setup.weatherLog ?? '');
  const [windDir, setWindDir] = useState(setup.windDir ?? '');
  const [windSpeed, setWindSpeed] = useState(setup.windSpeed ?? '');
  const [indoorEnabled, setIndoorEnabled] = useState(false);
  const [indoorTemp, setIndoorTemp] = useState('');

  const [uHome, setUHome] = useState(setup.umpireHome ?? '');
  const [u1B, setU1B] = useState(setup.umpire1B ?? '');
  const [u2B, setU2B] = useState(setup.umpire2B ?? '');
  const [u3B, setU3B] = useState(setup.umpire3B ?? '');
  const [uLeft, setULeft] = useState(setup.umpireLeft ?? '');
  const [uRight, setURight] = useState(setup.umpireRight ?? '');
  const [uWait, setUWait] = useState(setup.umpireStandby ?? '');
  const [rec1, setRec1] = useState(setup.recorder1 ?? '');
  const [rec2, setRec2] = useState(setup.recorder2 ?? '');

  const officialList = useMemo(
    () =>
      [
        '김철수',
        '이영희',
        '박민수',
        '최지훈',
        '정우성',
        '강동원',
        '오시현',
        '윤태훈',
        '김원석',
        '김수현',
        '이지은',
        '박지민',
        '남궁심판',
        '선우기록',
      ].sort(),
    []
  );

  const [isSuspended, setIsSuspended] = useState(false);
  const [suspendedTime, setSuspendedTime] = useState('');
  const [isRegSuspended, setIsRegSuspended] = useState(false);
  const [regSuspendedTime, setRegSuspendedTime] = useState('');

  const toMin = (h: string, m: string) => (parseInt(h) || 0) * 60 + (parseInt(m) || 0);

  // 게임키 생성 (날짜 반영)
  const gameKey = useMemo(() => {
    const datePart = setup.date ? setup.date.replace(/[^0-9]/g, '').slice(0, 8) : '00000000';
    const dhSuffix =
      setup.doubleHeader === '1차전' ? '1' : setup.doubleHeader === '2차전' ? '2' : '0';
    return `${datePart}${setup.awayTeam || ''}${setup.homeTeam || ''}${dhSuffix}`;
  }, [setup.date, setup.awayTeam, setup.homeTeam, setup.doubleHeader]);

  const totalDurationStr = useMemo(() => {
    if (!startH || !endH) return '0 : 00';
    const sT = toMin(startH, startM);
    let eT = toMin(endH, endM);
    if (eT < sT) eT += 1440;
    const delay = (parseInt(delayRegManual) || 0) + (parseInt(delayExt) || 0);
    const m = Math.max(0, eT - sT - delay);
    return `${Math.floor(m / 60)} : ${String(m % 60).padStart(2, '0')}`;
  }, [startH, startM, endH, endM, delayRegManual, delayExt]);

  const regDurationStr = useMemo(() => {
    if (!startH || !regEndH) return '0 : 00';
    const sT = toMin(startH, startM);
    let rT = toMin(regEndH, regEndM);
    if (rT < sT) rT += 1440;
    const m = Math.max(0, rT - sT - (parseInt(delayRegManual) || 0));
    return `${Math.floor(m / 60)} : ${String(m % 60).padStart(2, '0')}`;
  }, [startH, startM, regEndH, regEndM, delayRegManual]);

  return (
    <div
      className="screen active"
      style={{
        height: '100vh',
        background: '#fff',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 820,
          maxWidth: '95vw',
          border: `1px solid ${BLUE}`,
          borderRadius: 6,
          background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: BLUE,
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            padding: '11px 16px',
          }}
        >
          경기 정보
        </div>
        <div
          style={{ padding: '16px 20px 12px', overflowY: 'auto', maxHeight: 'calc(100vh - 100px)' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
            {/* 1열 */}
            <div>
              <div style={sectionTitleStyle}>기본정보</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
                <tbody>
                  <tr>
                    <td style={tdLabel}>경기키</td>
                    <td style={tdInput}>
                      <input readOnly value={gameKey} style={readonlySt} />
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
                    <td style={tdLabel}>더블헤더</td>
                    <td style={tdInput}>
                      <input readOnly value={setup.doubleHeader || '--------'} style={readonlySt} />
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={sectionTitleStyle}>시간</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={tdLabel}>날짜</td>
                    <td style={tdInput}>
                      <input readOnly value={setup.date || ''} style={readonlySt} />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>시합개시</td>
                    <td style={tdInput}>
                      <input
                        placeholder="HH"
                        value={startH}
                        onChange={(e) => setStartH(e.target.value)}
                        style={timeInputSt}
                      />{' '}
                      :{' '}
                      <input
                        placeholder="MM"
                        value={startM}
                        onChange={(e) => setStartM(e.target.value)}
                        style={timeInputSt}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>정규이닝종료</td>
                    <td style={tdInput}>
                      <input
                        placeholder="HH"
                        value={regEndH}
                        onChange={(e) => setRegEndH(e.target.value)}
                        disabled={!isExtra}
                        style={{ ...timeInputSt, opacity: isExtra ? 1 : 0.4 }}
                      />{' '}
                      :{' '}
                      <input
                        placeholder="MM"
                        value={regEndM}
                        onChange={(e) => setRegEndM(e.target.value)}
                        disabled={!isExtra}
                        style={{ ...timeInputSt, opacity: isExtra ? 1 : 0.4 }}
                      />{' '}
                      <label style={{ fontSize: 10, marginLeft: 4 }}>
                        <input
                          type="checkbox"
                          checked={isExtra}
                          onChange={(e) => setIsExtra(e.target.checked)}
                        />{' '}
                        연장
                      </label>
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>경기종료</td>
                    <td style={tdInput}>
                      <input
                        placeholder="HH"
                        value={endH}
                        onChange={(e) => setEndH(e.target.value)}
                        style={timeInputSt}
                      />{' '}
                      :{' '}
                      <input
                        placeholder="MM"
                        value={endM}
                        onChange={(e) => setEndM(e.target.value)}
                        style={timeInputSt}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>지연시간</td>
                    <td
                      style={{
                        ...tdInput,
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      정규{' '}
                      <input
                        value={delayRegManual}
                        onChange={(e) => setDelayRegManual(e.target.value)}
                        style={{ ...timeInputSt, width: 34 }}
                      />{' '}
                      분 연장{' '}
                      <input
                        value={delayExt}
                        onChange={(e) => setDelayExt(e.target.value)}
                        style={{ ...timeInputSt, width: 34 }}
                      />{' '}
                      분
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>소요시간</td>
                    <td style={tdInput}>
                      <input
                        value={isSuspended ? suspendedTime : totalDurationStr}
                        readOnly={!isSuspended}
                        onChange={(e) => setSuspendedTime(e.target.value)}
                        style={{
                          ...(isSuspended ? inputSt : readonlySt),
                          width: 80,
                          textAlign: 'center',
                          fontWeight: 'bold',
                        }}
                      />{' '}
                      <label style={{ fontSize: 11 }}>
                        <input
                          type="checkbox"
                          checked={isSuspended}
                          onChange={(e) => {
                            setIsSuspended(e.target.checked);
                            if (e.target.checked) setSuspendedTime(totalDurationStr);
                          }}
                        />{' '}
                        서스펜디드
                      </label>
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>
                      정규이닝
                      <br />
                      소요시간
                    </td>
                    <td style={tdInput}>
                      <input
                        value={isRegSuspended ? regSuspendedTime : regDurationStr}
                        readOnly={!isRegSuspended}
                        onChange={(e) => setRegSuspendedTime(e.target.value)}
                        style={{
                          ...(isRegSuspended ? inputSt : readonlySt),
                          width: 80,
                          textAlign: 'center',
                          fontWeight: 'bold',
                        }}
                      />{' '}
                      <label style={{ fontSize: 11 }}>
                        <input
                          type="checkbox"
                          checked={isRegSuspended}
                          onChange={(e) => {
                            setIsRegSuspended(e.target.checked);
                            if (e.target.checked) setRegSuspendedTime(regDurationStr);
                          }}
                        />{' '}
                        서스펜디드
                      </label>
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>관중수</td>
                    <td style={tdInput}>
                      <input
                        placeholder="명"
                        value={spectators}
                        onChange={(e) => setSpectators(e.target.value)}
                        style={inputSt}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* 2열 */}
            <div>
              {(() => {
                // 심판·기록원 — 중복 배정 방지. 각 필드의 옵션은 (전체 - 이미 다른 필드에 들어간 사람들)
                const allAssigned = [uHome, u1B, u2B, u3B, uLeft, uRight, uWait, rec1, rec2];
                const optsExcluding = (self: string) =>
                  officialList.filter((n) => !allAssigned.some((v) => v && v !== self && v === n));
                return (
                  <>
                    <div style={sectionTitleStyle}>심판</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
                      <tbody>
                        <SearchableInput
                          label="주심"
                          value={uHome}
                          setter={setUHome}
                          options={optsExcluding(uHome)}
                        />
                        <SearchableInput
                          label="1루심"
                          value={u1B}
                          setter={setU1B}
                          options={optsExcluding(u1B)}
                        />
                        <SearchableInput
                          label="2루심"
                          value={u2B}
                          setter={setU2B}
                          options={optsExcluding(u2B)}
                        />
                        <SearchableInput
                          label="3루심"
                          value={u3B}
                          setter={setU3B}
                          options={optsExcluding(u3B)}
                        />
                        <SearchableInput
                          label="좌선심"
                          value={uLeft}
                          setter={setULeft}
                          options={optsExcluding(uLeft)}
                        />
                        <SearchableInput
                          label="우선심"
                          value={uRight}
                          setter={setURight}
                          options={optsExcluding(uRight)}
                        />
                        <SearchableInput
                          label="대기심"
                          value={uWait}
                          setter={setUWait}
                          options={optsExcluding(uWait)}
                        />
                      </tbody>
                    </table>
                    <div style={sectionTitleStyle}>기록원</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        <SearchableInput
                          label="기록원1"
                          value={rec1}
                          setter={setRec1}
                          options={optsExcluding(rec1)}
                        />
                        <SearchableInput
                          label="기록원2"
                          value={rec2}
                          setter={setRec2}
                          options={optsExcluding(rec2)}
                        />
                      </tbody>
                    </table>
                  </>
                );
              })()}
            </div>
            {/* 3열 */}
            <div>
              <div style={sectionTitleStyle}>구장/일기</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
                <tbody>
                  <tr>
                    <td style={tdLabel}>내부온도</td>
                    <td style={tdInput}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={indoorEnabled}
                          onChange={(e) => setIndoorEnabled(e.target.checked)}
                        />
                        <input
                          placeholder="℃"
                          value={indoorTemp}
                          onChange={(e) => setIndoorTemp(e.target.value)}
                          disabled={!indoorEnabled}
                          style={{ ...inputSt, width: 80, opacity: indoorEnabled ? 1 : 0.5 }}
                        />
                      </label>
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>온도</td>
                    <td style={tdInput}>
                      <input
                        placeholder="℃"
                        value={temp}
                        onChange={(e) => setTemp(e.target.value)}
                        style={inputSt}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>습도</td>
                    <td style={tdInput}>
                      <input
                        placeholder="%"
                        value={hum}
                        onChange={(e) => setHum(e.target.value)}
                        style={inputSt}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>일기</td>
                    <td style={tdInput}>
                      <input
                        placeholder="예) F, C, R"
                        value={weatherLog}
                        onChange={(e) => setWeatherLog(e.target.value)}
                        style={inputSt}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>풍향</td>
                    <td style={tdInput}>
                      <input
                        placeholder="예) NE"
                        value={windDir}
                        onChange={(e) => setWindDir(e.target.value)}
                        style={inputSt}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>풍속</td>
                    <td style={tdInput}>
                      <input
                        placeholder="m/s"
                        value={windSpeed}
                        onChange={(e) => setWindSpeed(e.target.value)}
                        style={inputSt}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={tdLabel}>구장</td>
                    <td style={tdInput}>
                      <input
                        placeholder="구장 입력"
                        value={stadium}
                        onChange={(e) => setStadium(e.target.value)}
                        style={inputSt}
                      />
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
              onClick={() => {
                const startTime =
                  startH || startM ? `${startH || '0'}:${(startM || '0').padStart(2, '0')}` : '';
                const endTime =
                  endH || endM ? `${endH || '0'}:${(endM || '0').padStart(2, '0')}` : '';
                onConfirm({
                  stadium,
                  gameNum,
                  startTime,
                  endTime,
                  attendance: spectators,
                  umpireHome: uHome,
                  umpire1B: u1B,
                  umpire2B: u2B,
                  umpire3B: u3B,
                  umpireLeft: uLeft,
                  umpireRight: uRight,
                  umpireStandby: uWait,
                  recorder1: rec1,
                  recorder2: rec2,
                  temperature: temp,
                  humidity: hum,
                  windDir,
                  windSpeed,
                  weatherLog,
                });
              }}
              style={{
                minWidth: 72,
                height: 32,
                background: BLUE,
                color: '#fff',
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
                height: 32,
                background: '#fff',
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
