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
