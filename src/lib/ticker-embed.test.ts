import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../../public/ticker-embed.js", import.meta.url), "utf8");
const origin = "https://oberthurgauer-wetter.lovable.app";

function host() {
  const listeners = new Map<string, Array<(event: any) => void>>();
  const loads: Array<() => void> = [];
  const requests: Array<{ data: unknown; target: string }> = [];
  const frame = {
    src: origin + "/embed/ticker?view=banner",
    style: { height: "80px", margin: "12px", transition: "height .25s ease" },
    contentWindow: { postMessage: (data: unknown, target: string) => requests.push({ data, target }) },
    addEventListener: (_: string, listener: () => void) => loads.push(listener),
  };
  const other = { ...frame, src: origin + "/embed/ticker?view=widget", style: { ...frame.style }, contentWindow: { postMessage: () => {} } };
  const window = {
    otwTickerResize: 1,
    addEventListener: (type: string, listener: (event: any) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
  };
  const document = {
    baseURI: "https://wordpress.example/",
    readyState: "complete",
    documentElement: {},
    querySelectorAll: () => [frame, other],
  };
  const context = { window, document, URL, WeakSet, MutationObserver: class { observe() {} } };
  const run = () => runInNewContext(script, context);
  run();
  const send = (height: unknown, source: unknown = frame.contentWindow, eventOrigin = origin) => {
    for (const listener of listeners.get("message") ?? []) {
      listener({ data: { type: "lovable-weather:height", height }, source, origin: eventOrigin });
    }
  };
  return { frame, other, listeners, requests, loads, send, run };
}

test("WordPress height grows and shrinks to its content, without a lagging transition", () => {
  const h = host();
  h.send(231.2);
  assert.equal(h.frame.style.height, "232px");
  h.send(70);
  assert.equal(h.frame.style.height, "70px");
  assert.equal(h.frame.style.transition, "none");
  assert.equal(h.frame.style.margin, "0");
  assert.equal(h.other.style.height, "80px");
});

test("long messages with multiple attachments are not clipped at the old 4000px cap", () => {
  const h = host();
  h.send(4821);
  assert.equal(h.frame.style.height, "4821px");
});

test("only the matching ticker frame from its own origin can set its height", () => {
  const h = host();
  h.send(300, h.frame.contentWindow, "https://unrelated.example");
  h.send(300, {});
  assert.equal(h.frame.style.height, "80px");
  h.send(350, h.other.contentWindow);
  assert.equal(h.frame.style.height, "80px");
  assert.equal(h.other.style.height, "350px");
});

test("invalid height messages cannot hide or break the ticker", () => {
  const h = host();
  for (const invalid of [0, -1, 59, NaN, Infinity, "200", null]) h.send(invalid);
  assert.equal(h.frame.style.height, "80px");
});

test("a late script asks for the current height even alongside an old WordPress script", () => {
  const h = host();
  assert.equal(h.requests[0]?.target, origin);
  assert.equal((h.requests[0]?.data as { type?: string })?.type, "lovable-weather:request-height");
  const beforeLoad = h.requests.length;
  h.loads[0]?.();
  assert.equal(h.requests.length, beforeLoad + 1);
  for (const listener of h.listeners.get("resize") ?? []) listener({});
  assert.equal(h.requests.length, beforeLoad + 2);
});

test("including the script in both WordPress locations registers only one handler", () => {
  const h = host();
  h.run();
  assert.equal(h.listeners.get("message")?.length, 1);
  assert.equal(h.loads.length, 2);
});