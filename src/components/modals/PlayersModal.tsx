import { useEffect, useState } from 'react';
import type { Player } from '../../types';
import { posGroupAbbr } from '../../data/constants';

interface Props {
  open: boolean;
  title: string;
  playerList: Player[];
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export default function PlayersModal({
  open,
  title,
  playerList,
  selectedIdx,
  onSelect,
  onConfirm,
  onClose,
}: Props) {
  const [query, setQuery] = useState('');

  // 모달이 새로 열릴 때마다 검색어 초기화
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const q = query.trim();
  // 원본 index 보존하면서 필터 — 이름/등번호 매치 (대소문자 무시)
  const filtered = playerList
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => {
      if (!q) return true;
      const name = p.name || '';
      const num = p.num || '';
      return name.includes(q) || num.includes(q);
    });

  return (
    <div className={`ov${open ? ' open' : ''}`} id="ov-players">
      <div className="ov-card">
        <div className="modal-title">{title || '선수 선택'}</div>
        <div style={{ padding: '6px 10px 4px' }}>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름 또는 등번호로 검색"
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: 12,
              border: '1px solid var(--border)',
              borderRadius: 3,
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div className="pl-list">
          <table className="pl-tbl">
            <thead>
              <tr>
                <th>선수명</th>
                <th>등번호</th>
                <th>포지션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    style={{ textAlign: 'center', color: 'var(--text3)', padding: 12 }}
                  >
                    검색 결과 없음
                  </td>
                </tr>
              ) : (
                filtered.map(({ p, i }) => (
                  <tr
                    key={i}
                    className={selectedIdx === i ? 'sel' : ''}
                    onClick={() => onSelect(i)}
                  >
                    <td>{p.name}</td>
                    <td>{p.num}</td>
                    <td>{posGroupAbbr(p.pos)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="modal-footer">
          <button className="btn-ok" onClick={onConfirm}>
            확인
          </button>
          <button className="btn-cancel" onClick={onClose}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
