# Spec 001 - ASD Fenice, Seconda Divisione Femminile Girone A (FIPAV Cagliari 2026/27)

Pagina statica su GitHub Pages (`docs/`), aggiornata da una GitHub Action schedulata, con calendario,
risultati, classifica e analisi della squadra ASD FENICE (cod_aff_societa `190920448`) nel girone FIPAV
`64444`. Fonte unica dei dati di gara: API JSON pubbliche di FIPAV Online. Piano: `plan.md`, task: `tasks.md`.

## Vincoli decisi dall'utente

- Q1: solo il girone 64444 (Seconda Divisione Femminile, Girone A). Nessun altro campionato della Fenice.
- D1: repo nuovo, copia selettiva dei moduli del progetto `campionato-serie-c-26-27`, nessun fork git.
- D2: perimetro pagina come da R1-R26; fuori v1 PDF dei comunicati e statistiche individuali.
- D3: nessuna zona promozione/retrocessione finché la formula non è pubblicata; parità vittorie → quoziente set → quoziente punti, marcata "criterio provvisorio".
- D4: logo ufficiale di ASD Fenice Volley fornito dall'utente (`assets/logo-fenice.png`, copia in `docs/logo-fenice.png`); palette ricavata dal logo (indaco #2C1B73, arancio-rosso #F25034, oro #FB9827, dichiarata in OKLCH in `docs/styles.css`); icone app generate dal logo con `scripts/make_icons.py`.
- D5: repo `campionato-fenice-fipav-26-27`, Pages su `https://andreabonn.github.io/campionato-fenice-fipav-26-27/`, schedule ogni 4 ore (D7, 2026-11-21: niente cron orario nel weekend), attribuzione "Fonte: FIPAV Online". Approvato dall'utente. Repo remoto e push li fa l'utente.

## Requisiti

Ogni requisito è verificabile da un test, un comando o un'osservazione del render. Esempio Given/When/Then dove serve.

### Dati (sync)

- R1. `uv run fenice-sync` scrive `docs/data.json` conforme allo schema di `plan.md` § Schema di data.json: dalla fixture del girone 64444 produce 90 gare, 10 squadre, 18 gare della Fenice, 18 giornate. La Fenice è identificata solo da `cod_aff_societa` `190920448`, mai dall'id squadra o dal nome; se il codice manca nel calendario il run esce con codice diverso da 0 e non scrive nulla.
- R2. Le richieste vanno prima a `data.fipavonline.it`, poi a `app.fipavonline.it` sulla stessa risorsa; ogni richiesta porta lo User-Agent di progetto personale. Errore HTTP, timeout o corpo non JSON (pagina di challenge Cloudflare) su entrambi gli host del calendario o della classifica: il run esce con codice diverso da 0, `docs/data.json`, `docs/calendario.ics` e `docs/status.json` restano byte per byte com'erano.
- R3. `docs/data.json` viene riscritto solo se il contenuto cambia (`updated_at` escluso dal confronto): due run consecutivi sulla stessa risposta lasciano il file identico. `docs/status.json` (`checked_at`) è riscritto a ogni run riuscito, è in `.gitignore` e arriva al sito solo con l'artefatto Pages.
- R4. Normalizzazione di ogni gara: giornata intera da "Giornata N", data ISO `YYYY-MM-DD` da `dd/mm/yyyy`, ora `HH:MM` da `HH.MM`, `starts_at` ISO 8601 con offset Europe/Rome, nomi squadra senza spazi ai bordi, `\'` del campo impianto decodificato, parziali come coppie `[casa, ospite]`. Esempio: Given la gara 1 della Fenice nella fixture 64444, When la sync la normalizza, Then `date` = `2026-11-21`, `time` = `17:00`, `starts_at` = `2026-11-21T17:00:00+01:00`, `round` = 1.
- R5. Arbitri: il segnaposto "DESIGNATO" e il campo vuoto non compaiono come nomi; `referee_pending` è vero finché non c'è un nome, solo per le gare da giocare (decisione dell'utente del 2026-11-21): una gara giocata senza nome non è in attesa.

### Pagina, fase 1

- R6. La pagina mostra la prossima gara della Fenice (avversaria, data, ora, impianto, casa/trasferta) con countdown; dopo l'ultima gara mostra lo stato di fine stagione invece di un box vuoto. Stati loading, error (causa e "riprova"), empty, populated resi.
- R7. Lista gare della Fenice raggruppata per mese, con la giornata sopra l'avversaria; per una gara giocata il chip Vinta/Persa, il punteggio dal lato della Fenice e la riga dei parziali (es. "3-0" e "Set: 25-12, 25-19, 25-18"), nessuna riga Set per una gara a tavolino; link mappa costruito dalle coordinate dell'impianto solo per le gare da giocare (assente se mancano lat/lng). Testi aggiornati con le proposte UX approvate (decisione dell'utente del 2026-11-21).
- R8. Attribuzione "Fonte: FIPAV Online" con link, visibile in pagina; data dell'ultimo controllo da `status.json`.
- R9. Workflow schedulato: un solo cron ogni 4 ore (D7); pytest e `npm test` prima della sync; commit dei dati solo se cambiati; deploy Pages dell'artefatto `docs/`; azioni pinnate a SHA, `persist-credentials: false`, `permissions` al minimo; run fallito = nessun deploy.
- R10. Documentazione di progetto: `CLAUDE.md` (inglese, flusso dati e convenzioni), `README.md` (italiano, comprensibile in 60 secondi, fonte e attribuzione), `docs/REPORT_ATTIVITA.md`.

### Risultati e classifica, fase 2

- R11. Classifica dall'API (pos, G, P, V, S, set vinti/persi, QS, QP), Fenice evidenziata, valori numerici (non stringhe) in `data.json`. Nessuna zona promozione/retrocessione mentre la formula in config è vuota; nota "criterio di parità provvisorio" visibile.
- R12. Coerenza: la classifica ricalcolata dalle gare giocate (3-0 e 3-1 → 3/0, 3-2 → 2/1) coincide con quella dell'API sulla fixture 64353 (6 squadre, 8 gare giocate di cui 2 non omologate) per G, P, V, set e punti.
- R13. Feed `docs/calendario.ics` con le 18 gare della Fenice, UID stabile per id gara, riscritto solo se cambia ignorando `DTSTAMP`.
- R14. Per ogni gara con inizio futuro il pulsante "Calendario" che apre Google Calendar (nessuno dopo il fischio d'inizio); link "Diretta" a `https://escore.fipavonline.it?gara=<id>` solo quando `escorevolley` = "1".
- R15. Ogni gara porta `changes` (campi `date`, `time`, `venue` diversi dal calendario iniziale del 2026-11-21) e la pagina marca la gara spostata.

### Posizioni possibili, fase 3

- R16. Per ogni squadra l'intervallo di posizioni finali ancora possibili, con 4 esiti per gara (3/0, 2/1, 1/2, 0/3 punti); una parità che dipende da set o punti futuri resta aperta. Su campionati simulati piccoli il risultato coincide con la forza bruta; al massimo enumerato il calcolo resta sotto 0,3 s in node.
- R17. La colonna "Poss." compare solo quando almeno un intervallo è più stretto di 1°-ultimo.

### Squadre e Fenice, fase 4

- R18. Scheda avversaria (dialog nativo) aperta dalla prossima gara e da ogni nome in classifica: scontri diretti con la Fenice, rendimento casa/trasferta, gare rimaste.
- R19. Sezione analisi Fenice: serie in corso, set vinti/persi, punti medi per set fatti e subiti, tie-break vinti/persi, rimonte (vittorie dopo aver perso il primo set, di cui da 0-2). La forma delle ultime 5 gare sta nella striscia in testa alla sezione Andamento (analisi), non nel box dell'ultimo risultato (decisione dell'utente del 2026-11-21, con le proposte UX). Serie, forma e ultimo risultato seguono la data in cui la gara è stata giocata, non la giornata: una gara rinviata conta quando si gioca (decisione dell'utente del 2026-11-21). Prima della prima gara giocata: stato empty con spiegazione.

### Notizie e locandine, fase 5

- R20. Notizie del sito del Comitato (fipavcagliari.it, WordPress REST) filtrate sulla Seconda Divisione; un'interruzione del sito mantiene le notizie precedenti e non fa fallire il run.
- R21. Locandine dalla lista pubblica FIPAV: solo chiavi conformi a `^public/locandine/images/[A-Za-z0-9]{5}/\d+/[a-f0-9]{64}\.(jpg|gif)$`, abbinate per id gara, immagine con dimensioni esplicite e lazy loading; un'interruzione mantiene le precedenti.

### App, fase 6

- R22. Installabile: manifest con `start_url` relativo al sotto-percorso Pages, icone generate dal logo ufficiale da script, apple-touch opaca.
- R23. Service worker network-first, versione app = hash di `docs/` esclusi i dati, stampata solo nell'artefatto (`VERSION = "dev"` nel repo); avviso di aggiornamento "Aggiorna"/"Più tardi".
- R24. `tests.yml` su push pubblica badge test e coverage nel README.

### Trasversali

- R25. `uv run ruff check .`, `uv run mypy` (strict), `uv run pytest --cov` con copertura ≥ 80% sulla logica, `npm test` verdi; nessun file oltre 300 righe, nessuna funzione oltre 30.
- R26. Ogni fase con UI: `a11y-gate` senza violazioni, render osservato a 375 e 1280 px, click-through dei controlli registrato.

## Fuori scope v1

PDF dei comunicati settimanali (WP Download Manager con cookie), statistiche individuali (non esistono), altri campionati della Fenice, zone di classifica prima della formula ufficiale, creazione del repo remoto e push.
