# campionato-fenice-fipav-26-27

Static page (GitHub Pages, `docs/`) for ASD Fenice's Seconda Divisione Femminile 2026/27 games (FIPAV Cagliari, girone 64444), kept in sync with FIPAV Online by a scheduled GitHub Action.

The project started as a selective copy of the sister basketball project `campionato-serie-c-26-27` (same pipeline, different source), not a fork. Only what exists today is described here; the later phases (results table, standings, ICS feed, possible positions, team card, notices, installable app) are in `specs/001-fenice-seconda-divisione/plan.md`, checklist in `tasks.md`.

## Data flow

FIPAV Online JSON API (girone `64444`) → `src/fenice_calendar` → `docs/data.json` → `docs/index.html`.

- Source: `data.fipavonline.it` first, `app.fipavonline.it` on the same resource as fallback (`fetch.py`). A response whose content type is not JSON (the Cloudflare challenge page is HTML) is rejected like a network error; when both hosts fail the run raises `FetchError`. Requests are 1 s apart and carry a project User-Agent.
- The Fenice is identified only by `cod_aff_societa` `190920448` (`TEAM_COD` in `config.py`), never by team id or name: the team id changes from one group to another. If the code is not in the calendar the run fails.
- The calendar's `date` and `time` fields are authoritative; `ts_gara` is not used.
- `data.json` follows the schema in `plan.md` § Schema di data.json (version 1), checked by `validate_data()` in `schema.py`. Keys of later phases already exist with empty values (`standings: []`, `notices: []`, `poster: null`, `changes: []`).
- `docs/data.json` is rewritten only when content changes, `updated_at` excluded from the comparison (`output.py`).
- `docs/status.json` (`checked_at`) is written on every successful run, is gitignored and reaches the site only through the Pages artifact: a failed run skips the deploy, so the page keeps showing the last successful check.
- On any failure (`FetchError`, team not found, parse error, invalid document) `fenice-sync` exits 1 and writes nothing, so `data.json` and `status.json` stay as they were.
- The FIPAV standings count games that are not yet homologated too (measured 2026-11-21 on girone 64353). Relevant for the standings phase.
- The league formula is not published: `FORMULA` in `config.py` is empty (`published: false`, no promotion, playoff or relegation zones) and the tie-break (wins, set ratio, point ratio) is marked provisional (`TIE_BREAK`).
- Schedule: one cron every 4 hours (`17 */4 * * *`), plus push to main and manual dispatch. No hourly run on weekends: user decision of 2026-11-21 (D7). Midweek games can therefore show their result up to 4 hours late.
- Tests never read `docs/data.json` or the network: they use frozen responses and documents in `tests/fixtures/` (`calendar-64444.json`, `calendar-64353.json`, `standings-*.json`, `data-sample.json`, `data-64353.json`, `posters-19092.json`). CI runs them before the sync, so a FIPAV correction cannot block it.

## Web app

- `docs/index.html` wires state and events; rendering lives in modules that take their data as arguments: `game-rules.js` (pure rules: next game, sets, map link), `games-view.js` (hero and game list), `view-rules.js` (display wording). Styles in `styles.css`, palette from the FIPAV logo (plum and coral). Plain ES modules, no dependencies.
- The page shows the Fenice's next game with countdown, the game list by round, the "Fonte: FIPAV Online" attribution and the date of the last check read from `status.json`. Loading, error, empty and populated states are rendered.

## Commands

- `npm run setup`: `uv sync` and import check
- `uv run fenice-sync` (`npm run sync`): fetch the calendar, update `docs/data.json` and `docs/status.json`
- `npm test`: JS rules (`node --test tests/js/*.test.mjs`, no dependencies)
- `npm run test:py` (`uv run pytest --cov`), `npm run lint` (`uv run ruff check . && uv run mypy`, strict on `src` and `tests`)
- `npm run serve`: static server on `docs/` at port 8000
- Python has no runtime dependencies (stdlib only); dev tools run through uv.
- When FIPAV changes the response shape, save the new response in `tests/fixtures/` and reproduce the failure there first.
