import { describe, it } from "node:test";
import assert from "node:assert";
import { rowsToObjects } from "../../db/connection.ts";
import type { QueryExecResult } from "sql.js";

describe("rowsToObjects", () => {
  it("should return empty array for empty input", () => {
    const result = rowsToObjects([]);
    assert.deepStrictEqual(result, []);
  });

  it("should convert a single QueryExecResult to an array of objects", () => {
    const input: QueryExecResult[] = [
      {
        columns: ["id", "name"],
        values: [
          [1, "foo"],
          [2, "bar"],
        ],
      },
    ];

    const result = rowsToObjects(input);

    assert.deepStrictEqual(result, [
      { id: 1, name: "foo" },
      { id: 2, name: "bar" },
    ]);
  });

  it("should handle multiple QueryExecResults", () => {
    const input: QueryExecResult[] = [
      {
        columns: ["a"],
        values: [[1], [2]],
      },
      {
        columns: ["b"],
        values: [[3]],
      },
    ];

    const result = rowsToObjects(input);

    assert.deepStrictEqual(result, [{ a: 1 }, { a: 2 }, { b: 3 }]);
  });

  it("should handle empty columns and values", () => {
    const input: QueryExecResult[] = [
      { columns: [], values: [] },
    ];

    const result = rowsToObjects(input);
    assert.deepStrictEqual(result, []);
  });
});
