// Pure analysis rules over the games of one team: no DOM, tested with node --test.
import { isHome } from "./game-rules.js";

const emptyRecord = () => ({ played: 0, won: 0, lost: 0, setsWon: 0, setsLost: 0, pointsFor: 0, pointsAgainst: 0 });

const involves = (game, teamId) => game.home_id === teamId || game.away_id === teamId;
const isResult = (game) => game.played && game.sets_won;

function addGame(rec, game, teamId) {
  const home = isHome(game, teamId);
  const [mine, theirs] = home ? game.sets_won : [game.sets_won[1], game.sets_won[0]];
  rec.played += 1;
  if (mine > theirs) rec.won += 1;
  else rec.lost += 1;
  rec.setsWon += mine;
  rec.setsLost += theirs;
  for (const [h, a] of game.sets) {
    rec.pointsFor += home ? h : a;
    rec.pointsAgainst += home ? a : h;
  }
}

// Wins, losses, sets and points of a team, split between its home and its away games
export function homeAwayRecord(teamId, games) {
  const record = { home: emptyRecord(), away: emptyRecord() };
  for (const g of games.filter((x) => involves(x, teamId) && isResult(x))) {
    addGame(isHome(g, teamId) ? record.home : record.away, g, teamId);
  }
  return record;
}

// Unplayed games of a team with the opponent's current position and the average of those positions
// (a lower average means a harder run-in); averagePosition is null when nothing is left.
// Positions come from the FIPAV standings as published (penalties included), never rebuilt from results
export function remainingGames(teamId, games, standings) {
  const position = new Map(standings.map((r) => [r.team_id, r.pos]));
  const left = games.filter((g) => involves(g, teamId) && !g.played).map((game) => {
    const home = isHome(game, teamId);
    const opponentId = home ? game.away_id : game.home_id;
    return { game, opponentId, opponentPos: position.get(opponentId) ?? null, home };
  });
  const known = left.filter((r) => r.opponentPos !== null);
  const averagePosition = known.length ? known.reduce((sum, r) => sum + r.opponentPos, 0) / known.length : null;
  return { games: left, averagePosition };
}
