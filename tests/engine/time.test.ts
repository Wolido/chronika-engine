import { describe, it } from "node:test";
import assert from "node:assert";
import {
  startQuickTravel,
  checkTravelArrival,
  initGameTime,
  getGameTime,
  getFullTime,
} from "../../engine/time.ts";
import type {
  QuickTravelInput,
  QuickTravelResult,
  TravelStatus,
  GameTimeInfo,
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

describe("startQuickTravel", () => {
  it("should set correct arrival time for default speed (5 km/h)", () => {
    // Arrange
    const db = fakeDb();
    const input: QuickTravelInput = {
      db,
      from: "铁锈镇",
      to: "东部废墟",
      distance_km: 3,
    };
    const beforeCall = Date.now();

    // Act
    const result = startQuickTravel(input);

    // Assert
    const afterCall = Date.now();

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.from, "铁锈镇");
    assert.strictEqual(result.to, "东部废墟");
    assert.strictEqual(result.distance_km, 3);

    // speed=5 km/h → 3/5 = 0.6h = 36 minutes = 2,160,000 ms
    const expectedTravelMs = 2_160_000;
    assert.strictEqual(result.travel_time_minutes, 36);

    // arrives_at ≈ Date.now() + expectedTravelMs, within 100ms tolerance
    const expectedArrival = beforeCall + expectedTravelMs;
    const diff = Math.abs(result.arrives_at - expectedArrival);
    assert.ok(
      diff <= 100,
      `arrives_at ${result.arrives_at} differs from expected ${expectedArrival} by ${diff}ms (max 100ms)`,
    );

    // arrives_at should also be close to afterCall + expectedTravelMs
    const diffAfter = Math.abs(result.arrives_at - (afterCall + expectedTravelMs));
    assert.ok(
      diffAfter <= 100,
      `arrives_at ${result.arrives_at} differs from after-call expected by ${diffAfter}ms`,
    );
  });

  it("should reject negative distance", () => {
    const db = fakeDb();
    const input: QuickTravelInput = {
      db,
      from: "铁锈镇",
      to: "东部废墟",
      distance_km: -3,
    };

    const result = startQuickTravel(input);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.travel_time_minutes, 0);
    assert.strictEqual(result.arrives_at, 0);
    assert.ok(result.error, "error should be non-empty");
    assert.ok(result.error!.length > 0);
  });

  it("should reject negative speed", () => {
    const db = fakeDb();
    const input: QuickTravelInput = {
      db,
      from: "铁锈镇",
      to: "东部废墟",
      distance_km: 3,
      speed_kmh: -5,
    };

    const result = startQuickTravel(input);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.travel_time_minutes, 0);
    assert.strictEqual(result.arrives_at, 0);
    assert.ok(result.error, "error should be non-empty");
    assert.ok(result.error!.length > 0);
  });

  it("should calculate correct travel time with custom speed", () => {
    // Arrange
    const db = fakeDb();
    const input: QuickTravelInput = {
      db,
      from: "铁锈镇",
      to: "远方的灯塔",
      distance_km: 10,
      speed_kmh: 20,
    };

    // Act
    const result = startQuickTravel(input);

    // Assert
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.distance_km, 10);

    // 10 km / 20 km/h = 0.5 h = 30 minutes = 1,800,000 ms
    assert.strictEqual(result.travel_time_minutes, 30);

    const beforeCall = Date.now();
    // We can't know the exact call time anymore, but we can verify the
    // relationship: arrives_at should be roughly travel_time_minutes * 60_000 ms ahead
    const now = Date.now();
    const remainingMs = result.arrives_at - now;
    const remainingMinutes = remainingMs / 60_000;
    assert.ok(
      remainingMinutes > 0 && remainingMinutes <= 30,
      `Expected remaining minutes in (0, 30], got ${remainingMinutes}`,
    );
  });
});

describe("checkTravelArrival", () => {
  it("should report not arrived when arrival time is 1 hour in the future", () => {
    // Arrange
    const db = fakeDb();
    const futureArrival = Date.now() + 3_600_000; // 1 hour from now
    db.set("travel_status", {
      traveling: true,
      from: "铁锈镇",
      to: "东部废墟",
      arrives_at: futureArrival,
    });

    // Act
    const status = checkTravelArrival(db);

    // Assert
    assert.strictEqual(status.traveling, true);
    assert.strictEqual(status.arrived, false);
    assert.strictEqual(status.from, "铁锈镇");
    assert.strictEqual(status.to, "东部废墟");
    assert.strictEqual(status.arrives_at, futureArrival);

    // remaining_minutes ≈ 60 (allow ±1 minute for test execution time)
    assert.ok(status.remaining_minutes !== undefined);
    assert.ok(
      status.remaining_minutes! >= 59 && status.remaining_minutes! <= 60,
      `Expected remaining_minutes ~60, got ${status.remaining_minutes}`,
    );
  });

  it("should report arrived when arrival time is 1 second in the past", () => {
    // Arrange
    const db = fakeDb();
    const pastArrival = Date.now() - 1_000; // 1 second ago
    db.set("travel_status", {
      traveling: true,
      from: "铁锈镇",
      to: "东部废墟",
      arrives_at: pastArrival,
    });

    // Act
    const status = checkTravelArrival(db);

    // Assert
    assert.strictEqual(status.traveling, false);
    assert.strictEqual(status.arrived, true);
    assert.strictEqual(status.from, "铁锈镇");
    assert.strictEqual(status.to, "东部废墟");

    // remaining_minutes should be 0 when already arrived
    assert.strictEqual(status.remaining_minutes, 0);
  });

  it("should report not traveling when no travel status is set", () => {
    // Arrange
    const db = fakeDb();
    // No travel_status set at all

    // Act
    const status = checkTravelArrival(db);

    // Assert
    assert.strictEqual(status.traveling, false);
    assert.strictEqual(status.arrived, false);
    assert.strictEqual(status.from, undefined);
    assert.strictEqual(status.to, undefined);
    assert.strictEqual(status.arrives_at, undefined);
    assert.strictEqual(status.remaining_minutes, undefined);
  });
});

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
  it("should return full date info with default start date (2250-01-01T08:00:00)", () => {
    const db = fakeDb();
    initGameTime(db);

    const info = getFullTime(db);

    // Basic fields should exist and have correct types
    assert.strictEqual(info.year, 2250);
    assert.strictEqual(info.month, 1);
    assert.strictEqual(info.day, 1);
    assert.strictEqual(info.hour, 8);
    assert.strictEqual(info.minute, 0);
    assert.strictEqual(info.day_of_week, 2);
    assert.strictEqual(info.day_of_week_name, "Tuesday");
    assert.strictEqual(info.day_number, 1);
    assert.strictEqual(info.time_of_day, "早晨"); // 8am -> 早晨
    assert.strictEqual(info.is_night, false);
    assert.ok(typeof info.elapsed_ms === "number");
    assert.ok(typeof info.elapsed_hours === "number");
    assert.ok(typeof info.elapsed_days === "number");
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

  it("should return default values when no start time is set", () => {
    const db = fakeDb();
    // No initGameTime call

    const info = getFullTime(db);

    assert.strictEqual(info.year, 2250);
    assert.strictEqual(info.hour, 8);
    assert.strictEqual(info.elapsed_ms, 0);
    assert.strictEqual(info.day_number, 1);
  });
});

// ============================================================
// Defensive validation: checkTravelArrival with corrupt status
// ============================================================

describe("checkTravelArrival defensive checks", () => {
  it("should not produce NaN when travel_status is missing arrives_at", () => {
    // Arrange: travel_status exists but lacks arrives_at (corrupt state)
    const db = fakeDb();
    db.set("travel_status", { traveling: true, from: "A", to: "B" });

    // Act
    const status = checkTravelArrival(db);

    // Assert: must not crash and must not produce NaN
    assert.ok(
      status.traveling === false || status.arrived === false,
      `Expected traveling=false or arrived=false, got traveling=${status.traveling} arrived=${status.arrived}`,
    );
    assert.ok(
      !Number.isNaN(status.remaining_minutes ?? 0),
      `remaining_minutes should not be NaN, got ${status.remaining_minutes}`,
    );
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
