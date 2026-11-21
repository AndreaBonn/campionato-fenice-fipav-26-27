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
