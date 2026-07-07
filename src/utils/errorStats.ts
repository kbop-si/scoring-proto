import type { GameState, CellData, Half } from '../types';

// ── 실책 파생 집계 유틸 ────────────────────────────────────────────────────
// 실책은 상태 누적값이 아니라 셀 기록에서 매번 파생 계산한다 (undo/삭제/소급수정에 안전).
// 출처 3곳: ① 타격 결과 문자열(E4, 4-3E 등) ② 수비 체크(defRoles/runOutDefRoles)
//          ③ 주자 진루 실책 (runner_adv advCode: E4, (E4), 4-3E, 다른주자수비 '9E' 등)
// ③은 한 실책으로 주자 여러 명이 진루하면 runner_adv 가 여러 셀에 생기므로
//   (이닝, half, 코드) 단위로 dedupe 해서 1건으로 센다.

// advCode/결과 문자열에서 실책 수비수 번호 추출 — 'E4'→[4], '4-3E'→[3], '(E4)'→[4]
export function errorPositionsFromCode(code: string): number[] {
  const s = code.replace(/[()]/g, '');
  const out: number[] = [];
  for (const m of s.matchAll(/E(\d)/g)) out.push(Number(m[1]));
  for (const m of s.matchAll(/(\d)E/g)) out.push(Number(m[1]));
  return out;
}

// 진루 사유 코드가 실책 계열인지 (E 단독 포함)
function isErrorCode(code: string): boolean {
  const s = code.replace(/[()]/g, '');
  return s === 'E' || /E\d/.test(s) || /\dE/.test(s);
}

// 셀 자체 기록(타격 결과 + 수비 체크) 실책 수
export function cellOwnErrors(c: CellData): number {
  let n = 0;
  const r = c.result ?? '';
  n += (r.match(/E\d/g) || []).length; // E4, E4-3
  n += (r.match(/\d+E/g) || []).length; // 4-3E, #4E, Ob4E
  if (r === 'E') n += 1;
  n += (c.defRoles ?? []).filter((d) => d.error).length;
  n += (c.runOutDefRoles ?? []).filter((d) => d.error).length;
  return n;
}

// 주자 진루 실책 코드 목록 — (이닝 → dedupe된 코드 집합), 공격 half 기준
export function runnerAdvErrorCodesByInning(G: GameState, half: Half): Map<number, Set<string>> {
  const m = new Map<number, Set<string>>();
  Object.values(G.cells).forEach((c) => {
    if (c.half !== half) return;
    (c.eventLog ?? []).forEach((e) => {
      if (e.kind === 'runner_adv' && e.advCode && isErrorCode(e.advCode)) {
        const set = m.get(c.inning) ?? new Set<string>();
        set.add(e.advCode.replace(/[()]/g, ''));
        m.set(c.inning, set);
      }
    });
  });
  return m;
}

// 팀 실책 (수비팀 기준) — away 수비 = 홈 공격(bottom) 셀, home 수비 = 원정 공격(top) 셀
export function countTeamErrors(G: GameState, defSide: 'away' | 'home'): number {
  const half: Half = defSide === 'away' ? 'bottom' : 'top';
  let n = 0;
  Object.values(G.cells).forEach((c) => {
    if (c.half === half) n += cellOwnErrors(c);
  });
  runnerAdvErrorCodesByInning(G, half).forEach((codes) => {
    n += codes.size;
  });
  return n;
}
