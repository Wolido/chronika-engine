// exploration.ts — 探索 / 地图系统引擎
//
// 提供 discoverLocation / travel / explore / getKnownMap 四个纯函数，
// 直接操作 sql.js Database 实例。

import type { AccessoryData } from "./legendary-gen.ts";
import { startQuickTravel } from "./time.ts";

function rollD100(): number {
  return Math.floor(Math.random() * 100) + 1;
}

// ---------------------------------------------------------------------------
// SQL helpers — sql.js 的 exec() 不支持参数绑定，用 prepare + bind 代替
// ---------------------------------------------------------------------------

/**
 * 执行参数化查询，返回与 db.exec() 兼容的结果数组。
 * 每条结果包含 columns 和 values（二维数组）。
 */
function queryExec(db: any, sql: string, params: any[] = []): { columns: string[]; values: any[][] }[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows: any[][] = [];
  let columns: string[] = [];
  while (stmt.step()) {
    const obj = stmt.getAsObject();
    if (columns.length === 0) {
      columns = Object.keys(obj);
    }
    rows.push(columns.map(c => obj[c]));
  }
  stmt.free();
  return rows.length > 0 ? [{ columns, values: rows }] : [];
}

// ---------------------------------------------------------------------------
// discoverLocation
// ---------------------------------------------------------------------------

export interface DiscoverInput {
  name: string;
  connected_to: string;
  description: string;
  region?: string;
  danger_level?: number;
  distance_km?: number;
  connection_description?: string;
  has_shelter?: boolean;
}

export interface DiscoverResult {
  success: boolean;
  location_name: string;
  connection: { from: string; to: string };
  total_locations: number;
  error?: string;
}

export function discoverLocation(db: any, input: DiscoverInput): DiscoverResult {
  // Check if location already exists
  const existing = queryExec(db, "SELECT name FROM locations WHERE name = ?", [input.name]);
  if (existing.length > 0 && existing[0].values.length > 0) {
    return { success: false, location_name: input.name, connection: { from: "", to: "" }, total_locations: 0, error: `Location "${input.name}" already exists` };
  }

  // Check if connected_to exists
  const source = queryExec(db, "SELECT name FROM locations WHERE name = ?", [input.connected_to]);
  if (source.length === 0 || source[0].values.length === 0) {
    return { success: false, location_name: input.name, connection: { from: "", to: "" }, total_locations: 0, error: `Source location "${input.connected_to}" not found` };
  }

  // Create location
  db.run(
    "INSERT INTO locations (name, region, description, danger_level, has_shelter, discovered, visited) VALUES (?, ?, ?, ?, ?, 1, 1)",
    [input.name, input.region || null, input.description, input.danger_level ?? 1, input.has_shelter ? 1 : 0]
  );

  // Create connection
  db.run(
    "INSERT INTO location_connections (from_location, to_location, distance_km, description) VALUES (?, ?, ?, ?)",
    [input.connected_to, input.name, input.distance_km ?? 1.0, input.connection_description || null]
  );

  // Count total discovered
  const countResult = db.exec("SELECT COUNT(*) as c FROM locations WHERE discovered = 1");
  const total = countResult[0]?.values[0]?.[0] ?? 1;

  return { success: true, location_name: input.name, connection: { from: input.connected_to, to: input.name }, total_locations: total as number };
}

// ---------------------------------------------------------------------------
// travel
// ---------------------------------------------------------------------------

export interface TravelInput {
  current_location: string;
  target_location: string;
  stealth?: number;
  tracking?: number;
  accessories?: AccessoryData[];
  use_quick_travel?: boolean; // default true — 走现实时间，用 check_arrival 查询到达
}

export interface TravelEncounter {
  triggered: boolean;
  encounter_type?: string;
  description?: string;
  danger_level?: number;
}

export interface TravelResult {
  success: boolean;
  from: string;
  to: string;
  distance_km: number;
  encounter: TravelEncounter;
  tracking_discovery?: boolean;
  tracking_detail?: string;
  accessory_stealth_bonus?: number;
  accessory_danger_sense?: boolean;
  accessory_movement_speed?: number;
  travel_time_minutes?: number;
  arrives_at?: number;
  error?: string;
}

/** 汇总旅行类饰品（on_travel / passive 触发器）的加成。 */
function travelAccessoryBonuses(accessories: AccessoryData[] | undefined) {
  let stealthBonus = 0;
  let movementSpeed = 0;
  let dangerSense = false;
  for (const acc of accessories ?? []) {
    if (acc.trigger !== "on_travel" && acc.trigger !== "passive") continue;
    if (acc.effect_type === "stealth_field") stealthBonus += acc.magnitude;
    else if (acc.effect_type === "movement_speed") movementSpeed += acc.magnitude;
    else if (acc.effect_type === "danger_sense") dangerSense = true;
  }
  return { stealthBonus, movementSpeed, dangerSense };
}

export function travel(db: any, input: TravelInput): TravelResult {
  // 饰品加成（stealth_field 降低遭遇率 / danger_sense 预警 / movement_speed 加速）
  const accBonus = travelAccessoryBonuses(input.accessories);

  // Check if target exists
  const targetResult = queryExec(db, "SELECT name FROM locations WHERE name = ?", [input.target_location]);
  if (targetResult.length === 0 || targetResult[0].values.length === 0) {
    return { success: false, from: input.current_location, to: input.target_location, distance_km: 0, encounter: { triggered: false }, error: `Target "${input.target_location}" not found` };
  }

  // Check connection (bidirectional)
  const connResult = queryExec(db,
    "SELECT distance_km, description FROM location_connections WHERE (from_location = ? AND to_location = ?) OR (from_location = ? AND to_location = ?)",
    [input.current_location, input.target_location, input.target_location, input.current_location]
  );
  if (connResult.length === 0 || connResult[0].values.length === 0) {
    return { success: false, from: input.current_location, to: input.target_location, distance_km: 0, encounter: { triggered: false }, error: `No connection between "${input.current_location}" and "${input.target_location}"` };
  }

  const row = connResult[0];
  const distance = row.values[0][0] as number;

  // Check for encounters
  let encounter: TravelEncounter = { triggered: false };

  // 1. Try table-based encounters
  const encounterResult = queryExec(db,
    "SELECT encounter_type, description, probability FROM location_encounters WHERE location_name = ? AND probability > 0",
    [input.current_location]
  );

  if (encounterResult.length > 0 && encounterResult[0].values.length > 0) {
    // Use table data
    for (const encRow of encounterResult) {
      for (const val of encRow.values) {
        const roll = rollD100();
        if (roll <= (val[2] as number) * 100) {
          // Read danger_level from current location
          const dangerResult = queryExec(db, "SELECT danger_level FROM locations WHERE name = ?", [input.current_location]);
          const danger = dangerResult.length > 0 ? (dangerResult[0].values[0]?.[0] as number) ?? 1 : 1;
          encounter = { triggered: true, encounter_type: val[0] as string, description: val[1] as string, danger_level: danger };
          break;
        }
      }
      if (encounter.triggered) break;
    }
  } else {
    // 2. Auto-generate encounter based on danger levels
    const fromDangerResult = queryExec(db, "SELECT danger_level FROM locations WHERE name = ?", [input.current_location]);
    const toDangerResult = queryExec(db, "SELECT danger_level FROM locations WHERE name = ?", [input.target_location]);
    const fromDanger = fromDangerResult.length > 0 ? (fromDangerResult[0].values[0]?.[0] as number) ?? 1 : 1;
    const toDanger = toDangerResult.length > 0 ? (toDangerResult[0].values[0]?.[0] as number) ?? 1 : 1;
    const avgDanger = (fromDanger + toDanger) / 2;
    const encounterChance = avgDanger * 0.12 + 0.08;
    // Apply stealth reduction (角色隐匿 + 饰品 stealth_field)
    const totalStealth = (input.stealth ?? 0) + accBonus.stealthBonus;
    const stealthMod = totalStealth ? Math.max(0, 1.0 - totalStealth * 0.03) : 1.0;
    const finalChance = encounterChance * stealthMod;

    if (Math.random() < finalChance) {
      const types = ["combat", "loot", "event", "npc"];
      const typeIdx = Math.floor(Math.random() * types.length);
      const avgDangerRounded = Math.round(avgDanger);
      encounter = {
        triggered: true,
        encounter_type: types[typeIdx],
        description: `Random ${types[typeIdx]} encounter (danger level ${avgDangerRounded})`,
        danger_level: avgDangerRounded,
      };
    }
  }

  // Mark target as visited
  db.run("UPDATE locations SET visited = 1, discovered = 1 WHERE name = ?", [input.target_location]);

  // Tracking discovery
  let trackingDiscovery = false;
  let trackingDetail: string | undefined;
  if (input.tracking && input.tracking > 0) {
    trackingDiscovery = Math.random() < input.tracking * 0.05;
    if (trackingDiscovery) {
      const trackingTypes = ["animal tracks", "distant smoke", "old trail markers", "scavenged supplies", "hidden shelter"];
      trackingDetail = trackingTypes[Math.floor(Math.random() * trackingTypes.length)];
    }
  }

  const result: TravelResult = {
    success: true,
    from: input.current_location,
    to: input.target_location,
    distance_km: distance,
    encounter,
    tracking_discovery: trackingDiscovery || undefined,
    tracking_detail: trackingDetail,
    accessory_stealth_bonus: accBonus.stealthBonus > 0 ? accBonus.stealthBonus : undefined,
    accessory_danger_sense: accBonus.dangerSense && encounter.triggered ? true : undefined,
    accessory_movement_speed: accBonus.movementSpeed > 0 ? accBonus.movementSpeed : undefined,
  };

  // Quick travel：走现实时间（需要 db 提供 game_state key-value store 的 get/set）
  if (input.use_quick_travel !== false && typeof db.set === "function") {
    const qtResult = startQuickTravel({
      db,
      from: input.current_location,
      to: input.target_location,
      distance_km: distance,
    });
    if (qtResult.success) {
      result.travel_time_minutes = qtResult.travel_time_minutes;
      result.arrives_at = qtResult.arrives_at;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// explore
// ---------------------------------------------------------------------------

export interface ExploreInput {
  location_name: string;
  accessories?: AccessoryData[];
}

export interface ExploreResult {
  location_name: string;
  description: string;
  danger_level: number;
  has_shelter: boolean;
  pois: { name: string; description: string; discovered: boolean }[];
  available_connections: { to_poi: string; description?: string }[];
  cross_location_exits: { to_location: string; via: string }[];
  discoveries: string[];
  encounter?: TravelEncounter;
  current_poi?: string;
  accessory_resource_found?: string;
  error?: string;
}

/** resource_sense 饰品可发现的资源列表 */
const EXPLORE_RESOURCES = ["废金属", "净水", "草药", "木材", "布料", "罐头"];

export function explore(db: any, input: ExploreInput): ExploreResult {
  const locResult = queryExec(db, "SELECT description, danger_level, has_shelter FROM locations WHERE name = ?", [input.location_name]);
  if (locResult.length === 0 || locResult[0].values.length === 0) {
    return { location_name: input.location_name, description: "", danger_level: 0, has_shelter: false, pois: [], available_connections: [], cross_location_exits: [], discoveries: [], error: `Location "${input.location_name}" not found` };
  }

  const row = locResult[0];
  const description = row.values[0][0] as string;
  const dangerLevel = row.values[0][1] as number;
  const hasShelter = row.values[0][2] as number;

  // Check encounters
  const encResult = queryExec(db, "SELECT encounter_type, description, probability FROM location_encounters WHERE location_name = ?", [input.location_name]);
  const discoveries: string[] = [];
  let encounter: TravelEncounter | undefined;

  // Query POIs
  const poiResult = queryExec(db, "SELECT name, description, discovered FROM location_pois WHERE location_name = ? ORDER BY name", [input.location_name]);
  const pois: { name: string; description: string; discovered: boolean }[] = [];
  for (const r of poiResult) {
    for (const v of r.values) {
      pois.push({ name: v[0] as string, description: v[1] as string, discovered: (v[2] as number) === 1 });
    }
  }

  // Query connections from this location
  const connResult = queryExec(db, "SELECT pc.to_poi, pc.to_location, pc.description, pc.from_poi FROM poi_connections pc WHERE pc.location_name = ?", [input.location_name]);
  const availableConnections: { to_poi: string; description?: string }[] = [];
  const crossLocationExits: { to_location: string; via: string }[] = [];
  for (const r of connResult) {
    for (const v of r.values) {
      const toPoi = v[0] as string | null;
      const toLoc = v[1] as string | null;
      const desc = v[2] as string | null;
      const fromPoi = v[3] as string;
      if (toPoi) {
        availableConnections.push({ to_poi: toPoi, description: desc || undefined });
      }
      if (toLoc) {
        crossLocationExits.push({ to_location: toLoc, via: fromPoi });
      }
    }
  }

  for (const encRow of encResult) {
    for (const val of encRow.values) {
      const encType = val[0] as string;
      const encDesc = val[1] as string;
      const prob = val[2] as number;
      const roll = rollD100();
      if (roll <= prob * 100) {
        discoveries.push(`${encType}: ${encDesc}`);
        encounter = { triggered: true, encounter_type: encType, description: encDesc };
        break;
      }
    }
    if (encounter?.triggered) break;
  }

  // 饰品 resource_sense：概率发现额外资源
  let accessoryResourceFound: string | undefined;
  for (const acc of input.accessories ?? []) {
    if (acc.trigger !== "on_explore" && acc.trigger !== "passive") continue;
    if (acc.effect_type !== "resource_sense") continue;
    if (Math.random() < acc.magnitude) {
      accessoryResourceFound = EXPLORE_RESOURCES[Math.floor(Math.random() * EXPLORE_RESOURCES.length)];
    }
  }

  return { location_name: input.location_name, description, danger_level: dangerLevel, has_shelter: hasShelter === 1, pois, available_connections: availableConnections, cross_location_exits: crossLocationExits, discoveries, encounter, accessory_resource_found: accessoryResourceFound };
}

// ---------------------------------------------------------------------------
// getKnownMap
// ---------------------------------------------------------------------------

export interface MapLocation {
  name: string;
  region: string | null;
  danger_level: number;
  has_shelter: boolean;
  discovered: boolean;
}

export interface MapConnection {
  from: string;
  to: string;
  distance_km: number;
}

export interface MapResult {
  locations: MapLocation[];
  connections: MapConnection[];
  current_location?: string;
}

export function getKnownMap(db: any, currentLocation?: string): MapResult {
  const locResult = db.exec("SELECT name, region, danger_level, has_shelter, discovered FROM locations ORDER BY name");
  const locations: MapLocation[] = [];
  for (const result of locResult) {
    for (const val of result.values) {
      locations.push({ name: val[0] as string, region: val[1] as string | null, danger_level: val[2] as number, has_shelter: (val[3] as number) === 1, discovered: (val[4] as number) === 1 });
    }
  }

  const connResult = db.exec("SELECT from_location, to_location, distance_km FROM location_connections ORDER BY from_location");
  const connections: MapConnection[] = [];
  for (const result of connResult) {
    for (const val of result.values) {
      connections.push({ from: val[0] as string, to: val[1] as string, distance_km: val[2] as number });
    }
  }

  return { locations, connections, current_location: currentLocation };
}

// ---------------------------------------------------------------------------
// POI (Points of Interest)
// ---------------------------------------------------------------------------

export interface DiscoverPOIInput {
  location_name: string;
  name: string;
  description: string;
  has_shelter?: boolean;
  connected_to?: string;
  to_location?: string;
}

export interface DiscoverPOIResult {
  success: boolean;
  location: string;
  poi: string;
  total_pois: number;
  connection_created: boolean;
  error?: string;
}

export interface MoveToInput {
  location_name: string;
  target_poi: string;
}

export interface MoveToResult {
  success: boolean;
  location: string;
  poi: string;
  pois_available: string[];
  cross_location?: string;
  error?: string;
}

export function discoverPOI(db: any, input: DiscoverPOIInput): DiscoverPOIResult {
  const locResult = queryExec(db, "SELECT name FROM locations WHERE name = ?", [input.location_name]);
  if (locResult.length === 0 || locResult[0].values.length === 0) {
    return { success: false, location: input.location_name, poi: input.name, total_pois: 0, connection_created: false, error: `Location "${input.location_name}" not found` };
  }

  const existingResult = queryExec(db, "SELECT name FROM location_pois WHERE location_name = ? AND name = ?", [input.location_name, input.name]);
  if (existingResult.length > 0 && existingResult[0].values.length > 0) {
    return { success: false, location: input.location_name, poi: input.name, total_pois: 0, connection_created: false, error: `POI "${input.name}" already exists in "${input.location_name}"` };
  }

  db.run("INSERT INTO location_pois (location_name, name, description, has_shelter, discovered) VALUES (?, ?, ?, ?, 1)", [input.location_name, input.name, input.description, input.has_shelter ? 1 : 0]);

  let connectionCreated = false;
  if (input.connected_to) {
    db.run("INSERT INTO poi_connections (location_name, from_poi, to_poi, to_location) VALUES (?, ?, ?, ?)", [input.location_name, input.connected_to, input.name, input.to_location || null]);
    connectionCreated = true;
  }

  const countResult = queryExec(db, "SELECT COUNT(*) as c FROM location_pois WHERE location_name = ? AND discovered = 1", [input.location_name]);
  const total = countResult[0]?.values[0]?.[0] ?? 1;

  return { success: true, location: input.location_name, poi: input.name, total_pois: total as number, connection_created: connectionCreated };
}

export function moveTo(db: any, input: MoveToInput): MoveToResult {
  // Check if target POI exists in this location
  const poiResult = queryExec(db, "SELECT name FROM location_pois WHERE location_name = ? AND name = ?", [input.location_name, input.target_poi]);
  if (poiResult.length === 0 || poiResult[0].values.length === 0) {
    const anyPoiResult = queryExec(db, "SELECT name FROM location_pois WHERE location_name = ?", [input.location_name]);
    const available = anyPoiResult.length > 0 ? anyPoiResult[0].values.map(v => v[0] as string) : [];
    return { success: false, location: input.location_name, poi: input.target_poi, pois_available: available, error: `POI "${input.target_poi}" not found in "${input.location_name}"` };
  }

  // If no poi_connections are defined for this location, movement is unrestricted
  const connCountResult = queryExec(db, "SELECT COUNT(*) as c FROM poi_connections WHERE location_name = ?", [input.location_name]);
  const connCount = (connCountResult[0]?.values[0]?.[0] ?? 0) as number;

  if (connCount === 0) {
    const allPoisResult = queryExec(db, "SELECT name FROM location_pois WHERE location_name = ? AND discovered = 1", [input.location_name]);
    const allPois = allPoisResult.length > 0 ? allPoisResult[0].values.map(v => v[0] as string) : [];
    return { success: true, location: input.location_name, poi: input.target_poi, pois_available: allPois };
  }

  // Check for a direct connection leading to the target POI
  const connResult = queryExec(db,
    "SELECT pc.to_location FROM poi_connections pc WHERE pc.location_name = ? AND pc.to_poi = ?",
    [input.location_name, input.target_poi]
  );

  if (connResult.length === 0 || connResult[0].values.length === 0) {
    // No direct connection found - show what IS available
    const availResult = queryExec(db, "SELECT DISTINCT pc.to_poi FROM poi_connections pc WHERE pc.location_name = ? AND pc.to_poi IS NOT NULL", [input.location_name]);
    const available: string[] = [];
    for (const r of availResult) {
      for (const v of r.values) {
        if (v[0]) available.push(v[0] as string);
      }
    }
    return { success: false, location: input.location_name, poi: input.target_poi, pois_available: available, error: `No direct connection to "${input.target_poi}"` };
  }

  // Check if this connection leads to another world location
  const toLocation = connResult[0].values[0][0] as string | null;

  // Get all destinations reachable from the new current POI
  const allAvailResult = queryExec(db,
    "SELECT pc.to_poi FROM poi_connections pc WHERE pc.location_name = ? AND pc.from_poi = ? AND pc.to_poi IS NOT NULL",
    [input.location_name, input.target_poi]
  );
  const allAvailable: string[] = [];
  for (const r of allAvailResult) {
    for (const v of r.values) {
      if (v[0]) allAvailable.push(v[0] as string);
    }
  }

  return {
    success: true,
    location: input.location_name,
    poi: input.target_poi,
    pois_available: allAvailable,
    cross_location: toLocation || undefined,
  };
}
