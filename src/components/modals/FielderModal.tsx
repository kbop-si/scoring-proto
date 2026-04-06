import type { Player } from '../../types';
import { POS_NAME } from '../../data/constants';

interface Props {
  open: boolean;
  title: string;
  fielderSeq: number[];
  defLU: Player[];
  onAdd: (pos: number) => void;
  onClear: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

export default function FielderModal({ open, title, fielderSeq, defLU, onAdd, onClear, onConfirm, onClose }: Props) {
  return (
    <div className={`ov${open ? ' open' : ''}`} id="ov-fielder">
      <div className="ov-card">
        <div className="modal-title">{title || '수비수 선택 (순서대로 클릭)'}</div>
        <div style={{ padding: '4px 12px 0', fontSize: 10, color: 'var(--text3)' }}>
          선택 순서: <span style={{ fontFamily: 'monospace', color: 'var(--blue)' }}>{fielderSeq.join(' → ') || '—'}</span>
        </div>
        <div className="f-seq">
          {fielderSeq.map((p, i) => <span key={i} className="f-seq-item">{p}</span>)}
        </div>
        <div className="f-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((pos) => {
            const p = defLU.find((x) => x.pos === pos);
            return (
              <div key={pos} className="f-btn" onClick={() => onAdd(pos)}>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{pos}</div>
                <div style={{ fontSize: 9, color: 'var(--text3)' }}>{POS_NAME[pos]}</div>
                <div style={{ fontSize: 10, fontWeight: 600 }}>{p?.name || ''}</div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: '0 12px 8px', display: 'flex', gap: 6 }}>
          <button className="btn-sm" onClick={onClear}>지우기</button>
        </div>
        <div className="modal-footer">
          <button className="btn-ok" onClick={onConfirm}>확인</button>
          <button className="btn-cancel" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}
