import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { getSQL } from "../../db/connection.ts";
import { DDL_STATEMENTS } from "../../db/schema.ts";
import {
  logEvent,
  getHistory,
  type LogEventInput,
  type LogEventResult,
  type HistoryInput,
  type HistoryEntry,
  type HistoryResult,
} from "../../engine/event-log.ts";

// ============================================================
// Helpers
// ============================================================

async function createDB(): Promise<any> {
  const SQL = await getSQL();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON");
  db.run(DDL_STATEMENTS);
  return db;
}

// ============================================================
// logEvent
// ============================================================

describe("logEvent", () => {
  it("should return success=true and a positive event_id when logging a combat event", async () => {
    const db = await createDB();

    const input: LogEventInput = {
      event_type: "combat",
      summary: "Player attacked a raider",
      detail: JSON.stringify({ damage: 15 }),
      turn: 1,
    };

    const result: LogEventResult = logEvent(db, input);

    assert.strictEqual(result.success, true);
    assert.ok(result.event_id > 0, "event_id should be a positive number");
  });

  it("should auto-increment turn when logging 3 consecutive events", async () => {
    const db = await createDB();

    const result1: LogEventResult = logEvent(db, {
      event_type: "combat",
      summary: "First event",
    });

    const result2: LogEventResult = logEvent(db, {
      event_type: "exploration",
      summary: "Second event",
    });

    const result3: LogEventResult = logEvent(db, {
      event_type: "loot",
      summary: "Third event",
    });

    assert.strictEqual(result1.turn, 1);
    assert.strictEqual(result2.turn, 2);
    assert.strictEqual(result3.turn, 3);
  });

  it("should log an event when only required fields are provided", async () => {
    const db = await createDB();

    const input: LogEventInput = {
      event_type: "system",
      summary: "System initialized",
    };

    const result: LogEventResult = logEvent(db, input);

    assert.strictEqual(result.success, true);
    assert.ok(result.event_id > 0, "event_id should be a positive number");

    const history: HistoryResult = getHistory(db);
    const entry: HistoryEntry = history.events[0];

    assert.strictEqual(entry.event_type, "system");
    assert.strictEqual(entry.summary, "System initialized");
    assert.strictEqual(entry.detail, null);
  });
});

// ============================================================
// getHistory
// ============================================================

describe("getHistory", () => {
  it("should return the most recent events limited by limit and ordered by id desc", async () => {
    const db = await createDB();

    for (let i = 1; i <= 5; i++) {
      logEvent(db, {
        event_type: "narrative",
        summary: `Event ${i}`,
      });
    }

    const result: HistoryResult = getHistory(db, { limit: 3 });

    assert.strictEqual(result.events.length, 3);
    assert.strictEqual(result.total, 5);

    for (let i = 0; i < result.events.length - 1; i++) {
      assert.ok(
        result.events[i].id > result.events[i + 1].id,
        "events should be ordered by id descending",
      );
    }
  });

  it("should filter events by event_type", async () => {
    const db = await createDB();

    logEvent(db, { event_type: "combat", summary: "Combat 1" });
    logEvent(db, { event_type: "combat", summary: "Combat 2" });
    logEvent(db, { event_type: "loot", summary: "Loot 1" });

    const result: HistoryResult = getHistory(db, { event_type: "combat" });

    assert.strictEqual(result.events.length, 2);
    assert.strictEqual(result.total, 2);

    for (const entry of result.events) {
      assert.strictEqual(entry.event_type, "combat");
    }
  });

  it("should return an empty array for a fresh database", async () => {
    const db = await createDB();

    const result: HistoryResult = getHistory(db);

    assert.deepStrictEqual(result.events, []);
    assert.strictEqual(result.total, 0);
  });
});
