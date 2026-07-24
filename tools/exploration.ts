import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSQL } from "../db/connection";
import { discoverLocation, travel, explore, getKnownMap } from "../engine/exploration";

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
    description: "Discover a new location connected to an existing one. Creates both the location entry and the connection. Call this when exploring reveals a new place.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
      name: Type.String({ description: "New location name" }),
      connected_to: Type.String({ description: "Existing location this connects from" }),
      description: Type.String({ description: "Location description" }),
      region: Type.Optional(Type.String({ description: "Region name" })),
      danger_level: Type.Optional(Type.Number({ description: "Danger level 1-5" })),
      distance_km: Type.Optional(Type.Number({ description: "Distance in km" })),
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
    description: "Travel from current location to a connected location. May trigger encounters along the way.",
    parameters: Type.Object({
      db_path: Type.String({ description: "Path to game database" }),
      current_location: Type.String({ description: "Current location name" }),
      target_location: Type.String({ description: "Destination location name" }),
    }),
    async execute(_toolCallId, params) {
      const db = await openDB(params.db_path);
      const result = travel(db, { current_location: params.current_location, target_location: params.target_location });
      saveDB(db, params.db_path);
      if (!result.success) return { content: [{ type: "text", text: `❌ ${result.error}` }], details: result, isError: true };
      const encLine = result.encounter.triggered ? `\n⚡ Encounter en route: ${result.encounter.description}` : "";
      return { content: [{ type: "text", text: `🚶 Traveled ${result.distance_km}km from ${result.from} to ${result.to}.${encLine}` }], details: result };
    },
  });

  pi.registerTool({
    name: "explore",
    label: "Explore",
    description: "Search the current location for points of interest, resources, or encounters.",
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
      return { content: [{ type: "text", text: `📍 **${result.location_name}** (danger level: ${result.danger_level})${shelterLine}\n${result.description}${discLines}` }], details: result };
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
