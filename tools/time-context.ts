import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSQL } from "../db/connection";
import { dbAdapter } from "./time";
import { buildTimeContext, extractDbPath } from "../engine/time-context";

/**
 * 在 GM 每次回答前（before_agent_start）注入当前游戏时间上下文
 * （时间、时段、未就绪计时器），防止 GM 在叙事中跳过需要真实等待的时间。
 * 注入的消息持久化到会话并在 TUI 显示（display: true），用户可验证其生效。
 * 所有失败路径静默降级（不注入），不影响扩展加载。
 */
export function registerTimeContextHook(pi: ExtensionAPI) {
  let lastDbPath: string | null = null;

  const resolveDbPath = (p: string) =>
    p.startsWith("/") ? p : resolve(process.cwd(), p);

  // 恢复会话中最近使用的存档路径（resume / reload 后生效）
  pi.on("session_start", async (_event, ctx) => {
    try {
      const p = extractDbPath(ctx.sessionManager.getBranch());
      lastDbPath = p ? resolveDbPath(p) : null;
    } catch {
      lastDbPath = null;
    }
  });

  // 跟踪工具调用中的 db_path —— 游戏内工具几乎都携带此参数
  pi.on("tool_call", async (event) => {
    try {
      const p = (event.input as any)?.db_path;
      if (typeof p === "string" && p.length > 0) {
        lastDbPath = resolveDbPath(p);
      }
    } catch {
      // 忽略异常的 input，不影响后续追踪
    }
  });

  // GM 每次回答前注入时间上下文（持久化到会话 + TUI 可见）
  pi.on("before_agent_start", async () => {
    try {
      if (!lastDbPath) return;
      const SQL = await getSQL();
      const sqlDb = new SQL.Database(readFileSync(lastDbPath));
      let text: string;
      try {
        // 包装 set 以追踪副作用（时钟初始化 / 到期计时器清理），
        // 仅在有实际变更时才写回文件，避免每回合冗余写盘。
        // 写盘安全依赖 pi 的单线程顺序事件模型：before_agent_start 与工具执行不会并发。
        const adapter = dbAdapter(sqlDb);
        let dirty = false;
        text = buildTimeContext({
          get: adapter.get,
          set: (key: string, value: any) => {
            dirty = true;
            adapter.set(key, value);
          },
        });
        if (dirty) {
          writeFileSync(lastDbPath, Buffer.from(sqlDb.export()));
        }
      } finally {
        sqlDb.close();
      }
      return {
        message: {
          customType: "chronika-time",
          content: text,
          display: true,
        },
      };
    } catch {
      // db 未初始化 / 文件缺失 / 读取失败 —— 静默降级，不影响扩展运行
      return;
    }
  });
}
