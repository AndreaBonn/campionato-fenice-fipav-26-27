// HTML of the page load states as strings: loading, failed, empty, and the line of the last check.
// No DOM access: app.js puts them in the page.
import { esc } from "./html.js";
import { relativeAge } from "./view-rules.js";

const HTTP_STATUS = /^HTTP (\d+)$/;

// A failed load, in plain words: network down, server error, or a page opened as a local file
export function errorCause(err, protocol) {
  const status = HTTP_STATUS.exec(err?.message ?? "");
  if (status) return `Il server ha risposto con un errore (${status[1]}). Riprova tra poco.`;
  const local = protocol === "file:" ? " La pagina è aperta come file locale e il browser blocca la lettura dei dati: aprila dal sito pubblicato o con un server locale." : "";
  return err instanceof TypeError ? `Connessione non riuscita: controlla la rete e riprova.${local}` : `I dati ricevuti non sono leggibili. Riprova tra poco.${local}`;
}

const RETRY = '<button type="button" class="btn" id="retry">Riprova</button>';

export const renderError = (err, protocol) =>
  `<div class="state err" role="alert"><strong>Impossibile caricare i dati delle partite.</strong>${esc(errorCause(err, protocol))}<br>${RETRY}</div>`;

export const renderEmpty = () =>
  `<div class="state"><strong>Calendario non ancora disponibile</strong>La FIPAV non ha ancora pubblicato le partite dell'Asd Fenice per questo girone.<br>${RETRY}</div>`;

export const renderLoading = () =>
  '<div class="state" role="status"><span class="sr-only">Caricamento dei dati in corso</span><div class="skeleton" aria-hidden="true"><i></i><i></i><i></i></div></div>';

export const renderChecked = (iso, now) => `Dati FIPAV controllati ${relativeAge(iso, now)}`;
