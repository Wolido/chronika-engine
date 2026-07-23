import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerDiceTool } from "./tools/dice";
import { registerDBTools } from "./tools/db";
import { registerWorldGenTool } from "./tools/world-gen";
import { registerSkillCheckTool } from "./tools/skill-check";
import { registerCombatTool } from "./tools/combat";
import { registerLootTool } from "./tools/loot";
import { registerConsumeTool } from "./tools/consume";
import { registerCraftTool } from "./tools/craft";
import { registerTradeTool } from "./tools/trade";
import { registerStatusRuntimeTools } from "./tools/status-runtime";
import { registerLevelUpTool } from "./tools/level-up";
import { registerLegendaryGenTool } from "./tools/legendary-gen";
import { registerEquipTools } from "./tools/equip";

export default function (pi: ExtensionAPI) {
  registerDiceTool(pi);
  registerDBTools(pi);
  registerWorldGenTool(pi);
  registerSkillCheckTool(pi);
  registerCombatTool(pi);
  registerLootTool(pi);
  registerConsumeTool(pi);
  registerCraftTool(pi);
  registerTradeTool(pi);
  registerStatusRuntimeTools(pi);
  registerLevelUpTool(pi);
  registerLegendaryGenTool(pi);
  registerEquipTools(pi);

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("⚙️ Chronika Engine loaded", "info");
  });
}
