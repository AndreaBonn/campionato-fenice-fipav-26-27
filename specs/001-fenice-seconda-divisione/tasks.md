# Task 001 - Fenice Seconda Divisione Femminile

Dettaglio, file e `verify` di ogni task in `plan.md` § Sub-task. Formato: id | titolo | dip: | requisiti | par | rollback. D7 (2026-11-21): solo cron ogni 4 ore.

## Fase 1 - Dati e calendario minimo pubblicabile

- [x] T001 | git init, .gitignore, LICENSE | dip: - | R3, R10 | seq | rimuovere .git (utente)
- [x] T002 | pyproject, package.json con i verbi, uv.lock | dip: T001 | R25 | seq | revert
- [x] T003 | Copia fixture reali e stemma dalla scratchpad, test dei conteggi | dip: T002 | R1, R12 | ok | revert
- [x] T004 | config.py (URL, codice Fenice, UA, formula vuota, tie-break) | dip: T003 | R1, R2, R11 | ok | revert
- [x] T005 | Contratto data.json: schema.py, validate_data, data-sample.json | dip: T004 | R1 | contratto | revert
- [x] T006 | fetch.py con fallback data./app. e rifiuto HTML | dip: T004 | R2 | ok | revert
- [x] T007 | parse_game: normalizzazione data/ora/parziali/arbitri | dip: T005 | R4, R5 | seq | revert
- [x] T008 | parse documento, Fenice per cod, fixture data-64353.json | dip: T007 | R1 | seq | revert
- [x] T009 | output.py: write_if_changed, write_status | dip: T005 | R3 | ok | revert
- [x] T010 | cli.py main con exit 1 senza scritture su errore | dip: T006,T008,T009 | R2, R3 | seq | revert
- [x] T011 | Prima sync reale e controllo di docs/data.json | dip: T010 | R1 | seq | revert
- [x] T012 | index.html base, styles.css palette, view-rules.js | dip: T005 | R6, R8 | ok | revert
- [x] T013 | game-rules.js: prossima gara, parziali, mappa | dip: T005 | R6, R7 | ok | revert
- [x] T014 | games-view.js e wiring con i quattro stati | dip: T012,T013 | R6, R7, R8 | seq | revert
- [x] T015 | Render 375/1280, click-through, a11y-gate di fase 1 | dip: T011,T014 | R26 | seq | revert correzioni
- [x] T016 | sync.yml (cron, deploy Pages, SHA pinnati) e test_workflows | dip: T010 | R9 | ok | revert / disabilitare workflow
- [x] T017 | CLAUDE.md, README.md, docs/REPORT_ATTIVITA.md | dip: T016 | R10 | ok | revert
- [x] T018 | Commit di fase 1 con CHECKS | dip: T015,T017 | R25 | seq | reset --soft locale

## Fase 2 - Risultati, classifica, calendario esterno

- [x] T019 | parse_standings numerico, cli scarica la classifica | dip: T018 | R11 | seq | revert
- [x] T020 | standings-rules.js e test oracolo contro l'API (64353) | dip: T019 | R12 | ok | revert
- [x] T021 | tables-view.js: classifica, Fenice evidenziata, criterio provvisorio | dip: T019 | R11 | ok | revert
- [x] T022 | Ultimo risultato, forma, link diretta, arbitri | dip: T018 | R5, R14 | seq | revert
- [x] T023 | ics.py adattato, docs/calendario.ics | dip: T019 | R13 | seq | revert
- [x] T024 | calendar-rules.js: Google Calendar e link webcal | dip: T022 | R14 | seq | revert
- [x] T025 | Baseline calendario-iniziale.json, merge.py changes, badge spostata | dip: T019 | R15 | seq | revert
- [x] T026 | Sync reale, render, click-through, a11y-gate, commit di fase 2 | dip: T020,T021,T022,T023,T024,T025 | R26 | seq | revert

## Fase 3 - Posizioni finali possibili

- [x] T027 | standings-math.js a 4 esiti, test contro forza bruta | dip: T026 | R16 | seq | revert
- [x] T028 | Misura e taratura MAX_ENUMERATED_GAMES, fallback contenuto | dip: T027 | R16 | seq | revert
- [x] T029 | Colonna Poss. e Già deciso, render e commit di fase 3 | dip: T028 | R17, R26 | seq | revert

## Fase 4 - Scheda avversaria e analisi Fenice

- [x] T030 | team-rules.js: casa/trasferta, gare rimaste, forma | dip: T026 | R18 | ok | revert
- [x] T031 | opponent-rules.js: scontri diretti, calendario avversaria | dip: T030 | R18 | seq | revert
- [x] T032 | opponent-view.js con dialog nativo e click-through | dip: T031,T021 | R18, R26 | seq | revert
- [x] T033 | fenice-rules.js: set, punti medi, tie-break, rimonte | dip: T026 | R19 | ok | revert
- [x] T034 | analysis-view.js, stato empty, a11y-gate, commit di fase 4 | dip: T032,T033 | R19, R26 | seq | revert

## Fase 5 - Notizie e locandine

- [x] T035 | Cattura fixture WordPress, verifica id categorie | dip: T034 | R20 | ok | revert
- [x] T036 | notices.py con filtro Seconda Divisione, outage non fatale | dip: T035 | R20 | seq | revert
- [x] T037 | posters.py con regex della chiave, outage non fatale | dip: T035 | R21 | ok | revert
- [x] T038 | Notizie e locandine in pagina, a11y-gate, commit di fase 5 | dip: T036,T037 | R20, R21, R26 | seq | revert

## Fase 6 - App installabile e badge

- [x] T039 | make_icons.py monogramma F, manifest | dip: T038 | R22 | ok | revert
- [x] T040 | sw.js network-first, appversion e stamp nel workflow | dip: T039 | R23 | seq | revert
- [x] T041 | update.js e update-rules.js, avviso aggiornamento | dip: T040 | R23 | seq | revert
- [x] T042 | tests.yml, badges.py, badge nel README | dip: T040 | R24 | ok | revert
- [x] T043 | CLAUDE.md finale, report, verifica completa, commit | dip: T041,T042 | R10, R25 | seq | revert

## Fase 9 - Finding di /analyze (risposta Q1 O2 del 2026-11-21)

- [ ] T044 | A1: `setupUpdates` in update.js diviso in funzioni di modulo sotto 30 righe, comportamento invariato | dip: T043 | R25 | ok | revert
- [ ] T045 | A2: `load()` dell'index.html spostato in `docs/app.js` testabile, sotto 30 righe, con test e voce nel SHELL | dip: T043 | R25 | ok | revert
- [ ] T046 | A19: apple-touch-icon, icon-512 e favicon.ico nel SHELL di sw.js | dip: T045 | R22 | seq | revert
- [ ] T047 | A5: locandina come `<img loading="lazy" width height alt>` dentro il link | dip: T043 | R21 | ok | revert
- [ ] T048 | A12, A11: punteggio nel formato R7 "3-0 (25-12, ...)" con `setsLabel`; rimossi i simboli morti `changeLabel` e `ICS_PATH` | dip: T043 | R7 | ok | revert
- [ ] T049 | A16: "Aggiungi a Google Calendar" solo per gare con inizio futuro | dip: T048 | R14 | seq | revert
- [ ] T050 | A6, A13, A11: posizioni nella scheda avversaria da `data.standings`; forma nella scheda (usa `form`) | dip: T043 | R15 | ok | revert
- [ ] T051 | A14: una costante per URL del sito, fuso, limiti lat/lng, UID ICS e nome breve; JSON dei badge in tests.yml da badges.py | dip: T043 | R25 | ok | revert
- [ ] T052 | A18: `Notice.kind` come Literal, controllato da `validate_data` | dip: T043 | R1 | ok | revert
- [ ] T053 | A7, A8, A9: test di tempo 300 ms sulle posizioni, test su manifest e apple-touch, test sull'ordine dei passi e sul commit condizionato in sync.yml | dip: T043 | R16, R22, R9 | ok | revert
- [ ] T054 | A3, A4, A10, A15, A17: plan e spec allineati (Complessità con enrich/output/config e moduli JS, DoD spuntata, R19, decisioni D4/D5) | dip: T044,T045,T046,T047,T048,T049,T050,T051,T052,T053 | R10 | seq | revert
- [ ] T055 | Verifica finale: code-reviewer, a11y-gate, render 375/1280, click-through, report attività | dip: T054 | R10, R25 | seq | revert
