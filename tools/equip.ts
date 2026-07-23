import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { equipItem, unequipItem, calculateEquipmentStats, SLOT_LABELS } from "../engine/equip";

export function registerEquipTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "equip_item",
    label: "Equip Item",
    description: "Equip an item to a slot (weapon, head, chest, legs, accessory1, accessory2). Replaces any existing item in that slot and returns stat changes.",
    parameters: Type.Object({
      slot: Type.String({ description: "Equipment slot" }),
      item: Type.Any({ description: "Item data" }),
      current_equipment: Type.Any({ description: "Current equipment state" }),
    }),
    async execute(_toolCallId, params) {
      const result = equipItem(params);
      if (!result.success) {
        return { content: [{ type: "text", text: "❌ Cannot equip: " + result.error }], details: result, isError: true };
      }
      const statStr = Object.entries(result.stat_changes).map(([k, v]) => k + ": " + (v >= 0 ? "+" : "") + v).join(", ");
      const replaced = result.item_removed ? " (replaced " + result.item_removed + ")" : "";
      return { content: [{ type: "text", text: "✅ Equipped " + result.item_equipped + " to " + (SLOT_LABELS[params.slot] || params.slot) + replaced + "\nStat changes: " + (statStr || "none") }], details: result };
    },
  });

  pi.registerTool({
    name: "unequip_item",
    label: "Unequip Item",
    description: "Remove an item from an equipment slot.",
    parameters: Type.Object({
      slot: Type.String({ description: "Equipment slot" }),
      current_equipment: Type.Any({ description: "Current equipment state" }),
    }),
    async execute(_toolCallId, params) {
      const result = unequipItem(params);
      if (!result.success) {
        return { content: [{ type: "text", text: "❌ Cannot unequip: " + result.error }], details: result, isError: true };
      }
      const statStr = Object.entries(result.stat_changes).map(([k, v]) => k + ": " + (v >= 0 ? "+" : "") + v).join(", ");
      return { content: [{ type: "text", text: "✅ Unequipped " + result.item_removed + "\nStat changes: " + (statStr || "none") }], details: result };
    },
  });

  pi.registerTool({
    name: "equipment_stats",
    label: "Equipment Stats",
    description: "Calculate total defense and stat bonuses from all equipped items.",
    parameters: Type.Object({
      equipment: Type.Any({ description: "Current equipment state" }),
    }),
    async execute(_toolCallId, params) {
      const result = calculateEquipmentStats(params.equipment);
      if (result.equipped_items.length === 0) {
        return { content: [{ type: "text", text: "Nothing equipped." }], details: result };
      }
      const items = result.equipped_items.map(e => "  • " + (SLOT_LABELS[e.slot] || e.slot) + ": " + e.name).join("\n");
      const stats = Object.entries(result.stat_bonuses).map(([k, v]) => k + ": +" + v).join(", ");
      return { content: [{ type: "text", text: "**Equipment:**\n" + items + "\n\nTotal defense: " + result.total_defense + (stats ? "\nBonuses: " + stats : "") }], details: result };
    },
  });
}
