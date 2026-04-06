import { useState } from 'react';

interface Props {
  open: boolean;
  onConfirm: (visitor: string, catcher: boolean) => void;
  onClose: () => void;
}

type Visitor = '코칭스태프' | '포수' | '포수 덕아웃';

export default function MoundVisitModal({ open, onConfirm, onClose }: Props) {
  const [visitor, setVisitor] = useState<Visitor>('코칭스태프');

  const handle = () => {
    onConfirm(visitor, false);
    setVisitor('코칭스태프');
  };

  const handleClose = () => {
    setVisitor('코칭스태프');
    onClose();
  };

  const btnStyle = (v: Visitor): React.CSSProperties => ({
    flex: 1, padding: '9px 4px', fontWeight: 700, fontSize: 12, borderRadius: 3, cursor: 'pointer',
    border: `2px solid ${visitor === v ? 'var(--blue)' : 'var(--border)'}`,
    background: visitor === v ? 'var(--blue)' : '#fff',
    color: visitor === v ? '#fff' : 'var(--text)',
  });

  return (
    <div className={`ov${open ? ' open' : ''}`} id="ov-mound">
      <div className="ov-card" style={{ minWidth: 300 }}>
        <div className="modal-title">마운드 방문</div>
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['코칭스태프', '포수', '포수 덕아웃'] as Visitor[]).map((v) => (
              <button key={v} style={btnStyle(v)} onClick={() => setVisitor(v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ok" onClick={handle}>확인</button>
          <button className="btn-cancel" onClick={handleClose}>취소</button>
        </div>
      </div>
    </div>
  );
}
