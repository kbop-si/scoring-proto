import { useState } from 'react';

// 리그 데이터 정의
const MAIN_LEAGUES = ['KBO', '퓨처스'];
const SUB_LEAGUES = ['소프트뱅크', '국제대회', 'FALL 리그'];

interface Props {
  onSelect: (league: string) => void;
  onBack: () => void;
}

export default function LeagueScreen({ onSelect, onBack }: Props) {
  const [sel, setSel] = useState('');
  const [isSubMenu, setIsSubMenu] = useState(false); // 기타 메뉴 오픈 여부

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
  const BLUE = '#102C57';

  // 리그 선택 핸들러
  const handleSelect = (league: string) => {
    setSel(league);
    // 선택 효과를 위해 약간의 지연 후 부모 함수 호출
    setTimeout(() => onSelect(league), 200);
  };

  // 버튼 스타일 공통 함수
  const getButtonStyle = (isSelected: boolean) => ({
    width: '100%',
    height: 44,
    border: `1px solid ${BLUE}`,
    background: isSelected ? BLUE : '#ffffff',
    color: isSelected ? '#ffffff' : BLUE,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div
      className="screen active"
      style={{
        height: '100vh',
        background: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        className="league-box"
        style={{
          width: 340,
          padding: 24,
          border: `1px solid ${BLUE}`,
          borderRadius: 6,
          background: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}
      >
        <img src={`${BASE}/logos/kbofull.png`} alt="KBO" style={{ width: 180, marginBottom: 10 }} />

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!isSubMenu ? (
            /* 메인 메뉴 화면 */
            <>
              {MAIN_LEAGUES.map((l) => (
                <button key={l} onClick={() => handleSelect(l)} style={getButtonStyle(sel === l)}>
                  {l === 'KBO' ? 'KBO 리그' : '퓨처스리그'}
                </button>
              ))}
              <button onClick={() => setIsSubMenu(true)} style={getButtonStyle(false)}>
                기타 리그
              </button>
            </>
          ) : (
            /* 기타 메뉴(Sub) 화면 */
            <>
              {SUB_LEAGUES.map((l) => (
                <button key={l} onClick={() => handleSelect(l)} style={getButtonStyle(sel === l)}>
                  {l}
                </button>
              ))}
              <button
                onClick={() => setIsSubMenu(false)}
                style={{ ...getButtonStyle(false), borderStyle: 'dashed', marginTop: 10 }}
              >
                ◀ 이전으로
              </button>
            </>
          )}
        </div>

        <button
          onClick={onBack}
          style={{
            marginTop: 10,
            border: 'none',
            background: 'none',
            color: '#666',
            textDecoration: 'underline',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          처음 화면으로
        </button>
      </div>
    </div>
  );
}
