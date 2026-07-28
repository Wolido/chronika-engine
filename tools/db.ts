import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DDL_STATEMENTS, SCHEMA_VERSION } from "../db/schema";
import { SEED_MONSTERS, SEED_ITEMS, SEED_STATUS_EFFECTS, SEED_LOCATIONS, SEED_CONNECTIONS } from "../db/seed";
import { getSQL, rowsToObjects } from "../db/connection";

function resolvePath(inputPath: string): string {
  if (inputPath.startsWith("/")) return inputPath;
  if (inputPath.startsWith("~")) {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    return inputPath.replace("~", home);
  }
  return resolve(process.cwd(), inputPath);
}

export function registerDBTools(pi: ExtensionAPI) {
  // ── db_query: 只读查询 ──
  pi.registerTool({
    name: "db_query",
    label: "DB Query",
    description: "Execute a SELECT query on a Chronika game database. Returns matching rows as a JSON array. READ-ONLY — does not modify data.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to the SQLite database file" }),
      sql: Type.String({ description: "SELECT statement to execute" }),
      params: Type.Optional(Type.Array(Type.Any(), { description: "Parameter values for prepared statement" })),
    }),
    async execute(_toolCallId, params) {
      try {
        const resolved = resolvePath(params.db_path);
        const SQL = await getSQL();
        const buffer = readFileSync(resolved);
        const db = new SQL.Database(buffer);

        let rows: Record<string, any>[];
        if (params.params && params.params.length > 0) {
          const stmt = db.prepare(params.sql);
          stmt.bind(params.params);
          rows = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.free();
        } else {
          const results = db.exec(params.sql);
          rows = rowsToObjects(results);
        }

        db.close();

        return {
          content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
          details: { rows, count: rows.length, sql: params.sql },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ Query error: ${msg}` }],
          details: { error: msg, sql: params.sql },
          isError: true,
        };
      }
    },
  });

  // ── db_exec: 写入操作 ──
  pi.registerTool({
    name: "db_exec",
    label: "DB Exec",
    description: "Execute INSERT, UPDATE, DELETE, or DDL statements on a Chronika game database. Returns affected row count and last insert ID.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to the SQLite database file" }),
      sql: Type.String({ description: "SQL statement to execute" }),
      params: Type.Optional(Type.Array(Type.Any(), { description: "Parameter values for prepared statement" })),
    }),
    async execute(_toolCallId, params) {
      try {
        const resolved = resolvePath(params.db_path);
        const SQL = await getSQL();

        let db: any;
        if (existsSync(resolved)) {
          const buffer = readFileSync(resolved);
          db = new SQL.Database(buffer);
        } else {
          db = new SQL.Database();
          db.run("PRAGMA foreign_keys = ON");
        }

        if (params.params && params.params.length > 0) {
          db.run(params.sql, params.params);
        } else {
          db.run(params.sql);
        }

        const changes = db.getRowsModified();

        let lastInsertRowid: number | undefined;
        const upperSql = params.sql.trim().toUpperCase();
        if (upperSql.startsWith("INSERT")) {
          const result = db.exec("SELECT last_insert_rowid() as id");
          if (result.length > 0 && result[0].values.length > 0) {
            lastInsertRowid = result[0].values[0][0] as number;
          }
        }

        const data = db.export();
        writeFileSync(resolved, Buffer.from(data));
        db.close();

        return {
          content: [{
            type: "text",
            text: `✅ ${changes} row(s) affected` +
              (lastInsertRowid !== undefined ? `, last insert ID: ${lastInsertRowid}` : ""),
          }],
          details: { changes, lastInsertRowid, sql: params.sql },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ Execute error: ${msg}` }],
          details: { error: msg, sql: params.sql },
          isError: true,
        };
      }
    },
  });

  // ── init_db: 创建新数据库 ──
  pi.registerTool({
    name: "init_db",
    label: "Init DB",
    description: "Create a new database for a wasteland survival RPG. Initializes 21 tables including locations, weapons, monsters, items, etc. Call this first when starting a new game. The world is a post-nuclear wasteland where survivors scavenge, fight mutants, and struggle to survive. On creation, automatically populates the database with 75 monsters, 13 items, 12 status effects, 15 locations with connections. Weapons, armor, and accessories are not seeded — generate them with generate_weapon during gameplay. The world is ready to play after this command — no additional world generation is needed.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path where to create the database (e.g. './worlds/my_game.db')" }),
      world_name: Type.Optional(Type.String({ description: "Optional world name stored in world_meta" })),
    }),
    async execute(_toolCallId, params) {
      try {
        const resolved = resolvePath(params.db_path);

        if (existsSync(resolved)) {
          return {
            content: [{ type: "text", text: `ℹ️ Database already exists at \`${resolved}\`. Schema is already in place.` }],
            details: { db_path: resolved, already_exists: true },
          };
        }

        mkdirSync(dirname(resolved), { recursive: true });

        const SQL = await getSQL();
        const db = new SQL.Database();
        db.run("PRAGMA foreign_keys = ON");
        db.run(DDL_STATEMENTS);

        // 插入种子数据
        insertSeedData(db, params.world_name, params.world_name ? `初始区域` : undefined);

        if (params.world_name) {
          db.run("INSERT INTO world_meta (world_name) VALUES (?)", [params.world_name]);
        }

        const data = db.export();
        writeFileSync(resolved, Buffer.from(data));
        db.close();

        return {
          content: [{
            type: "text",
            text: `✅ 世界已创建！数据库位于 \`${resolved}\`\n世界已就绪：75 种怪物、15 个地点、基础物品和状态效果均已就位。\n下一步：用 create_character 创建你的角色开始游戏！` +
              (params.world_name ? `\nWorld: ${params.world_name}` : ""),
          }],
          details: {
            db_path: resolved,
            schema_version: SCHEMA_VERSION,
            world_name: params.world_name || null,
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `❌ Failed to create database: ${msg}` }],
          details: { error: msg },
          isError: true,
        };
      }
    },
  });

  // ── insertSeedData: 插入种子数据 ──
  function insertSeedData(db: any, worldName?: string, region?: string): void {
    // 怪物
    const monsterCols = ["name", "category", "hp", "damage_min", "damage_max", "accuracy", "evasion", "armor", "tier", "xp_reward", "strength", "agility", "endurance", "perception", "intelligence", "willpower"];
    for (const m of SEED_MONSTERS) {
      const vals = monsterCols.map(c => (m as any)[c] ?? null);
      db.run(`INSERT OR IGNORE INTO monsters (${monsterCols.join(", ")}) VALUES (${vals.map(() => "?").join(", ")})`, vals);
    }

    // 物品
    const itemCols = ["name", "item_type", "rarity", "value", "weight", "effect_type", "effect_value", "stackable", "stack_max"];
    for (const it of SEED_ITEMS) {
      const vals = itemCols.map(c => (it as any)[c] ?? null);
      db.run(`INSERT OR IGNORE INTO items (${itemCols.join(", ")}) VALUES (${vals.map(() => "?").join(", ")})`, vals);
    }

    // 状态效果
    const effectCols = ["name", "effect_type", "target_attribute", "magnitude", "duration", "description"];
    for (const e of SEED_STATUS_EFFECTS) {
      const vals = effectCols.map(c => (e as any)[c] ?? null);
      db.run(`INSERT OR IGNORE INTO status_effects (${effectCols.join(", ")}) VALUES (${vals.map(() => "?").join(", ")})`, vals);
    }

    // 地点
    const locCols = ["name", "region", "description", "danger_level", "has_shelter"];
    for (const l of SEED_LOCATIONS) {
      const vals = locCols.map(c => (l as any)[c] ?? null);
      db.run(`INSERT OR IGNORE INTO locations (name, region, description, danger_level, has_shelter, discovered, visited) VALUES (?, ?, ?, ?, ?, 1, 0)`, vals);
    }

    // 地点连接
    const connCols = ["from_location", "to_location", "distance_km", "description"];
    for (const c of SEED_CONNECTIONS) {
      const vals = connCols.map(col => (c as any)[col] ?? null);
      db.run(`INSERT OR IGNORE INTO location_connections (${connCols.join(", ")}) VALUES (${vals.map(() => "?").join(", ")})`, vals);
    }
  }
}
