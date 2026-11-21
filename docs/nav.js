// Section bar under the header: marks the link of the section in view with aria-current; the rule lives in nav-rules.js.
import { activeSection } from "./nav-rules.js";

// A little more than the sticky bar plus the scroll-margin-top of the sections, so a section reached by its link counts as current
const BAR_OFFSET_PX = 80;
const BOTTOM_SLACK_PX = 2;

const targetId = (link) => link.getAttribute("href")?.replace(/^#/, "");

function update(s) {
  const visible = [];
  for (const link of s.links) {
    const section = s.doc.getElementById(targetId(link));
    // a link to a section that is not on the page would go nowhere
    link.parentElement.hidden = !section || section.hidden;
    if (section && !section.hidden) visible.push({ id: section.id, top: section.getBoundingClientRect().top });
  }
  const { scrollHeight } = s.doc.documentElement;
  // a page that fits the viewport has no end to scroll to
  const atBottom = scrollHeight > s.win.innerHeight + BOTTOM_SLACK_PX && s.win.innerHeight + s.win.scrollY >= scrollHeight - BOTTOM_SLACK_PX;
  const current = activeSection(visible, { offset: s.offset, atBottom });
  for (const link of s.links) {
    if (targetId(link) === current) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}

// One update per frame, however many scroll events came in
function schedule(s) {
  if (s.queued) return;
  s.queued = true;
  s.raf(() => {
    s.queued = false;
    update(s);
  });
}

// env.watch(callback): optional, calls back when the page content changes (a section shown or hidden)
export function setupSectionNav(env) {
  const { doc, win, raf = (fn) => win.requestAnimationFrame(fn), offset = BAR_OFFSET_PX, watch } = env;
  const s = { doc, win, raf, offset, links: [...doc.querySelectorAll("[data-section-nav] a[href^='#']")], queued: false };
  const again = () => schedule(s);
  win.addEventListener("scroll", again, { passive: true });
  win.addEventListener("resize", again);
  watch?.(again);
  again();
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  const main = document.querySelector("main");
  const watch = (fn) => main && new MutationObserver(fn).observe(main, { attributes: true, attributeFilter: ["hidden"], childList: true, subtree: true });
  setupSectionNav({ doc: document, win: window, watch });
}
