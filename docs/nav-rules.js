// Pure rule of the section bar: which section is in view. No DOM.

// sections: the visible ones in page order, each { id, top } with top the distance from the viewport top.
// The current one is the last whose top has passed under the bar (top <= offset); before the first
// has, the first one is current; at the very end of the page the last one is, even if it is too short to reach the bar
export function activeSection(sections, { offset, atBottom }) {
  if (!sections.length) return null;
  if (atBottom) return sections.at(-1).id;
  const reached = sections.filter((s) => s.top <= offset);
  return (reached.at(-1) ?? sections[0]).id;
}
