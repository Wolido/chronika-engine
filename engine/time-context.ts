import { getFullTime, checkTimers } from "./time.ts";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 构建注入 GM 上下文的时间摘要（每次 GM 回答前注入，提醒当前时间与等待状态）。
 * 只要存档可用就始终返回文本。
 *
 * 副作用（均通过 db.set，调用方需自行决定是否持久化到磁盘）：
 * - 时钟不存在时 getFullTime 自动初始化（写入 game_start_real / game_start_date）
 * - checkTimers 清理已就绪计时器（写入 timers）
 */
export function buildTimeContext(db: any): string {
  const info = getFullTime(db); // 无时钟时自动初始化（db.set 副作用）
  const pendingTimers = checkTimers(db).filter((t) => !t.ready);

  const lines: string[] = [];

  const date = `${info.year}-${pad(info.month)}-${pad(info.day)}`;
  const time = `${pad(info.hour)}:${pad(info.minute)}`;
  lines.push(
    `[Chronika 时间] 当前游戏时间：${date} ${time} ${info.day_of_week_name}（${info.time_of_day}）`,
  );

  if (pendingTimers.length > 0) {
    const list = pendingTimers
      .map(
        (t) =>
          `${t.name}${t.description ? `（${t.description}）` : ""}，剩 ${t.remaining_minutes} 分钟`,
      )
      .join("；");
    lines.push(`未就绪计时器：${list}`);
  }

  // 约束行仅在有等待事件（未就绪计时器）时追加；无等待事件只输出时间行
  if (pendingTimers.length > 0) {
    lines.push(
      "约束：游戏时间与现实时间 1:1 同步。严禁跳过或快进等待时间；旅行到达目的地或计时器就绪之前，相关事件不得提前发生或完成。禁止反复轮询计时器——等待状态会随每回合自动注入更新，无需反复调用 check_timers。",
    );
  }

  return lines.join("\n");
}

/**
 * 从会话历史（branch entries 或裸消息）中提取最近一个工具调用携带的 db_path。
 * 用于在 resume / reload 后恢复"当前存档"，找不到时返回 null。
 */
export function extractDbPath(entries: any[]): string | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const msg = entries[i]?.message ?? entries[i];
    if (msg?.role !== "assistant" || !Array.isArray(msg.content)) continue;
    for (const part of msg.content) {
      if (part?.type === "toolCall" && typeof part.arguments?.db_path === "string") {
        return part.arguments.db_path;
      }
    }
  }
  return null;
}
