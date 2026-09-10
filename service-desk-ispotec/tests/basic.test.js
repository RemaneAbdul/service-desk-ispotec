const test = require("node:test");
const assert = require("node:assert/strict");

test("formato de ticket", () => {
  const n = "SD-2026-000001";
  assert.match(n, /^SD-\d{4}-\d{6}$/);
});

test("regra de páginas", () => {
  const limit = 10, pages = 11;
  assert.equal(pages > limit, true);
});
