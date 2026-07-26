import { describe, it } from "node:test";
import assert from "node:assert";
import { setTimer, checkTimers } from "../../engine/time.ts";

function fakeDb(): Record<string, any> {
  const store: Record<string, any> = {};
  return { get: (k: string) => store[k] ?? null, set: (k: string, v: any) => { store[k] = v; }, store };
}

describe("setTimer", () => {
  it("should create a timer and store it", () => {
    const db = fakeDb();
    const entry = setTimer(db, "rest", 60, "休息一小时");
    assert.strictEqual(entry.name, "rest");
    assert.strictEqual(entry.description, "休息一小时");
    assert.ok(entry.arrives_at > Date.now());
  });

  it("should overwrite existing timer with same name", () => {
    const db = fakeDb();
    setTimer(db, "rest", 60);
    setTimer(db, "rest", 120);
    const timers = db.get("timers");
    assert.strictEqual(timers.length, 1);
    assert.ok(timers[0].arrives_at > Date.now() + 119 * 60000);
  });

  it("should store multiple different timers", () => {
    const db = fakeDb();
    setTimer(db, "a", 10);
    setTimer(db, "b", 20);
    assert.strictEqual(db.get("timers").length, 2);
  });
});

describe("checkTimers", () => {
  it("should return empty for no timers", () => {
    const db = fakeDb();
    assert.deepStrictEqual(checkTimers(db), []);
  });

  it("should report not ready for future timer", () => {
    const db = fakeDb();
    setTimer(db, "wait", 60);
    const status = checkTimers(db);
    assert.strictEqual(status.length, 1);
    assert.strictEqual(status[0].name, "wait");
    assert.strictEqual(status[0].ready, false);
    assert.ok(status[0].remaining_minutes > 0);
  });

  it("should report ready for past timer", () => {
    const db = fakeDb();
    // Manually set a timer in the past
    db.set("timers", [{ name: "old", arrives_at: Date.now() - 60000 }]);
    const status = checkTimers(db);
    assert.strictEqual(status.length, 1);
    assert.strictEqual(status[0].name, "old");
    assert.strictEqual(status[0].ready, true);
    assert.strictEqual(status[0].remaining_minutes, 0);
  });

  it("should auto-clean ready timers from db", () => {
    const db = fakeDb();
    db.set("timers", [
      { name: "done", arrives_at: Date.now() - 60000 },
      { name: "pending", arrives_at: Date.now() + 60000 },
    ]);
    const status = checkTimers(db);
    assert.strictEqual(status.length, 2);
    // After check, only pending should remain in db
    const remaining = db.get("timers");
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].name, "pending");
  });
});
