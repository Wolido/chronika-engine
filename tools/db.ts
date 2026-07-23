import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DDL_STATEMENTS, SCHEMA_VERSION } from "../db/schema";
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
    description: "Create a new Chronika game database file with the complete schema (tables: world_meta, characters, weapons, items, monsters, inventory, event_log, game_state, plugin_registry, status_effects, actions). Safe to call if file already exists — returns info without overwriting.",
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

        if (params.world_name) {
          db.run("INSERT INTO world_meta (world_name) VALUES (?)", [params.world_name]);
        }

        const data = db.export();
        writeFileSync(resolved, Buffer.from(data));
        db.close();

        return {
          content: [{
            type: "text",
            text: `✅ Created game database at \`${resolved}\`\nSchema: 11 tables, version ${SCHEMA_VERSION}` +
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
}
