// Team crests: the FIPAV logo image of a team, and the initials badge that takes its place when there is
// no logo or the image fails (Cloudflare can answer 403). data-crest-name is what installCrestFallback reads.
import { esc } from "./html.js";
import { teamInitials } from "./view-rules.js";

// Initials badge shown in place of a crest image that did not load (e.g. a 403 or a blocked response)
export const crestFallbackHtml = (name) => `<span class="crest-fallback" aria-hidden="true">${esc(teamInitials(name))}</span>`;

// The logo of a team at a square size in px, or its initials when it has none; lazy for long lists
export function crestHtml(team, size, { lazy = false } = {}) {
  if (!team.logo_url) return crestFallbackHtml(team.name);
  const loading = lazy ? ' loading="lazy"' : "";
  return `<img src="${esc(team.logo_url)}" alt="" data-crest-name="${esc(team.name)}"${loading} width="${size}" height="${size}">`;
}

// Image error events do not bubble: one capturing listener on the container covers every crest
export function installCrestFallback(root) {
  root.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName !== "IMG" || img.dataset.crestName === undefined) return;
    img.insertAdjacentHTML("afterend", crestFallbackHtml(img.dataset.crestName));
    img.remove();
  }, true);
}
