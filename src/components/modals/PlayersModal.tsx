import type { Player } from '../../types';
import { POS_ABBR } from '../../data/constants';

interface Props {
  open: boolean;
  title: string;
  playerList: Player[];
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export default function PlayersModal({ open, title, playerList, selectedIdx, onSelect, onConfirm, onClose }: Props) {
  return (
    <div className={`ov${open ? ' open' : ''}`} id="ov-players">
      <div className="ov-card">
        <div className="modal-title">{title || '선수 선택'}</div>
        <div className="pl-list">
          <table className="pl-tbl">
            <thead>
              <tr><th>선수명</th><th>등번호</th><th>포지션</th></tr>
            </thead>
            <tbody>
              {playerList.map((p, i) => (
                <tr
                  key={i}
                  className={selectedIdx === i ? 'sel' : ''}
                  onClick={() => onSelect(i)}
                >
                  <td>{p.name}</td>
                  <td>{p.num}</td>
                  <td>{POS_ABBR[p.pos] || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-footer">
          <button className="btn-ok" onClick={onConfirm}>확인</button>
          <button className="btn-cancel" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}
