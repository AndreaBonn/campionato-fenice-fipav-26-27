import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { renderStandings } from "../../docs/tables-view.js";
import { crestFallbackHtml } from "../../docs/crest-view.js";

const girone = JSON.parse(readFileSync(new URL("../fixtures/data-64353.json", import.meta.url), "utf8"));
const count = (html, needle) => html.split(needle).length - 1;
const rows = (html) => html.split("<tr").filter((r) => r.includes("<td"));

test("renders one body row per team with the club crest lazy-loaded at a fixed size", () => {
  const html = renderStandings(girone);
  assert.equal(rows(html).length, 6);
  assert.equal(count(html, 'loading="lazy" width="24" height="24"'), 6);
  assert.match(html, /<th scope="col">Pt<\/th>/);
});

test("highlights the Fenice row only, with a text marker besides the colour", () => {
  const html = renderStandings(girone);
  const fenice = rows(html).filter((r) => r.includes('class="me"'));
  assert.equal(fenice.length, 1);
  assert.match(fenice[0], /Asd Fenice/);
  assert.match(fenice[0], /la tua squadra/);
});

test("opponent names are buttons carrying data-opponent with the team id, never the Fenice", () => {
  const html = renderStandings(girone);
  assert.equal(count(html, 'data-opponent="232396"'), 1);
  assert.equal(count(html, "data-opponent="), 5);
  assert.equal(count(html, '<button type="button" class="team" data-opponent='), 5);
  assert.equal(count(html, "<a "), 0);
  assert.doesNotMatch(html, /data-opponent="232645"/);
  assert.equal(count(html, "<a "), 0);
});

test("shows the provisional tie-break inside the how-to, and no zone class while the formula is unpublished", () => {
  const html = renderStandings(girone);
  assert.match(html, /A parità di punti si guarda, nell(?:'|&#39;)ordine: vittorie, quoziente set, quoziente punti\. Criterio provvisorio finché il Comitato non pubblica l(?:'|&#39;)indizione\./);
  assert.equal(count(html, "Criterio di parità provvisorio"), 0);
  assert.equal(count(html, "zone-"), 0);
});

test("marks the promotion zone on the first row once the formula is published", () => {
  const data = { ...girone, formula: { published: true, promotion: 1, playoff: 0, relegation: 0 } };
  const r = rows(renderStandings(data));
  assert.match(r[0], /zone-promotion/);
  assert.doesNotMatch(r[1], /zone-/);
});

test("escapes team names and shows an empty ratio as a dash", () => {
  const data = structuredClone(girone);
  data.teams[1].name = "<b>X</b>";
  data.standings[0].set_ratio = null;
  data.standings[0].point_ratio = Infinity;
  const html = renderStandings(data);
  assert.equal(count(html, "<b>X"), 0);
  assert.match(html, /&lt;b&gt;/);
  assert.match(rows(html)[0], /<td class="c-x">-<\/td><td class="c-x">-<\/td>/);
});

test("falls back to the table computed from the games when the file has no standings", () => {
  const data = { ...girone, standings: [] };
  assert.equal(rows(renderStandings(data)).length, 6);
});

test("returns nothing for a league without teams", () => {
  assert.equal(renderStandings({ ...girone, teams: [], standings: [], games: [] }), "");
});

test("each crest image carries the team name so the fallback can name it", () => {
  const html = renderStandings(girone);
  assert.equal(count(html, 'data-crest-name="'), 6);
});

// Every game played, the team listed first in data.teams always wins 3-0: a strict order, all positions decided
function decidedSeason() {
  const data = structuredClone(girone);
  const rank = (id) => data.teams.findIndex((t) => t.id === id);
  for (const g of data.games) {
    const homeWins = rank(g.home_id) < rank(g.away_id);
    Object.assign(g, homeWins
      ? { played: true, sets_won: [3, 0], sets: [[25, 10], [25, 10], [25, 10]] }
      : { played: true, sets_won: [0, 3], sets: [[10, 25], [10, 25], [10, 25]] });
  }
  data.standings = [];
  return data;
}

test("shows no possible-position column nor decided block at the start of the season", () => {
  const html = renderStandings(girone);
  assert.doesNotMatch(html, /Poss\./);
  assert.doesNotMatch(html, /Già deciso/);
});

test("shows the possible-position column and the decided block once positions are settled", () => {
  const html = renderStandings(decidedSeason());
  assert.match(html, /<th scope="col" class="c-x">Poss\.<\/th>/);
  assert.match(html, /<td class="c-x">1°<\/td>/);
  assert.match(html, /Già deciso/);
  assert.match(html, /1° posto/);
});

test("decided block lists zones only when the formula is published", () => {
  const data = decidedSeason();
  assert.doesNotMatch(renderStandings(data), /promozione|retrocessione/);
  data.formula = { published: true, promotion: 1, playoff: 0, relegation: 1 };
  const html = renderStandings(data);
  assert.match(html, /promozione/);
  assert.match(html, /retrocessione/);
});


test("published zones mark all six positions including the relegation boundary", () => {
  const data = { ...girone, formula: { published: true, promotion: 1, playoff: 2, relegation: 1 } };
  const classes = rows(renderStandings(data)).map((row) => row.match(/zone-(?:promotion|playoff|relegation)/)?.[0] ?? "none");
  assert.deepEqual(classes, ["zone-promotion", "zone-playoff", "zone-playoff", "none", "none", "zone-relegation"]);
});

test("a team without a logo shows its initials, like the team card, instead of an image", () => {
  const data = structuredClone(girone);
  const id = data.standings[0].team_id;
  const team = data.teams.find((t) => t.id === id);
  team.logo_url = null;
  const row = rows(renderStandings(data))[0];
  assert.match(row, new RegExp(`data-opponent="${id}"|la tua squadra`));
  assert.doesNotMatch(row, /<img/);
  assert.ok(row.includes(crestFallbackHtml(team.name)));
  const withLogo = rows(renderStandings(girone))[0];
  assert.match(withLogo, /<img/);
  assert.doesNotMatch(withLogo, /crest-fallback/);
});

test("a narrow open range shows the column without a decided block", () => {
  const data = structuredClone(girone);
  data.standings = data.standings.slice(0, 3).map((row, i) => ({ ...row, pos: i + 1, points: i ? 0 : 3, won: 0 }));
  const [a, b, c] = data.standings.map((row) => row.team_id);
  data.games = [{ home_id: b, away_id: c, played: false }];
  const html = renderStandings(data);
  assert.match(html, /<th scope="col" class="c-x">Poss\.<\/th>/);
  assert.match(rows(html)[0], /<td class="c-x">1°-2°<\/td>/);
  assert.doesNotMatch(html, /Già deciso/);
  assert.match(renderStandings(decidedSeason()), /Già deciso/);
});

test("a non-provisional tie break drops the provisional sentence from the how-to", () => {
  const data = { ...girone, tie_break: { ...girone.tie_break, provisional: false } };
  assert.doesNotMatch(renderStandings(data), /Criterio provvisorio/);
  assert.match(renderStandings(data), /A parità di punti si guarda, nell(?:'|&#39;)ordine: vittorie, quoziente set, quoziente punti\./);
  assert.match(renderStandings(girone), /Criterio provvisorio/);
});

test("an unknown tie-break criterion is displayed verbatim", () => {
  const data = { ...girone, tie_break: { provisional: true, criteria: ["wins", "custom_criterion"] } };
  assert.match(renderStandings(data), /nell(?:'|&#39;)ordine: vittorie, custom_criterion\./);
});

const heads = (html) => [...html.matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map((m) => m[1]);
const cellsOf = (row) => [...row.matchAll(/<td[^>]*>/g)].length;

test("C2: columns run Pos, Squadra, Pt, G, V, P, Set, Q. set, Q. punti, Ultime 5", () => {
  assert.deepEqual(heads(renderStandings(girone)), ["Pos", "Squadra", "Pt", "G", "V", "P", "Set", "Q. set", "Q. punti", "Ultime 5"]);
  assert.deepEqual(heads(renderStandings(decidedSeason())), ["Pos", "Squadra", "Pt", "G", "V", "P", "Set", "Q. set", "Q. punti", "Poss.", "Ultime 5"]);
  const first = rows(renderStandings(girone))[0];
  assert.match(first, /<td>1<\/td><td class="name">.*<\/td><td><b>8<\/b><\/td><td>3<\/td><td>3<\/td><td>0<\/td><td class="c-x">9-2<\/td>/);
  for (const r of rows(renderStandings(girone))) assert.equal(cellsOf(r), 10);
});

test("C1: Set, quotients, Poss. and Ultime 5 carry c-x in head and cells; Pos, Squadra, Pt, G, V, P never do", () => {
  for (const html of [renderStandings(girone), renderStandings(decidedSeason())]) {
    const cx = [...html.matchAll(/<th scope="col" class="c-x">([^<]+)<\/th>/g)].map((m) => m[1]);
    assert.ok(cx.includes("Set") && cx.includes("Q. set") && cx.includes("Q. punti") && cx.includes("Ultime 5"));
    for (const plain of ["Pos", "Squadra", "Pt", "G", "V", "P"]) assert.ok(html.includes(`<th scope="col">${plain}</th>`), plain);
    for (const r of rows(html)) assert.equal(count(r, 'class="c-x"'), cx.length);
  }
  assert.ok(renderStandings(decidedSeason()).includes('<th scope="col" class="c-x">Poss.</th>'));
});

test("C1: the region label no longer promises a sideways scroll", () => {
  const html = renderStandings(girone);
  assert.doesNotMatch(html, /scorri/);
  assert.match(html, /role="region" aria-label="Classifica del girone"/);
});

test("C1: the crest stays inline beside the name, in the Fenice row as in the others", () => {
  for (const r of rows(renderStandings(girone))) assert.match(r, /<td class="name"><span class="nm"><img [^>]*><(?:button|span)[^]*<\/span><\/td>/);
});

test("C4: a note above the table says the team names open the card", () => {
  const html = renderStandings(girone);
  const note = '<p class="note tap-hint">Tocca una squadra per vedere la sua scheda.</p>';
  assert.ok(html.indexOf(note) !== -1 && html.indexOf(note) < html.indexOf('<div class="table-wrap"'));
});

test("C3: a closed details «Come leggere la classifica» under the table explains the terms and the Fenice row", () => {
  const html = renderStandings(girone);
  assert.match(html, /<details class="howto"><summary>Come leggere la classifica<\/summary>/);
  assert.ok(html.indexOf("</table>") < html.indexOf('class="howto"'));
  for (const term of ["Pt", "G, V, P", "Set", "Q. set", "Q. punti"]) assert.ok(html.includes(`<dt>${term}</dt>`), term);
  assert.match(html, /3 per una vittoria 3-0 o 3-1, 2 per un 3-2, 1 per una sconfitta 2-3/);
  assert.match(html, /la riga della Fenice è evidenziata/);
  assert.doesNotMatch(html, /<details class="howto" open/);
});

test("C3: Poss. is explained only when its column is shown", () => {
  assert.doesNotMatch(renderStandings(girone), /<dt>Poss\.<\/dt>/);
  assert.match(renderStandings(decidedSeason()), /<dt>Poss\.<\/dt>/);
});

function preseason() {
  const data = structuredClone(girone);
  data.standings = data.standings.map((r) => ({ ...r, played: 0, points: 0, won: 0, lost: 0, sets_won: 0, sets_lost: 0 }));
  data.games = data.games.map((g) => ({ ...g, played: false, sets_won: null, sets: [] }));
  return data;
}

test("C5: while no team has played a tinted note names the first game day above the table", () => {
  const data = preseason();
  const first = data.games.map((g) => g.starts_at).sort()[0];
  const day = new Date(first).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" });
  const html = renderStandings(data);
  assert.ok(html.includes(`<p class="preseason">Il campionato parte ${day}: finché nessuno ha giocato tutte le squadre hanno 0 punti e l&#39;ordine non è ancora una graduatoria.</p>`));
  assert.ok(html.indexOf("preseason") < html.indexOf('<div class="table-wrap"'));
});

test("C5: no pre-season note once a team has played, and it appears once", () => {
  assert.equal(count(renderStandings(girone), "preseason"), 0);
  assert.equal(count(renderStandings(preseason()), "preseason"), 1);
});

test("C6: Ultime 5 shows coloured V/P letters per team in play-date order, a dash when none", () => {
  const data = structuredClone(girone);
  const id = data.standings[0].team_id;
  const html = renderStandings(data);
  const row = rows(html).find((r) => r.includes(`data-opponent="${id}"`));
  const letters = [...row.matchAll(/<span class="l5 (won|lost)">([VP])<\/span>/g)];
  assert.ok(letters.length > 0 && letters.length <= 5);
  for (const [, kind, letter] of letters) assert.equal(letter, kind === "won" ? "V" : "P");
  const empty = rows(renderStandings(preseason()))[0];
  assert.match(empty, /<td class="c-x">-<\/td><\/tr>/);
  assert.equal(count(empty, "l5"), 0);
});

test("ratios read with two decimals and a comma, zero included", () => {
  const fenice = rows(renderStandings(girone)).find((r) => r.includes('class="me"'));
  // set ratio 0 and point ratio 0.6089 of the Fenice in the fixture
  assert.match(fenice, /<td class="c-x">0,00<\/td><td class="c-x">0,61<\/td>/);
  const first = rows(renderStandings(girone))[0];
  assert.match(first, /<td class="c-x">4,50<\/td><td class="c-x">1,59<\/td>/);
});

test("the crest url and the team name cannot leave their attributes", () => {
  const data = structuredClone(girone);
  for (const t of data.teams) Object.assign(t, { logo_url: 'https://x.test/a.png" onerror="alert(1)', name: 'A"<b>' });
  const html = renderStandings(data);
  assert.match(html, /src="https:\/\/x\.test\/a\.png&quot; onerror=&quot;alert\(1\)" alt="" data-crest-name="A&quot;&lt;b&gt;"/);
  assert.doesNotMatch(html, /onerror="alert/);
});

test("the scrollable table region is reachable from the keyboard", () => {
  assert.ok(renderStandings(girone).includes('<div class="table-wrap" role="region" aria-label="Classifica del girone" tabindex="0">'));
});

test("a standings row of a team missing from the teams is left out, the others still show", () => {
  const data = structuredClone(girone);
  data.standings.push({ ...data.standings[0], pos: 7, team_id: "ghost" });
  const html = renderStandings(data);
  assert.equal(rows(html).length, 6);
  assert.equal(count(html, "ghost"), 0);
});

test("the decided block names the playoff place of a team that is settled in it", () => {
  const data = decidedSeason();
  data.formula = { published: true, promotion: 1, playoff: 1, relegation: 0 };
  const html = renderStandings(data);
  assert.ok(html.includes("<li><b>Asd Fenice</b>: 1° posto, promozione</li>"));
  assert.match(html, /<li><b>[^<]+<\/b>: 2° posto, playoff<\/li>/);
});

test("the decided block puts promotion on the first team and relegation on the last", () => {
  const data = decidedSeason();
  data.formula = { published: true, promotion: 1, playoff: 0, relegation: 1 };
  const html = renderStandings(data);
  assert.ok(html.includes("<li><b>Asd Fenice</b>: 1° posto, promozione</li>"));
  assert.ok(html.includes("<li><b>Sarlux Volley Sarroch</b>: 6° posto, retrocessione</li>"));
  assert.ok(html.includes("<li><b>Asd Sporting Club Su Planu</b>: 2° posto</li>")); // a middle team carries no zone
});

test("C6: Ultime 5 of a team lists its played games oldest first by date", () => {
  const lettersOf = (id) => {
    const row = rows(renderStandings(girone)).find((r) => r.includes(`data-opponent="${id}"`));
    return [...row.matchAll(/<span class="l5 (?:won|lost)">([VP])<\/span>/g)].map((m) => m[1]);
  };
  // Sarroch: lost 2-3 at home (2 Nov), won 3-0 at home (9 Nov), won 3-0 away at the Fenice (19 Nov)
  assert.deepEqual(lettersOf("232139"), ["P", "V", "V"]);
  // Selargius: won 3-0 at home (30 Oct), lost 0-3 away (5 Nov), lost 0-3 at home (20 Nov)
  assert.deepEqual(lettersOf("232550"), ["V", "P", "P"]);
});

test("the decided block leaves out a team with nothing settled to say (zones all ruled out, place still open)", () => {
  const data = decidedSeason();
  const open = new Set([data.teams[2].id, data.teams[3].id]); // CUS Cagliari and G.S. Aquila Oro
  for (const g of data.games) if (open.has(g.home_id) && open.has(g.away_id)) Object.assign(g, { played: false, sets_won: null, sets: [] });
  data.formula = { published: true, promotion: 1, playoff: 0, relegation: 1 };
  const html = renderStandings(data);
  assert.ok(html.includes("<li><b>Asd Sporting Club Su Planu</b>: 2° posto</li>"));
  assert.ok(html.includes("<li><b>Polisportiva Selargius 85 Asd</b>: 5° posto</li>"));
  assert.ok(!html.includes("</b>: </li>"));
  assert.ok(!html.includes("<b>CUS Cagliari</b>"));
});
