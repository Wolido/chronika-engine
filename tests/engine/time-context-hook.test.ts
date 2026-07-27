import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { getSQL } from "../../db/connection.ts";
import { registerTimeContextHook } from "../../tools/time-context.ts";

// ============================================================
// Helpers
// ============================================================

function mockPi() {
  const handlers: Record<string, any[]> = {};
  return {
    handlers,
    on: (event: string, handler: any) => {
      (handlers[event] ||= []).push(handler);
    },
  };
}

async function createEmptyDbFile(filePath: string): Promise<void> {
  const SQL = await getSQL();
  const db = new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS game_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  writeFileSync(filePath, Buffer.from(db.export()));
  db.close();
}

async function readGameState(filePath: string): Promise<Record<string, any>> {
  const SQL = await getSQL();
  const buffer = readFileSync(filePath);
  const db = new SQL.Database(buffer);
  const result = db.exec("SELECT key, value FROM game_state");
  const state: Record<string, any> = {};
  if (result.length > 0) {
    for (const row of result[0].values) {
      state[row[0] as string] = JSON.parse(row[1] as string);
    }
  }
  db.close();
  return state;
}

async function trigger(pi: any, event: string, ...args: any[]) {
  for (const handler of pi.handlers[event] || []) {
    await handler(...args);
  }
}

async function triggerBeforeAgentStart(pi: any): Promise<any> {
  const handlers = pi.handlers["before_agent_start"] || [];
  assert.strictEqual(handlers.length, 1, "expected a single before_agent_start handler");
  return handlers[0]();
}

// ============================================================
// Tests
// ============================================================

let tempDir: string;

before(() => {
  tempDir = mkdtempSync(resolve(tmpdir(), "chronika-time-context-hook-"));
});

after(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("registerTimeContextHook", () => {
  it("should persist clock when injecting into a save that has no game_start_real", async () => {
    // Arrange
    const pi = mockPi();
    registerTimeContextHook(pi);
    const dbPath = resolve(tempDir, "no-clock.db");
    await createEmptyDbFile(dbPath);

    // Let the hook learn the current save path
    await trigger(pi, "tool_call", { input: { db_path: dbPath } });

    // Act
    const result = await triggerBeforeAgentStart(pi);

    // Assert: injection happened and includes the current game time
    assert.ok(result?.message, "expected a time context message to be injected");
    assert.ok(
      result.message.content.includes("当前游戏时间"),
      `missing current game time in: ${result.message.content}`,
    );

    // Assert: the in-memory clock initialization was flushed back to disk
    const state = await readGameState(dbPath);
    assert.ok(
      typeof state.game_start_real === "number",
      `game_start_real should be persisted after injection, got ${state.game_start_real}`,
    );
    assert.ok(
      typeof state.game_start_date === "string",
      `game_start_date should be persisted after injection, got ${state.game_start_date}`,
    );
  });

  it("should inject current game time even when there are no timers or travel", async () => {
    // Arrange
    const pi = mockPi();
    registerTimeContextHook(pi);
    const dbPath = resolve(tempDir, "empty-save.db");
    await createEmptyDbFile(dbPath);

    await trigger(pi, "tool_call", { input: { db_path: dbPath } });

    // Act
    const result = await triggerBeforeAgentStart(pi);

    // Assert
    assert.ok(result?.message, "expected injection for an empty but known save");
    assert.ok(
      result.message.content.includes("当前游戏时间"),
      `missing current game time in: ${result.message.content}`,
    );
    assert.ok(
      !result.message.content.includes("旅行中"),
      `should not include travel line in: ${result.message.content}`,
    );
    assert.ok(
      !result.message.content.includes("未就绪计时器"),
      `should not include timer line in: ${result.message.content}`,
    );
  });

  it("should silently skip when no db path is known", async () => {
    // Arrange
    const pi = mockPi();
    registerTimeContextHook(pi);

    // Act
    const message = await triggerBeforeAgentStart(pi);

    // Assert
    assert.strictEqual(
      message,
      undefined,
      "should not inject anything when no save path is known",
    );
  });

  it("should silently skip without throwing when the db file is corrupt or deleted", async () => {
    // Arrange: corrupt file (not a valid sqlite database)
    const pi = mockPi();
    registerTimeContextHook(pi);
    const corruptPath = resolve(tempDir, "corrupt.db");
    writeFileSync(corruptPath, Buffer.from("this is not a sqlite database"));
    const missingPath = resolve(tempDir, "deleted.db"); // never created

    // Act & Assert: corrupt file — no throw, no injection
    await trigger(pi, "tool_call", { input: { db_path: corruptPath } });
    const corruptResult = await triggerBeforeAgentStart(pi);
    assert.strictEqual(
      corruptResult,
      undefined,
      "should silently skip on a corrupt db file",
    );

    // Act & Assert: deleted file — no throw, no injection
    await trigger(pi, "tool_call", { input: { db_path: missingPath } });
    const missingResult = await triggerBeforeAgentStart(pi);
    assert.strictEqual(
      missingResult,
      undefined,
      "should silently skip on a deleted db file",
    );
  });
});
