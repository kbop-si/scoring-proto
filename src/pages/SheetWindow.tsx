import { useEffect, useState } from 'react';
import type { GameState } from '../types';
import ScoreSheet from '../components/ScoreSheet';

export default function SheetWindow() {
  const [G, setG] = useState<GameState | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('kbo_sheet_state');
    if (raw) {
      try {
        setG(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'kbo_sheet_state' && e.newValue) {
        try {
          setG(JSON.parse(e.newValue));
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!G) return <div style={{ padding: 32, color: '#94a3b8' }}>기록지 데이터 없음</div>;

  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'auto', background: '#fff' }}>
      <ScoreSheet G={G} onSelCell={() => {}} />
    </div>
  );
}
