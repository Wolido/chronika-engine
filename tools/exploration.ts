import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSQL } from "../db/connection";
import { discoverLocation, travel, explore, getKnownMap, discoverPOI, moveTo } from "../engine/exploration";
import { dbAdapter } from "./time";

function resolvePath(p: string): string {
  if (p.startsWith("/")) return p;
  return resolve(process.cwd(), p);
}

async function openDB(dbPath: string) {
  const SQL = await getSQL();
  const resolved = resolvePath(dbPath);
  const buffer = readFileSync(resolved);
  return new SQL.Database(buffer);
}

function saveDB(db: any, dbPath: string) {
  const data = db.export();
  writeFileSync(resolvePath(dbPath), Buffer.from(data));
  db.close();
}

export function registerExplorationTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "discover_location",
    label: "Discover Location",
    description: "Discover a new wasteland location connected to an existing one. Use when the player finds a significant new place that requires travel to reach — not for small rooms or building interiors (use discover_poi for those).",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
      name: Type.String({ description: "New location name" }),
      connected_to: Type.String({ description: "Existing location this connects from" }),
      description: Type.String({ description: "Location description" }),
      region: Type.Optional(Type.String({ description: "Region name" })),
      danger_level: Type.Optional(Type.Number({ description: "Danger level 1-5" })),
      distance_km: Type.Optional(Type.Number({ description: "Distance in km (default 1.0, max 20). Walking speed is 5 km/h." })),
      connection_description: Type.Optional(Type.String({ description: "Description of the path/route" })),
      has_shelter: Type.Optional(Type.Boolean({ description: "Can rest here safely" })),
    }),
    async execute(_toolCallId, params) {
      const db = await openDB(params.db_path);
      const result = discoverLocation(db, params);
      saveDB(db, params.db_path);
      if (!result.success) return { content: [{ type: "text", text: `❌ ${result.error}` }], details: result, isError: true };
      return { content: [{ type: "text", text: `🗺️ Discovered "${result.location_name}" (${result.connection.from} → ${result.connection.to}). Total locations: ${result.total_locations}` }], details: result };
    },
  });

  pi.registerTool({
    name: "travel",
    label: "Travel",
    description: "Travel between wasteland locations on the world map. Distance is in kilometers. May trigger random encounters with mutants, raiders, or other wasteland dangers along the way.\n\nStealth skill reduces encounter probability: ×(1.0 - stealth × 0.03). Tracking skill gives chance to discover clues or supplies along the way.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
      current_location: Type.String({ description: "Current location name" }),
      target_location: Type.String({ description: "Destination location name" }),
      stealth: Type.Optional(Type.Number({ description: "Stealth skill — reduces encounter chance" })),
      tracking: Type.Optional(Type.Number({ description: "Tracking skill — chance to discover clues or supplies" })),
    }),
    async execute(_toolCallId, params) {
      const sqlDb = await openDB(params.db_path);
      // 挂上 game_state key-value store，让 travel 能通过统一 timer 系统持久化行程计时器
      const db = Object.assign(sqlDb, dbAdapter(sqlDb));
      const result = travel(db, { current_location: params.current_location, target_location: params.target_location, stealth: params.stealth, tracking: params.tracking });
      saveDB(sqlDb, params.db_path);
      if (!result.success) return { content: [{ type: "text", text: `❌ ${result.error}` }], details: result, isError: true };
      const encLine = result.encounter.triggered ? `\n⚡ Encounter en route: ${result.encounter.description}` : "";
      const trackLine = result.tracking_discovery ? `\n🔍 Tracking discovery: ${result.tracking_detail}` : "";
      const mainLine = result.travel_time_minutes != null
        ? `🚶 **出发！** 正在从 ${result.from} 前往 ${result.to}（${result.distance_km}km，步行约 ${result.travel_time_minutes} 分钟）`
        : `🚶 Traveled ${result.distance_km}km from ${result.from} to ${result.to}.`;
      const arrivalTimeStr = result.arrives_at != null
        ? new Date(result.arrives_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
        : "";
      const timeLine = result.travel_time_minutes != null
        ? `\n⏱️ 预计到达时间：${arrivalTimeStr}（约 ${result.travel_time_minutes} 分钟后）\n⚠️ 到达前请勿更新 current_location 或叙述到达场景。计时器状态每回合自动注入更新，无需手动查询。`
        : "";
      return { content: [{ type: "text", text: `${mainLine}${encLine}${trackLine}${timeLine}` }], details: result };
    },
  });

  pi.registerTool({
    name: "explore",
    label: "Explore",
    description: "Search the current wasteland location for points of interest, salvageable resources, hidden threats, or encounters. Use this when the player wants to scavenge, look around, or search a building or area.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
      location_name: Type.String({ description: "Location to explore" }),
    }),
    async execute(_toolCallId, params) {
      const db = await openDB(params.db_path);
      const result = explore(db, { location_name: params.location_name });
      db.close();
      if (result.error) return { content: [{ type: "text", text: `❌ ${result.error}` }], details: result, isError: true };
      const shelterLine = result.has_shelter ? "\n🏠 Has shelter (safe to rest)" : "";
      const discLines = result.discoveries.length > 0 ? `\n\n**Discoveries:**\n${result.discoveries.map(d => `  • ${d}`).join("\n")}` : "";
      const poiLines = result.pois.length > 0 ? `\n\n**Points of Interest:**\n${result.pois.map(p => `  • ${p.name}${p.discovered ? "" : " (undiscovered)"}`).join("\n")}` : "";
      const connLines = result.available_connections.length > 0 ? `\n\n**From here you can go to:**\n${result.available_connections.map(c => `  • ${c.to_poi}${c.description ? ": " + c.description : ""}`).join("\n")}` : "";
      const exitLines = result.cross_location_exits.length > 0 ? `\n**Exits to other areas:**\n${result.cross_location_exits.map(e => `  • ${e.via} → ${e.to_location}`).join("\n")}` : "";
      return { content: [{ type: "text", text: `📍 **${result.location_name}** (danger level: ${result.danger_level})${shelterLine}\n${result.description}${discLines}${poiLines}${connLines}${exitLines}` }], details: result };
    },
  });

  pi.registerTool({
    name: "discover_poi",
    label: "Discover POI",
    description: "Discover a new point of interest within a location (a room, building, landmark, etc.). NOT for discovering new map locations — use discover_location for that.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
      location_name: Type.String({ description: "Parent location" }),
      name: Type.String({ description: "POI name" }),
      description: Type.String({ description: "POI description" }),
      has_shelter: Type.Optional(Type.Boolean({ description: "Can rest here" })),
      connected_to: Type.Optional(Type.String({ description: "Existing POI this connects from" })),
      to_location: Type.Optional(Type.String({ description: "World location this POI exits to" })),
    }),
    async execute(_toolCallId, params) {
      const db = await openDB(params.db_path);
      const result = discoverPOI(db, params);
      saveDB(db, params.db_path);
      if (!result.success) return { content: [{ type: "text", text: `❌ ${result.error}` }], details: result, isError: true };
      return { content: [{ type: "text", text: `📍 Discovered "${result.poi}" in ${result.location}. Total POIs: ${result.total_pois}` }], details: result };
    },
  });

  pi.registerTool({
    name: "move_to",
    label: "Move To",
    description: "Move to a different point of interest within the current location. Free action with no travel time or encounter risk.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
      location_name: Type.String({ description: "Current location" }),
      target_poi: Type.String({ description: "Target POI" }),
      current_poi: Type.Optional(Type.String({ description: "Current POI name (for connection-based navigation)" })),
    }),
    async execute(_toolCallId, params) {
      const db = await openDB(params.db_path);
      const result = moveTo(db, { location_name: params.location_name, target_poi: params.target_poi, current_poi: params.current_poi });
      db.close();
      if (!result.success) return { content: [{ type: "text", text: `❌ ${result.error}` }], details: result, isError: true };
      const crossLine = result.cross_location ? `\n🚪 This leads to: ${result.cross_location} (use travel to go there)` : "";
      const availLine = result.pois_available.length > 0 ? `\nFrom here you can go to: ${result.pois_available.join(", ")}` : "";
      const noteLine = result.note ? `\nℹ️ ${result.note}` : "";
      return { content: [{ type: "text", text: `🚶 Moved to "${result.poi}" in ${result.location}.${availLine}${crossLine}${noteLine}` }], details: result };
    },
  });

  pi.registerTool({
    name: "get_map",
    label: "Get Map",
    description: "Show all discovered locations and their connections. Use at session start to restore map context.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
      current_location: Type.Optional(Type.String({ description: "Current location" })),
    }),
    async execute(_toolCallId, params) {
      const db = await openDB(params.db_path);
      const result = getKnownMap(db, params.current_location);
      db.close();
      if (result.locations.length === 0) return { content: [{ type: "text", text: "🗺️ No locations discovered yet." }], details: result };
      const locLines = result.locations.filter(l => l.discovered).map(l => `  ${l.name === params.current_location ? "📍" : "🏙️"} ${l.name}${l.region ? ` (${l.region})` : ""}`).join("\n");
      const connLines = result.connections.map(c => `  ${c.from} ↔ ${c.to} (${c.distance_km}km)`).join("\n");
      return { content: [{ type: "text", text: `**🗺️ Map**\n\n**Locations:**\n${locLines}\n\n**Connections:**\n${connLines}` }], details: result };
    },
  });
}
