import { useRef, useState } from 'react';
import type { GameState, Base, BaseTargetState, Runner } from '../types';
import { BASE_XY, FPOS_XY } from '../data/constants';

interface Props {
  G: GameState;
  selRunnerBase: Base | null;
  baseTargets: BaseTargetState;
  chainBases: Set<Base>;
  chainPendingBase: Base | null;
  chainTransitRunner?: Runner | null;
  showChainEndButton?: boolean;
  onRunnerToggle: (base: Base) => void;
  onBaseTargetClick: (dest: string) => void;
  onRunnerDestClick?: (dest: Base | 'HOME') => void;
  onFielderClick: (e: React.MouseEvent, pos: number) => void;
  onRunnerContextMenu?: (base: Base) => void;
  onBatterContextMenu?: () => void;
  onBatterRightClick?: () => void; // 스위치 타자 좌/우 토글 (hitType=3 만 의미)
  onChainPendingClick?: () => void;
  onChainEnd?: () => void;
  onFieldPosSwap?: (fromPos: number, toPos: number) => void;
}

function getNextBases(from: string): string[] {
  const order: Record<string, number> = { '1B': 1, '2B': 2, '3B': 3, HOME: 4 };
  const all = ['1B', '2B', '3B', 'HOME'];
  const cur = order[from] ?? 0;
  return all.filter((b) => order[b] > cur);
}

export default function Diamond({
  G,
  selRunnerBase,
  baseTargets,
  chainBases,
  chainPendingBase,
  chainTransitRunner,
  showChainEndButton = true,
  onRunnerToggle,
  onBaseTargetClick,
  onRunnerDestClick,
  onFielderClick,
  onRunnerContextMenu,
  onBatterContextMenu,
  onBatterRightClick,
  onChainPendingClick,
  onChainEnd,
  onFieldPosSwap,
}: Props) {
  // 수비 위치 드래그 — drag start/over 사이에 React 재렌더 전에 dragover 가 fire 되면
  // state-based closure 가 stale 해져 preventDefault 누락. ref 로 동기 읽기.
  const posDragFromRef = useRef<number | null>(null);
  const [posDragOver, setPosDragOver] = useState<number | null>(null);
  const curLU = G.half === 'top' ? G.awayLineup : G.homeLineup;
  const defLU = G.half === 'top' ? G.homeLineup : G.awayLineup;
  const batter = curLU[G.curBatterOrder - 1];

  // Position percentages in the 200×200 field
  const pct = (v: number) => `${(v / 200) * 100}%`;

  // 현재 이닝/half 에서 교체로 처음 들어온 선수만 강조 (대타 H, 대주자 R, 수비교체 D)
  // 후속 D 로그(이미 들어와 있는 선수의 포지션 변경 등) 는 무시 — 최초 등장 시점에만 강조
  const offendingSide: 'away' | 'home' = G.half === 'top' ? 'away' : 'home';
  const defendingSide: 'away' | 'home' = G.half === 'top' ? 'home' : 'away';
  const firstSubByPlayer = new Map<string, (typeof G.substitutions)[number]>();
  G.substitutions.forEach((s) => {
    if (s.kind !== 'H' && s.kind !== 'R' && s.kind !== 'D') return;
    const key = `${s.newNum}:${s.newName}`;
    if (!firstSubByPlayer.has(key)) firstSubByPlayer.set(key, s);
  });
  const recentOffSubKeys = new Set<string>();
  const recentDefSubKeys = new Set<string>();
  firstSubByPlayer.forEach((s, key) => {
    if (s.inning !== G.inning || s.half !== G.half) return;
    if (s.side === offendingSide) recentOffSubKeys.add(key);
    else if (s.side === defendingSide) recentDefSubKeys.add(key);
  });
  const SUB_COLOR = '#fbbf24'; // 대타·대주자·수비교체 강조 — 노랑

  const availBases = baseTargets.active ? getNextBases(baseTargets.fromBase) : [];
  const runnerDestBases: string[] =
    !baseTargets.active && selRunnerBase ? getNextBases(selRunnerBase) : [];

  return (
    <div className="dp">
      <div className="dp-title">
        <span>{G.half === 'top' ? G.homeTeam : G.awayTeam} 수비</span>
        <span style={{ fontSize: 9, color: '#94a3b8' }}>
          {G.inning}회 {G.half === 'top' ? '초' : '말'}
        </span>
        {showChainEndButton && (chainBases.size > 0 || !!chainPendingBase) && (
          <button
            onClick={onChainEnd}
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              border: '1px solid #991b1b',
              background: '#dc2626',
              color: '#fff',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            연결동작 종료
          </button>
        )}
      </div>

      <div className="dp-field" id="dp-field">
        {/* SVG field */}
        <svg
          style={{ width: '100%', height: '100%' }}
          viewBox="0 0 200 200"
          preserveAspectRatio="none"
        >
          <path
            d="M100,195 L0,70 Q100,2 200,70 Z"
            fill="#4a7c4a"
            stroke="#2d5a2d"
            strokeWidth="1"
          />
          <circle cx="100" cy="140" r="62" fill="#b8956a" opacity=".5" />
          <polygon points="100,85 145,130 100,175 55,130" fill="#5a8f5a" />
          <line x1="100" y1="85" x2="145" y2="130" stroke="#fff" strokeWidth="1.5" />
          <line x1="145" y1="130" x2="100" y2="175" stroke="#fff" strokeWidth="1.5" />
          <line x1="100" y1="175" x2="55" y2="130" stroke="#fff" strokeWidth="1.5" />
          <line x1="55" y1="130" x2="100" y2="85" stroke="#fff" strokeWidth="1.5" />
          <circle cx="100" cy="133" r="8" fill="#c4a06a" />
          <rect x="93" y="168" width="14" height="14" rx="1" fill="#fff" />
          <rect x="138" y="123" width="14" height="14" rx="1" fill="#fff" />
          <rect x="93" y="78" width="14" height="14" rx="1" fill="#fff" />
          <rect x="48" y="123" width="14" height="14" rx="1" fill="#fff" />
          <line
            x1="100"
            y1="175"
            x2="0"
            y2="70"
            stroke="#fff"
            strokeWidth="1"
            strokeDasharray="4,3"
            opacity=".5"
          />
          <line
            x1="100"
            y1="175"
            x2="200"
            y2="70"
            stroke="#fff"
            strokeWidth="1"
            strokeDasharray="4,3"
            opacity=".5"
          />
          {/* Fielder click zones */}
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((pos) => {
            const fp = FPOS_XY[pos];
            return (
              <circle
                key={pos}
                cx={fp.x}
                cy={fp.y}
                r={pos <= 2 ? 12 : 10}
                fill="rgba(255,255,255,.07)"
                style={{ cursor: 'pointer' }}
                onClick={(e) => onFielderClick(e, pos)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onFielderClick(e, pos);
                }}
              />
            );
          })}
          {/* Fielder number + name labels — 현재 이닝/half 에서 교체된 수비수는 빨강으로 강조 */}
          {defLU.map((p) => {
            if (p.pos < 1 || p.pos > 9) return null;
            const fp = FPOS_XY[p.pos];
            if (!fp) return null;
            const subbed = recentDefSubKeys.has(`${p.num}:${p.name}`);
            const color = subbed ? SUB_COLOR : '#111';
            return (
              <g key={p.pos} pointerEvents="none">
                <text
                  x={fp.x}
                  y={fp.y > 180 ? fp.y - 10 : fp.y}
                  textAnchor="middle"
                  fontSize="9"
                  fill={color}
                  fontWeight="700"
                  style={{ fontFamily: 'monospace' }}
                >
                  {p.num}
                </text>
                <text
                  x={fp.x}
                  y={fp.y > 180 ? fp.y : fp.y + 10}
                  textAnchor="middle"
                  fontSize="7"
                  fill={color}
                  fontWeight={subbed ? 700 : 400}
                  style={{ fontFamily: 'sans-serif' }}
                >
                  {p.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* 수비수 드래그 오버레이 — 원형 (P=1, D=0 제외) */}
        {onFieldPosSwap &&
          defLU
            .filter((p) => p.pos >= 2 && p.pos <= 9)
            .map((p) => {
              const fp = FPOS_XY[p.pos];
              if (!fp) return null;
              const isOver = posDragOver === p.pos;
              // 텍스트 라벨(번호+이름) 영역에 맞춰 컨테이너 비례로
              const sizePct = p.pos === 2 ? 22 : 18;
              return (
                <div
                  key={`pos-drag-${p.pos}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(p.pos));
                    posDragFromRef.current = p.pos;
                  }}
                  onDragOver={(e) => {
                    const from = posDragFromRef.current;
                    if (from !== null && from !== p.pos) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (posDragOver !== p.pos) setPosDragOver(p.pos);
                    }
                  }}
                  onDragLeave={() => setPosDragOver(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from =
                      posDragFromRef.current ?? Number(e.dataTransfer.getData('text/plain'));
                    if (from && from !== p.pos) onFieldPosSwap(from, p.pos);
                    posDragFromRef.current = null;
                    setPosDragOver(null);
                  }}
                  onDragEnd={() => {
                    posDragFromRef.current = null;
                    setPosDragOver(null);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFielderClick(e, p.pos);
                  }}
                  title={`${p.num} ${p.name} (수비 ${p.pos}) — 클릭: 교체 / 드래그: 위치 교환`}
                  style={{
                    position: 'absolute',
                    left: `calc(${pct(fp.x)} - ${sizePct / 2}%)`,
                    top: `calc(${pct(fp.y)} - ${sizePct / 2}%)`,
                    width: `${sizePct}%`,
                    height: `${sizePct}%`,
                    borderRadius: '50%',
                    cursor: 'grab',
                    border: isOver ? `2px solid ${SUB_COLOR}` : 'none',
                    background: isOver ? 'rgba(251, 191, 36, 0.35)' : 'transparent',
                    zIndex: 5,
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                  }}
                />
              );
            })}

        {/* Batter dot — hitType 1(우타)=왼쪽, 2(좌타)=오른쪽, 3(스위치)=좌/우 토글 가능
            현재 셀의 batterSide override 가 있으면 그 값으로, 없으면 hitType 기본값 */}
        {batter &&
          (() => {
            const curCell = G.cells[G.selCellKey];
            const overrideSide = curCell?.batterSide;
            const effectiveSide: 'L' | 'R' = overrideSide ?? (batter.hitType === 2 ? 'R' : 'L');
            const isSwitch = batter.hitType === 3;
            const batterSubbed = recentOffSubKeys.has(`${batter.num}:${batter.name}`);
            return (
              <div
                className="batter-dot"
                title={
                  isSwitch
                    ? `${batter.name} (스위치) — 클릭: 대타 / 우클릭: 좌·우 토글`
                    : `${batter.name} — 클릭: 대타 교체`
                }
                style={{
                  left: pct(BASE_XY.HOME.x + (effectiveSide === 'R' ? 30 : -30)),
                  top: pct(BASE_XY.HOME.y + 16),
                  width: 'auto',
                  minWidth: 32,
                  padding: '0 4px',
                  borderRadius: 4,
                  fontSize: 10,
                  whiteSpace: 'nowrap',
                  ...(batterSubbed ? { color: SUB_COLOR, fontWeight: 700 } : {}),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onBatterContextMenu?.();
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isSwitch) onBatterRightClick?.();
                }}
              >
                {batter.num} {batter.name}
              </div>
            );
          })()}

        {/* Runner badges */}
        {(['1B', '2B', '3B'] as Base[]).map((base) => {
          const r = G.runners[base];
          if (!r) return null;
          const pos = BASE_XY[base];
          const isChain = chainBases.has(base);
          const isCollisionTarget = chainPendingBase === base && !!chainTransitRunner;
          const isPending = (!!G.pendingBatter || isCollisionTarget) && !isChain;
          const runnerSubbed = recentOffSubKeys.has(`${r.num}:${r.name}`);
          return (
            <div
              key={base}
              className={`runner${selRunnerBase === base ? ' hl' : ''}${isChain ? ' chain' : isPending ? ' pending-move' : ''}`}
              title={`${r.name}(${base}) — 클릭: ${isChain ? '연결동작 진루' : '선택/취소'}, 우클릭: 대주자 교체`}
              style={{
                left: pct(pos.x),
                top: pct(pos.y),
                width: 'auto',
                minWidth: 32,
                padding: '0 4px',
                borderRadius: 4,
                fontSize: 10,
                whiteSpace: 'nowrap',
                ...(runnerSubbed ? { color: SUB_COLOR, fontWeight: 700 } : {}),
              }}
              onClick={(e) => {
                e.stopPropagation();
                onRunnerToggle(base);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRunnerContextMenu?.(base);
              }}
            >
              {r.num} {r.name}
            </div>
          );
        })}

        {/* 연결동작 중 대기 주자/타자 (blocked → 기존 주자 위에 스택, 클릭 가능) */}
        {chainPendingBase &&
          BASE_XY[chainPendingBase] &&
          (G.pendingBatter || chainTransitRunner) &&
          (() => {
            const pos = BASE_XY[chainPendingBase];
            // chainTransit 주자 우선, 없으면 현재 타자
            const displayRunner = chainTransitRunner
              ? { num: chainTransitRunner.num, name: chainTransitRunner.name }
              : (() => {
                  const bat = curLU[G.curBatterOrder - 1];
                  return bat ? { num: bat.num, name: bat.name } : null;
                })();
            if (!displayRunner) return null;
            const hasExisting = !!G.runners[chainPendingBase];
            return (
              <div
                key="chain-pending"
                className="runner chain"
                title={`${displayRunner.name} — 연결동작 클릭하여 전진`}
                style={{
                  left: pct(pos.x),
                  top: hasExisting ? `calc(${pct(pos.y)} - 36px)` : pct(pos.y),
                  width: 'auto',
                  minWidth: 32,
                  padding: '0 4px',
                  borderRadius: 4,
                  fontSize: 10,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onChainPendingClick?.();
                }}
              >
                {displayRunner.num} {displayRunner.name}
              </div>
            );
          })()}

        {/* 대기 중인 타자 (목적지 베이스에 반투명 표시) */}
        {G.pendingBatter &&
          (() => {
            const pos = BASE_XY[G.pendingBatter.dest];
            return (
              <div
                className="batter-dot pending-batter"
                title={`${G.pendingBatter.runner.name} → ${G.pendingBatter.dest} 대기중`}
                style={{ left: pct(pos.x), top: pct(pos.y) }}
              >
                {G.pendingBatter.runner.num}
              </div>
            );
          })()}

        {/* Base targets (pendingBatter) */}
        {baseTargets.active &&
          availBases.map((base) => {
            const pos = BASE_XY[base];
            if (!pos) return null;
            return (
              <div
                key={base}
                className="base-target"
                style={{
                  left: pct(pos.x),
                  top: pct(pos.y),
                  ...(base === 'HOME' ? { background: 'rgba(220,38,38,.5)' } : {}),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onBaseTargetClick(base);
                }}
              >
                {base === 'HOME' ? '홈' : base}
              </div>
            );
          })}

        {/* 주자 선택 후 목적지 루 클릭 → 진루 팝업 */}
        {runnerDestBases.map((base) => {
          const pos = BASE_XY[base];
          if (!pos) return null;
          return (
            <div
              key={`dest-${base}`}
              className="base-target"
              style={{
                left: pct(pos.x),
                top: pct(pos.y),
                background: base === 'HOME' ? 'rgba(220,38,38,.6)' : 'rgba(37,99,235,.6)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onRunnerDestClick?.(base as Base | 'HOME');
              }}
            >
              {base === 'HOME' ? '홈' : base}
            </div>
          );
        })}
      </div>

      {/* Outs */}
      {/* <div className="dp-outs">
        <span style={{ fontSize: 9, color: '#94a3b8' }}>아웃</span>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`dp-out-dot${G.outs >= n ? ' on' : ''}`} />
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#64748b' }}>
          {G.balls}B {G.strikes}S
        </span>
      </div> */}

      {/* Fielders list */}
      {/* <div className="dp-fielders">
        {defLU.filter((p) => p.pos > 0).map((p, i) => (
          <div key={i} className="dp-fielder-item">
            <span className="dp-fielder-num">{p.pos}</span>
            <span>{p.name}</span>
            <span style={{ color: 'var(--text3)', fontSize: 9, marginLeft: 2 }}>#{p.num}</span>
          </div>
        ))}
      </div> */}
    </div>
  );
}
