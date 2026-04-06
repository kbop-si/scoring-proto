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
      <div
        className="ctx-item"
        onClick={() => {
          onClose();
          onSubst(ctx.pos);
        }}
      >
        교체
      </div>
      {ctx.pos === 1 && (
        <div
          className="ctx-item"
          onClick={() => {
            onClose();
            onPitcherChange();
          }}
        >
          투수 교체
        </div>
      )}
      <div className="ctx-item" onClick={() => onClose()}>
        선수 정보
      </div>
    </div>
  );
}
