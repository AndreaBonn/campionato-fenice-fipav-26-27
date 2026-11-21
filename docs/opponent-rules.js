// Pure rules for the opponent card: head to head with the followed club and the opponent's calendar.
import { isHome, outcome, scoreLabel, setScores } from "./game-rules.js";

const between = (game, a, b) => (game.home_id === a && game.away_id === b) || (game.home_id === b && game.away_id === a);
const involves = (game, teamId) => game.home_id === teamId || game.away_id === teamId;
const isResult = (game) => game.played && game.sets_won;

// Games between the two clubs seen from feniceId: played ones with score and set partials, the ones still to play,
// and the balance of wins and sets
export function headToHead(feniceId, otherId, games) {
  const mine = games.filter((g) => between(g, feniceId, otherId));
  const played = mine.filter(isResult).map((game) => ({
    game, score: scoreLabel(game, feniceId), sets: setScores(game, feniceId), outcome: outcome(game, feniceId),
  }));
  const setsFor = (game) => (isHome(game, feniceId) ? game.sets_won : [game.sets_won[1], game.sets_won[0]]);
  return {
    played,
    upcoming: mine.filter((g) => !g.played),
    won: played.filter((p) => p.outcome === "won").length,
    lost: played.filter((p) => p.outcome === "lost").length,
    setsWon: played.reduce((sum, p) => sum + setsFor(p.game)[0], 0),
    setsLost: played.reduce((sum, p) => sum + setsFor(p.game)[1], 0),
  };
}

// Played and remaining games of a team, each with the opponent and the venue side, from the team's point of view
export function opponentSchedule(teamId, games) {
  const side = (game) => ({ opponentId: isHome(game, teamId) ? game.away_id : game.home_id, home: isHome(game, teamId) });
  const mine = games.filter((g) => involves(g, teamId));
  return {
    played: mine.filter(isResult).map((game) => ({ game, opponentId: side(game).opponentId, score: scoreLabel(game, teamId), outcome: outcome(game, teamId) })),
    remaining: mine.filter((g) => !g.played).map((game) => ({ game, ...side(game) })),
  };
}
