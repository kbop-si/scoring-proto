import { useState } from 'react';

const LEAGUES = ['KBO', '퓨처스', '소프트뱅크', '국제'];

interface Props {
  onSelect: (league: string) => void;
  onBack: () => void;
}

export default function LeagueScreen({ onSelect, onBack }: Props) {
  const [sel, setSel] = useState('KBO');

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
  const BLUE = '#102C57';

  const handleSelect = (league: string) => {
    setSel(league);
    setTimeout(() => onSelect(league), 200);
  };

  return (
    <div
      className="screen active"
      id="s-league"
      style={{
        height: '100vh',
        background: '#ffffff', // ⭐ 전체 흰색
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
          background: '#ffffff', // ⭐ 내부도 흰색
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)', // ⭐ 살짝 고급 느낌
        }}
      >
        {/* 로고 */}
        <img
          src={`${BASE}/logos/kbofull.png`}
          alt="KBO"
          style={{
            width: 180,
            marginBottom: 10,
          }}
        />

        {/* 리그 버튼 */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {LEAGUES.map((l) => {
            const isSel = sel === l;

            return (
              <button
                key={l}
                onClick={() => handleSelect(l)}
                style={{
                  width: '100%',
                  height: 44,
                  border: `1px solid ${BLUE}`,
                  background: isSel ? BLUE : '#ffffff',
                  color: isSel ? '#ffffff' : BLUE,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {l === 'KBO'
                  ? 'KBO 리그'
                  : l === '퓨처스'
                    ? '퓨처스리그'
                    : l === '소프트뱅크'
                      ? '소프트뱅크'
                      : '국제대회'}
              </button>
            );
          })}
        </div>

        {/* 뒤로 버튼 */}
        <button
          onClick={onBack}
          style={{
            marginTop: 10,
            border: `1px solid ${BLUE}`,
            background: '#ffffff',
            color: BLUE,
            padding: '6px 16px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          뒤로
        </button>
      </div>
    </div>
  );
}
