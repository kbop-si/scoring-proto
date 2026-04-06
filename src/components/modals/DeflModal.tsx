import type { Player } from '../../types';

interface Props {
  open: boolean;
  deflFielder: number | null;
  deflType: string;
  defLU: Player[];
  onSelFielder: (pos: number) => void;
  onSelType: (t: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeflModal({ open, deflFielder, deflType, defLU, onSelFielder, onSelType, onConfirm, onClose }: Props) {
  return (
    <div className={`ov${open ? ' open' : ''}`} id="ov-defl">
      <div className="ov-card">
        <div className="modal-title">디플렉션</div>
        <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text2)' }}>수비수 선택</div>
        <div className="f-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((pos) => {
            const p = defLU.find((x) => x.pos === pos);
            return (
              <div
                key={pos}
                className={`f-btn${deflFielder === pos ? ' sel' : ''}`}
                onClick={() => onSelFielder(pos)}
              >
                <div style={{ fontSize: 14, fontWeight: 900 }}>{pos}</div>
                <div style={{ fontSize: 9 }}>{p?.name || ''}</div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: '0 12px', fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>타구 유형</div>
        <div style={{ padding: '0 12px 12px', display: 'flex', gap: 6 }}>
          {['라이나', '땅볼', '뜬공'].map((t) => (
            <button
              key={t}
              className={`btn-sm${deflType === t ? ' sel' : ''}`}
              onClick={() => onSelType(t)}
              style={deflType === t ? { background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' } : {}}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn-ok" onClick={onConfirm}>확인</button>
          <button className="btn-cancel" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}
