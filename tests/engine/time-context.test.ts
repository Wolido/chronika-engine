import { describe, it } from "node:test";
import assert from "node:assert";
import { buildTimeContext, extractDbPath } from "../../engine/time-context.ts";
import { initGameTime, setTimer } from "../../engine/time.ts";

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
// buildTimeContext — guard logic
// ============================================================

describe("buildTimeContext guard", () => {
  it("should initialize and inject current game time when save exists but clock not started", () => {
    const db = fakeDb();

    const text = buildTimeContext(db);

    assert.ok(text !== null, "expected injection for existing save without clock");
    assert.ok(text!.includes("当前游戏时间"), `missing current game time in: ${text}`);
    assert.ok(db.get("game_start_real") !== null, "clock should be auto-initialized and persisted");
    assert.ok(db.get("game_start_date") !== null, "start date should be persisted");
  });

  it("should include current game time and active timers when clock was never initialized", () => {
    const db = fakeDb();
    setTimer(db, "休息", 45, "恢复体力");

    const text = buildTimeContext(db);

    assert.ok(text !== null, "expected injection for active timers without game clock");
    assert.ok(text!.includes("当前游戏时间"), `missing current game time in: ${text}`);
    assert.ok(text!.includes("休息（恢复体力）"), `missing timer in: ${text}`);
    assert.ok(db.get("game_start_real") !== null, "clock should be auto-initialized and persisted");
  });

  it("should include current game time and active travel timer when clock was never initialized", () => {
    const db = fakeDb();
    setTimer(db, "travel:铁锈镇→东部废墟", 36, "从铁锈镇前往东部废墟");

    const text = buildTimeContext(db);

    assert.ok(text !== null, "expected injection for active travel without game clock");
    assert.ok(text!.includes("当前游戏时间"), `missing current game time in: ${text}`);
    assert.ok(text!.includes("未就绪计时器"), `missing unready timer line in: ${text}`);
    assert.ok(
      text!.includes("travel:铁锈镇→东部废墟（从铁锈镇前往东部废墟）"),
      `missing travel timer in: ${text}`,
    );
    assert.ok(db.get("game_start_real") !== null, "clock should be auto-initialized and persisted");
  });

  it("should initialize and inject current game time when only ready timers exist", () => {
    const db = fakeDb();
    setTimer(db, "已到期的炉子", -1); // ready immediately — auto-cleaned

    const text = buildTimeContext(db);

    assert.ok(text !== null, "expected injection for existing save even with no pending events");
    assert.ok(text!.includes("当前游戏时间"), `missing current game time in: ${text}`);
    assert.ok(db.get("game_start_real") !== null, "clock should be auto-initialized and persisted");
    assert.ok(
      !text!.includes("已到期的炉子"),
      `ready timer should not be listed in: ${text}`,
    );
  });
});

// ============================================================
// buildTimeContext — content
// ============================================================

describe("buildTimeContext content", () => {
  it("should include date and time of day", () => {
    const db = fakeDb();
    initGameTime(db, "2260-06-15T14:30:00");

    const text = buildTimeContext(db)!;

    assert.ok(text.includes("2260-06-15 14:30"), `missing datetime in: ${text}`);
    assert.ok(text.includes("下午"), `missing time of day in: ${text}`);
  });

  it("should mark night time", () => {
    const db = fakeDb();
    initGameTime(db, "2260-01-01T23:00:00");

    const text = buildTimeContext(db)!;

    assert.ok(text.includes("夜间"), `missing night period in: ${text}`);
  });

  it("should omit constraint text when no pending events", () => {
    const db = fakeDb();
    initGameTime(db);

    const text = buildTimeContext(db)!;

    assert.ok(
      !text.includes("严禁跳过或快进等待时间"),
      `unexpected no-skip constraint in: ${text}`,
    );
    assert.ok(
      !text.includes("禁止反复轮询计时器"),
      `unexpected no-polling constraint in: ${text}`,
    );
  });

  it("should include constraint text when a timer is pending", () => {
    const db = fakeDb();
    initGameTime(db);
    setTimer(db, "休息", 45, "恢复体力");

    const text = buildTimeContext(db)!;

    assert.ok(
      text.includes("严禁跳过或快进等待时间"),
      `missing no-skip constraint in: ${text}`,
    );
    assert.ok(
      text.includes("禁止反复轮询计时器"),
      `missing no-polling constraint in: ${text}`,
    );
  });

  it("should include constraint text when a travel timer is pending", () => {
    const db = fakeDb();
    initGameTime(db);
    setTimer(db, "travel:铁锈镇→东部废墟", 36, "从铁锈镇前往东部废墟");

    const text = buildTimeContext(db)!;

    assert.ok(
      text.includes("严禁跳过或快进等待时间"),
      `missing no-skip constraint in: ${text}`,
    );
    assert.ok(
      text.includes("禁止反复轮询计时器"),
      `missing no-polling constraint in: ${text}`,
    );
  });

  it("should omit pending event lines when no timers or travel are active", () => {
    const db = fakeDb();
    initGameTime(db);

    const text = buildTimeContext(db)!;

    assert.ok(!text.includes("旅行中"), `unexpected travel line in: ${text}`);
    assert.ok(!text.includes("未就绪计时器"), `unexpected timer line in: ${text}`);
  });

  it("should include travel timer in unready timers with remaining minutes", () => {
    const db = fakeDb();
    initGameTime(db);
    // 3 km at default 5 km/h = 36 minutes
    setTimer(db, "travel:铁锈镇→东部废墟", 36, "从铁锈镇前往东部废墟");

    const text = buildTimeContext(db)!;

    assert.ok(
      text.includes("未就绪计时器"),
      `missing unready timer line in: ${text}`,
    );
    assert.ok(
      text.includes("travel:铁锈镇→东部废墟（从铁锈镇前往东部废墟）"),
      `missing travel timer in: ${text}`,
    );
    assert.ok(
      /travel:铁锈镇→东部废墟（从铁锈镇前往东部废墟），剩 3[56] 分钟/.test(text),
      `missing remaining minutes in: ${text}`,
    );
    assert.ok(
      !text.includes("旅行中"),
      `should not show a dedicated travel line in: ${text}`,
    );
  });

  it("should omit timer line when there are no timers", () => {
    const db = fakeDb();
    initGameTime(db);

    const text = buildTimeContext(db)!;

    assert.ok(
      !text.includes("未就绪计时器"),
      `unexpected timer line in: ${text}`,
    );
  });

  it("should list only unready timers with remaining minutes", () => {
    const db = fakeDb();
    initGameTime(db);
    setTimer(db, "休息", 45, "恢复体力");
    setTimer(db, "已到期的炉子", -1); // ready immediately — must be excluded

    const text = buildTimeContext(db)!;

    assert.ok(text.includes("未就绪计时器"), `missing timer line in: ${text}`);
    assert.ok(text.includes("休息（恢复体力）"), `missing timer name/description in: ${text}`);
    assert.ok(/休息（恢复体力），剩 4[45] 分钟/.test(text), `missing remaining minutes in: ${text}`);
    assert.ok(
      !text.includes("已到期的炉子"),
      `ready timer should not be listed in: ${text}`,
    );
  });
});

// ============================================================
// extractDbPath
// ============================================================

describe("extractDbPath", () => {
  it("should return null for empty history", () => {
    assert.strictEqual(extractDbPath([]), null);
  });

  it("should return null when no tool call carries db_path", () => {
    const entries = [
      { role: "user", content: "开玩" },
      {
        role: "assistant",
        content: [
          { type: "toolCall", id: "1", name: "roll_dice", arguments: { sides: 6 } },
        ],
      },
    ];
    assert.strictEqual(extractDbPath(entries), null);
  });

  it("should return the db_path from the LAST assistant tool call", () => {
    const entries = [
      {
        role: "assistant",
        content: [
          { type: "toolCall", id: "1", name: "init_db", arguments: { db_path: "./worlds/a.db" } },
        ],
      },
      { role: "toolResult", toolCallId: "1", toolName: "init_db", content: [] },
      {
        role: "assistant",
        content: [
          { type: "toolCall", id: "2", name: "game_time", arguments: { db_path: "./worlds/b.db" } },
        ],
      },
    ];
    assert.strictEqual(extractDbPath(entries), "./worlds/b.db");
  });

  it("should unwrap session branch entries with a message field", () => {
    const entries = [
      { type: "message", id: "abc", message: { role: "user", content: "继续" } },
      {
        type: "message",
        id: "def",
        message: {
          role: "assistant",
          content: [
            { type: "toolCall", id: "1", name: "check_timers", arguments: { db_path: "save.db" } },
          ],
        },
      },
    ];
    assert.strictEqual(extractDbPath(entries), "save.db");
  });

  it("should ignore tool calls whose db_path is not a string", () => {
    const entries = [
      {
        role: "assistant",
        content: [
          { type: "toolCall", id: "1", name: "db_query", arguments: { db_path: 42 } },
        ],
      },
    ];
    assert.strictEqual(extractDbPath(entries), null);
  });
});
