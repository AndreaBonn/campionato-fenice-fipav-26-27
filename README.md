# Campionato Fenice 2026/27

Pagina non ufficiale con calendario e risultati della ASD Fenice, Seconda Divisione Femminile Girone A, Comitato Territoriale FIPAV di Cagliari, stagione 2026/27.

Indirizzo del sito: https://andreabonn.github.io/campionato-fenice-fipav-26-27/

## Cosa mostra

- La prossima partita della Fenice, con avversaria, data, ora, palestra e un conto alla rovescia.
- L'elenco di tutte le partite, giornata per giornata, con il risultato in set e i punteggi di ogni set.
- Il collegamento alla mappa della palestra.
- La data e l'ora dell'ultimo controllo dei dati.

## Da dove arrivano i dati

Fonte: FIPAV Online (https://www.fipavonline.it). I dati di gara appartengono alla FIPAV: questa pagina li riporta così come li pubblica FIPAV Online e non è un sito ufficiale della Federazione né della società.

## Ogni quanto si aggiorna

Il sito controlla FIPAV Online ogni 4 ore, in modo automatico. Un risultato inserito in federazione può quindi comparire in pagina fino a 4 ore dopo. Se FIPAV Online non risponde, la pagina continua a mostrare gli ultimi dati validi e la data dell'ultimo controllo riuscito non cambia.

## Pubblicare il sito

Il repository non è ancora online. Per pubblicarlo servono pochi passi, da fare una volta sola:

1. Crea su GitHub un repository pubblico chiamato `campionato-fenice-fipav-26-27`, vuoto (senza README né licenza).
2. Nel repository vai su Settings > Pages e, alla voce Source, scegli "GitHub Actions".
3. Dalla cartella del progetto collega il repository e carica il codice:

   ```bash
   git remote add origin https://github.com/AndreaBonn/campionato-fenice-fipav-26-27.git
   git push -u origin main
   ```

4. Il caricamento avvia il controllo automatico: i test, la lettura dei dati da FIPAV Online e la pubblicazione. Al termine il sito è raggiungibile all'indirizzo indicato sopra. Lo stato si segue dalla scheda Actions del repository.

## Sviluppo

Servono [uv](https://docs.astral.sh/uv/) e Node.js.

```bash
npm run setup     # installa le dipendenze Python
npm run sync      # scarica il calendario e aggiorna docs/data.json
npm run serve     # apre la pagina su http://localhost:8000
npm test          # test delle regole JavaScript
npm run test:py   # test Python con copertura
npm run lint      # ruff e mypy
```

I test usano solo copie salvate delle risposte di FIPAV in `tests/fixtures/`, mai la rete. Convenzioni e flusso dei dati sono descritti in `CLAUDE.md`; il piano delle fasi successive è in `specs/001-fenice-seconda-divisione/`.

## Licenza

MIT. Vedi il file `LICENSE`.
