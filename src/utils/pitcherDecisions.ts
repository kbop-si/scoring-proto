import type { GameState, GameDecisions, Half } from '../types';
import { computePitcherRows, type PitcherRow } from './pitcherStats';

const chronoOf = (inning: number, half: Half, order: number) =>
  inning * 1000 + (half === 'top' ? 0 : 500) + order;

interface HalfEvent {
  inning: number;
  half: Half;
  // 이 half 종료 후 양팀 누적 점수
  awayRTotal: number;
  homeRTotal: number;
}

function buildHalfEvents(G: GameState): HalfEvent[] {
  const events: HalfEvent[] = [];
  let awayTotal = 0;
  let homeTotal = 0;
  const maxInn = Math.max(G.awayInn.length, G.homeInn.length);
  for (let i = 0; i < maxInn; i++) {
    const tr = G.awayInn[i];
    if (tr != null) awayTotal += tr;
    events.push({ inning: i + 1, half: 'top', awayRTotal: awayTotal, homeRTotal: homeTotal });
    const br = G.homeInn[i];
    if (br != null) homeTotal += br;
    events.push({ inning: i + 1, half: 'bottom', awayRTotal: awayTotal, homeRTotal: homeTotal });
  }
  return events;
}

// 승팀이 마지막으로 동점/뒤지지 않게 된 (= 최종 리드 잡은) half-inning
function findGoAheadHalf(events: HalfEvent[], winnerTeam: 'away' | 'home'): HalfEvent | null {
  let lastNotAheadIdx = -1;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const winLead =
      winnerTeam === 'away' ? e.awayRTotal - e.homeRTotal : e.homeRTotal - e.awayRTotal;
    if (winLead <= 0) lastNotAheadIdx = i;
  }
  if (lastNotAheadIdx + 1 >= events.length) return null; // 동점 종료
  return events[lastNotAheadIdx + 1];
}

// team 입장에서 (inning, half) 가 시작하기 직전 시점의 리드 (team.score - opp.score)
function leadAtHalfStart(
  events: HalfEvent[],
  team: 'away' | 'home',
  inning: number,
  half: Half
): number {
  const idx = events.findIndex((e) => e.inning === inning && e.half === half);
  if (idx <= 0) return 0;
  const prev = events[idx - 1];
  return team === 'away' ? prev.awayRTotal - prev.homeRTotal : prev.homeRTotal - prev.awayRTotal;
}

const defHalfOf = (team: 'away' | 'home'): Half => (team === 'away' ? 'bottom' : 'top');

// 등판 chrono ≤ T 인 가장 마지막 row
function pitcherOfRecord(rows: PitcherRow[], defHalf: Half, T: number): PitcherRow | undefined {
  let last: PitcherRow | undefined;
  for (const r of rows) {
    const c = chronoOf(r.entryInn, defHalf, r.entryOrd);
    if (c <= T) last = r;
  }
  return last;
}

// 한 팀에 대해 S/H/BS 산정
function applyTeamReliefDecisions(
  rows: PitcherRow[],
  team: 'away' | 'home',
  events: HalfEvent[],
  decisions: GameDecisions,
  winnerTeam: 'away' | 'home' | null,
  excludeName?: string
) {
  const defHalf = defHalfOf(team);
  const isWinner = team === winnerTeam;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r.name) continue;
    if (excludeName && r.name === excludeName) continue;

    const leadAtEntry = leadAtHalfStart(events, team, r.entryInn, defHalf);
    if (leadAtEntry <= 0) continue; // 리드 중 등판이 아니면 S/H/BS 대상 아님

    const ipOuts = r.outs;
    const saveSit =
      (leadAtEntry >= 1 && leadAtEntry <= 3 && ipOuts >= 3) || // (a) 1~3점 리드 + 1IP 이상
      ipOuts >= 9; // (c) 3IP 이상
    // (b) 동점/역전 주자 누상·타석·대기 — PA-level 데이터가 필요해 자동 판정에서는 생략 (사용자 수동)

    if (!saveSit) continue;

    // BS — 등판 후 허용한 실점이 등판 시 리드 이상이면 (동점/역전 허용)
    if (r.r >= leadAtEntry) {
      decisions[team].bs.push(r.name);
    }

    // 승팀에만 S/H 대상
    if (!isWinner) continue;

    const isLast = i === rows.length - 1;
    if (isLast && ipOuts >= 1) {
      decisions[team].save = r.name;
    } else if (!isLast && ipOuts >= 1) {
      const next = rows[i + 1];
      const leadAtExit = leadAtHalfStart(events, team, next.entryInn, defHalf);
      if (leadAtExit > 0) {
        decisions[team].holds.push(r.name);
      }
    }
  }
}

export function autoDecide(G: GameState): GameDecisions {
  const decisions: GameDecisions = {
    away: { holds: [], bs: [] },
    home: { holds: [], bs: [] },
  };

  const winnerTeam: 'away' | 'home' | null =
    G.awayR > G.homeR ? 'away' : G.homeR > G.awayR ? 'home' : null;

  const awayRows = computePitcherRows(G, 'bottom', G.pitcher?.name);
  const homeRows = computePitcherRows(G, 'top', G.pitcher?.name);
  const events = buildHalfEvents(G);

  if (winnerTeam) {
    const loserTeam = winnerTeam === 'away' ? 'home' : 'away';
    const winnerRows = winnerTeam === 'away' ? awayRows : homeRows;
    const loserRows = winnerTeam === 'away' ? homeRows : awayRows;

    const goAhead = findGoAheadHalf(events, winnerTeam);
    if (goAhead) {
      // 결승 PA 위치를 모르므로 그 half 의 중간 (order=5) 으로 근사
      const goAheadChrono = chronoOf(goAhead.inning, goAhead.half, 5);

      // L: 승팀 공격 = 패팀 수비 half (= goAhead.half) 에서 패팀의 그 시점 마운드 투수
      const loserDefHalf: Half = goAhead.half;
      const lossPit = pitcherOfRecord(loserRows, loserDefHalf, goAheadChrono);
      if (lossPit?.name) decisions[loserTeam].loss = lossPit.name;

      // W: 결승 시점 승팀의 pitcher of record (수비 half 기준 chrono)
      const winnerDefHalf = defHalfOf(winnerTeam);
      let winPit = pitcherOfRecord(winnerRows, winnerDefHalf, goAheadChrono);
      let winPitIdx = winPit ? winnerRows.indexOf(winPit) : -1;

      // KBO: 선발이 결승 시점 투수라도 5IP(15 outs) 미만이면 자격 없음 → 가장 빠른 효과적 구원에게 W
      if (winPitIdx === 0 && winPit && winPit.outs < 15 && winnerRows.length > 1) {
        for (let i = 1; i < winnerRows.length; i++) {
          if (winnerRows[i].outs >= 1) {
            winPit = winnerRows[i];
            winPitIdx = i;
            break;
          }
        }
      }
      if (winPit?.name) decisions[winnerTeam].win = winPit.name;
    }
  }

  // S/H/BS 양 팀 모두 — BS 는 양팀에서 가능, S/H 는 승팀에만
  applyTeamReliefDecisions(awayRows, 'away', events, decisions, winnerTeam, decisions.away.win);
  applyTeamReliefDecisions(homeRows, 'home', events, decisions, winnerTeam, decisions.home.win);

  return decisions;
}

// 모달에서 사용 — 양 팀 투수 row 목록 (이름 + 등판시점 + 스탯)
export function listPitchersForDecision(G: GameState) {
  return {
    away: computePitcherRows(G, 'bottom', G.pitcher?.name),
    home: computePitcherRows(G, 'top', G.pitcher?.name),
  };
}
