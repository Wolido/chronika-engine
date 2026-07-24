// exploration.ts — 探索 / 地图系统引擎
//
// 提供 discoverLocation / travel / explore / getKnownMap 四个纯函数，
// 直接操作 sql.js Database 实例。

function rollD100(): number {
  return Math.floor(Math.random() * 100) + 1;
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
  const existing = db.exec(`SELECT name FROM locations WHERE name = '${input.name}'`);
  if (existing.length > 0 && existing[0].values.length > 0) {
    return { success: false, location_name: input.name, connection: { from: "", to: "" }, total_locations: 0, error: `Location "${input.name}" already exists` };
  }

  // Check if connected_to exists
  const source = db.exec(`SELECT name FROM locations WHERE name = '${input.connected_to}'`);
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
}

export interface TravelEncounter {
  triggered: boolean;
  encounter_type?: string;
  description?: string;
}

export interface TravelResult {
  success: boolean;
  from: string;
  to: string;
  distance_km: number;
  encounter: TravelEncounter;
  error?: string;
}

export function travel(db: any, input: TravelInput): TravelResult {
  // Check if target exists
  const targetResult = db.exec(`SELECT name FROM locations WHERE name = '${input.target_location}'`);
  if (targetResult.length === 0 || targetResult[0].values.length === 0) {
    return { success: false, from: input.current_location, to: input.target_location, distance_km: 0, encounter: { triggered: false }, error: `Target "${input.target_location}" not found` };
  }

  // Check connection (bidirectional)
  const connResult = db.exec(
    `SELECT distance_km, description FROM location_connections WHERE (from_location = '${input.current_location}' AND to_location = '${input.target_location}') OR (from_location = '${input.target_location}' AND to_location = '${input.current_location}')`
  );
  if (connResult.length === 0 || connResult[0].values.length === 0) {
    return { success: false, from: input.current_location, to: input.target_location, distance_km: 0, encounter: { triggered: false }, error: `No connection between "${input.current_location}" and "${input.target_location}"` };
  }

  const row = connResult[0];
  const distance = row.values[0][0] as number;

  // Check for encounters
  const encounterResult = db.exec(`SELECT encounter_type, description, probability FROM location_encounters WHERE location_name = '${input.current_location}' AND probability > 0`);
  let encounter: TravelEncounter = { triggered: false };

  for (const encRow of encounterResult) {
    for (const val of encRow.values) {
      const encType = val[0] as string;
      const encDesc = val[1] as string;
      const prob = val[2] as number;
      const roll = rollD100();
      if (roll <= prob * 100) {
        encounter = { triggered: true, encounter_type: encType, description: encDesc };
        break;
      }
    }
    if (encounter.triggered) break;
  }

  // Mark target as visited
  db.run(`UPDATE locations SET visited = 1, discovered = 1 WHERE name = '${input.target_location}'`);

  return { success: true, from: input.current_location, to: input.target_location, distance_km: distance, encounter };
}

// ---------------------------------------------------------------------------
// explore
// ---------------------------------------------------------------------------

export interface ExploreInput {
  location_name: string;
}

export interface ExploreResult {
  location_name: string;
  description: string;
  danger_level: number;
  has_shelter: boolean;
  discoveries: string[];
  encounter?: TravelEncounter;
  error?: string;
}

export function explore(db: any, input: ExploreInput): ExploreResult {
  const locResult = db.exec(`SELECT description, danger_level, has_shelter FROM locations WHERE name = '${input.location_name}'`);
  if (locResult.length === 0 || locResult[0].values.length === 0) {
    return { location_name: input.location_name, description: "", danger_level: 0, has_shelter: false, discoveries: [], error: `Location "${input.location_name}" not found` };
  }

  const row = locResult[0];
  const description = row.values[0][0] as string;
  const dangerLevel = row.values[0][1] as number;
  const hasShelter = row.values[0][2] as number;

  // Check encounters
  const encResult = db.exec(`SELECT encounter_type, description, probability FROM location_encounters WHERE location_name = '${input.location_name}'`);
  const discoveries: string[] = [];
  let encounter: TravelEncounter | undefined;

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

  return { location_name: input.location_name, description, danger_level: dangerLevel, has_shelter: hasShelter === 1, discoveries, encounter };
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
