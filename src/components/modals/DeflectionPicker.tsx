import { useState, useRef, useLayoutEffect } from 'react';
import type { DeflectionInfo, Player } from '../../types';

// de2.png — 3x3 수비수 단일선택 + 땅/뜬/라 + 번트 체크
// 번트는 ballType='땅'으로 저장 (셀 표시는 땅볼 곡선만)
interface Props {
  value: DeflectionInfo | null;
  defLU?: Player[];
  onChange: (next: DeflectionInfo | null) => void;
}

const POS_GRID: (number | null)[][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

const POPUP_W = 240;
const POPUP_H_EST = 220; // 대략적인 팝업 높이 (flip 판단용)
const MARGIN = 8;

export default function DeflectionPicker({ value, defLU = [], onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [bunt, setBunt] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // 팝업 위치 계산 — 뷰포트 경계 안에 들어가도록 좌/우/위/아래 flip
  useLayoutEffect(() => {
    if (!open || !btnRef.current) {
      setPos(null);
      return;
    }
    const compute = () => {
      const r = btnRef.current!.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const popupH = popupRef.current?.offsetHeight ?? POPUP_H_EST;
      const popupW = popupRef.current?.offsetWidth ?? POPUP_W;

      // 좌우: 버튼 좌측 정렬 우선, 우측 넘치면 우측 정렬
      let left = r.left;
      if (left + popupW + MARGIN > vw) left = Math.max(MARGIN, r.right - popupW);
      if (left < MARGIN) left = MARGIN;

      // 상하: 버튼 아래 우선, 안 들어가면 위로 flip
      let top = r.bottom + 4;
      if (top + popupH + MARGIN > vh) {
        const above = r.top - popupH - 4;
        top = above >= MARGIN ? above : Math.max(MARGIN, vh - popupH - MARGIN);
      }
      setPos({ left, top });
    };
    compute();
    // 팝업이 렌더된 후 실제 크기 반영
    const id = requestAnimationFrame(compute);
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open]);

  // 바깥 클릭으로 닫기
  useLayoutEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popupRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selectPos = (p: number) => {
    const ballType = value?.ballType ?? '땅';
    onChange({ pos: p, ballType });
  };

  const selectBallType = (bt: '땅' | '뜬' | '라') => {
    if (bt !== '땅') setBunt(false);
    if (!value) return;
    onChange({ pos: value.pos, ballType: bt });
  };

  const clear = () => {
    setBunt(false);
    onChange(null);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 700,
          border: `1px solid ${value ? 'var(--blue)' : 'var(--border)'}`,
          background: value ? 'var(--blue)' : '#fff',
          color: value ? '#fff' : 'var(--text)',
          borderRadius: 3,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        디플렉션{value ? ` (${value.pos}·${value.ballType}${bunt ? '·번트' : ''})` : ''}
      </button>

      {open && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            zIndex: 9999,
            left: pos?.left ?? -9999,
            top: pos?.top ?? -9999,
            visibility: pos ? 'visible' : 'hidden',
            background: '#fff',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 16px rgba(0,0,0,.18)',
            padding: 10,
            borderRadius: 4,
            minWidth: POPUP_W,
            maxWidth: 'min(90vw, 320px)',
            maxHeight: '85vh',
            overflow: 'auto',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
            타격 정보
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* 3x3 수비수 그리드 (단일선택 라디오) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 32px)', gap: 6 }}>
              {POS_GRID.flat().map((p, i) => {
                if (!p) return <div key={`empty-${i}`} />;
                const sel = value?.pos === p;
                const player = defLU.find((x) => x.pos === p);
                return (
                  <label
                    key={p}
                    title={player?.name || ''}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="defl_pos"
                      checked={sel}
                      onChange={() => selectPos(p)}
                      style={{ accentColor: 'var(--blue)' }}
                    />
                    <span style={{ fontSize: sel ? 16 : 11, fontWeight: sel ? 900 : 600 }}>
                      {p}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* 우측: 땅/뜬/라 라디오 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(['땅', '뜬', '라'] as const).map((bt) => (
                <label
                  key={bt}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    cursor: value ? 'pointer' : 'not-allowed',
                    opacity: value ? 1 : 0.4,
                  }}
                >
                  <input
                    type="radio"
                    name="defl_ball"
                    disabled={!value}
                    checked={value?.ballType === bt}
                    onChange={() => selectBallType(bt)}
                    style={{ accentColor: 'var(--blue)' }}
                  />
                  {bt === '땅' ? '땅볼' : bt === '뜬' ? '뜬공' : '라이너'}
                </label>
              ))}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  cursor: value && value.ballType === '땅' ? 'pointer' : 'not-allowed',
                  opacity: value && value.ballType === '땅' ? 1 : 0.4,
                  marginTop: 4,
                  paddingTop: 4,
                  borderTop: '1px dashed var(--border2)',
                }}
              >
                <input
                  type="checkbox"
                  disabled={!value || value.ballType !== '땅'}
                  checked={bunt}
                  onChange={(e) => setBunt(e.target.checked)}
                  style={{ accentColor: 'var(--blue)' }}
                />
                번트
              </label>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 6,
              marginTop: 10,
              paddingTop: 8,
              borderTop: '1px solid var(--border2)',
            }}
          >
            <button
              type="button"
              onClick={clear}
              style={{
                fontSize: 11,
                padding: '3px 8px',
                border: '1px solid var(--border)',
                background: '#fff',
                cursor: 'pointer',
                borderRadius: 2,
              }}
            >
              초기화
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                fontSize: 11,
                padding: '3px 10px',
                border: '1px solid var(--blue)',
                background: 'var(--blue)',
                color: '#fff',
                cursor: 'pointer',
                borderRadius: 2,
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
