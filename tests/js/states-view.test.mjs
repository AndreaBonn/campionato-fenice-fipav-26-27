import assert from "node:assert/strict";
import { test } from "node:test";

import { errorCause, renderChecked, renderEmpty, renderError, renderLoading } from "../../docs/states-view.js";

const count = (html, needle) => html.split(needle).length - 1;

test("error: plain cause and a Riprova button, never a stack trace", () => {
  const html = renderError(new TypeError("Failed to fetch"), "https:");
  assert.match(html, /Impossibile caricare i dati/);
  assert.match(html, /Connessione non riuscita/);
  assert.match(html, /<button[^>]*id="retry"[^>]*>Riprova<\/button>/);
  assert.equal(count(html, "Failed to fetch"), 0);
});

test("error cause: server status, and the local file hint only on file:", () => {
  assert.equal(errorCause(new Error("HTTP 404"), "https:"), "Il server ha risposto con un errore (404). Riprova tra poco.");
  assert.match(errorCause(new TypeError("x"), "file:"), /server locale/);
  assert.equal(count(errorCause(new TypeError("x"), "https:"), "server locale"), 0);
});

test("empty: no Fenice games gives a headline and a Riprova button", () => {
  const html = renderEmpty();
  assert.match(html, /Calendario non ancora disponibile/);
  assert.match(html, /<button[^>]*id="retry"[^>]*>Riprova<\/button>/);
});

test("checked line: relative age of the last successful sync", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  assert.equal(renderChecked("2026-11-21T09:30:00Z", now), "Dati FIPAV controllati 2 ore fa");
});

test("error cause: a failure that is not a network error says the data is not readable", () => {
  const unreadable = "I dati ricevuti non sono leggibili. Riprova tra poco.";
  assert.equal(errorCause(new SyntaxError("Unexpected token"), "https:"), unreadable);
  assert.equal(errorCause(new Error("boom"), "https:"), unreadable);
  assert.equal(errorCause(undefined, "https:"), unreadable);
  assert.equal(errorCause(new TypeError("x"), "https:"), "Connessione non riuscita: controlla la rete e riprova.");
});

test("error box: announced as an alert, the calendar list itself is not a live region", () => {
  assert.match(renderError(new TypeError("x"), "https:"), /^<div class="state err" role="alert">/);
});

test("loading: a skeleton hidden from screen readers and a status they hear", () => {
  assert.equal(
    renderLoading(),
    '<div class="state" role="status"><span class="sr-only">Caricamento dei dati in corso</span><div class="skeleton" aria-hidden="true"><i></i><i></i><i></i></div></div>',
  );
});
