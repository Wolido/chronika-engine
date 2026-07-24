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

  if (!status || !status.traveling) {
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

export function initGameTime(db: any): void {
  db.set("game_start_time", Date.now());
}

export function getGameTime(db: any): number {
  const startTime = db.get("game_start_time");
  if (!startTime) return 0;
  return Date.now() - startTime;
}
