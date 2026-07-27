import { describe, it } from "node:test";
import assert from "node:assert";
import {
  initGameTime,
  getGameTime,
  getFullTime,
} from "../../engine/time.ts";

// ============================================================
// Helpers
// ============================================================

/** A minimal fake db object that stores arbitrary key-value pairs in memory. */
function fakeDb(): Record<string, any> {
  const store: Record<string, any> = {};
  return {
    get: (key: string) => store[key] ?? null,
    set: (key: string, value: any) => {
      store[key] = value;
    },
    store,
  };
}

// ============================================================
// Tests
// ============================================================

describe("initGameTime / getGameTime", () => {
  it("should track elapsed game time from init", async () => {
    // Arrange
    const db = fakeDb();

    // Act
    initGameTime(db);

    // Small delay to let time pass
    await sleep(50);

    const elapsed = getGameTime(db);

    // Assert
    // elapsed should be roughly >= 50ms (actual wall-clock time passed)
    assert.ok(
      elapsed >= 40,
      `Expected elapsed >= 40ms, got ${elapsed}ms`,
    );

    // Another delay
    await sleep(50);

    const elapsed2 = getGameTime(db);

    // elapsed2 should be larger than elapsed
    assert.ok(
      elapsed2 > elapsed,
      `Expected elapsed2 (${elapsed2}) > elapsed (${elapsed})`,
    );
  });

  it("getGameTime should auto-initialize and return 0 after auto-init", () => {
    const db = fakeDb();

    const elapsed = getGameTime(db);

    // Should be 0 right after auto-init
    assert.ok(elapsed >= 0 && elapsed < 1000);
  });

  it("after auto-init, subsequent getGameTime calls should show elapsed time", async () => {
    const db = fakeDb();

    getGameTime(db); // auto-init
    await sleep(50);
    const elapsed = getGameTime(db);

    assert.ok(elapsed >= 40, `Expected elapsed >= 40ms, got ${elapsed}`);
  });
});

describe("getFullTime auto-initialization", () => {
  it("should auto-initialize game time when getFullTime is called before initGameTime", () => {
    const db = fakeDb();
    // No initGameTime called — simulate resumed session

    const info = getFullTime(db);

    // Should still return valid current time (not default 2250)
    const now = new Date();
    assert.strictEqual(info.year, now.getFullYear());
    assert.strictEqual(info.month, now.getMonth() + 1);
    assert.strictEqual(info.day, now.getDate());
    // elapsed should be 0 (just initialized)
    assert.strictEqual(info.elapsed_ms, 0);
  });
});

// ============================================================
// Utility
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// getFullTime tests
// ============================================================

describe("getFullTime", () => {
  it("should use real current time as default start date", () => {
    // Arrange
    const db = fakeDb();
    const before = new Date();

    // Act
    initGameTime(db); // no custom date

    const info = getFullTime(db);
    const after = new Date();

    // Assert
    // Year/month/day should be today
    assert.strictEqual(info.year, before.getFullYear());
    assert.strictEqual(info.month, before.getMonth() + 1);
    assert.strictEqual(info.day, before.getDate());
    // Hour/minute should be close to now (within 1 minute tolerance for test execution)
    assert.strictEqual(info.hour, before.getHours());
    assert.ok(
      Math.abs(info.minute - before.getMinutes()) <= 1,
      `Expected minute ${info.minute} to be within 1 of ${before.getMinutes()}`,
    );
    // elapsed should be very small (just initialized)
    assert.ok(info.elapsed_ms < 5000, `Expected elapsed_ms < 5000, got ${info.elapsed_ms}`);
  });

  it("should support custom start date via initGameTime", () => {
    const db = fakeDb();
    initGameTime(db, "2260-06-15T14:30:00");

    const info = getFullTime(db);

    assert.strictEqual(info.year, 2260);
    assert.strictEqual(info.month, 6);
    assert.strictEqual(info.day, 15);
    assert.strictEqual(info.hour, 14);
    assert.strictEqual(info.minute, 30);
  });

  it("should return night=true for nighttime hours", () => {
    const db = fakeDb();
    // Start at 2:00 AM — hour=2 maps to 夜间 (night)
    initGameTime(db, "2250-01-01T02:00:00");

    const info = getFullTime(db);

    assert.strictEqual(info.hour, 2);
    assert.strictEqual(info.time_of_day, "夜间");
    assert.strictEqual(info.is_night, true);
  });

  it("should return night=true for 夜间 hours", () => {
    const db = fakeDb();
    initGameTime(db, "2250-01-01T20:00:00");

    const info = getFullTime(db);

    assert.strictEqual(info.hour, 20);
    assert.strictEqual(info.time_of_day, "夜间");
    assert.strictEqual(info.is_night, true);
  });

  it("should return current real time when no start time is set", () => {
    // Arrange
    const db = fakeDb();
    const now = new Date();
    // No initGameTime call

    // Act
    const info = getFullTime(db);

    // Assert
    assert.strictEqual(info.year, now.getFullYear());
    assert.strictEqual(info.month, now.getMonth() + 1);
    assert.strictEqual(info.day, now.getDate());
    assert.strictEqual(info.elapsed_ms, 0);
  });
});

// ============================================================
// Defensive validation: getFullTime with invalid date string
// ============================================================

describe("getFullTime defensive checks", () => {
  it("should not crash or return NaN fields when game_start_date is invalid", () => {
    // Arrange: valid real timestamp but corrupt date string
    const db = fakeDb();
    db.set("game_start_real", Date.now());
    db.set("game_start_date", "not-a-date");

    // Act
    const info = getFullTime(db);

    // Assert: all numeric date fields must be valid numbers (not NaN)
    const numericFields: (keyof typeof info)[] = [
      "year",
      "month",
      "day",
      "hour",
      "minute",
      "day_of_week",
      "day_number",
      "elapsed_ms",
      "elapsed_hours",
      "elapsed_days",
    ];
    for (const field of numericFields) {
      const value = info[field];
      assert.ok(
        typeof value === "number" && !Number.isNaN(value),
        `Expected ${field} to be a valid number, got ${value}`,
      );
    }
  });
});
