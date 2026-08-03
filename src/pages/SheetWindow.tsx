import { useEffect, useState } from 'react';
import type { GameState } from '../types';
import ScoreSheet from '../components/ScoreSheet';
import { normalizeLoadedGame } from '../store/gameReducer';

export default function SheetWindow() {
  const [G, setG] = useState<GameState | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('kbo_sheet_state');
    if (raw) {
      try {
        // 구버전 스탬프의 수비 자동확정 로그 시점 교정 (불러오기와 동일 정규화)
        setG(normalizeLoadedGame(JSON.parse(raw)));
      } catch {
        /* ignore */
      }
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'kbo_sheet_state' && e.newValue) {
        try {
          setG(normalizeLoadedGame(JSON.parse(e.newValue)));
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
      <ScoreSheet
        G={G}
        onSelCell={(key) => {
          localStorage.setItem('kbo_sel_cell_request', key);
        }}
      />
    </div>
  );
}
