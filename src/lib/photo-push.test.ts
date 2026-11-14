import { test } from "node:test";
import assert from "node:assert/strict";
import { photoPushPayload, validatePhotoPushDevice } from "./photo-push";

const device = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test",
  p256dh: btoa(String.fromCharCode(4) + "x".repeat(64)),
  auth: btoa("a".repeat(16)),
};
test("accepts browser push service and actual key lengths", () => {
  assert.equal(validatePhotoPushDevice(device).endpoint, device.endpoint);
  assert.throws(() => validatePhotoPushDevice({ ...device, auth: btoa("short") }));
});
test("rejects arbitrary URLs, forged provider domains and credentials", () => {
  for (const endpoint of ["https://localhost/", "http://fcm.googleapis.com/x", "https://fcm.googleapis.com.evil.test/x", "https://user@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x"]) {
    assert.throws(() => validatePhotoPushDevice({ ...device, endpoint }));
  }
});
test("photo notifications open the admin ticker and remain distinct per submission", () => {
  const first = photoPushPayload({ id: "one", author: "Test", place: "Amriswil", note: "" });
  const next = photoPushPayload({ id: "two", author: "Test", place: "", note: "" });
  assert.equal(first.url, "/admin-ticker");
  assert.notEqual(first.tag, next.tag);
});
const v2 = validatePhotoPushDevice;
test("iPhone: Standard-Base64 mit + und / sowie ohne Padding wird akzeptiert", () => {
  const pk = new Uint8Array(65).fill(251); pk[0] = 4;
  const auth = new Uint8Array(16).fill(255);
  const b = (a: Uint8Array) => btoa(String.fromCharCode(...a));
  const d = v2({ endpoint: "https://api.push.apple.com/3/device/abc", p256dh: b(pk), auth: b(auth).replace(/=+$/, "") });
  assert.doesNotMatch(d.p256dh, /[+/=]/);
  assert.equal(d.auth, "_____________________w");
});
