import { useState, useEffect } from 'react';
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

// ── 공통 컨텍스트 필드 (이닝/초말/타순/타석내투구수) — 편집 가능 ──────────────────
function ContextFields({
  inning,
  half,
  order,
  atBatPitch,
  onInning,
  onHalf,
  onOrder,
  onAtBatPitch,
}: {
  inning: number;
  half: 'top' | 'bottom';
  order?: number;
  atBatPitch?: number;
  onInning: (v: number) => void;
  onHalf: (v: 'top' | 'bottom') => void;
  onOrder?: (v: number) => void;
  onAtBatPitch?: (v: number) => void;
}) {
  const extraCols = (onOrder != null ? 1 : 0) + (onAtBatPitch != null ? 1 : 0);
  const cols = `1fr 1fr${extraCols > 0 ? ` repeat(${extraCols}, 1fr)` : ''}`;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 6, marginBottom: 10 }}>
      <div>
        <span style={label}>이닝</span>
        <input
          style={input}
          type="number"
          min={1}
          max={15}
          value={inning}
          onChange={(e) => onInning(Number(e.target.value))}
        />
      </div>
      <div>
        <span style={label}>초/말</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['top', 'bottom'] as const).map((h) => (
            <button key={h} style={teamBtn(half === h)} onClick={() => onHalf(h)}>
              {h === 'top' ? '초' : '말'}
            </button>
          ))}
        </div>
      </div>
      {onOrder != null && order != null && (
        <div>
          <span style={label}>타순</span>
          <input
            style={input}
            type="number"
            min={1}
            max={9}
            value={order}
            onChange={(e) => onOrder(Number(e.target.value))}
          />
        </div>
      )}
      {onAtBatPitch != null && atBatPitch != null && (
        <div>
          <span style={label}>투구수</span>
          <input
            style={input}
            type="number"
            min={0}
            value={atBatPitch}
            onChange={(e) => onAtBatPitch(Number(e.target.value))}
          />
        </div>
      )}
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
  const [inning, setInning] = useState(G.inning);
  const [half, setHalf] = useState<'top' | 'bottom'>(G.half);
  const [order, setOrder] = useState(G.curBatterOrder);
  const [pitchCount, setPitchCount] = useState(G.pitchCount);
  const [atBatPitch, setAtBatPitch] = useState(G.cells[G.selCellKey]?.pitches?.length ?? 0);
  const [team, setTeam] = useState('');
  const [player, setPlayer] = useState('');
  const [content, setContent] = useState('');
  const [situation, setSituation] = useState('');
  const [firstCall, setFirstCall] = useState('');
  const [result, setResult] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (open) {
      setInning(G.inning);
      setHalf(G.half);
      setOrder(G.curBatterOrder);
      setPitchCount(G.pitchCount);
      setAtBatPitch(G.cells[G.selCellKey]?.pitches?.length ?? 0);
    }
  }, [open, G.inning, G.half, G.curBatterOrder, G.pitchCount, G.cells, G.selCellKey]);

  if (!open) return null;
  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>비디오 판독</div>
        <ContextFields
          inning={inning}
          half={half}
          order={order}
          atBatPitch={atBatPitch}
          onInning={setInning}
          onHalf={setHalf}
          onOrder={setOrder}
          onAtBatPitch={setAtBatPitch}
        />
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
                inning,
                half,
                order,
                pitchCount,
                atBatPitch,
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
  const [inning, setInning] = useState(G.inning);
  const [half, setHalf] = useState<'top' | 'bottom'>(G.half);
  const [order, setOrder] = useState(G.curBatterOrder);
  const [pitchCount, setPitchCount] = useState(G.pitchCount);
  const [atBatPitch, setAtBatPitch] = useState(G.cells[G.selCellKey]?.pitches?.length ?? 0);
  const [team, setTeam] = useState('');
  const [player, setPlayer] = useState('');
  const [umpire, setUmpire] = useState('');
  const [result, setResult] = useState('');
  const [situation, setSituation] = useState('');

  useEffect(() => {
    if (open) {
      setInning(G.inning);
      setHalf(G.half);
      setOrder(G.curBatterOrder);
      setPitchCount(G.pitchCount);
      setAtBatPitch(G.cells[G.selCellKey]?.pitches?.length ?? 0);
    }
  }, [open, G.inning, G.half, G.curBatterOrder, G.pitchCount, G.cells, G.selCellKey]);

  if (!open) return null;
  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>체크스윙 리스트</div>
        <ContextFields
          inning={inning}
          half={half}
          order={order}
          atBatPitch={atBatPitch}
          onInning={setInning}
          onHalf={setHalf}
          onOrder={setOrder}
          onAtBatPitch={setAtBatPitch}
        />
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
                inning,
                half,
                order,
                pitchCount,
                atBatPitch,
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
  const [inning, setInning] = useState(G.inning);
  const [half, setHalf] = useState<'top' | 'bottom'>(G.half);
  const [order, setOrder] = useState(G.curBatterOrder);
  const [pitchCount, setPitchCount] = useState(G.pitchCount);
  const [atBatPitch, setAtBatPitch] = useState(G.cells[G.selCellKey]?.pitches?.length ?? 0);
  const [team, setTeam] = useState('');
  const [player, setPlayer] = useState('');
  const [memo, setMemo] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (open) {
      setInning(G.inning);
      setHalf(G.half);
      setOrder(G.curBatterOrder);
      setPitchCount(G.pitchCount);
      setAtBatPitch(G.cells[G.selCellKey]?.pitches?.length ?? 0);
    }
  }, [open, G.inning, G.half, G.curBatterOrder, G.pitchCount, G.cells, G.selCellKey]);

  if (!open) return null;
  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>기타 (직접 입력)</div>
        <ContextFields
          inning={inning}
          half={half}
          order={order}
          atBatPitch={atBatPitch}
          onInning={setInning}
          onHalf={setHalf}
          onOrder={setOrder}
          onAtBatPitch={setAtBatPitch}
        />
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
                inning,
                half,
                order,
                pitchCount,
                atBatPitch,
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
  const [inning, setInning] = useState(G.inning);
  const [half, setHalf] = useState<'top' | 'bottom'>(G.half);
  const [content, setContent] = useState('');
  const [situation, setSituation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [duration, setDuration] = useState('');

  useEffect(() => {
    if (open) {
      setInning(G.inning);
      setHalf(G.half);
    }
  }, [open, G.inning, G.half]);

  if (!open) return null;
  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>경기 지연/중단</div>
        <ContextFields inning={inning} half={half} onInning={setInning} onHalf={setHalf} />
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
                inning,
                half,
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
  const [inning, setInning] = useState(G.inning);
  const [half, setHalf] = useState<'top' | 'bottom'>(G.half);
  const [team, setTeam] = useState('');
  const [player, setPlayer] = useState('');
  const [kind, setKind] = useState('경고');
  const [content, setContent] = useState('');
  const [situation, setSituation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (open) {
      setInning(G.inning);
      setHalf(G.half);
    }
  }, [open, G.inning, G.half]);

  if (!open) return null;
  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>경고 및 퇴장</div>
        <ContextFields inning={inning} half={half} onInning={setInning} onHalf={setHalf} />
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
                inning,
                half,
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
  const [inning, setInning] = useState(G.inning);
  const [half, setHalf] = useState<'top' | 'bottom'>(G.half);
  const [oldUmpire, setOldUmpire] = useState('');
  const [newUmpire, setNewUmpire] = useState('');
  const [reason, setReason] = useState('');
  const [oldPos, setOldPos] = useState('');
  const [newPos, setNewPos] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (open) {
      setInning(G.inning);
      setHalf(G.half);
    }
  }, [open, G.inning, G.half]);

  if (!open) return null;
  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>심판 교체</div>
        <ContextFields inning={inning} half={half} onInning={setInning} onHalf={setHalf} />
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
                inning,
                half,
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

// ── 이벤트 인라인 편집 폼 ──────────────────────────────────────────────────────
function EventEditForm({
  ev,
  G,
  onSave,
  onCancel,
}: {
  ev: GameEvent;
  G: GameState;
  onSave: (updated: GameEvent) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<GameEvent>(ev);
  const upd = (partial: Record<string, unknown>) =>
    setDraft((p) => ({ ...p, ...partial }) as GameEvent);

  const d = draft as Record<string, unknown>;

  return (
    <div style={{ paddingTop: 8 }}>
      {/* 이닝/초말 공통 */}
      <ContextFields
        inning={Number(d.inning ?? 1)}
        half={(d.half as 'top' | 'bottom') ?? 'top'}
        order={'order' in d ? Number(d.order) : undefined}
        atBatPitch={'atBatPitch' in d ? Number(d.atBatPitch ?? 0) : undefined}
        onInning={(v) => upd({ inning: v })}
        onHalf={(v) => upd({ half: v })}
        onOrder={'order' in d ? (v) => upd({ order: v }) : undefined}
        onAtBatPitch={'atBatPitch' in d ? (v) => upd({ atBatPitch: v }) : undefined}
      />

      {/* mound / batter_timeout / pitcher_leave */}
      {(draft.type === 'mound' ||
        draft.type === 'batter_timeout' ||
        draft.type === 'pitcher_leave') && (
        <>
          <Field
            label="투수"
            value={String(d.pitcher ?? '')}
            onChange={(v) => upd({ pitcher: v })}
          />
          <Field
            label="상세 내용"
            value={String(d.detail ?? '')}
            onChange={(v) => upd({ detail: v })}
          />
        </>
      )}

      {/* video_review */}
      {draft.type === 'video_review' && (
        <>
          <TeamSelect G={G} value={String(d.team ?? '')} onChange={(v) => upd({ team: v })} />
          <Field
            label="판독 대상 선수"
            value={String(d.player ?? '')}
            onChange={(v) => upd({ player: v })}
          />
          <Field
            label="판독 내용"
            value={String(d.content ?? '')}
            onChange={(v) => upd({ content: v })}
            multiline
          />
          <Field
            label="세부 상황"
            value={String(d.situation ?? '')}
            onChange={(v) => upd({ situation: v })}
          />
          <Field
            label="최초 판정"
            value={String(d.firstCall ?? '')}
            onChange={(v) => upd({ firstCall: v })}
          />
          <Field
            label="판독 결과"
            value={String(d.result ?? '')}
            onChange={(v) => upd({ result: v })}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <Field
              label="시작시간"
              value={String(d.startTime ?? '')}
              onChange={(v) => upd({ startTime: v })}
              placeholder="HH:MM:SS"
            />
            <Field
              label="종료시간"
              value={String(d.endTime ?? '')}
              onChange={(v) => upd({ endTime: v })}
              placeholder="HH:MM:SS"
            />
          </div>
        </>
      )}

      {/* check_swing */}
      {draft.type === 'check_swing' && (
        <>
          <TeamSelect G={G} value={String(d.team ?? '')} onChange={(v) => upd({ team: v })} />
          <Field
            label="대상 선수"
            value={String(d.player ?? '')}
            onChange={(v) => upd({ player: v })}
          />
          <Field
            label="판정 심판"
            value={String(d.umpire ?? '')}
            onChange={(v) => upd({ umpire: v })}
          />
          <Field
            label="판정 결과"
            value={String(d.result ?? '')}
            onChange={(v) => upd({ result: v })}
          />
          <Field
            label="발생 상황"
            value={String(d.situation ?? '')}
            onChange={(v) => upd({ situation: v })}
            multiline
          />
        </>
      )}

      {/* memo_input */}
      {draft.type === 'memo_input' && (
        <>
          <TeamSelect G={G} value={String(d.team ?? '')} onChange={(v) => upd({ team: v })} />
          <Field
            label="관련 선수"
            value={String(d.player ?? '')}
            onChange={(v) => upd({ player: v })}
          />
          <Field
            label="메모 내용"
            value={String(d.memo ?? '')}
            onChange={(v) => upd({ memo: v })}
            multiline
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <Field
              label="시작시간"
              value={String(d.startTime ?? '')}
              onChange={(v) => upd({ startTime: v })}
              placeholder="HH:MM:SS"
            />
            <Field
              label="종료시간"
              value={String(d.endTime ?? '')}
              onChange={(v) => upd({ endTime: v })}
              placeholder="HH:MM:SS"
            />
          </div>
        </>
      )}

      {/* game_delay */}
      {draft.type === 'game_delay' && (
        <>
          <Field
            label="지연·중단 내용"
            value={String(d.content ?? '')}
            onChange={(v) => upd({ content: v })}
          />
          <Field
            label="세부 상황"
            value={String(d.situation ?? '')}
            onChange={(v) => upd({ situation: v })}
            multiline
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <Field
              label="시작시간"
              value={String(d.startTime ?? '')}
              onChange={(v) => upd({ startTime: v })}
              placeholder="HH:MM:SS"
            />
            <Field
              label="종료시간"
              value={String(d.endTime ?? '')}
              onChange={(v) => upd({ endTime: v })}
              placeholder="HH:MM:SS"
            />
            <Field
              label="소요시간"
              value={String(d.duration ?? '')}
              onChange={(v) => upd({ duration: v })}
              placeholder="mm:ss"
            />
          </div>
        </>
      )}

      {/* warning_ejection */}
      {draft.type === 'warning_ejection' && (
        <>
          <TeamSelect G={G} value={String(d.team ?? '')} onChange={(v) => upd({ team: v })} />
          <Field
            label="대상 선수"
            value={String(d.player ?? '')}
            onChange={(v) => upd({ player: v })}
          />
          <div style={fieldRow}>
            <span style={label}>구분</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {['경고', '퇴장'].map((k) => (
                <button
                  key={k}
                  style={teamBtn(String(d.kind) === k)}
                  onClick={() => upd({ kind: k })}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <Field
            label="발생 내용"
            value={String(d.content ?? '')}
            onChange={(v) => upd({ content: v })}
          />
          <Field
            label="세부 상황"
            value={String(d.situation ?? '')}
            onChange={(v) => upd({ situation: v })}
            multiline
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <Field
              label="시작시간"
              value={String(d.startTime ?? '')}
              onChange={(v) => upd({ startTime: v })}
              placeholder="HH:MM:SS"
            />
            <Field
              label="종료시간"
              value={String(d.endTime ?? '')}
              onChange={(v) => upd({ endTime: v })}
              placeholder="HH:MM:SS"
            />
          </div>
        </>
      )}

      {/* umpire_change */}
      {draft.type === 'umpire_change' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <Field
              label="기존 심판명"
              value={String(d.oldUmpire ?? '')}
              onChange={(v) => upd({ oldUmpire: v })}
            />
            <Field
              label="교체 심판명"
              value={String(d.newUmpire ?? '')}
              onChange={(v) => upd({ newUmpire: v })}
            />
            <Field
              label="교체 전 위치"
              value={String(d.oldPos ?? '')}
              onChange={(v) => upd({ oldPos: v })}
            />
            <Field
              label="교체 후 위치"
              value={String(d.newPos ?? '')}
              onChange={(v) => upd({ newPos: v })}
            />
          </div>
          <Field
            label="교체 사유"
            value={String(d.reason ?? '')}
            onChange={(v) => upd({ reason: v })}
            multiline
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <Field
              label="시작시간"
              value={String(d.startTime ?? '')}
              onChange={(v) => upd({ startTime: v })}
              placeholder="HH:MM:SS"
            />
            <Field
              label="종료시간"
              value={String(d.endTime ?? '')}
              onChange={(v) => upd({ endTime: v })}
              placeholder="HH:MM:SS"
            />
          </div>
        </>
      )}

      <div style={{ ...btnRow, marginTop: 8 }}>
        <button style={cancelBtn} onClick={onCancel}>
          취소
        </button>
        <button style={saveBtn} onClick={() => onSave(draft)}>
          저장
        </button>
      </div>
    </div>
  );
}

// ── 기타 리스트 보기 ───────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
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

const SPECIAL_TYPES = Object.keys(TYPE_LABEL);

export function MemoListModal({
  G,
  open,
  onClose,
  onEdit,
  onDelete,
}: {
  G: GameState;
  open: boolean;
  onClose: () => void;
  onEdit: (index: number, ev: GameEvent) => void;
  onDelete: (index: number) => void;
}) {
  const [editingOrigIdx, setEditingOrigIdx] = useState<number | null>(null);
  const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);

  const specialEvents = G.gameEvents
    .map((ev, origIdx) => ({ ev, origIdx }))
    .filter(({ ev }) => SPECIAL_TYPES.includes(ev.type));

  if (!open) return null;
  return (
    <div
      style={overlay}
      onClick={() => {
        setEditingOrigIdx(null);
        onClose();
      }}
    >
      <div style={{ ...dialog, minWidth: 440, maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>기타 목록</div>
        {specialEvents.length === 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
            기록된 이벤트 없음
          </div>
        ) : (
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {specialEvents.map(({ ev, origIdx }) => (
              <div
                key={origIdx}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid #e2e8f0',
                  fontSize: 12,
                  background: editingOrigIdx === origIdx ? '#f8fafc' : undefined,
                }}
              >
                {/* 헤더 행 */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
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
                    {TYPE_LABEL[ev.type] ?? ev.type}
                  </span>
                  <span style={{ color: '#6b7280', flex: 1 }}>
                    {ev.inning}회 {ev.half === 'top' ? '초' : '말'}
                    {'pitcher' in ev && ev.pitcher ? ` · 투수 ${ev.pitcher}` : ''}
                    {'atBatPitch' in ev && ev.atBatPitch != null
                      ? ` · 타석 ${ev.atBatPitch}구`
                      : ''}
                  </span>
                  {editingOrigIdx !== origIdx && confirmDeleteIdx !== origIdx && (
                    <>
                      <button
                        style={{ ...cancelBtn, padding: '2px 8px', fontSize: 11 }}
                        onClick={() => setEditingOrigIdx(origIdx)}
                      >
                        수정
                      </button>
                      <button
                        style={{
                          ...cancelBtn,
                          padding: '2px 8px',
                          fontSize: 11,
                          color: '#dc2626',
                          borderColor: '#fca5a5',
                        }}
                        onClick={() => setConfirmDeleteIdx(origIdx)}
                      >
                        삭제
                      </button>
                    </>
                  )}
                  {confirmDeleteIdx === origIdx && (
                    <>
                      <span style={{ fontSize: 11, color: '#dc2626' }}>삭제할까요?</span>
                      <button
                        style={{
                          ...saveBtn,
                          padding: '2px 8px',
                          fontSize: 11,
                          background: '#dc2626',
                          borderColor: '#dc2626',
                        }}
                        onClick={() => {
                          onDelete(origIdx);
                          setConfirmDeleteIdx(null);
                        }}
                      >
                        확인
                      </button>
                      <button
                        style={{ ...cancelBtn, padding: '2px 8px', fontSize: 11 }}
                        onClick={() => setConfirmDeleteIdx(null)}
                      >
                        취소
                      </button>
                    </>
                  )}
                </div>

                {/* 요약 (편집 중이 아닐 때) */}
                {editingOrigIdx !== origIdx && confirmDeleteIdx !== origIdx && (
                  <div style={{ color: '#374151', paddingLeft: 4, fontSize: 11 }}>
                    {'pitcher' in ev && ev.pitcher && <span>투수 {ev.pitcher} </span>}
                    {'detail' in ev && ev.detail && <span>· {ev.detail} </span>}
                    {'content' in ev && ev.content && <span>{ev.content} </span>}
                    {'player' in ev && ev.player && <span>· {ev.player} </span>}
                    {'team' in ev && ev.team && <span>({ev.team}) </span>}
                    {'result' in ev && ev.result && <span>→ {ev.result} </span>}
                    {'oldUmpire' in ev && (
                      <span>
                        {ev.oldUmpire} → {ev.newUmpire}{' '}
                      </span>
                    )}
                    {'memo' in ev && ev.memo && <span>{ev.memo}</span>}
                    {'situation' in ev && ev.situation && (
                      <span style={{ color: '#6b7280' }}>{ev.situation}</span>
                    )}
                  </div>
                )}

                {/* 인라인 편집 폼 */}
                {editingOrigIdx === origIdx && (
                  <EventEditForm
                    ev={ev}
                    G={G}
                    onSave={(updated) => {
                      onEdit(origIdx, updated);
                      setEditingOrigIdx(null);
                    }}
                    onCancel={() => setEditingOrigIdx(null)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        <div style={btnRow}>
          <button
            style={cancelBtn}
            onClick={() => {
              setEditingOrigIdx(null);
              onClose();
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
