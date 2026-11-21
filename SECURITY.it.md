[English](./SECURITY.md) | **Italiano**

# Politica di sicurezza

## Versioni supportate

Il progetto non ha release. Le correzioni di sicurezza vanno sull'ultimo commit di `main`, che è quello pubblicato da GitHub Pages.

## Segnalare una vulnerabilità

Segnala le vulnerabilità in privato tramite [GitHub Security Advisories](https://github.com/AndreaBonn/campionato-fenice-fipav-26-27/security/advisories/new), non con una issue pubblica.

Indica:

- una descrizione della vulnerabilità
- i passi per riprodurla
- il comportamento atteso e quello osservato
- l'impatto: cosa potrebbe ottenere un attaccante

**Tempi di risposta:**
<!-- TODO: aggiungere i tempi di risposta reali -->
- La divulgazione pubblica viene coordinata dopo la pubblicazione della correzione.

## Misure di sicurezza implementate

Il sito è statico: non ci sono account, moduli, codice lato server né segreti nella pagina. I dati che mostra arrivano da terzi (FIPAV Online e il sito WordPress del Comitato di Cagliari), quindi le misure qui sotto trattano quei dati come non fidati.

- **Escape dell'output**: ogni stringa che arriva dai dati viene trasformata (`&`, `<`, `>`, `"`, `'`) prima di entrare nel markup, tramite un'unica funzione condivisa (`docs/html.js:5`).
- **Link delle notizie su lista consentita**: una notizia del Comitato si tiene solo se il link è `https` e l'host è nella lista ammessa (`src/fenice_calendar/notices.py:41`).
- **Validazione del percorso delle locandine**: una locandina si tiene solo se la sua chiave rispetta un pattern rigido (`src/fenice_calendar/config.py:43`, controllato in `src/fenice_calendar/posters.py:19`).
- **Controllo del tipo di risposta**: una risposta FIPAV che non è `application/json` viene rifiutata come un errore di rete (`src/fenice_calendar/fetch.py:38`). Le richieste hanno un timeout di 30 s e distano almeno 1 s l'una dall'altra (`src/fenice_calendar/config.py:23`).
- **Validazione dello schema**: `docs/data.json` viene validato prima di essere scritto; chiavi inattese e dati incoerenti fanno fallire l'esecuzione (`src/fenice_calendar/schema.py:142`, `src/fenice_calendar/schema.py:279`). Un'esecuzione fallita non scrive alcun file di output.
- **GitHub Actions**: i permessi dei workflow partono da `contents: read` e si alzano solo nel singolo job; il checkout usa `persist-credentials: false`; le action di terze parti sono fissate allo SHA del commit (`.github/workflows/sync.yml`, `.github/workflows/tests.yml`).
- **Dipendenze bloccate**: `uv.lock` è nel repository e la CI installa con `uv sync --frozen`. La sincronizzazione non ha dipendenze a runtime oltre alla libreria standard di Python.

Non presenti: una Content-Security-Policy, la scansione automatica delle dipendenze (Dependabot o simili) e la validazione degli URL degli stemmi delle avversarie, caricati da FIPAV Online così come vengono pubblicati.

## Fuori ambito

- Errori o modifiche nei dati pubblicati da FIPAV Online o dal Comitato: vanno segnalati alla fonte.
- Self-XSS che richiede alla vittima di incollare codice nella console del proprio browser.
- Vulnerabilità di GitHub Pages o GitHub Actions.
- Vulnerabilità già pubbliche nelle dipendenze di terze parti: vanno segnalate a chi le mantiene.

---

[Torna al README](./README.it.md)
