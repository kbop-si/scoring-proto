import { useState, useEffect, useRef } from 'react';
import { WEEK } from '../data/constants';

interface Props {
  selectedDate: string;
  onPick: (y: number, m: number, d: number) => void;
  onClose: () => void;
}

export default function Calendar({ selectedDate, onPick, onClose }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} className="cal-day empty" />);
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = (firstDay + d - 1) % 7;
    const isToday =
      today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === d;
    const thisFmt = `${year}년 ${String(month).padStart(2, '0')}월 ${String(d).padStart(2, '0')}일 (${WEEK[new Date(year, month - 1, d).getDay()]})`;
    const isSel = selectedDate === thisFmt;
    const cls = [
      'cal-day',
      dow === 0 ? 'sun' : dow === 6 ? 'sat' : '',
      isToday ? 'today' : '',
      isSel ? 'selected' : '',
    ]
      .filter(Boolean)
      .join(' ');
    cells.push(
      <button key={d} className={cls} onClick={() => onPick(year, month, d)}>
        {d}
      </button>
    );
  }

  return (
    <div className="cal-wrap open" ref={ref} onClick={(e) => e.stopPropagation()}>
      <div className="cal-header">
        <button onClick={() => setYear((y) => y - 1)}>«</button>
        <button onClick={prevMonth}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 700, flex: 1, textAlign: 'center' }}>
          {year}년 {month}월
        </span>
        <button onClick={nextMonth}>›</button>
        <button onClick={() => setYear((y) => y + 1)}>»</button>
      </div>
      <div className="cal-grid">
        {WEEK.map((d) => (
          <div key={d} className="cal-day-hd">
            {d}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}
