import assert from "node:assert/strict";
import { test } from "node:test";

import { activeSection } from "../../docs/nav-rules.js";

const sections = (...tops) => tops.map((top, i) => ({ id: `s${i + 1}`, top }));
const OFFSET = 80;

test("at the top of the page the first section is current, even though it starts below the bar", () => {
  assert.equal(activeSection(sections(200, 900, 1500), { offset: OFFSET, atBottom: false }), "s1");
});

test("the current section is the last one whose top has passed under the bar", () => {
  assert.equal(activeSection(sections(-600, 40, 700), { offset: OFFSET, atBottom: false }), "s2");
  assert.equal(activeSection(sections(-1600, -900, 60), { offset: OFFSET, atBottom: false }), "s3");
});

test("a section whose top is exactly at the offset counts as reached", () => {
  assert.equal(activeSection(sections(-300, 80), { offset: OFFSET, atBottom: false }), "s2");
});

test("at the bottom of the page the last section is current, even when it never reached the bar", () => {
  assert.equal(activeSection(sections(-900, -200, 500), { offset: OFFSET, atBottom: true }), "s3");
});

test("no visible section gives null, so no link is marked", () => {
  assert.equal(activeSection([], { offset: OFFSET, atBottom: false }), null);
  assert.equal(activeSection([], { offset: OFFSET, atBottom: true }), null);
});
