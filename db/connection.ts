import initSqlJs from "sql.js";
import type { SqlJsStatic, QueryExecResult } from "sql.js";
import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);
const wasmPath = _require.resolve("sql.js/dist/sql-wasm.wasm");

let sqlInitPromise: Promise<SqlJsStatic> | null = null;

export async function getSQL(): Promise<SqlJsStatic> {
  if (!sqlInitPromise) {
    sqlInitPromise = initSqlJs({
      locateFile: (file: string) => {
        // Use Node's standard module resolution to find sql-wasm.wasm
        return wasmPath.replace("sql-wasm.wasm", file);
      },
    }).catch((err) => {
      sqlInitPromise = null; // Reset on failure so retry works
      throw err;
    });
  }
  return sqlInitPromise;
}

/**
 * 将 sql.js 的 QueryExecResult[] 转为对象数组
 */
export function rowsToObjects(results: QueryExecResult[]): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  for (const result of results) {
    const { columns, values } = result;
    for (const row of values) {
      const obj: Record<string, any> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      rows.push(obj);
    }
  }
  return rows;
}
