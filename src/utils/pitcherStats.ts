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
  const changes = (G.pitcherChanges || [])
    .filter((c) => c.half === half)
    .sort((a, b) => (a.inning !== b.inning ? a.inning - b.inning : a.order - b.order));
  const defLU = half === 'top' ? G.homeLineup : G.awayLineup;
  const starterName =
    changes[0]?.oldName || defLU.find((p) => p.pos === 1)?.name || activePitcherName || '';

  const rows: PitcherRow[] = [{ name: starterName, entryInn: 1, entryOrd: 1, ...blank() }];
  changes.forEach((ch) => {
    rows.push({ name: ch.name, entryInn: ch.inning, entryOrd: ch.order, ...blank() });
  });

  Object.values(G.cells)
    .filter((c) => c.half === half && (c.result || c.pitches.length > 0))
    .sort((a, b) =>
      a.inning !== b.inning
        ? a.inning - b.inning
        : a.appearance !== b.appearance
          ? a.appearance - b.appearance
          : a.order - b.order
    )
    .forEach((c) => {
      let idx = 0;
      for (let i = 0; i < rows.length; i++) {
        const e = rows[i];
        if (e.entryInn < c.inning || (e.entryInn === c.inning && e.entryOrd <= c.order)) {
          idx = i;
        }
      }
      const s = rows[idx];
      s.np += (c.pitches || []).length;
      const r = c.result || '';
      if (!r) return;
      s.bf += 1;
      const exclAB = ['B', 'IB', 'IB2', 'HP', 'INT', 'SF', 'SH'].includes(r);
      if (!exclAB) s.ab += 1;
      if (isHitR(r)) s.h += 1;
      if (r === 'HR' || r === 'GHR') s.hr += 1;
      if (r === 'B') s.bb += 1;
      if (r === 'IB' || r === 'IB2') {
        s.ibb += 1;
        s.bb += 1;
      }
      if (r === 'HP') s.hbp += 1;
      if (/^K|^ꓘ/.test(r)) s.so += 1;
      if (r === 'SH' || r === 'SH진루' || r.includes('SH')) s.sh += 1;
      if (r === 'SF' || r === '/SF') s.sf += 1;
      if (c.cellOutNum) s.outs += 1;
      if (c.runOutNum) s.outs += 1;
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
          if (e.advCode === 'W' || e.advCode === '(W)') s.wp += 1;
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

  return rows;
}
