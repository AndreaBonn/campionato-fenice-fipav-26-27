# Report attività - campionato-fenice-fipav-26-27

Creato il 2026-11-21. Pagina statica con calendario e risultati della ASD Fenice, Seconda Divisione Femminile Girone A (FIPAV Cagliari 2026/27).

## 2026-11-21 - Fattibilità, piano 001 e fase 1

### Cosa è stato fatto

- Analisi di fattibilità: la fonte è l'insieme di API JSON pubbliche di FIPAV Online (`data.fipavonline.it`, con `app.fipavonline.it` come alternativa). Il girone della Fenice è il 64444.
- Scelta della squadra: la Fenice si identifica con `cod_aff_societa` 190920448, perché l'id squadra cambia da un girone all'altro. Verificato sulle risposte reali salvate in `tests/fixtures/`.
- Piano RPI 001 (`specs/001-fenice-seconda-divisione/`): 26 requisiti in 6 fasi, ciascuna pubblicabile da sola.
- Fase 1 implementata (T001-T017): scheletro uv e npm, fixture reali, contratto di `data.json` con validazione, configurazione, recupero JSON con host alternativo e rifiuto della pagina HTML di Cloudflare, normalizzazione delle gare, scrittura di `data.json` solo se il contenuto cambia, comando `fenice-sync` che esce con 1 senza scrivere in caso di errore, pagina (prossima gara con conto alla rovescia, elenco giornate, stati di caricamento, errore e vuoto), workflow di sincronizzazione e pubblicazione, documentazione di progetto. Render e click-through a 375 e 1280 px eseguiti in T015.
- Il progetto nasce da una copia selettiva del gemello basket `campionato-serie-c-26-27`, senza fork e senza i moduli specifici del basket.

### Decisioni

- D1: repo nuovo, copia selettiva dal gemello basket.
- D2: perimetro pagina come da requisiti R1-R26; fuori dalla prima versione i PDF dei comunicati e le statistiche individuali.
- D3: nessuna zona di promozione o retrocessione finché la formula non è pubblicata; criterio di parità provvisorio (vittorie, quoziente set, quoziente punti), dichiarato in pagina.
- D4: palette dal logo FIPAV (prugna e arancio-rosso), stemma originale piccolo.
- D5: repo `campionato-fenice-fipav-26-27`, pubblicazione su GitHub Pages, attribuzione "Fonte: FIPAV Online". Creazione del repo remoto e push li fa l'utente.
- D7: aggiornamento solo ogni 4 ore, senza passaggi orari nel fine settimana. Conseguenza: le gare infrasettimanali (per esempio martedì 1 dicembre alle 21:00) mostrano il risultato anche 4 ore dopo.
- D6: GitHub Pages pubblicato dal workflow con sorgente "GitHub Actions", così status.json e la versione dell'app arrivano al sito.
- D8: notizie dal sito del Comitato filtrate su "seconda divisione" più la categoria "Indizioni Campionati", al massimo 10.

### Verifiche

- Test Python e JS verdi, `ruff` e `mypy` strict puliti alla chiusura di ogni task.
- I test leggono solo le fixture, mai `docs/data.json` né la rete.
- Il workflow non è stato eseguito su GitHub: il repo non è ancora online.

### Note per il Cliente

La pagina con calendario e risultati della Fenice è pronta in locale. Si aggiorna da sola ogni 4 ore partendo dai dati pubblicati da FIPAV Online. Per metterla online resta da creare il repository su GitHub, attivare la pubblicazione nelle impostazioni e caricare il codice: i passi sono nel README. Classifica, calendario da aggiungere al telefono e le altre funzioni arrivano nelle fasi successive del piano.

### Fasi 2-6 (T019-T042)

- Fase 2: classifica ufficiale FIPAV letta e mostrata con la Fenice in evidenza e il criterio di parità provvisorio, risultati con parziali, ultimo risultato e andamento recente, baseline `data/calendario-iniziale.json` per segnalare le partite spostate (data, ora, palestra), calendario scaricabile `calendario.ics` e collegamenti a Google Calendar, diretta e arbitri.
- Fasi 3 e 4: posizioni finali ancora possibili (`standings-math.js`), con 4 esiti per ogni gara rimasta (3-0, 2-1, 1-2, 0-3) e blocco "Già deciso"; scheda avversaria in una finestra nativa (sfida diretta, gare rimaste, rendimento in casa e in trasferta); analisi della Fenice (set, punti medi per set, tie-break, rimonte, serie).
- Fase 5: notizie del Comitato (categoria Indizioni più ricerca "seconda divisione", dal 2026-08-01, al massimo 10) e locandine delle gare; un'interruzione del sito del Comitato non blocca la sincronizzazione e le notizie precedenti restano.
- Fase 6: app installabile (manifest, icone, service worker con rete prima della cache), avviso di nuova versione con pulsante "Aggiorna", versione dell'app calcolata come impronta dei file e applicata solo nel workflow (`sw.js` resta con `VERSION "dev"` nel repository), badge di test e copertura pubblicati da `tests.yml`.
- Logo ufficiale della ASD Fenice fornito dall'utente (`assets/logo-fenice.png`): sostituisce lo stemma provvisorio e fissa la palette di pagina, indaco #2C1B73, arancio-rosso #F25034, oro #FB9827. Le icone dell'app si rigenerano con `uv run --script scripts/make_icons.py`. Questo supera la scelta D4 (palette dal logo FIPAV).

### Decisioni (fasi 2-6)

- Il report di sviluppo non va online: `docs/REPORT_ATTIVITA.md` resta nel repository ma il workflow lo rimuove prima del caricamento su Pages, e non entra nel calcolo della versione dell'app.
- La classifica mostrata è quella ufficiale FIPAV, che conta anche le gare non ancora omologate; le posizioni possibili partono da quella, penalità incluse.
- Limite di enumerazione `MAX_ENUMERATED_GAMES` a 9, misurato con `scripts/bench-standings.mjs`: 74 ms a 9 gare, 285 ms a 10. Oltre si usa solo il limite sui punti, che non sbaglia ma può dare un intervallo più largo.
- Una parità su punti e vittorie resta aperta finché le squadre coinvolte hanno gare da giocare, perché i criteri successivi dipendono da punteggi non ancora noti.
- Gli stemmi delle avversarie sono collegati direttamente dal sito FIPAV, con le iniziali come alternativa. Cloudflare risponde 403 a un browser automatico (HeadlessChrome), quindi nei test con Playwright senza interfaccia gli stemmi non si vedono.

### Difetti trovati dai controlli di fase e corretti

- Overflow orizzontale a 375 px: le tabelle larghe sforavano la pagina; ora restano dentro il proprio contenitore scorrevole (`a509d28`).
- Una gara in corso spariva dal riquadro della prossima partita: ora resta mostrata per tutta la durata prevista (`7aab176`).
- Le posizioni possibili ignoravano le penalità, perché partivano da una classifica ricostruita dai risultati: ora partono da quella ufficiale (`9764a4e`).
- Le gare assegnate a tavolino falsavano le statistiche sui set nell'analisi della Fenice: ora ne restano fuori (`1c88319`).
- Altri difetti corretti lungo le fasi: elenco di set vuoto e pulsante avversaria inutile (`9dc0fd5`), squadra senza set ordinata sotto una che ha perso 0-3 (`8aab424`), iniziali al posto di uno stemma che non si carica (`fff3f19`), normalizzazione dei ritorni a capo nel calendario e `SEQUENCE` per gli aggiornamenti (`601c894`).

### Verifiche (fasi 2-6)

- A ogni task: test Python e JS, `ruff` e `mypy` strict verdi; un commit per task. I test leggono solo `tests/fixtures/`.
- Render e click-through a 375 e 1280 px a ogni chiusura di fase.
- Il workflow non è ancora stato eseguito su GitHub: il repository non è online. La verifica completa e la chiusura di T043 sono a carico della revisione finale.

### Note per il Cliente (aggiornamento)

La pagina ora mostra tutto quello che serviva: calendario e risultati con i punteggi dei set, classifica ufficiale, le posizioni che ogni squadra può ancora raggiungere, la scheda di ogni avversaria, un'analisi della stagione della Fenice, le notizie del Comitato e il calendario da aggiungere al telefono. Si può installare sul telefono come un'app e avvisa quando c'è una versione nuova. Usa il logo ufficiale della società e i suoi colori. Il campionato non ha ancora una formula pubblicata (promozioni e retrocessioni): finché il Comitato non la comunica, la pagina non indica zone di classifica e dichiara che l'ordine a parità di punti è provvisorio. Il sito non è ancora online: restano da fare i passi del README e una verifica finale.

## 2026-11-21 - Correzione dei finding dell'analisi finale (T044-T055)

L'utente ha chiesto di correggere tutti i 19 finding dell'analisi di coerenza (risposta "Q1 O2") e ha confermato le decisioni N1-N4.

### Cosa è cambiato

- Codice più piccolo e testato: l'avviso di aggiornamento (`update.js`) è diviso in funzioni corte; il caricamento della pagina è uscito da `index.html` ed è in `app.js`, con i suoi test.
- Locandina mostrata come immagine (con misure, testo alternativo e caricamento differito) invece che come link.
- Risultati nella lista nel formato "3-0 (25-12, 25-19, 25-18)".
- "Aggiungi a Google Calendar" solo sulle gare ancora da giocare.
- Scheda avversaria: le posizioni delle prossime avversarie vengono dalla classifica ufficiale FIPAV, penalità comprese.
- Una sola fonte per indirizzo del sito, fuso orario e altre costanti, in Python e in JS; il link al calendario si ricava dall'indirizzo della pagina e non compare se la pagina è aperta da disco.
- Le icone dell'app sono disponibili anche offline.
- Il tipo delle notizie è controllato dallo schema.
- Badge: il JSON scritto a mano nel workflow è stato tolto; se `uv` non parte, i badge si costruiscono col Python del runner.
- Nuovi test: tempo del calcolo delle posizioni sotto 0,3 s, manifest e icona apple opaca, ordine dei passi e commit condizionato in `sync.yml`.
- Piano, spec e CLAUDE.md allineati al codice e alle decisioni (logo ufficiale, palette, moduli, DoD spuntata).

### Verifiche

- 177 test Python (copertura 98%) e 199 test JS verdi, `ruff` e `mypy` puliti.
- Review del codice: nessun difetto bloccante; corretti i due rilievi fondati (badge senza `uv`, link del calendario su file://).
- a11y-gate 5/5 sulla pagina con gare giocate; render a 375 e 1280 px senza scorrimento orizzontale; click-through della scheda avversaria (apertura, Tab, Esc, Chiudi, ritorno del focus), nessun errore in console.
- Non verificati: il workflow su GitHub e il caricamento reale delle locandine FIPAV in un browser (in automatico Cloudflare risponde 403).

## 2026-11-21 - Macchine a stati implicite: analisi e correzioni

### Cosa è stato fatto

- Mappate le macchine a stati del progetto: ciclo di vita della partita, caricamento della pagina, avviso di aggiornamento del service worker, sincronizzazione Python (host alternativo, arricchimento tollerante, scrittura atomica), scheda avversaria. Il lato Python è risultato corretto e non è stato toccato.
- Ciclo di vita della partita reso esplicito con `gameStatus()`: la riga di una gara in corso diceva «Da giocare», una gara finita senza risultato pure; l'hero diceva «finita da poco» anche settimane dopo; la scheda avversaria chiamava «da giocare» una gara già giocata in attesa di risultato.
- Pagina: prima restava ferma all'istante del caricamento (conto alla rovescia, prossima partita, «In corso» mai aggiornati) e non rinfrescava mai i dati, nemmeno riaprendo l'app installata giorni dopo. Ora segue l'orologio e rinfresca in background i dati vecchi di oltre 10 minuti; una risposta vecchia non sovrascrive una nuova; un refresh fallito non copre i dati con un errore; un tick durante un caricamento lento non lascia più la pagina bloccata sullo scheletro (trovato dal code-reviewer).
- Aggiornamento: se la versione accettata viene sostituita da una più nuova prima di prendere il controllo, il pulsante non resta più bloccato su «Aggiornamento…».
- Accessibilità: l'elenco del calendario non è più una regione live (veniva letto per intero a ogni cambio); il box di errore è un `alert`.
- Service worker: l'icona maskable del manifest entra nella cache offline.

### Verifica

- `npm test` 302 passati (23 test nuovi), `pytest` 260 passati, ruff e mypy puliti. Mutazioni sulle guardie nuove: ogni mutazione fa fallire almeno un test.
- Browser (Chromium headless, 375 e 1280 px, orologio simulato): «tra 2 minuti» diventa «In corso» nell'hero e nella riga senza ricaricare; scheda avversaria aperta e chiusa con focus restituito; errore offline con Riprova, Riprova ripristina il calendario; refresh fallito in background lascia il calendario; nessun errore in console.


## 2026-11-21 - Audit dei test con mutazioni e scomposizioni (844b48b..ef9174e)

### Cosa è stato fatto

- Audit della qualità dei test con lente mutazionale: tre worker in sola lettura (Python, regole JS, viste JS), poi verifica con mutanti eseguiti su una copia temporanea. All'inizio sopravvivevano 25 mutanti Python validi su 25, 12 regole JS su 13 e 15 viste JS su 15. Alla fine sono tutti uccisi tranne uno equivalente (`view-rules.js:46`: la clausola dell'iniziale singola è ridondante).
- Test aggiunti: Python da 260 a 292, JS da 428 a 464. Copertura Python da 99% a 100% di righe e rami; JS da 98,5/98,1 a 98,65/98,34. Le righe JS scoperte rimaste sono il bootstrap del browser e `sw.js` caricato via `vm`, punti ciechi della metrica.
- Fix: il test di timing R16 viene saltato sotto coverage (la strumentazione lo rallentava di circa 4 volte). `ics_changed` tratta un `calendario.ics` illeggibile o non UTF-8 come cambiato, invece di far fallire ogni run.
- Scomposizioni: `esc` in `html.js`; stemmi in `crest-view.js`; stati di caricamento in `states-view.js`; `load` e `refresh` di `app.js` su `takeTicket` e `fetchAndShow`; `schema.py` diviso in `_venue_errors`, `_format_errors`, `_result_errors`, `_start_errors`; `plural` e lettere V/P unici in `view-rules.js`.
- Scartate per guadagno marginale: `cli._fetch_and_build`, `enrich`, `notices._notice`, separazione di hero e schedule.

### Verifica

- Confronto differenziale del vecchio e del nuovo `validate_data` su 8000 documenti perturbati: 0 differenze.
- Confronto differenziale del markup di `buildViews` e `renderOpponent` prima e dopo le scomposizioni: 360 confronti, 0 differenze.
- Smoke test Playwright a 375 e 1280 px con click-through su filtri e scheda avversaria: console senza errori.
- `code-reviewer` sul diff: nessun rilievo bloccante.

### Divergenze aperte per l'utente

- Posizione della striscia forma: la spec (R19) e l'analisi non coincidono.
- I testi R14 e R7 della spec sono superati dalle proposte UX.
- `tables-view` ricalcola la classifica dalle gare quando `standings` è vuoto, mentre CLAUDE.md dice che non si ricalcola.
- La ricerca notizie su WordPress non è filtrata per titolo.
- La media punti per set esclude il quinto set.
- Il countdown mostra «Domani ore 00:30» a 45 minuti dall'inizio.
- Il ramo «data da definire» di `sharePayload` è irraggiungibile.

### Note per il Cliente

Il funzionamento della pagina non cambia. Abbiamo reso i controlli automatici molto più severi: ora si accorgono anche di errori piccoli che prima passavano inosservati. Una correzione evita che il calendario da aggiungere al telefono smetta di aggiornarsi se il file di appoggio risulta danneggiato. Restano sette punti da decidere insieme, elencati sopra.

### Riepilogo

Complessità: media. Stato: completato, nessun commit di questa entry; le divergenze aperte attendono una decisione.

## 2026-11-21 - Analisi di prodotto, risposte FIPAV salvate e notizie nascoste quando mancano

### Cosa è stato fatto

- Analisi di prodotto in `docs/ANALISI_PRODOTTO.md` (escluso da git con `.gitignore`, quindi mai pubblicato). Fatto misurato oggi: il sito del Comitato non pubblica nulla sulla Seconda Divisione dal 2017 e la categoria Indizioni è ferma al 2023, quindi la sezione Notizie restava sempre vuota.
- P2: una sync fallita salva le risposte già ricevute (FIPAV e sito del Comitato), nell'ordine delle richieste, in `reports/sync-failure/<data UTC>/`; il workflow le carica come artefatto `fipav-responses` (30 giorni) solo quando qualcosa è fallito. `data.json`, `calendario.ics` e `status.json` restano intatti come prima.
- P3: senza notizie la sezione e la sua voce nel menu sono nascoste fin dal primo disegno; il sito del Comitato è collegato nel piè di pagina.
- Corretto un difetto preesistente: con una notizia nuova, a 280 e 320 px la pagina scorreva di lato di 71 e 31 px, perché il testo per i lettori di schermo del contatore nel menu usciva dalla barra scorrevole.

### Verifica

- 299 test Python (copertura 100%) e 488 test JS verdi, ruff e mypy puliti. Tre mutazioni sul salvataggio delle risposte: tutte fanno fallire almeno un test.
- Browser (Chromium headless) a 375 e 1280 px, con e senza notizie: sezione e voce di menu nascoste o mostrate come atteso, nessun errore in console. a11y-gate 5/5 su entrambe le varianti del DOM renderizzato.
- code-reviewer sul diff: nessun rilievo bloccante.
- Non verificati: il caricamento dell'artefatto su GitHub (il repository non è ancora online).

### Note per il Cliente

Quando il Comitato non ha notizie sulla Seconda Divisione la pagina non mostra più una sezione vuota: il collegamento al sito del Comitato resta in fondo alla pagina. Se un giorno FIPAV cambia il formato dei dati e l'aggiornamento si ferma, ora resta una copia di ciò che FIPAV ha risposto, così la correzione si prepara in fretta.
