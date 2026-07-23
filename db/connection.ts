import initSqlJs from "sql.js";
import type { SqlJsStatic, QueryExecResult } from "sql.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let sqlInitPromise: Promise<SqlJsStatic> | null = null;

export async function getSQL(): Promise<SqlJsStatic> {
  if (!sqlInitPromise) {
    sqlInitPromise = initSqlJs({
      // sql-wasm.wasm 位于 node_modules/sql.js/dist/ 下
      // 相对于当前模块路径 (db/connection.ts) 的上一层
      locateFile: (file: string) => {
        return resolve(__dirname, "..", "node_modules/sql.js/dist", file);
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
