import type { GameState, Half } from '../types';

export interface PitcherRow {
  name: string;
  entryInn: number;
  entryOrd: number;
  bf: number;
  np: number;
  ab: number;
  h: number;
  hr: number;
  sh: number;
  sf: number;
  bb: number;
  ibb: number;
  hbp: number;
  so: number;
  wp: number;
  bk: number;
  r: number;
  er: number;
  outs: number;
}

const isHitR = (r: string) =>
  /^\/[789]$/.test(r) ||
  ['H1', '/hit', 'INT', 'BUNT', 'OBUNT'].includes(r) ||
  /^>[789]/.test(r) ||
  r === 'H2' ||
  r === '>hit' ||
  /^>>>[789]$/.test(r) ||
  r === 'H3' ||
  r === '>>>hit' ||
  r === 'HR' ||
  r === 'GHR';

// result로만 기록되는 추가 투구 1개가 있는지 — c.pitches에 없는 마지막 1구
// (인플레이 타격 접촉구, 사구 HP의 맞은 공)
// 삼진류(K/ꓘ, 낫아웃 포함)·볼넷은 이미 PITCH/STRIKEOUT에서 c.pitches에 포함됨
export const hasBatContactPitch = (r: string): boolean => {
  if (/^K|^ꓘ/.test(r)) return false;
  if (['B', 'IB', 'IB2'].includes(r)) return false;
  if (/^#\dE$/.test(r) || /^Ob\dE$/.test(r)) return false;
  return true;
};

const blank = (): Omit<PitcherRow, 'name' | 'entryInn' | 'entryOrd'> => ({
  bf: 0,
  np: 0,
  ab: 0,
  h: 0,
  hr: 0,
  sh: 0,
  sf: 0,
  bb: 0,
  ibb: 0,
  hbp: 0,
  so: 0,
  wp: 0,
  bk: 0,
  r: 0,
  er: 0,
  outs: 0,
});

// half = 투수의 등판 half (= 상대 팀이 공격하는 half)
//   half='top'    → HOME 투수 (원정 공격 시 등판)
//   half='bottom' → AWAY 투수 (홈 공격 시 등판)
export function computePitcherRows(
  G: GameState,
  half: Half,
  activePitcherName?: string
): PitcherRow[] {
  // 교체 목록은 기록된 배열 순서 = 시간순 그대로 사용
  // ((이닝,타순) 재정렬은 타순이 9→1로 도는 순간 시간 순서가 깨짐)
  const changes = (G.pitcherChanges || []).filter((c) => c.half === half);
  const defLU = half === 'top' ? G.homeLineup : G.awayLineup;
  const starterName =
    changes[0]?.oldName || defLU.find((p) => p.pos === 1)?.name || activePitcherName || '';

  const rows: PitcherRow[] = [{ name: starterName, entryInn: 1, entryOrd: 1, ...blank() }];
  changes.forEach((ch) => {
    rows.push({ name: ch.name, entryInn: ch.inning, entryOrd: ch.order, ...blank() });
  });

  // 시간순 셀 정렬 — 이닝 → 셀 생성(입력) 순서 (타순 wrap에 안전)
  const insertSeq: Record<string, number> = {};
  Object.keys(G.cells).forEach((k, i) => {
    insertSeq[k] = i;
  });
  const seqOf = (c: { half: string; inning: number; order: number; appearance: number }) =>
    insertSeq[`${c.half}-${c.inning}-${c.order}-${c.appearance}`] ?? 0;
  const cells = Object.values(G.cells)
    .filter((c) => c.half === half && (c.result || c.pitches.length > 0))
    .sort((a, b) => (a.inning !== b.inning ? a.inning - b.inning : seqOf(a) - seqOf(b)));

  // 시간순 워크: 교체 앵커 타석(교체 시점의 이닝·타순)에 도달하면 투수 전환.
  // mid(볼카운트 도중) 교체는 전임 투수가 던진 투구 수를 분리 귀속.
  let cur = 0;
  let next = 0; // changes 포인터 — rows[next + 1] 이 해당 교체의 새 투수
  // 셀별 귀속 투수 행 인덱스 — 병살/삼중살 주자 아웃을 타자 셀(outGroup) 투수에게 재귀속할 때 사용
  const rowIndexOf: Record<string, number> = {};
  cells.forEach((c) => {
    // 앵커 타석이 없었던 교체(이닝 사이 등)는 다음 이닝 진입 시점에 반영
    while (next < changes.length && changes[next].inning < c.inning) {
      next++;
      cur = next;
    }
    // 이 타석에서 일어난 교체(들) — mid면 전임 투구 분리
    let prevMid = 0;
    while (
      next < changes.length &&
      changes[next].inning === c.inning &&
      changes[next].order === c.order
    ) {
      const ch = changes[next];
      if (ch.mid) {
        const midP = Math.min(
          ch.mid.pitches ?? (ch.mid.balls ?? 0) + (ch.mid.strikes ?? 0),
          (c.pitches || []).length
        );
        rows[cur].np += Math.max(0, midP - prevMid);
        prevMid = Math.max(prevMid, midP);
      }
      next++;
      cur = next;
    }
    const s = rows[cur];
    rowIndexOf[`${c.half}-${c.inning}-${c.order}-${c.appearance}`] = cur;
    s.np += (c.pitches || []).length - prevMid;
    const r = c.result || '';
    if (!r) return;
    // BAT_ADV/BAT_OUT이 접촉투구(타격)를 c.pitches 아닌 pitchCount로만 집계하는 결과들에 +1
    // (B/HP/삼진류는 이미 PITCH or STRIKEOUT에서 처리됨)
    if (hasBatContactPitch(r)) s.np += 1;
    s.bf += 1;
    // 타수 제외: 볼넷·고의4구·사구·희생번트(SH~)·희생플라이(SF~)·타격방해 출루
    const exclAB =
      ['B', 'IB', 'IB2', 'HP'].includes(r) ||
      /^SF/.test(r) ||
      /^SH/.test(r) ||
      /^#\dE$/.test(r) ||
      /^Ob\dE$/.test(r);
    if (!exclAB) s.ab += 1;
    if (isHitR(r)) s.h += 1;
    if (r === 'HR' || r === 'GHR') s.hr += 1;
    if (r === 'B') {
      // mid 교체 시 불리한 카운트 인계 볼넷은 전임 투수 책임 (bbChargedTo)
      const chargeTo = c.bbChargedTo ? rows.find((x) => x.name === c.bbChargedTo) : null;
      (chargeTo ?? s).bb += 1;
    }
    if (r === 'IB' || r === 'IB2') {
      s.ibb += 1;
      s.bb += 1;
    }
    if (r === 'HP') s.hbp += 1;
    if (/^K|^ꓘ/.test(r)) s.so += 1;
    if (r === 'SH' || r === 'SH진루' || r.includes('SH')) s.sh += 1;
    if (r.startsWith('SF')) s.sf += 1;
    if (c.cellOutNum) s.outs += 1;
    if (c.scored) {
      const sp = c.scorePitcher
        ? rows.find((x) => x.name === c.scorePitcher || c.scorePitcher!.startsWith(`${x.name}(`))
        : null;
      const target = sp || s;
      target.r += 1;
      if (c.earned === true) target.er += 1;
      else if (c.earned === 'half') target.er += 0.5;
    }
    (c.eventLog || []).forEach((e) => {
      if (e.kind === 'runner_steal') {
        // (W)는 폭투로 기록하지 않는 표기 (주자 아웃 등) — 투수 폭투 집계 제외
        if (e.advCode === 'W') s.wp += 1;
        if (
          e.advCode === 'BK' ||
          e.advCode === '(BK)' ||
          e.advCode === '✓BK' ||
          e.advCode === '✓(BK)'
        )
          s.bk += 1;
      }
    });
  });

  // 병살/삼중살 주자 아웃 — 주자의 원래 타석(시간상 이전)이 아니라 실제 아웃이 발생한
  // 타자 셀(outGroup)의 투수에게 귀속 (그 순간 마운드에 있던 투수가 잡은 아웃이므로)
  cells.forEach((c) => {
    if (!c.runOutNum) return;
    const ownKey = `${c.half}-${c.inning}-${c.order}-${c.appearance}`;
    const idx = (c.outGroup ? rowIndexOf[c.outGroup] : undefined) ?? rowIndexOf[ownKey] ?? 0;
    rows[idx].outs += 1;
  });

  return rows;
}
