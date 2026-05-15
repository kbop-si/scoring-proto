import { useEffect, useRef } from 'react';
import type { ContextMenuState } from '../types';

interface Props {
  ctx: ContextMenuState;
  hasFielder: boolean;
  onClose: () => void;
  onSubst: (pos: number) => void;
  onPitcherChange: () => void;
}

export default function ContextMenu({ ctx, onClose, onSubst, onPitcherChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [onClose]);

  if (!ctx.open) return null;

  return (
    <div
      ref={ref}
      className="ctx open"
      style={{ left: ctx.x, top: ctx.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="ctx-t">{ctx.title}</div>
      {ctx.pos === 1 ? (
        // 투수는 전용 투수교체만 사용 (일반 교체는 투수에 안 먹음)
        <div
          className="ctx-item"
          onClick={() => {
            onClose();
            onPitcherChange();
          }}
        >
          투수 교체
        </div>
      ) : (
        <div
          className="ctx-item"
          onClick={() => {
            onClose();
            onSubst(ctx.pos);
          }}
        >
          교체
        </div>
      )}
    </div>
  );
}
