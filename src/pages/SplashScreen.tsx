interface Props {
  onStart: () => void;
}

export default function SplashScreen({ onStart }: Props) {
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <div
      style={{
        height: '100vh',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: '18vh',
      }}
    >
      {/* 로고 */}
      <img
        src={`${BASE}/logos/kbo.png`}
        alt="KBO Scoring"
        style={{
          width: 700,
          maxWidth: '100vw',
        }}
      />

      {/* 버튼 */}
      <button
        onClick={onStart}
        style={{
          marginTop: 150,
          width: 240,
          height: 56,
          background: '#102C57',
          color: '#ffffff',
          fontSize: 18,
          fontWeight: 700,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        경기입력
      </button>
    </div>
  );
}
