// Pure standings rules: the table recomputed from the played games, no DOM, tested with node --test.
// Tie-break order (D3, provisional): points, wins, set ratio, point ratio.

const WIN_FULL = 3;
const WIN_TIGHT = 2;
const LOSS_TIGHT = 1;
const SETS_TO_WIN = 3;

// Match points [home, away] from the sets [home, away]: 3-0 and 3-1 give 3/0, 3-2 gives 2/1
export function matchPoints(setsWon) {
  const [h, a] = setsWon;
  const tight = Math.min(h, a) === SETS_TO_WIN - 1;
  const [win, loss] = tight ? [WIN_TIGHT, LOSS_TIGHT] : [WIN_FULL, 0];
  return h > a ? [win, loss] : [loss, win];
}

const emptyRow = (team_id) => ({
  team_id, pos: 0, played: 0, points: 0, won: 0, lost: 0, sets_won: 0, sets_lost: 0, points_for: 0, points_against: 0, set_ratio: 0, point_ratio: 0,
});

// A zero denominator reads as an infinite ratio, so a side that never lost a set ranks first
const ratio = (num, den) => (den === 0 ? Infinity : num / den);

function addSide(row, mine, theirs, points, sets) {
  row.played += 1;
  row.points += points;
  if (mine > theirs) row.won += 1;
  else row.lost += 1;
  row.sets_won += mine;
  row.sets_lost += theirs;
  for (const s of sets) {
    row.points_for += s[0];
    row.points_against += s[1];
  }
}

const compare = (a, b) =>
  b.points - a.points || b.won - a.won || (b.set_ratio === a.set_ratio ? 0 : b.set_ratio > a.set_ratio ? 1 : -1) ||
  (b.point_ratio === a.point_ratio ? 0 : b.point_ratio > a.point_ratio ? 1 : -1);

// Every played game counts, official or not: that is how the FIPAV standings are built
export function tableFromGames(games, teams) {
  const rows = new Map(teams.map((t) => [t.id, emptyRow(t.id)]));
  for (const g of games) {
    if (!g.played || !g.sets_won) continue;
    const [hp, ap] = matchPoints(g.sets_won);
    addSide(rows.get(g.home_id), g.sets_won[0], g.sets_won[1], hp, g.sets);
    addSide(rows.get(g.away_id), g.sets_won[1], g.sets_won[0], ap, g.sets.map(([h, a]) => [a, h]));
  }
  const table = [...rows.values()];
  for (const r of table) {
    r.set_ratio = ratio(r.sets_won, r.sets_lost);
    r.point_ratio = ratio(r.points_for, r.points_against);
  }
  table.sort(compare);
  table.forEach((r, i) => { r.pos = i + 1; });
  return table;
}
