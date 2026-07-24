export interface LogEventInput {
  event_type: string;
  summary: string;
  detail?: string;
  turn?: number;
}

export interface LogEventResult {
  success: boolean;
  event_id: number;
  turn: number;
}

export interface HistoryInput {
  limit?: number;
  event_type?: string;
  since_id?: number;
}

export interface HistoryEntry {
  id: number;
  turn: number;
  event_type: string;
  summary: string;
  detail: string | null;
  created_at: string;
}

export interface HistoryResult {
  events: HistoryEntry[];
  total: number;
}

export function logEvent(db: any, input: LogEventInput): LogEventResult {
  // Auto-increment turn: find max turn, add 1
  const maxTurnResult = db.exec("SELECT COALESCE(MAX(turn), 0) as max_turn FROM event_log");
  const nextTurn = input.turn ?? (maxTurnResult[0]?.values[0]?.[0] ?? 0) + 1;

  db.run(
    "INSERT INTO event_log (turn, event_type, summary, detail) VALUES (?, ?, ?, ?)",
    [nextTurn, input.event_type, input.summary, input.detail || null]
  );

  const idResult = db.exec("SELECT last_insert_rowid() as id");
  const eventId = idResult[0]?.values[0]?.[0] ?? 0;

  return { success: true, event_id: eventId as number, turn: nextTurn };
}

export function getHistory(db: any, input?: HistoryInput): HistoryResult {
  const limit = input?.limit ?? 20;
  const conditions: string[] = [];
  const params: any[] = [];

  if (input?.event_type) {
    conditions.push("event_type = ?");
    params.push(input.event_type);
  }
  if (input?.since_id) {
    conditions.push("id > ?");
    params.push(input.since_id);
  }

  const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  // Count total matching events
  let total = 0;
  if (params.length > 0) {
    const stmt = db.prepare(`SELECT COUNT(*) as total FROM event_log ${whereClause}`);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      total = row.total as number;
    }
    stmt.free();
  } else {
    const r = db.exec("SELECT COUNT(*) as total FROM event_log");
    total = r[0]?.values[0]?.[0] ?? 0;
  }

  // Query events
  const query = `SELECT id, turn, event_type, summary, detail, created_at FROM event_log ${whereClause} ORDER BY id DESC LIMIT ?`;
  const allParams = [...params, limit];

  const stmt = db.prepare(query);
  stmt.bind(allParams);
  const events: HistoryEntry[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    events.push({
      id: row.id as number,
      turn: row.turn as number,
      event_type: row.event_type as string,
      summary: row.summary as string,
      detail: row.detail as string | null,
      created_at: row.created_at as string,
    });
  }
  stmt.free();

  return { events, total };
}
