export interface GameTimeInfo {
  elapsed_ms: number;
  elapsed_hours: number;
  elapsed_days: number;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  day_of_week: number;
  day_of_week_name: string;
  time_of_day: string;
  is_night: boolean;
  day_number: number;
}

export interface QuickTravelInput {
  db: any;
  from: string;
  to: string;
  distance_km: number;
  speed_kmh?: number; // 默认 5
}

export interface QuickTravelResult {
  success: boolean;
  from: string;
  to: string;
  distance_km: number;
  travel_time_minutes: number;
  arrives_at: number; // 到达的 Unix 时间戳（ms）
  error?: string;
}

export interface TravelStatus {
  traveling: boolean;
  from?: string;
  to?: string;
  arrives_at?: number;
  remaining_minutes?: number;
  arrived: boolean;
}

export function startQuickTravel(input: QuickTravelInput): QuickTravelResult {
  if (!(input.distance_km > 0)) {
    return { success: false, from: input.from, to: input.to, distance_km: input.distance_km, travel_time_minutes: 0, arrives_at: 0, error: "Distance must be positive" };
  }
  const speed = input.speed_kmh ?? 5;
  if (!(speed > 0)) {
    return { success: false, from: input.from, to: input.to, distance_km: input.distance_km, travel_time_minutes: 0, arrives_at: 0, error: "Speed must be positive" };
  }
  const travelTimeHours = input.distance_km / speed;
  const travelTimeMinutes = Math.round(travelTimeHours * 60);
  const travelTimeMs = travelTimeMinutes * 60 * 1000;
  const arrivesAt = Date.now() + travelTimeMs;

  // Store travel state via db.set
  input.db.set("travel_status", {
    traveling: true,
    from: input.from,
    to: input.to,
    arrives_at: arrivesAt,
  });

  return {
    success: true,
    from: input.from,
    to: input.to,
    distance_km: input.distance_km,
    travel_time_minutes: travelTimeMinutes,
    arrives_at: arrivesAt,
  };
}

export function checkTravelArrival(db: any): TravelStatus {
  const status = db.get("travel_status");

  if (!status || !status.traveling || typeof status.arrives_at !== 'number' || Number.isNaN(status.arrives_at)) {
    if (status) db.set("travel_status", null);
    return { traveling: false, arrived: false };
  }

  const now = Date.now();
  const arrived = now >= status.arrives_at;

  if (arrived) {
    // Clear travel state
    db.set("travel_status", null);
    return {
      traveling: false,
      from: status.from,
      to: status.to,
      arrives_at: status.arrives_at,
      remaining_minutes: 0,
      arrived: true,
    };
  }

  const remainingMs = status.arrives_at - now;
  const remainingMinutes = Math.ceil(remainingMs / 60000);

  return {
    traveling: true,
    from: status.from,
    to: status.to,
    arrives_at: status.arrives_at,
    remaining_minutes: remainingMinutes,
    arrived: false,
  };
}

export interface TimerEntry {
  name: string;
  description?: string;
  arrives_at: number;
}

export interface TimerStatus {
  name: string;
  description?: string;
  remaining_minutes: number;
  ready: boolean;
}

export function setTimer(db: any, name: string, minutes: number, description?: string): TimerEntry {
  const timers: TimerEntry[] = db.get("timers") || [];
  const existing = timers.findIndex(t => t.name === name);
  const entry: TimerEntry = { name, description, arrives_at: Date.now() + minutes * 60 * 1000 };
  if (existing >= 0) {
    timers[existing] = entry;
  } else {
    timers.push(entry);
  }
  db.set("timers", timers);
  return entry;
}

export function checkTimers(db: any): TimerStatus[] {
  const timers: TimerEntry[] = db.get("timers") || [];
  const now = Date.now();
  const result = timers.map(t => ({
    name: t.name,
    description: t.description,
    remaining_minutes: Math.max(0, Math.ceil((t.arrives_at - now) / 60000)),
    ready: now >= t.arrives_at,
  }));
  // Auto-clean ready timers
  const remaining = timers.filter(t => now < t.arrives_at);
  if (remaining.length !== timers.length) {
    db.set("timers", remaining);
  }
  return result;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_OF_DAY = [
  { start: 5, label: "凌晨", night: false },
  { start: 7, label: "早晨", night: false },
  { start: 9, label: "上午", night: false },
  { start: 12, label: "中午", night: false },
  { start: 13, label: "下午", night: false },
  { start: 17, label: "傍晚", night: false },
  { start: 19, label: "夜间", night: true },
  { start: 24, label: "夜间", night: true },
];

function getTimeOfDay(hour: number): { label: string; night: boolean } {
  for (const period of TIME_OF_DAY) {
    if (hour < period.start) {
      const prev = TIME_OF_DAY[TIME_OF_DAY.indexOf(period) - 1] || TIME_OF_DAY[TIME_OF_DAY.length - 1];
      return { label: prev.label, night: prev.night };
    }
  }
  return { label: "夜间", night: true };
}

export function initGameTime(db: any, startDateStr?: string): void {
  db.set("game_start_real", Date.now());
  db.set("game_start_date", startDateStr || new Date().toISOString());
}

export function getGameTime(db: any): number {
  const startReal = db.get("game_start_real");
  if (!startReal) {
    initGameTime(db); // 自动初始化
    return 0;
  }
  return Date.now() - startReal;
}

export function getFullTime(db: any): GameTimeInfo {
  let startReal = db.get("game_start_real");
  if (!startReal) {
    initGameTime(db); // 自动初始化
    startReal = db.get("game_start_real");
  }
  const startDateStr = db.get("game_start_date") || new Date().toISOString();

  const elapsed = Date.now() - startReal;
  let startDate = new Date(startDateStr);
  if (isNaN(startDate.getTime())) {
    startDate = new Date();
  }
  const currentDate = new Date(startDate.getTime() + elapsed);

  const hour = currentDate.getHours();
  const minute = currentDate.getMinutes();
  const period = getTimeOfDay(hour);

  return {
    elapsed_ms: elapsed,
    elapsed_hours: Math.round(elapsed / 360000) / 10,
    elapsed_days: Math.floor(elapsed / 86400000),
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
    day: currentDate.getDate(),
    hour,
    minute,
    day_of_week: currentDate.getDay(),
    day_of_week_name: WEEKDAY_NAMES[currentDate.getDay()],
    time_of_day: period.label,
    is_night: period.night,
    day_number: Math.floor(elapsed / 86400000) + 1,
  };
}
