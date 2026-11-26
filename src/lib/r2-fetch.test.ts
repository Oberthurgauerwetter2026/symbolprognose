import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { fetchR2 } from "./r2-url.server";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function stub(responses: Array<Response | Error>) {
  let calls = 0;
  globalThis.fetch = (async () => {
    const next = responses[Math.min(calls, responses.length - 1)];
    calls++;
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  return () => calls;
}

describe("fetchR2", () => {
  test("wiederholt einen gedrosselten Abruf einmal", async () => {
    const calls = stub([new Response("", { status: 429 }), new Response("ok", { status: 200 })]);
    const res = await fetchR2("https://example.test/a.png");
    assert.equal(res.status, 200);
    assert.equal(calls(), 2);
  });
  test("wiederholt nach einem Verbindungsabbruch", async () => {
    const calls = stub([new Error("reset"), new Response("ok", { status: 200 })]);
    assert.equal((await fetchR2("https://example.test/a.png")).status, 200);
    assert.equal(calls(), 2);
  });
  test("ein fehlendes Bild (404) wird nicht wiederholt", async () => {
    const calls = stub([new Response("", { status: 404 })]);
    assert.equal((await fetchR2("https://example.test/a.png")).status, 404);
    assert.equal(calls(), 1);
  });
});
