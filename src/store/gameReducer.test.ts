import { describe, it, expect } from 'vitest';
import { gameReducer, initialGameState, cellKey } from './gameReducer';
import type { GameState, GameAction, Player } from '../types';

// ── 테스트 헬퍼 ──────────────────────────────────────────────────────────────

const mkPlayer = (name: string, order: number, pos: number): Player => ({
  name,
  num: String(order),
  pos,
  order,
  hitType: 1,
});

function freshGame(): GameState {
  const awayLineup = [
    ...Array.from({ length: 9 }, (_, i) => mkPlayer(`원정${i + 1}`, i + 1, i === 0 ? 2 : 3)),
    { ...mkPlayer('원정P', 0, 1) },
  ];
  const homeLineup = [
    ...Array.from({ length: 9 }, (_, i) => mkPlayer(`홈${i + 1}`, i + 1, i === 0 ? 2 : 3)),
    { ...mkPlayer('홈P', 0, 1) },
  ];
  return {
    ...initialGameState,
    awayLineup,
    homeLineup,
    pitcher: { name: '홈P', num: '0', pitchCount: 0 },
  };
}

function run(state: GameState, actions: GameAction[]): GameState {
  return actions.reduce((s, a) => gameReducer(s, a), state);
}

// n번 타자 땅볼 아웃 (5-3)
const groundOut: GameAction = { type: 'BAT_OUT', result: '5-3', ballType: '땅' };
const single: GameAction = { type: 'BAT_ADV', result: 'H1' };

// ── DELETE_CELL ──────────────────────────────────────────────────────────────

describe('DELETE_CELL', () => {
  it('3아웃째 타석 삭제 시 outs가 2로 재계산되어 재입력 가능', () => {
    let s = run(freshGame(), [groundOut, groundOut, groundOut]);
    expect(s.outs).toBe(3);

    const thirdKey = cellKey(1, 3, 0, 'top');
    s = gameReducer(s, { type: 'DELETE_CELL', cellKey: thirdKey });

    expect(s.cells[thirdKey]).toBeUndefined();
    expect(s.outs).toBe(2); // 3아웃 해제 → 입력 가드 통과 가능
    expect(s.selCellKey).toBe(thirdKey); // 커서가 삭제된 타석으로 이동
    expect(s.curBatterOrder).toBe(3);
  });

  it('중간 타석(2아웃째) 삭제 시 outs 재계산 + 나머지 기록 유지', () => {
    let s = run(freshGame(), [groundOut, groundOut, groundOut]);
    const secondKey = cellKey(1, 2, 0, 'top');
    s = gameReducer(s, { type: 'DELETE_CELL', cellKey: secondKey });

    expect(s.outs).toBe(2); // 남은 아웃 2개 (1번·3번 타자)
    expect(s.cells[cellKey(1, 1, 0, 'top')]).toBeDefined();
    expect(s.cells[cellKey(1, 3, 0, 'top')]).toBeDefined();
  });

  it('3아웃 해제 시 같은 이닝 잔루(lobCell) 표시도 제거', () => {
    // 1번 안타 출루 → 2·3·4번 아웃 (3아웃, 1번은 잔루)
    let s = run(freshGame(), [single, groundOut, groundOut, groundOut]);
    const runnerKey = cellKey(1, 1, 0, 'top');
    expect(s.cells[runnerKey].lobCell).toBe(true);

    s = gameReducer(s, { type: 'DELETE_CELL', cellKey: cellKey(1, 4, 0, 'top') });
    expect(s.outs).toBe(2);
    expect(s.cells[runnerKey].lobCell).toBeUndefined();
  });

  it('병살 타석 삭제 시 주자 셀의 병살 마크(runOut/isDPRunner/outGroup)도 제거', () => {
    // 1번 안타 → PLACE 불필요(주자 없음 자동 배치) → 2번 병살(6-4-3)
    let s = run(freshGame(), [single]);
    expect(s.runners['1B']?.order).toBe(1);
    s = gameReducer(s, { type: 'BAT_OUT', result: '6-4-3', dp: true, ballType: '땅' });
    expect(s.outs).toBe(2);

    const runnerKey = cellKey(1, 1, 0, 'top');
    const dpKey = cellKey(1, 2, 0, 'top');
    expect(s.cells[runnerKey].isDPRunner).toBe(true);
    expect(s.cells[runnerKey].outGroup).toBe(dpKey);

    s = gameReducer(s, { type: 'DELETE_CELL', cellKey: dpKey });
    expect(s.outs).toBe(0); // 병살 2아웃 모두 해제
    expect(s.cells[runnerKey].isDPRunner).toBeUndefined();
    expect(s.cells[runnerKey].runOut).toBeUndefined();
    expect(s.cells[runnerKey].outGroup).toBeUndefined();
  });

  // 소급 재입력(이미 지난 반이닝을 다시 열어 편집) 시 state.runners에 남아있는
  // 다른 이닝의 잔존 주자를 병살 대상으로 착각해 엉뚱한 셀에 태그하면 안 됨
  it('병살 처리 시 다른 이닝에서 넘어온 잔존 주자는 무시(엉뚱한 셀 태그 방지)', () => {
    let s = run(freshGame(), []);
    // 9회초 9번 타자의 실제 안타 셀(나중 이닝, 이미 기록됨)
    const staleRunnerKey = cellKey(9, 9, 0, 'top');
    s = {
      ...s,
      cells: {
        ...s.cells,
        [staleRunnerKey]: {
          half: 'top',
          inning: 9,
          order: 9,
          appearance: 0,
          pitches: [],
          result: 'H1',
          runnerNotes: [],
        },
      },
      // 7회초 3번 타순 타석으로 커서를 옮기고, runners에는 9회 소속 주자가 잘못 남아있는 상황을 재현
      half: 'top',
      inning: 7,
      curBatterOrder: 3,
      selCellKey: cellKey(7, 3, 0, 'top'),
      outs: 1,
      runners: { '1B': { name: '이원준', num: '100', order: 9, half: 'top', inning: 9 } },
    };
    s = gameReducer(s, { type: 'BAT_OUT', result: '1-4-3', dp: true, ballType: '땅' });
    expect(s.outs).toBe(3);

    // 9회 주자의 셀에 7회 병살 태그가 잘못 붙으면 안 됨
    expect(s.cells[staleRunnerKey].isDPRunner).toBeUndefined();
    expect(s.cells[staleRunnerKey].runOut).toBeUndefined();
    // 잔존 주자는 다이아몬드에서는 정리됨(더 이상 유효하지 않은 잔존 데이터이므로)
    expect(s.runners['1B']).toBeUndefined();
  });
});

// ── CLEAR_CELL (타석지우기) ──────────────────────────────────────────────────

describe('CLEAR_CELL', () => {
  it('진행 중 타석(결과 없음)은 투구만 클리어', () => {
    let s = run(freshGame(), [
      { type: 'PITCH', pitchType: 'B' },
      { type: 'PITCH', pitchType: 'S' },
    ]);
    expect(s.balls).toBe(1);
    expect(s.strikes).toBe(1);

    s = gameReducer(s, { type: 'CLEAR_CELL' });
    expect(s.balls).toBe(0);
    expect(s.strikes).toBe(0);
    expect(s.cells[cellKey(1, 1, 0, 'top')]).toBeUndefined();
  });

  it('3아웃 직후 타석지우기 → 그 PA 전체 pop, outs 2로 복귀 (3아웃 알럿 루프 방지)', () => {
    let s = run(freshGame(), [groundOut, groundOut, groundOut]);
    expect(s.outs).toBe(3);

    s = gameReducer(s, { type: 'CLEAR_CELL' });
    expect(s.outs).toBe(2);
    expect(s.cells[cellKey(1, 3, 0, 'top')]).toBeUndefined();
    expect(s.curBatterOrder).toBe(3); // 3번 타자 재입력 대기
  });
});

// ── DELETE_INNING (이닝지우기) ───────────────────────────────────────────────

describe('DELETE_INNING', () => {
  it('이닝 삭제 시 그 이닝 시작 지점(0아웃)으로 복귀 — 이전 이닝 3아웃 상태로 돌아가지 않음', () => {
    // 1회초 3아웃 → 다음이닝 → 1회말 아웃 2개 → 1회말 삭제
    let s = run(freshGame(), [groundOut, groundOut, groundOut, { type: 'NEXT_INNING' }]);
    expect(s.half).toBe('bottom');
    expect(s.outs).toBe(0);

    s = run(s, [groundOut, groundOut]);
    expect(s.outs).toBe(2);

    s = gameReducer(s, { type: 'DELETE_INNING', inning: 1, half: 'bottom' });
    // 1회말 시작 지점: half=bottom, outs=0 (1회초 3아웃 상태 아님)
    expect(s.half).toBe('bottom');
    expect(s.outs).toBe(0);
    expect(s.cells[cellKey(1, 1, 0, 'bottom')]).toBeUndefined();
    // 1회초 기록은 보존
    expect(s.cells[cellKey(1, 1, 0, 'top')]).toBeDefined();
  });

  it('half=bottom 삭제 시 같은 이닝 초 기록은 보존', () => {
    let s = run(freshGame(), [groundOut, groundOut, groundOut, { type: 'NEXT_INNING' }, single]);
    expect(s.cells[cellKey(1, 1, 0, 'bottom')]).toBeDefined();

    s = gameReducer(s, { type: 'DELETE_INNING', inning: 1, half: 'bottom' });
    expect(s.cells[cellKey(1, 1, 0, 'bottom')]).toBeUndefined();
    expect(s.cells[cellKey(1, 3, 0, 'top')]).toBeDefined();
    expect(s.outs).toBe(0);
    expect(s.half).toBe('bottom');
  });
});

// ── HP(사구) 투구수 집계 ─────────────────────────────────────────────────────

describe('BAT_ADV HP 투구수', () => {
  it('HP 선택 시 pitchCount·pitchBalls·투수 투구수 +1', () => {
    const s0 = freshGame();
    const s = gameReducer(s0, { type: 'BAT_ADV', result: 'HP' });
    expect(s.pitchCount).toBe(1);
    expect(s.pitchBalls).toBe(1);
    expect(s.pitchStrikes).toBe(0);
    expect(s.pitcher.pitchCount).toBe(1);
  });

  it('인플레이(안타)는 스트라이크로 +1, 고의4구(IB)는 투구수 변화 없음', () => {
    const hit = gameReducer(freshGame(), single);
    expect(hit.pitchCount).toBe(1);
    expect(hit.pitchStrikes).toBe(1);

    const ib = gameReducer(freshGame(), { type: 'BAT_ADV', result: 'IB' });
    expect(ib.pitchCount).toBe(0);
  });
});

// ── 실책 파생 집계 ───────────────────────────────────────────────────────────

describe('실책 집계 (errorStats)', () => {
  it('타격 실책 출루(E6) + 주자 진루 실책(advCode E9) 팀 실책 집계', async () => {
    const { countTeamErrors } = await import('../utils/errorStats');
    // 1번 실책 출루 (E6) — 홈 수비 실책 1
    let s = gameReducer(freshGame(), { type: 'BAT_ADV', result: 'E6' });
    expect(countTeamErrors(s, 'home')).toBe(1);

    // 주자 1루→3루, 우익수 실책(E9) 진루
    const runner = s.runners['1B']!;
    s = gameReducer(s, {
      type: 'RUN_ADV',
      base: '1B',
      runner,
      dest: '3B',
      earned: true,
      advCode: 'E9',
    });
    expect(countTeamErrors(s, 'home')).toBe(2);
    expect(countTeamErrors(s, 'away')).toBe(0);
  });

  it('같은 실책으로 주자 2명 진루 시 1건으로 집계 (동일 advCode dedupe)', async () => {
    const { countTeamErrors } = await import('../utils/errorStats');
    let s = run(freshGame(), [single]); // 1번 1루
    s = gameReducer(s, { type: 'BAT_ADV', result: 'H1' }); // 2번 안타 → pendingBatter (1번은 1루 유지)
    // 같은 우익수 실책(E9)으로: 1번 1→3루, 타자(2번) 배치 후 1→2루
    const rA = s.runners['1B']!;
    s = gameReducer(s, {
      type: 'RUN_ADV',
      base: '1B',
      runner: rA,
      dest: '3B',
      earned: true,
      advCode: 'E9',
    });
    s = gameReducer(s, { type: 'PLACE_BATTER' }); // 2번 → 1루
    const rB = s.runners['1B']!;
    s = gameReducer(s, {
      type: 'RUN_ADV',
      base: '1B',
      runner: rB,
      dest: '2B',
      earned: true,
      advCode: 'E9',
    });
    expect(countTeamErrors(s, 'home')).toBe(1);
  });
});

// ── DELETE_CELL 점수/투구수 재계산 정합성 ────────────────────────────────────

describe('DELETE_CELL 점수 재계산 정합성', () => {
  it('홈런 포함 경기에서 무관 타석 삭제 시 점수 불변 (HR 이중 집계 금지)', () => {
    let s = gameReducer(freshGame(), { type: 'BAT_ADV', result: 'HR' }); // 1번 솔로 홈런
    expect(s.awayR).toBe(1);
    s = gameReducer(s, groundOut); // 2번 아웃
    s = gameReducer(s, { type: 'DELETE_CELL', cellKey: cellKey(1, 2, 0, 'top') });
    expect(s.awayR).toBe(1); // 버그: HR 셀이 scored+HR 두 조건에 걸려 2가 됨
    expect(s.awayInn[0]).toBe(1);
    expect(s.awayER).toBe(1);
    expect(s.awayH).toBe(1);
  });

  it('반자책(0.5) 자책점이 타석 삭제 후에도 보존', () => {
    let s = run(freshGame(), [single]); // 1번 1루
    const r1 = s.runners['1B']!;
    s = gameReducer(s, {
      type: 'RUN_ADV',
      base: '1B',
      runner: r1,
      dest: 'HOME',
      earned: 'half',
    });
    expect(s.awayER).toBe(0.5);
    s = gameReducer(s, groundOut); // 2번 아웃
    s = gameReducer(s, { type: 'DELETE_CELL', cellKey: cellKey(1, 2, 0, 'top') });
    expect(s.awayER).toBe(0.5); // 버그: earned !== false 판정으로 1이 됨
    expect(s.awayR).toBe(1);
  });

  it('자동 밀림 홈인 주자에 scored 마크가 찍히고 삭제 후에도 점수 보존', () => {
    let s = run(freshGame(), [single]); // 1번 1루
    const r1 = s.runners['1B']!;
    s = gameReducer(s, { type: 'RUN_ADV', base: '1B', runner: r1, dest: '3B', earned: true });
    s = gameReducer(s, { type: 'BAT_ADV', result: 'H1' }); // 2번 안타 → pending
    s = gameReducer(s, { type: 'PLACE_BATTER' }); // 2번 → 1루
    const r2 = s.runners['1B']!;
    // 2번을 3루로 → 3루의 1번이 자동으로 홈으로 밀림
    s = gameReducer(s, { type: 'RUN_ADV', base: '1B', runner: r2, dest: '3B', earned: true });
    expect(s.awayR).toBe(1);
    expect(s.cells[cellKey(1, 1, 0, 'top')].scored).toBe(true); // 버그: 마크 누락
    s = gameReducer(s, groundOut); // 3번 아웃
    s = gameReducer(s, { type: 'DELETE_CELL', cellKey: cellKey(1, 3, 0, 'top') });
    expect(s.awayR).toBe(1); // 버그: scored 마크 없어 재계산에서 1점 소실
  });

  it('타석 삭제 시 현재 투수 실시간 투구수 카운터 차감', () => {
    let s = run(freshGame(), [
      { type: 'PITCH', pitchType: 'B' },
      { type: 'PITCH', pitchType: 'S' },
      single, // 인플레이 접촉구 +1 (스트라이크)
    ]);
    expect(s.pitchCount).toBe(3);
    s = run(s, [{ type: 'PITCH', pitchType: 'B' }, groundOut]); // 2번: 볼 + 접촉구
    expect(s.pitchCount).toBe(5);
    expect(s.pitchBalls).toBe(2);
    expect(s.pitchStrikes).toBe(3);

    s = gameReducer(s, { type: 'DELETE_CELL', cellKey: cellKey(1, 2, 0, 'top') });
    expect(s.pitchCount).toBe(3); // 버그: 카운터 안 줄어 5 유지
    expect(s.pitchBalls).toBe(1);
    expect(s.pitchStrikes).toBe(2);
    expect(s.pitcher.pitchCount).toBe(3);
  });
});

// ── DELETE_CELL — 아웃 아닌 타석 삭제 시 3아웃 잠금 방지 ─────────────────────

describe('DELETE_CELL 아웃 아닌 타석 삭제', () => {
  it('3아웃 완료 이닝에서 안타 타석 삭제 → outs 2로 캡 (재입력 가능)', () => {
    // 1번 안타 + 2·3·4번 아웃 = 3아웃. 안타(아웃 아님) 타석을 삭제해도
    // 남은 아웃 3개 때문에 outs=3이면 재입력이 가드에 막힘 → 2로 캡되어야 함
    let s = run(freshGame(), [single, groundOut, groundOut, groundOut]);
    expect(s.outs).toBe(3);

    const hitKey = cellKey(1, 1, 0, 'top');
    s = gameReducer(s, { type: 'DELETE_CELL', cellKey: hitKey });

    expect(s.cells[hitKey]).toBeUndefined();
    expect(s.outs).toBe(2); // 3아웃 가드에 걸리지 않아야 재입력 가능
    expect(s.selCellKey).toBe(hitKey);
    expect(s.curBatterOrder).toBe(1);
  });
});

// ── DELETE_INNING — 이벤트 로그 정리 ─────────────────────────────────────────

describe('DELETE_INNING 이벤트 정리', () => {
  it('반이닝 삭제 시 그 반이닝의 gameEvents(타자타임 등)도 제거', () => {
    let s = run(freshGame(), [
      { type: 'PITCH', pitchType: 'B' },
      { type: 'GAME_EVENT', eventType: 'batter_timeout', note: 'BT' },
      groundOut,
      groundOut,
    ]);
    expect(s.gameEvents).toHaveLength(1);

    s = gameReducer(s, { type: 'DELETE_INNING', inning: 1, half: 'top' });
    expect(s.gameEvents).toHaveLength(0); // 유령 이벤트 없음
    expect(s.outs).toBe(0);
    // 셀도 롤백됨 — 남은 셀에 BT 노트가 없어야 함
    const anyBT = Object.values(s.cells).some((c) =>
      (c.eventLog || []).some((e) => e.kind === 'note' && e.note === 'BT')
    );
    expect(anyBT).toBe(false);
  });
});

// ── DELETE_SUBST — 대타/대주자 교체 취소 ─────────────────────────────────────

describe('DELETE_SUBST', () => {
  it('대타 교체 취소 → 라인업/벤치/교체로그/셀 마크 원복', () => {
    let s = freshGame();
    const pinch = mkPlayer('대타맨', 1, 3);
    s = { ...s, awayBench: [pinch] };
    s = gameReducer(s, { type: 'SUBST_BATTER', side: 'away', player: pinch });
    expect(s.awayLineup[0].name).toBe('대타맨');
    expect(s.substitutions).toHaveLength(1);

    s = gameReducer(s, {
      type: 'DELETE_SUBST',
      side: 'away',
      kind: 'H',
      order: 1,
      newName: '대타맨',
      newNum: pinch.num,
    });
    expect(s.awayLineup[0].name).toBe('원정1'); // 원래 선수 복귀
    expect(s.substitutions).toHaveLength(0);
    expect(s.awayBench.some((p) => p.name === '대타맨')).toBe(true); // 대타 벤치 복귀
    expect(s.awayBench.some((p) => p.name === '원정1')).toBe(false);
    const cell = s.cells[cellKey(1, 1, 0, 'top')];
    expect(cell?.pinchHitter).toBeUndefined(); // 셀 대타 마크 제거
  });

  it('수비 교체(D) 취소 → 이전 선수(수비 미확정 대타) 원복', () => {
    // 박성빈 대타 → 이닝 종료 후 "없음" → 강민균 수비 투입 시나리오의 취소
    let s = freshGame();
    const pinch = mkPlayer('박성빈', 1, 3);
    const fielder = mkPlayer('강민균', 1, 3);
    s = { ...s, awayBench: [pinch, fielder] };
    s = gameReducer(s, { type: 'SUBST_BATTER', side: 'away', player: pinch });
    const pinchPos = s.awayLineup[0].pos;
    expect(s.awayLineup[0].needsPosReview).toBe(true);
    // 수비 교체: 박성빈 자리에 강민균 투입 (LineupReviewModal '없음' 플로우와 동일 액션)
    s = gameReducer(s, { type: 'SUBST', side: 'away', pos: pinchPos, player: fielder });
    expect(s.awayLineup[0].name).toBe('강민균');

    s = gameReducer(s, {
      type: 'DELETE_SUBST',
      side: 'away',
      kind: 'D',
      order: 1,
      newName: '강민균',
      newNum: fielder.num,
    });
    expect(s.awayLineup[0].name).toBe('박성빈'); // 대타 복귀 (수비 미확정 상태 유지)
    expect(s.awayLineup[0].needsPosReview).toBe(true);
    expect(s.awayBench.some((p) => p.name === '강민균')).toBe(true);
    // 이후 H(박성빈 대타)도 연속 취소 가능
    s = gameReducer(s, {
      type: 'DELETE_SUBST',
      side: 'away',
      kind: 'H',
      order: 1,
      newName: '박성빈',
      newNum: pinch.num,
    });
    expect(s.awayLineup[0].name).toBe('원정1');
    expect(s.substitutions).toHaveLength(0);
  });

  it('없음 플로우: 슬롯 기준 선수 교체 — 다른 포지션 선수 안 건드림 + 포지션 이어서 선택', () => {
    // 대타(포수 슬롯 승계) 자리에 강민균 투입 — 기존 유격수(원정4, pos... i=3 → pos 3) 등
    // 다른 선수는 그대로여야 하고, 강민균은 미확정 상태로 들어와 이후 포지션 선택
    let s = freshGame();
    const pinch = mkPlayer('박성빈', 1, 3);
    const fielder = mkPlayer('강민균', 1, 3);
    s = { ...s, awayBench: [pinch, fielder] };
    s = gameReducer(s, { type: 'SUBST_BATTER', side: 'away', player: pinch });
    const othersBefore = s.awayLineup.slice(1).map((p) => `${p.name}:${p.pos}`);

    // 공수교대 시 생기는 잠정 수비확정(auto-D) 로그 시뮬레이션 — 없음 교체 시 제거돼야 함
    s = {
      ...s,
      substitutions: [
        ...s.substitutions,
        {
          inning: 1,
          half: 'top' as const,
          side: 'away' as const,
          kind: 'D' as const,
          pos: s.awayLineup[0].pos,
          newName: '박성빈',
          newNum: pinch.num,
          oldName: '',
          oldNum: '',
          order: 1,
        },
      ],
    };

    // 슬롯(order 1) 기준 선수만 교체
    s = gameReducer(s, {
      type: 'SUBST',
      side: 'away',
      pos: s.awayLineup[0].pos,
      order: 1,
      player: fielder,
    });
    expect(s.awayLineup[0].name).toBe('강민균');
    // 박성빈의 잠정 수비확정 로그가 제거됨 — "6 박성빈" 유령 layer 방지
    expect(
      s.substitutions.some((x) => x.kind === 'D' && x.newName === '박성빈' && x.oldName === '')
    ).toBe(false);
    expect(s.awayLineup[0].needsPosReview).toBe(true); // 포지션 미확정 유지
    // 나머지 라인업 전원 무변동 (기존 유격수 안 빠짐)
    expect(s.awayLineup.slice(1).map((p) => `${p.name}:${p.pos}`)).toEqual(othersBefore);

    // 시점 표기 = 반이닝 선두타자 (타자 몇 명 지나고 입력해도 선두타순으로 찍힘)
    const kmSub = s.substitutions[s.substitutions.length - 1];
    expect(kmSub.atOrder).toBe(1); // 1회초 선두 = 1번 (원정1 셀 존재)

    // 이어서 포지션 선택(예: 5) → 같은 시점 D 로그의 pos만 갱신 (이중 행 없음)
    const dCountBefore = s.substitutions.filter((x) => x.newName === '강민균').length;
    s = gameReducer(s, { type: 'CHANGE_LU_POS', team: 'away', idx: 0, pos: 5 });
    expect(s.awayLineup[0].pos).toBe(5);
    expect(s.awayLineup[0].needsPosReview).toBe(false);
    const kmLogs = s.substitutions.filter((x) => x.newName === '강민균');
    expect(kmLogs.length).toBe(dCountBefore); // 로그 개수 그대로 (pos만 갱신)
    expect(kmLogs[kmLogs.length - 1].pos).toBe(5);
  });

  it('H 취소 시 후속 수비교체(D)까지 연쇄 취소 (스크린샷 시나리오)', () => {
    // 심건보 → 박성빈(H) → 강민균(D) 상태에서 H를 바로 취소하면 전부 원복
    let s = freshGame();
    const pinch = mkPlayer('박성빈', 1, 3);
    const fielder = mkPlayer('강민균', 1, 3);
    s = { ...s, awayBench: [pinch, fielder] };
    s = gameReducer(s, { type: 'SUBST_BATTER', side: 'away', player: pinch });
    s = gameReducer(s, {
      type: 'SUBST',
      side: 'away',
      pos: s.awayLineup[0].pos,
      player: fielder,
    });
    expect(s.awayLineup[0].name).toBe('강민균');
    expect(s.substitutions).toHaveLength(2);

    s = gameReducer(s, {
      type: 'DELETE_SUBST',
      side: 'away',
      kind: 'H',
      order: 1,
      newName: '박성빈',
      newNum: pinch.num,
    });
    expect(s.awayLineup[0].name).toBe('원정1'); // 원래 선수 복귀
    expect(s.substitutions).toHaveLength(0); // H·D 둘 다 제거
    expect(s.awayBench.map((p) => p.name).sort()).toContain('강민균');
    expect(s.awayBench.map((p) => p.name)).toContain('박성빈');
  });

  it('대타가 타석 결과를 남긴 뒤에는 취소 불가 (no-op)', () => {
    let s = freshGame();
    const pinch = mkPlayer('대타맨', 1, 3);
    s = { ...s, awayBench: [pinch] };
    s = gameReducer(s, { type: 'SUBST_BATTER', side: 'away', player: pinch });
    s = gameReducer(s, single); // 대타가 안타 기록
    const before = s;
    s = gameReducer(s, {
      type: 'DELETE_SUBST',
      side: 'away',
      kind: 'H',
      order: 1,
      newName: '대타맨',
      newNum: pinch.num,
    });
    expect(s).toBe(before); // 상태 변화 없음
  });
});

// ── 교체 로그 oldPos (수비기록 구간 역산용) ──────────────────────────────────

describe('SubstitutionLog oldPos', () => {
  it('대타 교체 시 빠지는 타자의 수비 포지션이 oldPos로 기록', () => {
    // freshGame 1번 타자 = 포수(pos 2)
    let s = freshGame();
    s = gameReducer(s, {
      type: 'SUBST_BATTER',
      side: 'away',
      player: mkPlayer('대타맨', 1, 3),
    });
    const log = s.substitutions[s.substitutions.length - 1];
    expect(log.kind).toBe('H');
    expect(log.oldPos).toBe(2);
    expect(log.newName).toBe('대타맨');
  });

  it('자리교대(SWAP_FIELD_POS) 시 각자 이전 포지션이 oldPos로 기록', () => {
    let s = freshGame();
    // 원정 라인업에서 야수 두 명 (idx 1: pos 3, idx 2: pos 3... mkPlayer i>0 → pos 3)
    // pos 중복 mock이므로 pos를 명시 세팅
    s = {
      ...s,
      awayLineup: s.awayLineup.map((p, i) =>
        i === 1 ? { ...p, pos: 7 } : i === 2 ? { ...p, pos: 8 } : p
      ),
    };
    s = gameReducer(s, { type: 'SWAP_FIELD_POS', team: 'away', idx1: 1, idx2: 2 });
    const [l1, l2] = s.substitutions.slice(-2);
    expect(l1.pos).toBe(8); // idx1: 7 → 8
    expect(l1.oldPos).toBe(7);
    expect(l2.pos).toBe(7); // idx2: 8 → 7
    expect(l2.oldPos).toBe(8);
  });
});

// ── RUN_OUT 명시적 outBase (연결동작 — 2루 이상 진루 후 아웃) ─────────────────

describe('RUN_OUT outBase', () => {
  it('1루 주자가 2루 경유 후 3루 앞 태그아웃 → runOutBase 3B + 2B 경유 노트', () => {
    // 1번 안타 출루 → 다음 플레이에서 1루 주자가 2루를 밟고 3루로 가다 태그아웃
    let s = run(freshGame(), [single]);
    expect(s.runners['1B']?.order).toBe(1);

    s = gameReducer(s, { type: 'RUN_OUT', base: '1B', result: '2-5T', outBase: '3B' });

    const runnerKey = cellKey(1, 1, 0, 'top');
    expect(s.outs).toBe(1);
    expect(s.runners['1B']).toBeUndefined();
    expect(s.cells[runnerKey].runOut).toBe('2-5T');
    expect(s.cells[runnerKey].runOutBase).toBe('3B'); // 2→3 구간에 아웃 표기
    // 경유한 2루에 진루 노트 기록 (연결동작 맥락 보존)
    const notes = s.cells[runnerKey].runnerNotes;
    expect(notes.some((n) => n.base === '2B')).toBe(true);
    // 3루 이후 노트는 없어야 함 (아웃 지점)
    expect(notes.some((n) => n.base === '3B')).toBe(false);
  });

  it('outBase 미지정 시 기존 추론 동작 유지 — 노트 추가 없음', () => {
    let s = run(freshGame(), [single]);
    s = gameReducer(s, { type: 'RUN_OUT', base: '1B', result: '2-5T' });

    const runnerKey = cellKey(1, 1, 0, 'top');
    expect(s.cells[runnerKey].runOutBase).toBe('2B'); // nextOf('1B') 추론
    expect(s.cells[runnerKey].runnerNotes).toHaveLength(0);
  });

  it('1루 주자가 홈 앞에서 아웃 → 2B·3B 경유 노트 둘 다 기록', () => {
    let s = run(freshGame(), [single]);
    s = gameReducer(s, { type: 'RUN_OUT', base: '1B', result: '7-2T', outBase: 'HOME' });

    const runnerKey = cellKey(1, 1, 0, 'top');
    expect(s.cells[runnerKey].runOutBase).toBe('HOME');
    const bases = s.cells[runnerKey].runnerNotes.map((n) => n.base);
    expect(bases).toContain('2B');
    expect(bases).toContain('3B');
  });
});
