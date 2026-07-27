import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { getSQL } from "../../db/connection.ts";
import { registerTimeTools } from "../../tools/time.ts";

// ============================================================
// Helpers
// ============================================================

function mockPi() {
  const tools: Record<string, any> = {};
  return {
    tools,
    registerTool: (tool: any) => {
      tools[tool.name] = tool;
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

// ============================================================
// Tests
// ============================================================

let tempDir: string;

before(() => {
  tempDir = mkdtempSync(resolve(tmpdir(), "chronika-time-persistence-"));
});

after(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("game_time tool persistence", () => {
  it("should persist game_start_real to disk on first call", async () => {
    // Arrange
    const pi = mockPi();
    registerTimeTools(pi);
    const dbPath = resolve(tempDir, "game.db");
    await createEmptyDbFile(dbPath);

    const tool = pi.tools["game_time"];
    assert.ok(tool, "game_time tool should be registered");

    // Act
    const result = await tool.execute("call-1", { db_path: dbPath });

    // Assert: the tool returned a time string
    assert.ok(
      result.content[0].text.includes("Day"),
      `expected time text, got: ${result.content[0].text}`,
    );

    // Assert: the auto-initialized clock was written back to the .db file
    const state = await readGameState(dbPath);
    assert.ok(
      typeof state.game_start_real === "number",
      `game_start_real should be persisted in the db file, got ${state.game_start_real}`,
    );
    assert.ok(
      typeof state.game_start_date === "string",
      `game_start_date should be persisted in the db file, got ${state.game_start_date}`,
    );
  });
});
