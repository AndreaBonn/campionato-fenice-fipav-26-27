import { performance } from "node:perf_hooks";
import { MAX_ENUMERATED_GAMES, positionRanges } from "../docs/standings-math.js";

const RUNS = 5;
const LIMIT_MS = 300;
const TEAM_COUNT = 6;
const PLAYING_TEAMS = TEAM_COUNT - 1;
const count = process.argv[2] === undefined ? MAX_ENUMERATED_GAMES : Number(process.argv[2]);
const teams = Array.from({ length: TEAM_COUNT }, (_, id) => ({ id }));
const games = Array.from({ length: count }, (_, i) => ({
  home_id: i % PLAYING_TEAMS, away_id: (i + 1) % PLAYING_TEAMS, played: false,
}));
const timings = Array.from({ length: RUNS }, () => {
  const start = performance.now();
  positionRanges({ teams, games }, { maxEnumerated: count });
  return performance.now() - start;
}).sort((a, b) => a - b);
const median = timings[Math.floor(RUNS / 2)];
console.log(`max-enumerated=${count} games, median of ${RUNS} runs: ${median.toFixed(2)} ms`);
process.exitCode = median < LIMIT_MS ? 0 : 1;
