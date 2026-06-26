import { useState } from 'react';
import type { GameEvent, GameState } from '../../types';

// ── 공통 스타일 ────────────────────────────────────────────────────────────────
const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
};
const dialog: React.CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  padding: '16px 20px',
  minWidth: 340,
  maxWidth: 480,
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
};
const fieldRow: React.CSSProperties = { marginBottom: 8 };
const label: React.CSSProperties = {
  fontSize: 11,
  color: '#6b7280',
  marginBottom: 2,
  display: 'block',
};
const input: React.CSSProperties = {
  width: '100%',
  fontSize: 12,
  padding: '4px 6px',
  borderRadius: 3,
  border: '1px solid #cbd5e1',
  boxSizing: 'border-box' as const,
};
const readonlyInput: React.CSSProperties = { ...input, background: '#f1f5f9', color: '#64748b' };
const btnRow: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  justifyContent: 'flex-end',
  marginTop: 14,
};
const cancelBtn: React.CSSProperties = {
  padding: '5px 14px',
  fontSize: 12,
  border: '1px solid #cbd5e1',
  background: '#fff',
  borderRadius: 4,
  cursor: 'pointer',
};
const saveBtn: React.CSSProperties = {
  padding: '5px 14px',
  fontSize: 12,
  border: '1px solid #1e40af',
  background: '#1e40af',
  color: '#fff',
  borderRadius: 4,
  cursor: 'pointer',
};
const teamBtn = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '4px 8px',
  fontSize: 12,
  borderRadius: 3,
  cursor: 'pointer',
  border: `1px solid ${active ? '#1e40af' : '#cbd5e1'}`,
  background: active ? '#1e40af' : '#fff',
  color: active ? '#fff' : '#374151',
});

// ── 공통 컨텍스트 필드 (이닝/타순/투구수) ──────────────────────────────────────
function ContextFields({ G }: { G: GameState }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
      <div>
        <span style={label}>이닝</span>
        <input
          style={readonlyInput}
          readOnly
          value={`${G.inning}회 ${G.half === 'top' ? '초' : '말'}`}
        />
      </div>
      <div>
        <span style={label}>타순</span>
        <input style={readonlyInput} readOnly value={`${G.curBatterOrder}번`} />
      </div>
      <div>
        <span style={label}>투구수</span>
        <input style={readonlyInput} readOnly value={`${G.pitchCount}구`} />
      </div>
    </div>
  );
}

function Field({
  label: lbl,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div style={fieldRow}>
      <span style={label}>{lbl}</span>
      {multiline ? (
        <textarea
          style={{ ...input, minHeight: 56, resize: 'vertical' }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          style={input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function TeamSelect({
  G,
  value,
  onChange,
}: {
  G: GameState;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={fieldRow}>
      <span style={label}>요청/관련 구단</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={teamBtn(value === G.awayTeam)} onClick={() => onChange(G.awayTeam)}>
          {G.awayTeam}
        </button>
        <button style={teamBtn(value === G.homeTeam)} onClick={() => onChange(G.homeTeam)}>
          {G.homeTeam}
        </button>
      </div>
    </div>
  );
}

// ── 비디오 판독 ────────────────────────────────────────────────────────────────
export function VideoReviewModal({
  G,
  open,
  onClose,
  onSave,
}: {
  G: GameState;
  open: boolean;
  onClose: () => void;
  onSave: (ev: GameEvent) => void;
}) {
  const [team, setTeam] = useState('');
  const [player, setPlayer] = useState('');
  const [content, setContent] = useState('');
  const [situation, setSituation] = useState('');
  const [firstCall, setFirstCall] = useState('');
  const [result, setResult] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  if (!open) return null;
  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>비디오 판독</div>
        <ContextFields G={G} />
        <TeamSelect G={G} value={team} onChange={setTeam} />
        <Field label="판독 대상 선수" value={player} onChange={setPlayer} />
        <Field label="판독 내용" value={content} onChange={setContent} multiline />
        <Field label="세부 상황" value={situation} onChange={setSituation} />
        <Field label="최초 판정" value={firstCall} onChange={setFirstCall} />
        <Field label="판독 결과" value={result} onChange={setResult} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <Field
            label="시작시간"
            value={startTime}
            onChange={setStartTime}
            placeholder="HH:MM:SS"
          />
          <Field label="종료시간" value={endTime} onChange={setEndTime} placeholder="HH:MM:SS" />
        </div>
        <div style={btnRow}>
          <button style={cancelBtn} onClick={onClose}>
            취소
          </button>
          <button
            style={saveBtn}
            onClick={() => {
              onSave({
                type: 'video_review',
                inning: G.inning,
                half: G.half,
                order: G.curBatterOrder,
                pitchCount: G.pitchCount,
                team,
                player,
                content,
                situation,
                firstCall,
                result,
                startTime,
                endTime,
              });
              onClose();
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 체크스윙 리스트 ────────────────────────────────────────────────────────────
export function CheckSwingModal({
  G,
  open,
  onClose,
  onSave,
}: {
  G: GameState;
  open: boolean;
  onClose: () => void;
  onSave: (ev: GameEvent) => void;
}) {
  const [team, setTeam] = useState('');
  const [player, setPlayer] = useState('');
  const [umpire, setUmpire] = useState('');
  const [result, setResult] = useState('');
  const [situation, setSituation] = useState('');

  if (!open) return null;
  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>체크스윙 리스트</div>
        <ContextFields G={G} />
        <TeamSelect G={G} value={team} onChange={setTeam} />
        <Field label="대상 선수" value={player} onChange={setPlayer} />
        <Field label="판정 심판" value={umpire} onChange={setUmpire} />
        <Field label="판정 결과" value={result} onChange={setResult} />
        <Field label="발생 상황" value={situation} onChange={setSituation} multiline />
        <div style={btnRow}>
          <button style={cancelBtn} onClick={onClose}>
            취소
          </button>
          <button
            style={saveBtn}
            onClick={() => {
              onSave({
                type: 'check_swing',
                inning: G.inning,
                half: G.half,
                order: G.curBatterOrder,
                pitchCount: G.pitchCount,
                team,
                player,
                umpire,
                result,
                situation,
              });
              onClose();
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 기타 직접입력 ──────────────────────────────────────────────────────────────
export function MemoInputModal({
  G,
  open,
  onClose,
  onSave,
}: {
  G: GameState;
  open: boolean;
  onClose: () => void;
  onSave: (ev: GameEvent) => void;
}) {
  const [team, setTeam] = useState('');
  const [player, setPlayer] = useState('');
  const [memo, setMemo] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  if (!open) return null;
  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>기타 (직접 입력)</div>
        <ContextFields G={G} />
        <TeamSelect G={G} value={team} onChange={setTeam} />
        <Field label="관련 선수" value={player} onChange={setPlayer} />
        <Field label="메모 내용" value={memo} onChange={setMemo} multiline />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <Field
            label="시작시간"
            value={startTime}
            onChange={setStartTime}
            placeholder="HH:MM:SS"
          />
          <Field label="종료시간" value={endTime} onChange={setEndTime} placeholder="HH:MM:SS" />
        </div>
        <div style={btnRow}>
          <button style={cancelBtn} onClick={onClose}>
            취소
          </button>
          <button
            style={saveBtn}
            onClick={() => {
              onSave({
                type: 'memo_input',
                inning: G.inning,
                half: G.half,
                order: G.curBatterOrder,
                pitchCount: G.pitchCount,
                team,
                player,
                memo,
                startTime,
                endTime,
              });
              onClose();
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 경기 지연/중단 ─────────────────────────────────────────────────────────────
export function GameDelayModal({
  G,
  open,
  onClose,
  onSave,
}: {
  G: GameState;
  open: boolean;
  onClose: () => void;
  onSave: (ev: GameEvent) => void;
}) {
  const [content, setContent] = useState('');
  const [situation, setSituation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState('');

  if (!open) return null;
  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>경기 지연/중단</div>
        <ContextFields G={G} />
        <Field label="지연·중단 내용" value={content} onChange={setContent} />
        <Field label="세부 상황" value={situation} onChange={setSituation} multiline />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <Field
            label="시작시간"
            value={startTime}
            onChange={setStartTime}
            placeholder="HH:MM:SS"
          />
          <Field label="종료시간" value={endTime} onChange={setEndTime} placeholder="HH:MM:SS" />
          <Field label="소요시간" value={duration} onChange={setDuration} placeholder="mm:ss" />
        </div>
        <div style={btnRow}>
          <button style={cancelBtn} onClick={onClose}>
            취소
          </button>
          <button
            style={saveBtn}
            onClick={() => {
              onSave({
                type: 'game_delay',
                inning: G.inning,
                half: G.half,
                content,
                situation,
                startTime,
                endTime,
                duration,
              });
              onClose();
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 경고 및 퇴장 ───────────────────────────────────────────────────────────────
export function WarningEjectionModal({
  G,
  open,
  onClose,
  onSave,
}: {
  G: GameState;
  open: boolean;
  onClose: () => void;
  onSave: (ev: GameEvent) => void;
}) {
  const [team, setTeam] = useState('');
  const [player, setPlayer] = useState('');
  const [kind, setKind] = useState('경고');
  const [content, setContent] = useState('');
  const [situation, setSituation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  if (!open) return null;
  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>경고 및 퇴장</div>
        <ContextFields G={G} />
        <TeamSelect G={G} value={team} onChange={setTeam} />
        <Field label="대상 선수" value={player} onChange={setPlayer} />
        <div style={fieldRow}>
          <span style={label}>구분</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {['경고', '퇴장'].map((k) => (
              <button key={k} style={teamBtn(kind === k)} onClick={() => setKind(k)}>
                {k}
              </button>
            ))}
          </div>
        </div>
        <Field label="발생 내용" value={content} onChange={setContent} />
        <Field label="세부 상황" value={situation} onChange={setSituation} multiline />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <Field
            label="시작시간"
            value={startTime}
            onChange={setStartTime}
            placeholder="HH:MM:SS"
          />
          <Field label="종료시간" value={endTime} onChange={setEndTime} placeholder="HH:MM:SS" />
        </div>
        <div style={btnRow}>
          <button style={cancelBtn} onClick={onClose}>
            취소
          </button>
          <button
            style={saveBtn}
            onClick={() => {
              onSave({
                type: 'warning_ejection',
                inning: G.inning,
                half: G.half,
                team,
                player,
                kind,
                content,
                situation,
                startTime,
                endTime,
              });
              onClose();
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 심판 교체 ──────────────────────────────────────────────────────────────────
export function UmpireChangeModal({
  G,
  open,
  onClose,
  onSave,
}: {
  G: GameState;
  open: boolean;
  onClose: () => void;
  onSave: (ev: GameEvent) => void;
}) {
  const [oldUmpire, setOldUmpire] = useState('');
  const [newUmpire, setNewUmpire] = useState('');
  const [reason, setReason] = useState('');
  const [oldPos, setOldPos] = useState('');
  const [newPos, setNewPos] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  if (!open) return null;
  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>심판 교체</div>
        <ContextFields G={G} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <Field label="기존 심판명" value={oldUmpire} onChange={setOldUmpire} />
          <Field label="교체 심판명" value={newUmpire} onChange={setNewUmpire} />
          <Field label="교체 전 위치" value={oldPos} onChange={setOldPos} />
          <Field label="교체 후 위치" value={newPos} onChange={setNewPos} />
        </div>
        <Field label="교체 사유" value={reason} onChange={setReason} multiline />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <Field
            label="시작시간"
            value={startTime}
            onChange={setStartTime}
            placeholder="HH:MM:SS"
          />
          <Field label="종료시간" value={endTime} onChange={setEndTime} placeholder="HH:MM:SS" />
        </div>
        <div style={btnRow}>
          <button style={cancelBtn} onClick={onClose}>
            취소
          </button>
          <button
            style={saveBtn}
            onClick={() => {
              onSave({
                type: 'umpire_change',
                inning: G.inning,
                half: G.half,
                oldUmpire,
                newUmpire,
                reason,
                oldPos,
                newPos,
                startTime,
                endTime,
              });
              onClose();
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 기타 리스트 보기 ───────────────────────────────────────────────────────────
export function MemoListModal({
  G,
  open,
  onClose,
}: {
  G: GameState;
  open: boolean;
  onClose: () => void;
}) {
  const specialEvents = G.gameEvents.filter((e) =>
    [
      'mound',
      'batter_timeout',
      'pitcher_leave',
      'video_review',
      'check_swing',
      'memo_input',
      'game_delay',
      'warning_ejection',
      'umpire_change',
    ].includes(e.type)
  );

  const typeLabel: Record<string, string> = {
    mound: '마운드방문',
    batter_timeout: '타자타임',
    pitcher_leave: '투수판이탈',
    video_review: '비디오판독',
    check_swing: '체크스윙',
    memo_input: '기타메모',
    game_delay: '경기지연/중단',
    warning_ejection: '경고/퇴장',
    umpire_change: '심판교체',
  };

  if (!open) return null;
  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...dialog, minWidth: 400, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>기타 이벤트 목록</div>
        {specialEvents.length === 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
            기록된 이벤트 없음
          </div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {specialEvents.map((ev, i) => (
              <div
                key={i}
                style={{ padding: '6px 0', borderBottom: '1px solid #e2e8f0', fontSize: 12 }}
              >
                <div style={{ display: 'flex', gap: 6, marginBottom: 2, alignItems: 'center' }}>
                  <span
                    style={{
                      background: '#e0e7ff',
                      color: '#3730a3',
                      borderRadius: 3,
                      padding: '1px 6px',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {typeLabel[ev.type] ?? ev.type}
                  </span>
                  <span style={{ color: '#6b7280' }}>
                    {ev.inning}회 {ev.half === 'top' ? '초' : '말'}
                    {'pitcher' in ev && ev.pitcher ? ` · 투수 ${ev.pitcher}` : ''}
                    {'pitchCount' in ev && ev.pitchCount != null ? ` · ${ev.pitchCount}구째` : ''}
                  </span>
                </div>
                <div style={{ color: '#374151' }}>
                  {'content' in ev && ev.content && <span>{ev.content} </span>}
                  {'player' in ev && ev.player && <span>· {ev.player} </span>}
                  {'team' in ev && ev.team && <span>({ev.team}) </span>}
                  {'result' in ev && ev.result && <span>→ {ev.result}</span>}
                  {'oldUmpire' in ev && (
                    <span>
                      {ev.oldUmpire} → {ev.newUmpire}
                    </span>
                  )}
                  {'memo' in ev && ev.memo && <span>{ev.memo}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={btnRow}>
          <button style={cancelBtn} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
