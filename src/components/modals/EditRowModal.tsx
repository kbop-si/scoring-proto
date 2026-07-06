import { useState, useEffect, useRef } from 'react';
import type { CellEventEntry, Player, PitchType } from '../../types';
import type { EditRowInfo } from '../PitcherLogPanel';

// 비-투구 이벤트 행 라벨 (볼카운트 순서 수정 리스트용)
function eventEntryLabel(e: CellEventEntry): string {
  if (e.kind === 'runner_steal') {
    const ac = e.advCode ?? '';
    const cause =
      ac === 'W' || ac === '(W)'
        ? '폭투'
        : ac === 'P' || ac === '(P)'
          ? '포일'
          : ac.includes('BK')
            ? '보크'
            : '도루';
    return `/ ${e.runnerName} ${cause} → ${e.dest}`;
  }
  if (e.kind === 'runner_cs') {
    const cause = e.runOut.startsWith('X')
      ? '견제사'
      : e.runOut.startsWith('CS')
        ? '도루아웃'
        : '주자아웃';
    return `/ ${e.runnerName} ${cause}`;
  }
  if (e.kind === 'runner_adv') return `${e.runnerName} 진루 → ${e.dest}`;
  if (e.kind === 'note') return e.note;
  return '';
}

const PITCH_OPTIONS: { code: PitchType; label: string; color: string }[] = [
  { code: 'S', label: '스트라이크', color: '#111' },
  { code: 'SW', label: '헛스윙', color: '#111' },
  { code: 'B', label: '볼', color: '#111' },
  { code: 'F', label: '파울', color: '#111' },
  { code: 'FE', label: '파울실책', color: '#111' },
  { code: 'BS', label: '번트헛스윙', color: '#111' },
  { code: 'BF', label: '번트파울', color: '#111' },
  { code: 'PC1', label: '투수위반 볼', color: '#111' },
  { code: 'PC2', label: '포수위반 볼', color: '#111' },
  { code: 'PC3', label: '타자위반 스트라이크', color: '#111' },
];

const ZONE_OPTIONS: { code: number; label: string }[] = [
  { code: 1, label: '1 (투수)' },
  { code: 2, label: '2 (포수)' },
  { code: 3, label: '3 (1루)' },
  { code: 4, label: '4 (2루)' },
  { code: 5, label: '5 (3루)' },
  { code: 6, label: '6 (유격)' },
  { code: 7, label: '7 (좌)' },
  { code: 8, label: '8 (중)' },
  { code: 9, label: '9 (우)' },
];

const REASON_OPTIONS: { code: string; label: string }[] = [
  { code: 'S', label: '도루' },
  { code: '(S)', label: '(S) 무관심도루' },
  { code: 'SD', label: '이중도루' },
  { code: '(SD)', label: '(SD) 무관심이중도루' },
  { code: 'W', label: '폭투' },
  { code: '(W)', label: '(W) 폭투' },
  { code: 'P', label: '포일' },
  { code: '(P)', label: '(P) 포일' },
  { code: 'BK', label: '보크' },
  { code: '(BK)', label: '(BK) 보크' },
  { code: '✓BK', label: '✓ 보크' },
  { code: '✓(BK)', label: '✓(BK)' },
];

const BAT_RESULT_OPTIONS: { code: string; label: string }[] = [
  { code: 'H1', label: '안타' },
  { code: 'INT', label: '내야안타' },
  { code: 'BUNT', label: '번트안타' },
  { code: 'OBUNT', label: '외야번트' },
  { code: 'E1', label: '실책 (1)' },
  { code: 'E2', label: '실책 (2)' },
  { code: 'E3', label: '실책 (3)' },
  { code: 'E4', label: '실책 (4)' },
  { code: 'E5', label: '실책 (5)' },
  { code: 'E6', label: '실책 (6)' },
  { code: 'E7', label: '실책 (7)' },
  { code: 'E8', label: '실책 (8)' },
  { code: 'E9', label: '실책 (9)' },
];

interface Props {
  info: EditRowInfo | null;
  onClose: () => void;
  onSavePitch: (cellKey: string, entryIdx: number, newPitch: PitchType) => void;
  onSaveZone: (cellKey: string, newZone: number) => void;
  onSaveRunnerReason: (cellKey: string, entryIdx: number, newAdvCode: string) => void;
  onSaveBatResultCode: (cellKey: string, newResult: string) => void;
  onSaveBatOutCode: (cellKey: string, newResult: string, newBallType?: '땅' | '뜬' | '라') => void;
  onSavePitchSeq: (cellKey: string, pitches: PitchType[]) => void;
  // 도루 '/' 등 주자 이벤트 포함 순서 수정 (eventLog result 이전 구간 통째 교체)
  onSavePitchEventSeq?: (cellKey: string, entries: CellEventEntry[]) => void;
  onPinchHitter?: (
    cellKey: string,
    player: Player,
    mid?: { balls: number; strikes: number }
  ) => void;
  onPitcherChange?: (
    side: 'away' | 'home',
    inning: number,
    half: 'top' | 'bottom',
    order: number,
    player: Player,
    mid?: { balls: number; strikes: number; pitches?: number }
  ) => void;
  getBench?: (side: 'away' | 'home') => Player[];
}

// 아웃 결과의 prefix 추출 (땅/F/f/L/IF/SF/BU/SH)
function parseOutResult(result: string): {
  prefix: '' | 'F' | 'f' | 'L' | 'IF' | 'SF' | 'BU' | 'SH';
  fielders: string;
} {
  if (result.startsWith('SF')) return { prefix: 'SF', fielders: result.slice(2) };
  if (result.startsWith('IF')) return { prefix: 'IF', fielders: result.slice(2) };
  if (result.startsWith('BU')) return { prefix: 'BU', fielders: result.slice(2) };
  if (result.startsWith('SH')) return { prefix: 'SH', fielders: result.slice(2) };
  if (result.startsWith('F')) return { prefix: 'F', fielders: result.slice(1) };
  if (result.startsWith('f')) return { prefix: 'f', fielders: result.slice(1) };
  if (result.startsWith('L')) return { prefix: 'L', fielders: result.slice(1) };
  return { prefix: '', fielders: result };
}

// 투구 시퀀스에서 볼·스트라이크 카운트 계산
function computeCount(pitches: PitchType[]): { balls: number; strikes: number } {
  let balls = 0;
  let strikes = 0;
  for (const p of pitches) {
    switch (p) {
      case 'S':
      case 'SW':
      case 'BS':
      case 'PC3':
        strikes = Math.min(strikes + 1, 3);
        break;
      case 'F':
      case 'FE':
        if (strikes < 2) strikes++;
        break;
      case 'BF':
        strikes = Math.min(strikes + 1, 3);
        break;
      case 'B':
      case 'PC1':
      case 'PC2':
        balls = Math.min(balls + 1, 4);
        break;
    }
  }
  return { balls, strikes };
}

// 결과 타입별 필요 볼·스트라이크 검증
function validateSeq(pitches: PitchType[], result: string | null): string | null {
  if (!result) return null;
  const { balls, strikes } = computeCount(pitches);
  if (result === 'K' || result === 'KW' || result === 'KE' || result === 'KP') {
    if (strikes < 3) return `삼진 결과에는 스트라이크가 3개 필요합니다 (현재 ${strikes}개)`;
  } else if (result === 'B' || result === 'BB') {
    if (balls < 4) return `볼넷 결과에는 볼이 4개 필요합니다 (현재 ${balls}개)`;
  }
  return null;
}

export default function EditRowModal({
  info,
  onClose,
  onSavePitch,
  onSaveZone,
  onSaveRunnerReason,
  onSaveBatResultCode,
  onSaveBatOutCode,
  onSavePitchSeq,
  onSavePitchEventSeq,
  onPinchHitter,
  onPitcherChange,
  getBench,
}: Props) {
  // 아웃 편집 state — info가 bat_out_code일 때만 의미 있음
  const initialOut =
    info?.kind === 'bat_out_code'
      ? parseOutResult(info.currentResult)
      : { prefix: '' as const, fielders: '' };
  const [outPrefix, setOutPrefix] = useState<typeof initialOut.prefix>(initialOut.prefix);
  const [outFielders, setOutFielders] = useState(initialOut.fielders);
  // pitch_seq / batter_edit 편집 state
  const [seqPitches, setSeqPitches] = useState<PitchType[]>([]);
  // batter_edit: 투구 + 주자 이벤트(도루 '/' 등) 통합 리스트 — eventLog result 이전 구간
  const [seqEntries, setSeqEntries] = useState<CellEventEntry[]>([]);
  const [seqError, setSeqError] = useState<string | null>(null);
  const seqDragFromRef = useRef<number | null>(null);
  const [seqDragOver, setSeqDragOver] = useState<number | null>(null);
  // batter_edit 탭 state
  const [batterTab, setBatterTab] = useState<'count' | 'pinch'>('count');
  const [phSelIdx, setPhSelIdx] = useState<number | null>(null);
  const [phQuery, setPhQuery] = useState('');
  const [phMidPitchIdx, setPhMidPitchIdx] = useState<number | null>(null);
  const [phUseMid, setPhUseMid] = useState(false);
  // pitcher_edit state
  const [pitcherQuery, setPitcherQuery] = useState('');
  const [pitcherSelIdx, setPitcherSelIdx] = useState<number | null>(null);
  const [pitcherMidCount, setPitcherMidCount] = useState(0);
  const [pitcherUseMid, setPitcherUseMid] = useState(false);
  // info 바뀌면 state 재설정
  useEffect(() => {
    if (info?.kind === 'bat_out_code') {
      const p = parseOutResult(info.currentResult);
      setOutPrefix(p.prefix);
      setOutFielders(p.fielders);
    }
    if (info?.kind === 'pitch_seq' || info?.kind === 'batter_edit') {
      setSeqPitches([...(info.pitches ?? [])]);
      // batter_edit: eventLog 있으면 도루 '/' 포함 통합 리스트, 없으면 pitches 폴백
      const events = info.kind === 'batter_edit' ? info.events : undefined;
      setSeqEntries(
        events
          ? [...events]
          : (info.pitches ?? []).map((p) => ({ kind: 'pitch' as const, pitch: p }))
      );
      setSeqError(null);
      setBatterTab('count');
      setPhSelIdx(null);
      setPhQuery('');
      setPhMidPitchIdx(null);
      setPhUseMid(false);
    }
    if (info?.kind === 'pitcher_edit') {
      setPitcherQuery('');
      setPitcherSelIdx(null);
      setPitcherMidCount(info.currentPitchCount);
      setPitcherUseMid(false);
    }
  }, [info]);

  if (!info) return null;

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };
  const dialog: React.CSSProperties = {
    background: '#fff',
    borderRadius: 6,
    padding: 16,
    minWidth: 280,
    maxWidth: 420,
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  };
  const arrowBtn: React.CSSProperties = {
    padding: '1px 5px',
    fontSize: 11,
    border: '1px solid #cbd5e1',
    background: '#fff',
    borderRadius: 3,
    cursor: 'pointer',
  };

  if (info.kind === 'pitch') {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={dialog} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>
            투구 종류 수정 (현재: {PITCH_OPTIONS.find((o) => o.code === info.currentPitch)?.label})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {PITCH_OPTIONS.map((o) => (
              <button
                key={o.code}
                onClick={() => {
                  onSavePitch(info.cellKey, info.entryIdx, o.code);
                  onClose();
                }}
                style={{
                  padding: '6px 8px',
                  fontSize: 12,
                  fontWeight: o.code === info.currentPitch ? 700 : 500,
                  border: `1px solid ${o.code === info.currentPitch ? o.color : '#cbd5e1'}`,
                  background: o.code === info.currentPitch ? `${o.color}15` : '#fff',
                  color: o.color,
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button
              onClick={onClose}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                border: '1px solid #cbd5e1',
                background: '#fff',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (info.kind === 'runner_reason') {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={dialog} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>
            진루 사유 변경 — {info.runnerName} → {info.dest}
            {info.currentAdvCode ? ` (현재: ${info.currentAdvCode})` : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {REASON_OPTIONS.map((o) => (
              <button
                key={o.code}
                onClick={() => {
                  onSaveRunnerReason(info.cellKey, info.entryIdx, o.code);
                  onClose();
                }}
                style={{
                  padding: '6px 8px',
                  fontSize: 12,
                  fontWeight: o.code === info.currentAdvCode ? 700 : 500,
                  border: `1px solid ${o.code === info.currentAdvCode ? '#059669' : '#cbd5e1'}`,
                  background: o.code === info.currentAdvCode ? '#f0fdf4' : '#fff',
                  color: '#059669',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button
              onClick={onClose}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                border: '1px solid #cbd5e1',
                background: '#fff',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (info.kind === 'bat_result_code') {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={dialog} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>
            타격 결과 종류 변경 (현재: {info.currentResult})
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
            ⓘ 동일 베이스 도달 결과 안에서만 교환 가능 (1B 도달)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {BAT_RESULT_OPTIONS.map((o) => (
              <button
                key={o.code}
                onClick={() => {
                  onSaveBatResultCode(info.cellKey, o.code);
                  onClose();
                }}
                style={{
                  padding: '6px 8px',
                  fontSize: 12,
                  fontWeight: o.code === info.currentResult ? 700 : 500,
                  border: `1px solid ${o.code === info.currentResult ? '#7c3aed' : '#cbd5e1'}`,
                  background: o.code === info.currentResult ? '#f5f3ff' : '#fff',
                  color: '#7c3aed',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button
              onClick={onClose}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                border: '1px solid #cbd5e1',
                background: '#fff',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (info.kind === 'bat_out_code') {
    // 결과 미리보기 빌드
    const previewResult = outPrefix + outFielders;
    // 표시 ballType: 땅볼은 ballType='땅' 으로 저장하고, F/L 등은 result에 이미 표기되므로 ballType 빼는게 자연스러움
    const finalBallType: '땅' | '뜬' | '라' | undefined =
      outPrefix === '' || outPrefix === 'BU' || outPrefix === 'SH' ? '땅' : undefined;
    const PREFIX_OPTS: { code: typeof outPrefix; label: string }[] = [
      { code: '', label: '땅볼' },
      { code: 'F', label: 'F (플라이)' },
      { code: 'f', label: 'f (작은플라이)' },
      { code: 'L', label: 'L (라이너)' },
      { code: 'IF', label: 'IF (내야플라이)' },
      { code: 'SF', label: 'SF (희생플라이)' },
      { code: 'BU', label: 'BU (번트아웃)' },
      { code: 'SH', label: 'SH (희생번트)' },
    ];
    const FIELDER_OPTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    const setSingleFielder = (f: string) => setOutFielders(f);

    return (
      <div style={overlay} onClick={onClose}>
        <div
          style={{ ...dialog, minWidth: 320, maxWidth: 480 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>
            아웃 결과 변경 (현재: {info.currentResult}
            {info.currentBallType ? ` ${info.currentBallType}` : ''})
          </div>

          {/* 타구 종류 (prefix) */}
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>타구 종류</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
              marginBottom: 10,
            }}
          >
            {PREFIX_OPTS.map((o) => (
              <button
                key={o.code || 'ground'}
                onClick={() => setOutPrefix(o.code)}
                style={{
                  padding: '6px 8px',
                  fontSize: 12,
                  fontWeight: o.code === outPrefix ? 700 : 500,
                  border: `1px solid ${o.code === outPrefix ? '#dc2626' : '#cbd5e1'}`,
                  background: o.code === outPrefix ? '#fef2f2' : '#fff',
                  color: '#dc2626',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* 수비 번호 (단일 — 빠른 선택) */}
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
            수비 번호 (단일 빠른 선택)
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(9, 1fr)',
              gap: 4,
              marginBottom: 10,
            }}
          >
            {FIELDER_OPTS.map((f) => (
              <button
                key={f}
                onClick={() => setSingleFielder(f)}
                style={{
                  padding: '6px 0',
                  fontSize: 13,
                  fontWeight: outFielders === f ? 700 : 500,
                  border: `1px solid ${outFielders === f ? '#dc2626' : '#cbd5e1'}`,
                  background: outFielders === f ? '#fef2f2' : '#fff',
                  color: '#dc2626',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* 수비 시퀀스 직접 입력 (6-3 등) */}
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
            또는 직접 입력 (6-3, 4-6-3 등)
          </div>
          <input
            type="text"
            value={outFielders}
            onChange={(e) => setOutFielders(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: 13,
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              marginBottom: 10,
            }}
            placeholder="예: 6-3, 4-6-3"
          />

          {/* 미리보기 */}
          <div
            style={{
              padding: '8px',
              background: '#f8fafc',
              borderRadius: 4,
              marginBottom: 10,
              fontSize: 13,
            }}
          >
            <span style={{ color: '#64748b' }}>새 결과: </span>
            <span style={{ fontWeight: 700, color: '#dc2626' }}>
              {previewResult || '(비어있음)'}
              {finalBallType && outPrefix === '' ? ' 땅' : ''}
            </span>
          </div>

          {/* 버튼 */}
          <div
            style={{
              marginTop: 12,
              textAlign: 'right',
              display: 'flex',
              gap: 6,
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                border: '1px solid #cbd5e1',
                background: '#fff',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              onClick={() => {
                if (!outFielders) return;
                onSaveBatOutCode(info.cellKey, previewResult, finalBallType);
                onClose();
              }}
              disabled={!outFielders}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 700,
                border: '1px solid #dc2626',
                background: outFielders ? '#dc2626' : '#fca5a5',
                color: '#fff',
                borderRadius: 4,
                cursor: outFielders ? 'pointer' : 'not-allowed',
              }}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── pitcher_edit ──────────────────────────────────────────────────────────
  if (info.kind === 'pitcher_edit') {
    const bench = getBench?.(info.pitchingSide) ?? [];
    const q = pitcherQuery.trim();
    const filtered = bench.filter((p) => !q || p.name.includes(q) || p.num.includes(q));
    const canConfirm = pitcherSelIdx !== null;
    const handleConfirm = () => {
      if (pitcherSelIdx === null) return;
      const player = bench[pitcherSelIdx];
      onPitcherChange?.(
        info.pitchingSide,
        info.inning,
        info.half,
        info.order,
        player,
        pitcherUseMid ? { balls: 0, strikes: 0, pitches: pitcherMidCount } : undefined
      );
      onClose();
    };
    return (
      <div style={overlay} onClick={onClose}>
        <div style={{ ...dialog, minWidth: 300 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>
            투수 교체 — {info.inning}회{info.half === 'top' ? '초' : '말'} {info.order}번 타자
          </div>
          <input
            type="text"
            placeholder="이름/번호 검색"
            value={pitcherQuery}
            onChange={(e) => setPitcherQuery(e.target.value)}
            style={{
              width: '100%',
              marginBottom: 6,
              boxSizing: 'border-box',
              padding: '4px 6px',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              fontSize: 13,
            }}
          />
          <div
            style={{
              maxHeight: 200,
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              marginBottom: 10,
            }}
          >
            {filtered.length === 0 && (
              <div style={{ padding: 8, color: '#94a3b8', fontSize: 12 }}>벤치 선수 없음</div>
            )}
            {filtered.map((p, fi) => {
              const origIdx = bench.indexOf(p);
              return (
                <div
                  key={fi}
                  onClick={() => setPitcherSelIdx(origIdx)}
                  style={{
                    padding: '5px 10px',
                    cursor: 'pointer',
                    background: pitcherSelIdx === origIdx ? '#dce8ff' : 'transparent',
                    fontSize: 13,
                  }}
                >
                  {p.num} {p.name}
                </div>
              );
            })}
          </div>
          <label
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 8 }}
          >
            <input
              type="checkbox"
              checked={pitcherUseMid}
              onChange={(e) => setPitcherUseMid(e.target.checked)}
            />
            타석 도중 교체 (몇 구째 후)
          </label>
          {pitcherUseMid && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 8,
                fontSize: 13,
              }}
            >
              <span>투구 수:</span>
              <input
                type="number"
                min={0}
                max={info.currentPitchCount}
                value={pitcherMidCount}
                onChange={(e) =>
                  setPitcherMidCount(
                    Math.max(0, Math.min(info.currentPitchCount, Number(e.target.value)))
                  )
                }
                style={{
                  width: 56,
                  textAlign: 'center',
                  padding: '3px 6px',
                  border: '1px solid #cbd5e1',
                  borderRadius: 4,
                }}
              />
              <span style={{ color: '#94a3b8', fontSize: 11 }}>/ {info.currentPitchCount}구</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button
              onClick={onClose}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                border: '1px solid #cbd5e1',
                background: '#fff',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                border: '1px solid #059669',
                background: canConfirm ? '#059669' : '#a7f3d0',
                color: '#fff',
                borderRadius: 4,
                cursor: canConfirm ? 'pointer' : 'not-allowed',
              }}
            >
              확인
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── batter_edit ───────────────────────────────────────────────────────────
  if (info.kind === 'batter_edit') {
    const bench = getBench?.(info.battingSide) ?? [];
    const q = phQuery.trim();
    const filteredBench = bench.filter((p) => !q || p.name.includes(q) || p.num.includes(q));

    const FOUL_TYPES: PitchType[] = ['F', 'BF', 'FE'];
    // 통합 리스트에서 파생된 투구 시퀀스 (검증·대타 mid 선택용)
    const entryPitches: PitchType[] = seqEntries
      .filter((e): e is Extract<CellEventEntry, { kind: 'pitch' }> => e.kind === 'pitch')
      .map((e) => e.pitch);
    const changeType = (i: number, p: PitchType) => {
      setSeqEntries((prev) =>
        prev.map((e, idx) => (idx === i && e.kind === 'pitch' ? { kind: 'pitch', pitch: p } : e))
      );
      setSeqError(null);
    };
    const remove = (i: number) => {
      setSeqEntries((prev) => prev.filter((_, idx) => idx !== i));
      setSeqError(null);
    };
    const addFoul = (p: PitchType) => {
      setSeqEntries((prev) => [...prev, { kind: 'pitch', pitch: p }]);
      setSeqError(null);
    };
    const handleSaveSeq = () => {
      const err = validateSeq(entryPitches, info.result);
      if (err) {
        setSeqError(err);
        return;
      }
      // eventLog 기반 셀이면 주자 이벤트 포함 통째 저장, 구형 데이터는 투구만 저장
      if (info.events !== undefined && onSavePitchEventSeq) {
        onSavePitchEventSeq(info.cellKey, seqEntries);
      } else {
        onSavePitchSeq(info.cellKey, entryPitches);
      }
      onClose();
    };
    const handleSavePinch = () => {
      if (phSelIdx === null) return;
      const player = bench[phSelIdx];
      let mid: { balls: number; strikes: number } | undefined;
      if (phUseMid && phMidPitchIdx !== null) {
        mid = { balls: pitchCounts[phMidPitchIdx].b, strikes: pitchCounts[phMidPitchIdx].s };
      }
      onPinchHitter?.(info.cellKey, player, mid);
      onClose();
    };

    // entryCounts: seqEntries 인덱스별 누적 카운트 / pitchCounts: 투구 순번별 누적 카운트
    const entryCounts: { b: number; s: number }[] = [];
    const pitchCounts: { b: number; s: number }[] = [];
    // entryPitchNo: 투구 entry의 순번 (1-base), 비-투구는 0
    const entryPitchNo: number[] = [];
    {
      let rb = 0,
        rs = 0,
        pn = 0;
      for (const e of seqEntries) {
        if (e.kind === 'pitch') {
          pn++;
          switch (e.pitch) {
            case 'S':
            case 'SW':
            case 'BS':
            case 'PC3':
              rs = Math.min(rs + 1, 3);
              break;
            case 'F':
            case 'FE':
              if (rs < 2) rs++;
              break;
            case 'BF':
              rs = Math.min(rs + 1, 3);
              break;
            case 'B':
            case 'PC1':
            case 'PC2':
              rb = Math.min(rb + 1, 4);
              break;
          }
          pitchCounts.push({ b: rb, s: rs });
        }
        entryCounts.push({ b: rb, s: rs });
        entryPitchNo.push(e.kind === 'pitch' ? pn : 0);
      }
    }

    const tabStyle = (active: boolean): React.CSSProperties => ({
      padding: '5px 14px',
      fontSize: 12,
      cursor: 'pointer',
      border: 'none',
      borderBottom: active ? '2px solid #1e40af' : '2px solid transparent',
      background: 'transparent',
      fontWeight: active ? 700 : 400,
      color: active ? '#1e40af' : '#64748b',
    });

    return (
      <div style={overlay} onClick={onClose}>
        <div
          style={{ ...dialog, minWidth: 340, maxWidth: 480 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 12 }}>
            <button style={tabStyle(batterTab === 'count')} onClick={() => setBatterTab('count')}>
              볼카운트 수정
            </button>
            <button style={tabStyle(batterTab === 'pinch')} onClick={() => setBatterTab('pinch')}>
              대타 교체
            </button>
          </div>

          {batterTab === 'count' && (
            <>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>
                볼카운트 순서 수정
              </div>
              {seqEntries.some((e) => e.kind !== 'pitch') && (
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                  ⓘ 도루(/) 등 주자 이벤트 행도 드래그로 순서를 옮길 수 있습니다
                </div>
              )}
              <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 8 }}>
                {seqEntries.map((entry, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => {
                      seqDragFromRef.current = i;
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (seqDragOver !== i) setSeqDragOver(i);
                    }}
                    onDragLeave={() => setSeqDragOver(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = seqDragFromRef.current;
                      if (from !== null && from !== i) {
                        setSeqEntries((prev) => {
                          const next = [...prev];
                          const [item] = next.splice(from, 1);
                          next.splice(i, 0, item);
                          return next;
                        });
                        setSeqError(null);
                      }
                      setSeqDragOver(null);
                    }}
                    onDragEnd={() => {
                      seqDragFromRef.current = null;
                      setSeqDragOver(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      marginBottom: 4,
                      padding: '3px 4px',
                      background:
                        seqDragOver === i
                          ? '#dbeafe'
                          : entry.kind === 'pitch'
                            ? '#f8fafc'
                            : '#f0fdf4',
                      borderRadius: 4,
                      border: seqDragOver === i ? '1px solid #3b82f6' : '1px solid transparent',
                      cursor: 'grab',
                    }}
                  >
                    <span style={{ color: '#94a3b8', fontSize: 13, userSelect: 'none' }}>⠿</span>
                    <span style={{ width: 20, color: '#94a3b8', fontSize: 11 }}>
                      {entry.kind === 'pitch' ? entryPitchNo[i] : ''}
                    </span>
                    {entry.kind === 'pitch' ? (
                      <select
                        value={entry.pitch}
                        onChange={(e) => changeType(i, e.target.value as PitchType)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          fontSize: 12,
                          flex: 1,
                          padding: '2px 4px',
                          borderRadius: 3,
                          border: '1px solid #cbd5e1',
                          cursor: 'auto',
                        }}
                      >
                        {PITCH_OPTIONS.map((o) => (
                          <option key={o.code} value={o.code}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        style={{
                          fontSize: 12,
                          flex: 1,
                          padding: '2px 4px',
                          fontWeight: 700,
                          color: '#059669',
                        }}
                      >
                        {eventEntryLabel(entry)}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: '#64748b', width: 36, textAlign: 'right' }}>
                      {entryCounts[i].b}B {entryCounts[i].s}S
                    </span>
                    {entry.kind === 'pitch' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(i);
                        }}
                        style={{
                          padding: '1px 5px',
                          fontSize: 11,
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          borderRadius: 3,
                          cursor: 'pointer',
                          color: '#ef4444',
                        }}
                      >
                        ✕
                      </button>
                    ) : (
                      <span style={{ width: 23 }} />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {FOUL_TYPES.map((ft) => (
                  <button
                    key={ft}
                    onClick={() => addFoul(ft)}
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      border: '1px solid #92400e',
                      color: '#92400e',
                      background: '#fff',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    + {PITCH_OPTIONS.find((o) => o.code === ft)?.label}
                  </button>
                ))}
              </div>
              {seqError && (
                <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 6 }}>{seqError}</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleSaveSeq}
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    border: '1px solid #1e40af',
                    background: '#1e40af',
                    color: '#fff',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  저장
                </button>
              </div>
            </>
          )}

          {batterTab === 'pinch' && (
            <>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>대타 교체</div>
              <input
                type="text"
                placeholder="이름/번호 검색"
                value={phQuery}
                onChange={(e) => setPhQuery(e.target.value)}
                style={{
                  width: '100%',
                  marginBottom: 6,
                  boxSizing: 'border-box',
                  padding: '4px 6px',
                  border: '1px solid #cbd5e1',
                  borderRadius: 4,
                  fontSize: 13,
                }}
              />
              <div
                style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: 4,
                  marginBottom: 8,
                }}
              >
                {filteredBench.length === 0 && (
                  <div style={{ padding: 8, color: '#94a3b8', fontSize: 12 }}>벤치 선수 없음</div>
                )}
                {filteredBench.map((p, fi) => {
                  const origIdx = bench.indexOf(p);
                  return (
                    <div
                      key={fi}
                      onClick={() => setPhSelIdx(origIdx)}
                      style={{
                        padding: '5px 10px',
                        cursor: 'pointer',
                        background: phSelIdx === origIdx ? '#fef9c3' : 'transparent',
                        fontSize: 13,
                      }}
                    >
                      {p.num} {p.name}
                    </div>
                  );
                })}
              </div>
              {entryPitches.length > 0 && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    marginBottom: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={phUseMid}
                    onChange={(e) => {
                      setPhUseMid(e.target.checked);
                      setPhMidPitchIdx(null);
                    }}
                  />
                  볼카운트 도중 교체
                </label>
              )}
              {phUseMid && entryPitches.length > 0 && (
                <div
                  style={{
                    maxHeight: 160,
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: 4,
                    marginBottom: 8,
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      padding: '4px 8px',
                      color: '#64748b',
                      fontSize: 11,
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    몇 구째 후 교체? (클릭 선택)
                  </div>
                  {entryPitches.map((p, i) => {
                    const pitchLabel = PITCH_OPTIONS.find((o) => o.code === p)?.label ?? p;
                    const cnt = pitchCounts[i];
                    const selected = phMidPitchIdx === i;
                    return (
                      <div
                        key={i}
                        onClick={() => setPhMidPitchIdx(selected ? null : i)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '4px 8px',
                          cursor: 'pointer',
                          background: selected ? '#dce8ff' : 'transparent',
                          borderBottom: '1px solid #f1f5f9',
                        }}
                      >
                        <span style={{ color: '#94a3b8', minWidth: 22 }}>{i + 1}구</span>
                        <span style={{ flex: 1 }}>{pitchLabel}</span>
                        <span style={{ color: '#64748b', fontSize: 11 }}>
                          → {cnt.b}B {cnt.s}S
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleSavePinch}
                  disabled={
                    phSelIdx === null ||
                    (phUseMid && entryPitches.length > 0 && phMidPitchIdx === null)
                  }
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    border: '1px solid #dc2626',
                    background:
                      phSelIdx !== null &&
                      !(phUseMid && entryPitches.length > 0 && phMidPitchIdx === null)
                        ? '#dc2626'
                        : '#fca5a5',
                    color: '#fff',
                    borderRadius: 4,
                    cursor:
                      phSelIdx !== null &&
                      !(phUseMid && entryPitches.length > 0 && phMidPitchIdx === null)
                        ? 'pointer'
                        : 'not-allowed',
                  }}
                >
                  확인
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (info.kind === 'pitch_seq') {
    const FOUL_TYPES: PitchType[] = ['F', 'BF', 'FE'];
    const changeType = (i: number, p: PitchType) => {
      const next = [...seqPitches];
      next[i] = p;
      setSeqPitches(next);
      setSeqError(null);
    };
    const remove = (i: number) => {
      setSeqPitches(seqPitches.filter((_, idx) => idx !== i));
      setSeqError(null);
    };
    const addFoul = (p: PitchType) => {
      setSeqPitches([...seqPitches, p]);
      setSeqError(null);
    };
    const handleSave = () => {
      const err = validateSeq(seqPitches, info.result);
      if (err) {
        setSeqError(err);
        return;
      }
      onSavePitchSeq(info.cellKey, seqPitches);
      onClose();
    };
    const handleDrop = (toIdx: number) => {
      const fromIdx = seqDragFromRef.current;
      if (fromIdx === null || fromIdx === toIdx) return;
      const next = [...seqPitches];
      const [item] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, item);
      setSeqPitches(next);
      setSeqError(null);
    };
    const counts: { b: number; s: number }[] = [];
    let rb = 0;
    let rs = 0;
    for (const p of seqPitches) {
      switch (p) {
        case 'S':
        case 'SW':
        case 'BS':
        case 'PC3':
          rs = Math.min(rs + 1, 3);
          break;
        case 'F':
        case 'FE':
          if (rs < 2) rs++;
          break;
        case 'BF':
          rs = Math.min(rs + 1, 3);
          break;
        case 'B':
        case 'PC1':
        case 'PC2':
          rb = Math.min(rb + 1, 4);
          break;
      }
      counts.push({ b: rb, s: rs });
    }
    return (
      <div style={overlay} onClick={onClose}>
        <div
          style={{ ...dialog, minWidth: 340, maxWidth: 480 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>볼카운트 순서 수정</div>
          <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 8 }}>
            {seqPitches.map((p, i) => (
              <div
                key={i}
                draggable
                onDragStart={() => {
                  seqDragFromRef.current = i;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (seqDragOver !== i) setSeqDragOver(i);
                }}
                onDragLeave={() => setSeqDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(i);
                  setSeqDragOver(null);
                }}
                onDragEnd={() => {
                  seqDragFromRef.current = null;
                  setSeqDragOver(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginBottom: 4,
                  padding: '3px 4px',
                  background: seqDragOver === i ? '#dbeafe' : '#f8fafc',
                  borderRadius: 4,
                  border: seqDragOver === i ? '1px solid #3b82f6' : '1px solid transparent',
                  cursor: 'grab',
                }}
              >
                <span style={{ color: '#94a3b8', fontSize: 13, userSelect: 'none' }}>⠿</span>
                <span style={{ width: 20, color: '#94a3b8', fontSize: 11 }}>{i + 1}</span>
                <select
                  value={p}
                  onChange={(e) => changeType(i, e.target.value as PitchType)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    fontSize: 12,
                    flex: 1,
                    padding: '2px 4px',
                    borderRadius: 3,
                    border: '1px solid #cbd5e1',
                    cursor: 'auto',
                  }}
                >
                  {PITCH_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: '#64748b', width: 36, textAlign: 'right' }}>
                  {counts[i].b}B {counts[i].s}S
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(i);
                  }}
                  style={{ ...arrowBtn, color: '#ef4444' }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {FOUL_TYPES.map((ft) => (
              <button
                key={ft}
                onClick={() => addFoul(ft)}
                style={{
                  fontSize: 11,
                  padding: '3px 8px',
                  border: '1px solid #92400e',
                  color: '#92400e',
                  background: '#fff',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                + {PITCH_OPTIONS.find((o) => o.code === ft)?.label}
              </button>
            ))}
          </div>
          {seqError && (
            <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 6 }}>{seqError}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button
              onClick={onClose}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                border: '1px solid #cbd5e1',
                background: '#fff',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                border: '1px solid #1e40af',
                background: '#1e40af',
                color: '#fff',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    );
  }

  // info.kind === 'hit' — zone 변경
  const curZone = info.currentHitData?.zone ?? null;
  return (
    <div style={overlay} onClick={onClose}>
      <div style={dialog} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>
          안타 방향(zone) 수정{curZone != null ? ` (현재: ${curZone})` : ''}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {ZONE_OPTIONS.map((o) => (
            <button
              key={o.code}
              onClick={() => {
                onSaveZone(info.cellKey, o.code);
                onClose();
              }}
              style={{
                padding: '8px 6px',
                fontSize: 12,
                fontWeight: o.code === curZone ? 700 : 500,
                border: `1px solid ${o.code === curZone ? '#7c3aed' : '#cbd5e1'}`,
                background: o.code === curZone ? '#f5f3ff' : '#fff',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              border: '1px solid #cbd5e1',
              background: '#fff',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
