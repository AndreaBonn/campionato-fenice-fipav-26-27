# Piano 001 - Pagina ASD Fenice, Seconda Divisione Femminile Girone A

Requisiti in `spec.md` (R1-R26), task in `tasks.md`. Gemello di riferimento:
`/home/bonn/Documenti/00_Lavoro/ProgettiPersonali/campionato-serie-c-26-27` (indicato sotto come "gemello").

## Obiettivo

A fine lavoro un repo git locale contiene una pagina statica in `docs/` pubblicabile su GitHub Pages che mostra
prossima gara, risultati con parziali, classifica con posizioni possibili, schede avversarie e analisi della
Fenice nel girone FIPAV 64444, e un workflow che la riallinea a FIPAV Online ogni 4 ore (D7: nessun aggiornamento orario nel weekend).

## Definition of Done

- [x] `uv run fenice-sync` contro le fixture reali produce `docs/data.json` valido per lo schema, con 90 gare, 10 squadre, 18 gare Fenice (R1, R4, R5) (`tests/test_cli.py::test_main_success_writes_valid_data_and_status`)
- [x] Rete giù o pagina Cloudflare al posto del JSON: exit ≠ 0, file in `docs/` invariati (R2); seconda run uguale: `data.json` identico byte per byte (R3) (`tests/test_cli.py::test_main_network_down_exits_1_and_leaves_files_untouched`, `::test_main_second_run_keeps_data_but_refreshes_status`)
- [x] Prossima gara Fenice con countdown, lista gare con parziali e mappa, attribuzione FIPAV Online, osservate in browser a 375 e 1280 px (R6-R8) (render e click-through registrati in `docs/REPORT_ATTIVITA.md`, T015; test di vista in `tests/js/games-view.test.mjs`)
- [x] Classifica dall'API coincidente con quella ricalcolata dalle gare sulla fixture 64353 (R11, R12) (`tests/js/standings-rules.test.mjs`, fixture `data-64353.json`)
- [x] `docs/calendario.ics` con 18 VEVENT, link Google Calendar e diretta eScoreVolley quando `escorevolley` = "1" (R13, R14) (`tests/test_ics.py`, `tests/js/calendar-rules.test.mjs`, `tests/js/games-view.test.mjs`)
- [x] Posizioni possibili uguali alla forza bruta su campionati sintetici, < 0,3 s al massimo enumerato (R16, R17) (`tests/js/standings-math.test.mjs`)
- [x] Scheda avversaria e analisi Fenice con valori concreti sulle fixture e stato empty prima della prima gara (R18, R19) (`tests/js/opponent-view.test.mjs`, `tests/js/analysis-view.test.mjs`)
- [x] Notizie e locandine: outage della fonte non fa fallire il run e conserva i dati precedenti (R20, R21) (`tests/test_cli.py::test_extra_sources_outage_preserves_previous_values`)
- [x] PWA installabile, service worker network-first, versione stampata solo nell'artefatto (R22, R23) (`tests/test_manifest.py`, `tests/js/sw.test.mjs`, `tests/test_appversion.py`)
- [x] `ruff`, `mypy --strict`, `pytest --cov` ≥ 80%, `npm test` verdi (verificato il 2026-11-21: ruff e mypy puliti, 177 test Python con copertura 98%, 199 test JS); a11y-gate 5/5 (stati e axe in chiaro e scuro, responsive) sulla pagina con gare giocate il 2026-11-21, registrato in `docs/REPORT_ATTIVITA.md` (R25, R26)
- [ ] `git log` locale con un commit per fase, `git status` pulito; nessun push (D5). Per richiesta dell'utente i commit sono atomici, uno per task e non uno per fase (decisione "Un commit per task" in `.pilota/decisioni.md`, N1 in `.pilota/MATTINA.md`, 2026-11-21). Non spuntato: l'albero è pulito solo a fine lavoro e il workflow non è mai girato su GitHub, quindi l'accesso dai runner a Cloudflare e il SIGNAL restano da osservare dopo il push dell'utente

SIGNAL: `curl -s https://andreabonn.github.io/campionato-fenice-fipav-26-27/status.json` → `checked_at` | atteso più recente di 4 h 30 min e `data.json` con `games` lungo 90 | entro 5 h dal primo push dell'utente e poi a ogni controllo. Il segnale si produce in T009 (`status.json`) e T016 (deploy); prima del push resta non osservabile.

## Assunzioni

Già misurate in Research (2026-11-21, su copie reali):
- La classifica API conta tutte le gare giocate, anche non omologate: sulla fixture 64353 G, P, V, set e punti ricalcolati da tutte le 8 gare `played` (2 con `ris_ufficiale` "0") coincidono con l'API per tutte le 6 squadre. Diverso dal gemello basket, dove FIP contava solo le omologate. `BASIS: measured`.
- Il calendario 64444 arriva in una risposta unica, 90 gare, nessuna paginazione. `BASIS: measured`.
- Le gare di una "giornata" non stanno in un weekend: la giornata 1 va dal 21/11 al 01/12 (martedì 21:00). La prima gara della Fenice è il 21/11/2026 alle 17:00, cioè oggi. `BASIS: measured`.

Mie, rivedibili:
- A1. `date` + `time` sono autorevoli; `ts_gara` non si usa (non so quale dei due FIPAV aggiorna per primo su un rinvio). Data o ora vuota → `null` e gara "da programmare".
- A2. L'impianto si divide su `" - "` in nome / indirizzo / città best effort; la stringa originale resta in `venue.raw`.
- A3. Loghi delle squadre e locandine in hotlink dagli URL FIPAV (lazy, dimensioni esplicite); solo il logo ufficiale della Fenice, fornito dall'utente, è copiato in `docs/logo-fenice.png` (sorgente `assets/logo-fenice.png`, base delle icone, offline).
- A4. Notizie: ricerca WordPress `search=seconda divisione` più i post di categoria "Indizioni Campionati" che nominano la Seconda Divisione o nessuna competizione (bandi generici di Divisione, che valgono anche per la Seconda: decisione dell'utente del 2026-11-21), esclusi quelli che nominano solo altre competizioni; max 10. Le categorie id 1-3 vengono riverificate in T035 prima di scrivere il filtro.
- A5. Rimonta = vittoria in una gara in cui la Fenice ha perso il primo set; "da 0-2" ne è il sottoinsieme.
- A6. Evento Google Calendar e VEVENT di durata 2 ore.
- A7. Baseline di `changes` = il calendario del 2026-11-21 (fixture `calendar-64444.json`), congelato in `data/calendario-iniziale.json`.
- A8. Il quoziente con denominatore 0 si mostra come lo dà l'API; nei calcoli JS vale `Infinity` (prima di chiunque abbia perso un set).
- A9. Python ≥ 3.12 con `zoneinfo` e tzdata di sistema (runner ubuntu), Node ≥ 20 (`node --test`; locale 24.12).
- A10. Pages pubblicato via workflow con artefatto di `docs/` (sorgente Pages "GitHub Actions"), come il gemello. [BLOCCANTE da confermare: con "Deploy from branch /docs" `status.json` non arriva al sito e la versione non viene stampata, quindi R3, R8 e R23 cadono.]

## Disambiguazione

- Opzione A: Pages da GitHub Actions (artefatto `docs/`) → `status.json` gitignored e `sw.js` stampato arrivano al sito; l'utente imposta la sorgente su "GitHub Actions" alla creazione del repo.
- Opzione B: Pages da branch `main` cartella `/docs` → niente job di deploy, ma `status.json` va committato a ogni run (un commit ogni 4 ore) e la versione dell'app va committata.
- Raccomandata: A, perché è il pattern già collaudato nel gemello e non sporca la storia con commit di solo timestamp.

Residuo dallo schedule D5 (da far decidere, non cambio): le gare infrasettimanali (01/12 martedì 21:00) con il solo cron a 4 ore mostrano il risultato fino a 4 ore dopo. Aggiungere `47 18-22 * * 1-5` (sere feriali) costa ~25 run a settimana su un repo pubblico. Default del piano: D5 così com'è (D5 approvato dall'utente: repo `campionato-fenice-fipav-26-27`, Pages su https://andreabonn.github.io/campionato-fenice-fipav-26-27/).

## Approccio

Pipeline uguale al gemello, fonte diversa: `fetch.py` (JSON da data., fallback app.) → `parse.py` (normalizzazione in tipi del dominio) → `merge.py` (`changes` contro la baseline, notizie e locandine con "guasto = tieni il precedente") → `cli.py` (scrittura solo se cambia) → `docs/data.json` → moduli ES della pagina. Tutte le statistiche derivate (forma, analisi, scheda avversaria, posizioni possibili, ricalcolo classifica) vivono in regole JS pure testate con `node --test`, non pre-calcolate: `data.json` resta una copia fedele e normalizzata della fonte.

Contratto Python ↔ JS: lo schema sotto, espresso in `src/fenice_calendar/schema.py` (TypedDict per mypy + `validate_data()` che ritorna la lista degli errori) e pinnato da due fixture: `tests/fixtures/data-sample.json` scritta a mano in T005 (copre ogni ramo: gara giocata 3-0 e 3-2, non giocata, arbitro da designare, diretta, data nulla, locandina) e `tests/fixtures/data-64353.json` generata in T008 dal parse reale. Python verifica che entrambe passino `validate_data()` e che il parse rigeneri la seconda identica; i test JS leggono solo queste due fixture, mai `docs/data.json` (CI gira prima della sync, come nel gemello).

### Schema di data.json (versione 1)

```text
schema_version: int                      # 1
updated_at: str                          # ISO 8601 UTC, escluso dal confronto di riscrittura
source: {name: str, url: str}            # "FIPAV Online", https://www.fipavonline.it
season: str                              # "2026/27"
league: {group_id: str, title: str}      # "64444", titolo con spazi normalizzati
team_cod: str                            # "190920448", la Fenice
formula: {published: bool, promotion: int, playoff: int, relegation: int}   # tutto 0/false finché D3
tie_break: {criteria: list[str], provisional: bool}   # ["wins","set_ratio","point_ratio"], true
teams: list[Team]
  Team: {id: str, cod: str, name: str, logo_url: str | null}
games: list[Game]                        # ordinate per round, poi starts_at (null in coda), poi number
  Game:
    id: str                              # id gara FIPAV, chiave stabile
    number: str                          # ng
    round: int                           # 1..18
    date: str | null                     # YYYY-MM-DD
    time: str | null                     # HH:MM
    starts_at: str | null                # ISO 8601 con offset Europe/Rome
    venue: {raw: str, name: str, address: str | null, city: str | null,
            lat: float | null, lng: float | null}
    home_id: str                         # Team.id
    away_id: str
    played: bool
    official: bool                       # ris_ufficiale == "1"
    sets_won: [int, int] | null          # null se non giocata
    sets: list[[int, int]]               # [casa, ospite] per set, [] se non giocata
    referees: list[str]                  # solo nomi reali
    referee_pending: bool
    live_url: str | null                 # se escorevolley == "1"
    poster: {url: str, width: int, height: int} | null       # fase 5
    changes: list[str]                   # sottoinsieme di ["date","time","venue"], fase 2
standings: list[Row]                     # fase 2, ordinate per pos
  Row: {team_id: str, pos: int, played: int, points: int, won: int, lost: int,
        sets_won: int, sets_lost: int, points_for: int, points_against: int,
        set_ratio: float | null, point_ratio: float | null}
notices: list[Notice]                    # fase 5
  Notice: {id: int, title: str, url: str, date: str, kind: str}
```

Le chiavi delle fasi successive esistono da subito con valore vuoto (`standings: []`, `notices: []`, `poster: null`, `changes: []`): lo schema non cambia fra le fasi, quindi un modulo JS di fase 1 non si rompe quando arriva la fase 2. `docs/status.json`: `{checked_at: str}`.

## Complessità introdotta

- Package Python `fenice_calendar` (fetch, parse, merge, schema, ics, notices, posters, appversion, badges, cli) → R1-R5, R11, R13, R15, R20-R24 | più semplice scartata: script unico, perché supera 300 righe già in fase 2 e non si testa per parti.
- `schema.py` con `validate_data()` scritto a mano → contratto R1 fra Python e JS | scartata: dipendenza `jsonschema`, perché aggiunge una dipendenza di runtime per ~60 righe e lato JS non si userebbe comunque (nessuna dipendenza npm).
- Iniezione di `opener` in `fetch.py` → testabilità senza rete (R2) | scartata: mock di `urlopen` via monkeypatch, più fragile e lega i test all'implementazione.
- `data/calendario-iniziale.json` → R15 | scartata: confronto con il `data.json` precedente, perché perde lo spostamento dopo il primo commit.
- `enrich.py` → R20-R21: un'interruzione di notizie o locandine mantiene quelle precedenti di `docs/data.json` e il run non fallisce | scartata: far fallire il run, perché una fonte accessoria spegnerebbe l'aggiornamento di calendario e classifica.
- `output.py` → R3 e atomicità: scrittura via file temporaneo e rename, riscrittura solo se il contenuto cambia (`updated_at` escluso) | scartata: scrivere a ogni run, perché produrrebbe un commit dati ogni 4 ore e un file mezzo scritto in caso di errore.
- `config.py` → unico posto delle costanti (`TEAM_COD`, `TEAM_DISPLAY_NAME`, `LOCAL_TZ`, `TIMEZONE_NAME`, `LAT_LIMIT`, `LNG_LIMIT`, `ICS_UID_DOMAIN`, `FORMULA`, URL e limiti) | scartata: costanti nei singoli moduli, già duplicate fra parse, ics e schema.
- Moduli ES in `docs/` (`app.js`, `game-rules.js`, `games-view.js`, `calendar-rules.js`, `view-rules.js`, `standings-rules.js`, `standings-math.js`, `tables-view.js`, `team-rules.js`, `opponent-rules.js`, `opponent-view.js`, `fenice-rules.js`, `analysis-view.js`, `notices-view.js`, `update-rules.js`, `update.js`, `sw.js`) → regole pure separate dalle viste, testate con `node --test` senza dipendenze (R16-R19, R22-R23) | scartata: script inline in `index.html`, che supera 300 righe e non si testa.
- Dipendenze: nessuna di runtime (stdlib: `urllib`, `json`, `zoneinfo`); dev: pytest, pytest-cov, ruff, mypy. `scripts/make_icons.py` porta Pillow nel proprio manifesto PEP 723. Niente BeautifulSoup né Pillow nel progetto (il gemello li usava per HTML e loghi).

## Operazioni

Runner: `package.json` per i verbi del progetto, entry point uv in `pyproject.toml` (stesso schema del gemello, più gli alias npm):
- `npm run setup` → `uv sync && uv run python -c "import fenice_calendar"` | task: T002
- `npm test` → `node --test tests/js/*.test.mjs`; `npm run test:py` → `uv run pytest --cov` | task: T002, T013
- `npm run lint` → `uv run ruff check . && uv run mypy` | task: T002
- `npm run sync` → `uv run fenice-sync` (5-6 richieste, 1 s fra l'una e l'altra) | task: T010
- `npm run serve` → `uv run python -m http.server -d docs 8000` (anteprima locale per render e click-through) | task: T014
- `uv run fenice-stamp-sw` → stampa la versione in `docs/sw.js`, solo nel workflow | task: T040
- Stato e rollback in produzione: stato = `status.json` del SIGNAL; rollback = `git revert` del commit dati o di codice, poi `workflow_dispatch` del workflow sync; spegnimento = disabilitare il workflow da GitHub (passo dell'utente, non automatizzabile senza `gh` autenticato sul repo, che non esiste ancora).
- A mano, dall'utente: creare il repo GitHub, impostare Pages su "GitHub Actions" (A10), `git remote add` e push. Nessuna operazione distruttiva su dati condivisi.

## Sub-task

Stima: 43 task da 15-30 min ≈ 16-21 h di lavoro, +20% imprevisti (API mai usate in CI dietro Cloudflare, primo deploy) = 19-25 h. Le fasi 1 e 2 sono il cammino critico: la stagione è già iniziata (prima gara Fenice oggi 21/11 ore 17).

### Fase 1 - Dati e calendario minimo pubblicabile (R1-R10, R25, R26)

Dopo questa fase il sito è pubblicabile e utile: prossima gara, calendario con risultati e parziali, aggiornamento schedulato.

T001. git init, `.gitignore` (`.venv/`, caches, `.coverage`, `docs/status.json`, `node_modules/`, `reports/`), `LICENSE` MIT come il gemello - file: `.gitignore`, `LICENSE` - rischio: basso
    verify: `git rev-parse --is-inside-work-tree` stampa `true` e `git check-ignore docs/status.json` stampa il path (oggi: "not a git repository") | livello: e2e | dip: - | par: seq | rollback: rimuovere `.git/` (passo utente)
T002. `pyproject.toml` (package `fenice_calendar`, scripts `fenice-sync`/`fenice-stamp-sw`/`fenice-badges`, ruff come il gemello, mypy strict su src+tests, coverage branch), `package.json` con i verbi di § Operazioni, `src/fenice_calendar/__init__.py`, `uv sync` → `uv.lock` - file: `pyproject.toml`, `package.json`, `uv.lock` - rischio: basso
    verify: `npm run setup && npm run lint` esce 0 (oggi: nessun package.json) | livello: integrazione | dip: T001 | par: seq | rollback: revert
T003. Copia delle fixture dalla scratchpad: `r2/cal64444.raw` → `tests/fixtures/calendar-64444.json`, `r2/tab64444.raw` → `standings-64444.json`, `r4/r2cal.raw` → `calendar-64353.json`, `r4/r2tab.raw` → `standings-64353.json`, `r1/posters.raw` → `posters-19092.json`, `fenice-logo.jpg` → `docs/logo-fenice.jpg` (poi sostituito dal logo ufficiale `assets/logo-fenice.png`, copia `docs/logo-fenice.png`); `tests/test_fixtures.py` con i conteggi misurati - file: `tests/fixtures/*`, `docs/logo-fenice.jpg`, `tests/test_fixtures.py` - rischio: medio (la scratchpad può sparire: farlo per primo)
    verify: `uv run pytest tests/test_fixtures.py` verde con 90 gare/18 Fenice sul 64444 e 30 gare/8 giocate sul 64353 | livello: unit | dip: T002 | par: ok | rollback: revert
T004. `config.py`: URL primario e fallback (calendar, tables, locandine), `GROUP_ID`, `TEAM_COD`, `COMMITTEE_CODE` "19092", `USER_AGENT` di progetto personale con URL del repo, timeout, pausa 1 s, `FORMULA` vuota (D3), `TIE_BREAK`, `SEASON` - file: `src/fenice_calendar/config.py`, `tests/test_config.py` - rischio: basso
    verify: `uv run pytest tests/test_config.py` (TEAM_COD presente 18 volte nella fixture 64444; FORMULA tutta a zero) | livello: unit | dip: T003 | par: ok | rollback: revert
T005. Contratto `data.json`: `schema.py` (TypedDict + `validate_data()`), `tests/fixtures/data-sample.json` a mano (5 gare che coprono ogni ramo dello schema), test che la fixture è valida e che 6 mutazioni (chiave mancante, `sets_won` stringa, `round` 0, `home_id` non in `teams`, `starts_at` senza offset, `changes` fuori vocabolario) producono ciascuna un errore - file: `src/fenice_calendar/schema.py`, `tests/test_schema.py`, `tests/fixtures/data-sample.json` - rischio: medio (è il contratto di tutta la pagina)
    verify: `uv run pytest tests/test_schema.py` con 7 casi, ognuno delle 6 mutazioni rosso se si toglie il relativo controllo | livello: unit (contratto) | dip: T004 | par: contratto | rollback: revert
T006. `fetch.py`: `fetch_json(path, opener=...)` prova data. poi app., User-Agent, timeout, rifiuta content-type non JSON e corpo non parsabile (`FetchError`), pausa fra richieste - file: `src/fenice_calendar/fetch.py`, `tests/test_fetch.py` - rischio: medio
    verify: `uv run pytest tests/test_fetch.py`: primario OK → 1 chiamata; primario 503 → fallback usato; entrambi HTML di challenge → `FetchError`; UA nell'header | livello: unit | dip: T004 | par: ok | rollback: revert
T007. `parse.py` gare: `parse_game()` secondo R4/R5 e A1/A2 - file: `src/fenice_calendar/parse.py`, `tests/test_parse.py` - rischio: medio
    verify: `uv run pytest tests/test_parse.py`: gara 1 Fenice = `2026-11-21`/`17:00`/`+01:00`/round 1; Sarlux-Aquila del 64353 = `sets_won [2,3]`, `sets [[25,16],[25,19],[12,25],[16,25],[5,15]]`; "DESIGNATO" → `referees []`, `referee_pending true`; `\'` decodificato | livello: unit | dip: T005 | par: seq | rollback: revert
T008. `parse.py` documento: squadre (nome strip, logo), Fenice per `cod` (errore se assente), ordinamento gare, chiavi vuote delle fasi successive; genera `tests/fixtures/data-64353.json` e il test che il parse la rigenera identica e la valida - file: `src/fenice_calendar/parse.py`, `tests/test_parse_document.py`, `tests/fixtures/data-64353.json` - rischio: medio
    verify: `uv run pytest tests/test_parse_document.py`: 64444 → 90/10/18 e `validate_data() == []`; calendario senza la Fenice → `TeamNotFound` | livello: unit | dip: T007 | par: seq | rollback: revert
T009. `output.py`: `write_if_changed()` (confronto senza `updated_at`, JSON indentato stabile) e `write_status()` - file: `src/fenice_calendar/output.py`, `tests/test_output.py` - rischio: basso
    verify: `uv run pytest tests/test_output.py`: seconda scrittura con solo `updated_at` diverso → file e mtime invariati, ritorna False | livello: unit | dip: T005 | par: ok | rollback: revert
T010. `cli.py` `main()`: fetch calendario, build, write, status; logging; exit 1 su `FetchError`/`TeamNotFound` senza scrivere nulla - file: `src/fenice_calendar/cli.py`, `tests/test_cli.py` - rischio: medio
    verify: `uv run pytest tests/test_cli.py` con fetch finto: successo → 3 file scritti; rete giù → exit 1 e i tre file identici byte per byte a prima; seconda run → `data.json` non riscritto | livello: integrazione | dip: T006, T008, T009 | par: seq | rollback: revert
T011. Prima sync reale: `npm run sync` (3 richieste a FIPAV), controllo del risultato - file: `docs/data.json` - rischio: medio (Cloudflare può rispondere diversamente da quanto misurato)
    verify: `uv run python -c` che conta in `docs/data.json` 90 gare, 18 Fenice, `validate_data()` vuoto | livello: e2e | dip: T010 | par: seq | rollback: revert
T012. Base della pagina: `docs/index.html` (lang it, stati, attribuzione R8, logo ufficiale piccolo), `styles.css` con token OKLCH dalla palette del logo (indaco #2C1B73, arancio-rosso #F25034, oro #FB9827) chiaro+scuro (riga `DIAL:` nel commit), `view-rules.js` dal gemello (countdown, data relativa it-IT, title case dei nomi) con test - file: `docs/index.html`, `docs/styles.css`, `docs/view-rules.js`, `tests/js/view-rules.test.mjs` - rischio: medio
    verify: `npm test` verde con casi countdown (giorni/ore, "in corso", passato) e title case "ASD FENICE" → "Asd Fenice" | livello: unit | dip: T005 | par: ok | rollback: revert
T013. `game-rules.js`: `feniceGames()`, `nextGame(games, now)`, `setsLabel()` ("3-0 (25-12, 25-19, 25-18)"), `mapUrl(venue)` (null senza coordinate), `isHome()` - file: `docs/game-rules.js`, `tests/js/game-rules.test.mjs` - rischio: basso
    verify: `npm test`: su `data-sample.json` prossima gara corretta prima e dopo l'ultima, mappa null senza lat | livello: unit | dip: T005 | par: ok | rollback: revert
T014. `games-view.js` (hero con countdown, lista per giornata, stato fine stagione) e wiring in `index.html` con loading/error/empty/populated; lettura `status.json` - file: `docs/games-view.js`, `docs/index.html`, `tests/js/games-view.test.mjs` - rischio: medio
    verify: `npm test`: HTML del hero contiene avversaria, ora e countdown; lista con 18 righe sulla fixture 64444 convertita; stato error con bottone "Riprova" | livello: unit | dip: T012, T013 | par: seq | rollback: revert
T015. Verifica UI di fase: `npm run serve`, render a 375 e 1280 px, click-through (mappa, riprova con `data.json` rinominato), skill `a11y-gate` - file: nessuno (correzioni nei file di T012-T014) - rischio: medio
    verify: a11y-gate 0 violazioni, screenshot alle due larghezze, elenco controlli azionati con esito | livello: e2e | dip: T011, T014 | par: seq | rollback: revert delle correzioni
T016. `.github/workflows/sync.yml` dal gemello: solo cron `17 */4 * * *` (D7), concurrency, pytest + `npm test` prima della sync, commit di `docs/data.json` e `docs/calendario.ics` solo se cambiati, upload-pages-artifact + deploy-pages con gli SHA del gemello; `tests/test_workflows.py` - file: `.github/workflows/sync.yml`, `tests/test_workflows.py` - rischio: medio
    verify: `uv run pytest tests/test_workflows.py`: ogni `uses:` pinnato a 40 hex, `persist-credentials: false` su ogni checkout, un solo cron `17 */4 * * *` e nessun altro schedule, `permissions: contents: read` a livello workflow | livello: unit | dip: T010 | par: ok | rollback: revert (in produzione: disabilitare il workflow)
T017. `CLAUDE.md` (inglese, struttura del gemello: data flow, schema, comandi), `README.md` (italiano: cosa è, fonte e attribuzione, URL Pages, come pubblicare con A10), `docs/REPORT_ATTIVITA.md` via `doc-writer` - file: `CLAUDE.md`, `README.md`, `docs/REPORT_ATTIVITA.md` - rischio: basso
    verify: `grep -c "Fonte: FIPAV Online" README.md` ≥ 1, `grep -c "cod_aff_societa" CLAUDE.md` ≥ 1, report con la voce di sessione | livello: e2e | dip: T016 | par: ok | rollback: revert
T018. Commit di fase con riga `CHECKS:` (code-reviewer, a11y-gate) - file: - - rischio: basso
    verify: `git log --oneline` mostra `feat: ...` e `git status --porcelain` vuoto | livello: e2e | dip: T015, T017 | par: seq | rollback: `git reset --soft HEAD~1` (locale, mai pushato)

### Fase 2 - Risultati, classifica, calendario esterno (R11-R15)

T019. `parse_standings()`: stringhe → int/float, `team_id`, ordinamento per `pos`; cli scarica anche la classifica (errore = run fallito) - file: `parse.py`, `cli.py`, `tests/test_parse_standings.py`, `tests/fixtures/data-64353.json` (rigenerata) - rischio: medio
    verify: `uv run pytest`: riga Aquila Oro 64353 = played 3, points 8, sets 9-2, set_ratio 4.5, point_ratio 1.5924 | livello: unit | dip: T018 | par: seq | rollback: revert
T020. `standings-rules.js`: `matchPoints(setsWon)` e `tableFromGames(games, teams)`; test oracolo contro `standings` di `data-64353.json` - file: `docs/standings-rules.js`, `tests/js/standings-rules.test.mjs` - rischio: basso
    verify: `npm test`: G, P, V, set e punti identici all'API per tutte le 6 squadre; 3-2 → 2/1 | livello: integrazione (Python fixture → JS) | dip: T019 | par: ok | rollback: revert
T021. `tables-view.js`: classifica (Fenice evidenziata, nomi cliccabili `data-opponent` già predisposti), nota "criterio provvisorio", nessuna zona con `formula.published` false - file: `docs/tables-view.js`, `docs/index.html`, `tests/js/tables-view.test.mjs` - rischio: basso
    verify: `npm test`: 6 righe, classe della Fenice sulla riga 6, nessuna classe di zona; con `published: true` e `promotion: 1` la prima riga ha la zona | livello: unit | dip: T019 | par: ok | rollback: revert
T022. Ultimo risultato, striscia forma e link "Diretta" in `games-view.js`, arbitri designati in lista - file: `docs/games-view.js`, `docs/game-rules.js`, test - rischio: basso
    verify: `npm test`: diretta presente solo sulla gara con `live_url`; arbitro "Rossi Anna" mostrato, pending → "da designare" | livello: unit | dip: T018 | par: seq | rollback: revert
T023. `ics.py` dal gemello adattato (UID `<id>@campionato-fenice-fipav-26-27`, TZID Europe/Rome, LOCATION, durata 2 h, DTSTAMP escluso dal confronto); cli scrive `docs/calendario.ics` - file: `src/fenice_calendar/ics.py`, `cli.py`, `tests/test_ics.py` - rischio: basso
    verify: `uv run pytest tests/test_ics.py`: 18 VEVENT dalla fixture 64444, righe ≤ 75 ottetti, seconda run con solo DTSTAMP diverso → file non riscritto | livello: unit | dip: T019 | par: seq | rollback: revert
T024. `calendar-rules.js`: URL Google Calendar (`action=TEMPLATE`, date UTC, location) e link webcal al feed; in pagina sulle gare future - file: `docs/calendar-rules.js`, `games-view.js`, test - rischio: basso
    verify: `npm test`: gara `2026-11-21T17:00:00+01:00` → `dates=20261121T160000Z/20261121T180000Z` | livello: unit | dip: T022 | par: seq | rollback: revert
T025. `data/calendario-iniziale.json` generato una volta dalla fixture 64444 (id → date, time, venue.raw), `merge.py` `changes`, badge "spostata" in lista - file: `data/calendario-iniziale.json`, `src/fenice_calendar/merge.py`, `tests/test_merge.py`, `games-view.js` - rischio: medio
    verify: `uv run pytest tests/test_merge.py`: ora cambiata → `["time"]`; gara assente dalla baseline → `[]`; `npm test` badge presente | livello: integrazione | dip: T019 | par: seq | rollback: revert
T026. Sync reale, render e click-through di fase 2 (classifica, Google Calendar, ics scaricato), a11y-gate, commit con `CHECKS:` - file: `docs/data.json`, `docs/calendario.ics` - rischio: medio
    verify: a11y-gate 0 violazioni; `grep -c BEGIN:VEVENT docs/calendario.ics` = 18; `git status --porcelain` vuoto | livello: e2e | dip: T020-T025 | par: seq | rollback: revert

### Fase 3 - Posizioni finali possibili (R16, R17)

T027. `standings-math.js` adattato: 4 esiti per gara, ordinamento punti → vittorie → parità aperta se dipende da set/punti futuri, chiusa con i quozienti solo a gare finite fra le squadre in parità; test contro forza bruta su campionati sintetici da 4 squadre - file: `docs/standings-math.js`, `tests/js/standings-math.test.mjs` - rischio: alto (logica combinatoria, il gemello aveva 2 esiti e head-to-head FIP)
    verify: `npm test`: su 50 stagioni sintetiche generate con seme fisso gli intervalli coincidono con la forza bruta; caso noto a mano: capolista a +7 con 2 gare rimaste → posizione 1 decisa | livello: unit | dip: T026 | par: seq | rollback: revert
T028. Misura e taratura di `MAX_ENUMERATED_GAMES` (4^n: stima 8-9 contro i 16 del gemello) e fallback sul solo limite di punti; test che il fallback contiene sempre l'intervallo esatto - file: `docs/standings-math.js`, `scripts/bench-standings.mjs`, test - rischio: medio
    verify: `node scripts/bench-standings.mjs` stampa il tempo al massimo enumerato < 300 ms (mediana di 5 run, valore nel commit); `npm test` verde sul contenimento | livello: unit | dip: T027 | par: seq | rollback: revert
T029. Colonna "Poss." e blocco "Già deciso" in `tables-view.js`, solo con intervallo più stretto di 1°-ultimo; render e commit - file: `docs/tables-view.js`, test - rischio: basso
    verify: `npm test`: a inizio stagione nessuna colonna; con la stagione sintetica decisa colonna presente; a11y-gate 0 violazioni | livello: unit + e2e | dip: T028 | par: seq | rollback: revert

### Fase 4 - Scheda avversaria e analisi Fenice (R18, R19)

T030. `team-rules.js`: rendimento casa/trasferta (V/S, set), gare rimaste, forma ultime 5 - file: `docs/team-rules.js`, test - rischio: basso
    verify: `npm test` su `data-64353.json`: Aquila Oro nessuna gara in casa, trasferta 3 vinte su 3, set 9-2 (ricontati a mano dalla fixture) | livello: unit | dip: T026 | par: ok | rollback: revert
T031. `opponent-rules.js`: scontri diretti con la Fenice (gare, set, parziali), gare rimaste dell'avversaria con posizione media delle sue avversarie - file: `docs/opponent-rules.js`, test - rischio: basso
    verify: `npm test`: Fenice-Aquila Oro 64353 → 0-3 (8-25, 17-25, 16-25) | livello: unit | dip: T030 | par: seq | rollback: revert
T032. `opponent-view.js` con `<dialog>` nativo, apertura dalla prossima gara e da `data-opponent`, chiusura con Esc e bottone; click-through - file: `docs/opponent-view.js`, `docs/index.html`, test - rischio: medio
    verify: `npm test` (HTML della scheda con le tre sezioni); click-through: apre, Esc chiude, focus torna al nome cliccato | livello: unit + e2e | dip: T031, T021 | par: seq | rollback: revert
T033. `fenice-rules.js`: set vinti/persi, punti medi per set fatti/subiti, tie-break V/S, rimonte (A5) e da 0-2 - file: `docs/fenice-rules.js`, test - rischio: basso
    verify: `npm test`: su 64353 Fenice set 0-9, punti medi 15,2 fatti; su `data-sample.json` una rimonta da 0-2 contata | livello: unit | dip: T026 | par: ok | rollback: revert
T034. `analysis-view.js` + wiring, stato empty "Nessuna gara ancora giocata", render, a11y-gate, commit di fase - file: `docs/analysis-view.js`, `docs/index.html`, test - rischio: medio (index.html vicino a 300 righe, vedi Rischi)
    verify: `npm test` (empty e populated); a11y-gate 0 violazioni; `wc -l docs/index.html` < 300 | livello: unit + e2e | dip: T032, T033 | par: seq | rollback: revert

### Fase 5 - Notizie e locandine (R20, R21)

T035. Cattura fixture WordPress: `curl` di `/wp-json/wp/v2/categories` e della ricerca "seconda divisione" su fipavcagliari.it in `tests/fixtures/`, conferma o correzione degli id categoria di A4 - file: `tests/fixtures/wp-categories.json`, `tests/fixtures/wp-search.json` - rischio: medio
    verify: i due file sono JSON validi con campi `id`, `title.rendered`, `link`, `date`; id categorie riportati nel commit | livello: e2e | dip: T034 | par: ok | rollback: revert
T036. `notices.py` dal gemello: fonte e filtro di A4, outage → notizie precedenti e run riuscito, `kind` per provenienza - file: `src/fenice_calendar/notices.py`, `merge.py`, `cli.py`, test - rischio: basso
    verify: `uv run pytest tests/test_notices.py`: fixture → N notizie con titolo HTML decodificato; WordPress 500 → notizie precedenti, exit 0 | livello: integrazione | dip: T035 | par: seq | rollback: revert
T037. `posters.py`: lista locandine, regex della chiave, abbinamento per id gara, outage → locandine precedenti - file: `src/fenice_calendar/posters.py`, `cli.py`, test - rischio: basso
    verify: `uv run pytest tests/test_posters.py`: la chiave reale `13012625` accettata, chiave con `..` rifiutata, gara senza locandina → `null` | livello: unit | dip: T035 | par: ok | rollback: revert
T038. Pagina: sezione notizie (empty se vuota) e locandina nella gara (`loading="lazy"`, width/height); render, a11y-gate, commit di fase - file: `docs/notices-view.js`, `games-view.js`, `index.html`, test - rischio: basso
    verify: `npm test`; a11y-gate 0 violazioni; immagine con `alt` descrittivo | livello: unit + e2e | dip: T036, T037 | par: seq | rollback: revert

### Fase 6 - App installabile e badge (R22-R24)

T039. `scripts/make_icons.py` (PEP 723, Pillow) che genera dal logo ufficiale (`assets/logo-fenice.png`): 192, 512, maskable, apple-touch opaca, favicon; `manifest.webmanifest` con `start_url` e `scope` relativi - file: `scripts/make_icons.py`, `docs/icons/*`, `docs/favicon.ico`, `docs/manifest.webmanifest` - rischio: basso
    verify: `uv run --script scripts/make_icons.py` poi controllo dimensioni e canale alfa assente sulla apple-touch; mypy strict dello script come nel gemello | livello: e2e | dip: T038 | par: ok | rollback: revert
T040. `sw.js` network-first con SHELL di tutti i moduli, `appversion.py` + `fenice-stamp-sw`, step nel workflow prima dell'upload; `sw.test.mjs` e `test_appversion.py` dal gemello - file: `docs/sw.js`, `src/fenice_calendar/appversion.py`, `sync.yml`, test - rischio: medio
    verify: `npm test` (ogni import della pagina è in SHELL); `uv run pytest tests/test_appversion.py` (doppio stamp fallisce, dati esclusi dall'hash) | livello: integrazione | dip: T039 | par: seq | rollback: revert
T041. `update.js` + `update-rules.js` dal gemello, avviso "Aggiorna"/"Più tardi" - file: `docs/update.js`, `docs/update-rules.js`, test - rischio: basso
    verify: `npm test` sulle regole; click-through con due versioni stampate localmente: avviso compare, "Aggiorna" ricarica | livello: unit + e2e | dip: T040 | par: seq | rollback: revert
T042. `tests.yml` + `badges.py` dal gemello, badge nel README - file: `.github/workflows/tests.yml`, `src/fenice_calendar/badges.py`, `README.md`, test - rischio: basso
    verify: `uv run pytest tests/test_badges.py tests/test_workflows.py` (nuovo workflow pinnato a SHA) | livello: unit | dip: T040 | par: ok | rollback: revert
T043. Chiusura: CLAUDE.md aggiornato (PWA, posizioni possibili, MAX misurato), report attività, verifica finale completa, commit con `CHECKS:` - file: `CLAUDE.md`, `docs/REPORT_ATTIVITA.md` - rischio: basso
    verify: `npm run lint && npm run test:py && npm test` verdi, copertura ≥ 80%, `git status --porcelain` vuoto | livello: e2e | dip: T041, T042 | par: seq | rollback: revert

## Fuori scope

- PDF dei comunicati settimanali del Comitato (download dietro cookie di WP Download Manager).
- Statistiche individuali delle atlete: la fonte non le pubblica.
- Prima Divisione Maschile e Under 14 della Fenice (Q1), anche se il codice le renderebbe facili.
- Zone di promozione/retrocessione e playoff prima della formula ufficiale (D3).
- Creazione del repo GitHub, impostazione di Pages, push (D5).
- Pulizia dei moduli del gemello: si copia, non si modifica il progetto Serie C.

## File impattati

| File | Tipo | Scopo |
|---|---|---|
| `.gitignore`, `LICENSE` | nuovo | repo, status.json fuori da git |
| `pyproject.toml`, `uv.lock`, `package.json` | nuovo | progetto uv, runner dei verbi |
| `src/fenice_calendar/{config,schema,fetch,parse,output,cli}.py` | nuovo | sync di fase 1 |
| `src/fenice_calendar/{merge,ics,notices,posters,enrich,appversion,badges}.py` | nuovo (ics/notices/appversion/badges da gemello) | fasi 2, 5, 6 |
| `data/calendario-iniziale.json` | nuovo | baseline di `changes` |
| `tests/fixtures/*.json`, `assets/logo-fenice.png`, `docs/logo-fenice.png` | nuovo | copie reali del 2026-11-21, contratto Python ↔ JS |
| `tests/test_*.py`, `tests/js/*.test.mjs` | nuovo | test per modulo |
| `docs/index.html`, `docs/styles.css` | nuovo | pagina, palette Fenice |
| `docs/{view,game,standings,calendar,team,opponent,fenice,update}-rules.js` | nuovo (view/update da gemello) | regole pure |
| `docs/{games,tables,opponent,analysis,notices}-view.js`, `docs/standings-math.js`, `docs/app.js`, `docs/update.js`, `docs/sw.js` | nuovo (adattati) | render, wiring e PWA |
| `docs/manifest.webmanifest`, `docs/icons/*`, `docs/favicon.ico`, `scripts/make_icons.py` | nuovo | installabilità |
| `scripts/bench-standings.mjs` | nuovo | misura di MAX_ENUMERATED_GAMES |
| `.github/workflows/sync.yml`, `tests.yml` | nuovo | schedule, deploy, badge |
| `CLAUDE.md`, `README.md`, `docs/REPORT_ATTIVITA.md` | nuovo | documentazione |

## Rischi e mitigazioni

- Poiché FIPAV sta dietro Cloudflare e le misure sono state fatte da questa macchina, i runner GitHub (IP di datacenter) potrebbero ricevere una challenge HTML invece del JSON, e la sync fallirebbe a ogni run dal primo push: la fase 1 resterebbe pubblicata solo coi dati del commit locale (0,5-2 giorni per trovare un'alternativa). → `fetch.py` rifiuta l'HTML in modo esplicito e logga host e status; il run fallito non fa deploy; primo controllo sul SIGNAL subito dopo il push; ripiego documentato nel README: sync locale schedulata e push dell'utente.
- Poiché FIPAV non pubblica termini di riuso, il Comitato o FIPAV potrebbero chiedere la rimozione: la pagina andrebbe spenta (nessun ritardo di sviluppo, perdita del lavoro). → 5-6 richieste ogni 4 ore, User-Agent con URL del repo, attribuzione visibile, niente copia di loghi e locandine (hotlink).
- Poiché le posizioni possibili passano da 2 a 4 esiti per gara, l'enumerazione cresce come 4^n e un `MAX_ENUMERATED_GAMES` copiato dal gemello (16) bloccherebbe la pagina per minuti: T027-T028 +1-2 ore. → taratura misurata in T028, test di contenimento del fallback.
- Poiché `index.html` del gemello è a 325 righe e qui si aggiungono analisi, notizie e dialog, la pagina supererebbe il limite di 300: refactor a metà fase 4 (+1 ora). → `index.html` fa solo wiring dalla fase 1; controllo `wc -l` nel verify di T034; un `app.js` di wiring se serve.
- Poiché la stagione è già iniziata e la Fenice gioca oggi, ogni giorno di ritardo della fase 1 è un turno senza pagina. → fasi 1 e 2 prima di tutto il resto; le fasi 3-6 non bloccano la pubblicazione.
- Poiché le fixture vivono solo nella scratchpad, una pulizia di `/tmp` prima di T003 costringerebbe a riscaricarle senza più lo stato a zero di oggi (le gare giocate cambiano i file): T003 è il primo task di codice, subito dopo il setup.
- Poiché il campo impianto è testo libero, la divisione su " - " può sbagliare città o indirizzo: mappa e ICS restano corretti perché usano coordinate e `venue.raw` (A2).

## Criteri di verifica

- Fase per fase: i `verify` dei task, poi `npm run lint`, `npm run test:py` (coverage ≥ 80%), `npm test` verdi; sulle fasi con UI render a 375 e 1280 px, click-through registrato, a11y-gate 0 violazioni; commit locale con riga `CHECKS:`.
- Fine piano: le voci della DoD spuntate con l'evidenza (comando e output), `git log` con un commit per fase e albero pulito. Dopo il push dell'utente: la riga SIGNAL verificata sul sito pubblicato.

Handoff: `tdd-guide` per T002-T010 e T019-T025 (Python, test-first, delegabile a Codex con `[DELEGATE-CODEX]` 2-4 task per invocazione), `fullstack-developer` per le parti UI (T012-T015, T021-T022, T029, T032, T034, T038), `devops-engineer` per T016, T040, T042.
