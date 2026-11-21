// Escaping of the strings that come from the data (FIPAV, WordPress) before they are put in markup.
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// Text and attribute values alike: null and undefined become an empty string
export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
