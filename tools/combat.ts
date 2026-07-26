import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { combatResolve } from "../engine/combat";

export function registerCombatTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "combat_resolve",
    label: "Combat Resolve",
    description: "Resolve a combat action in the wasteland: hit check, damage calculation with strength bonus and armor absorption, elemental effect proc. Weapons can have fire, corrosive, shock, or other elemental effects. Legendary effects multiply damage or provide lifesteal. Returns remaining HP and kill status.",
    parameters: Type.Object({
      attacker: Type.Object({
        stats: Type.Object({
          strength: Type.Number({ description: "Attacker's strength (0-20)" }),
          agility: Type.Number({ description: "Attacker's agility (0-20)" }),
          endurance: Type.Number({ description: "Attacker's endurance (0-20)" }),
          perception: Type.Number({ description: "Attacker's perception (0-20)" }),
          intelligence: Type.Number({ description: "Attacker's intelligence (0-20)" }),
          willpower: Type.Number({ description: "Attacker's willpower (0-20)" }),
        }),
        weapon: Type.Object({
          damage_min: Type.Number({ description: "Minimum weapon damage" }),
          damage_max: Type.Number({ description: "Maximum weapon damage" }),
          accuracy: Type.Number({ description: "Weapon accuracy (0.0-1.0)" }),
          damage_type: Type.String({ description: "Damage type: slashing/piercing/bludgeoning/thermal/explosive/chemical" }),
        }),
        crit_chance: Type.Optional(Type.Number({ description: "Crit chance 0.0-1.0 (default 0.05)" })),
        flags: Type.Optional(Type.Array(Type.String({ description: "Combat flags: stealth, counter_attack, reload, empty_mag, full_mag, weapon_jam, first_blood, reflect, dodge, parry" }))),
        hp: Type.Optional(Type.Number({ description: "Attacker current HP" })),
        hp_max: Type.Optional(Type.Number({ description: "Attacker max HP" })),
        ammo: Type.Optional(Type.Number({ description: "Current ammo count" })),
        max_ammo: Type.Optional(Type.Number({ description: "Max ammo capacity" })),
        element: Type.Optional(Type.Object({
          element_type: Type.String({ description: "Element type: fire/corrosive/shock/frost/radiation/explosive/venom/void" }),
          proc_chance: Type.Number({ description: "Element proc chance (0.0-1.0)" }),
        })),
        legendary: Type.Optional(Type.Object({
          effect_name: Type.String({ description: "Legendary effect name" }),
          trigger: Type.String({ description: "Trigger: on_hit, on_crit, on_miss, on_kill, on_attack_start, on_damage_dealt, on_overkill, on_armor_pierce, on_low_attacker_hp, on_low_defender_hp, on_parry, on_reload, on_empty_mag, on_full_mag, on_weapon_jam, on_elemental_proc, on_stealth_attack, on_counter_attack, on_finishing_blow, on_berserk, on_last_stand, on_first_blood, on_reflect, on_wound, on_ammo_low" }),
          effect_type: Type.String({ description: "Effect: multiply_damage, add_flat_damage, lifesteal, life_drain, aoe_explosion, chain_lightning, armor_pierce, armor_shred, stun, bleed, burn, poison, frost_slow, shock_proc, mental_break, debuff_attack, debuff_defense, buff_attack, buff_accuracy, buff_evasion, summon_ally, refill_ammo, shield, reflect_damage, disarm" }),
          magnitude: Type.Number({ description: "Effect magnitude multiplier (e.g. 2.0 for double damage)" }),
        })),
      }),
      defender: Type.Object({
        evasion: Type.Number({ description: "Defender's evasion (0.0-1.0)" }),
        armor: Type.Number({ description: "Defender's armor value" }),
        hp: Type.Number({ description: "Defender's current HP" }),
        hp_max: Type.Optional(Type.Number({ description: "Defender's max HP" })),
        armor_legendary: Type.Optional(Type.Object({
          effect_name: Type.String(),
          trigger: Type.String({ description: "防具触发器: on_hit_taken, on_crit_taken, on_damage_taken, on_heavy_damage, on_block, on_dodged, on_low_wearer_hp, on_critical_hp, on_combat_start, on_kill_response, on_debuff_received, on_elemental_hit, on_fatal_hit, passive" }),
          effect_type: Type.String({ description: "防具效果: damage_reduction, flat_damage_block, thorns, reflect_percent, hp_regen, emergency_heal, heal_on_kill, explosive_retaliation, elemental_absorption, status_cleanse, fear_aura, pain_to_power, last_stand, stat_boost, retribution" }),
          magnitude: Type.Number(),
          description: Type.Optional(Type.String()),
        })),
      }),
    }),
    async execute(_toolCallId, params) {
      const result = combatResolve(params as any);

      if (!result.hit) {
        const missArmorLine = result.armor_legendary_triggered
          ? `\n🛡️ **Armor legendary triggered!** ${result.armor_legendary_detail ?? ""}`
          : "";
        return {
          content: [{ type: "text", text: `🛡️ **Miss!** Rolled ${result.hit_roll} (needed ≤ ${result.hit_threshold})${missArmorLine}` }],
          details: result,
        };
      }

      const elementLine = result.elemental_proc
        ? `\n⚡ **Element proc!** ${result.elemental_detail}`
        : "";

      const legendaryLine = result.legendary_triggered
        ? `\n🌟 **Legendary triggered!** ${result.legendary_detail}`
        : "";

      const armorLegendaryLine = result.armor_legendary_triggered
        ? `\n🛡️ **Armor legendary triggered!** ${result.armor_legendary_detail ?? ""}`
        : "";

      const critLine = result.crit
        ? `\n💥 **Critical hit!** (roll ${result.crit_roll} ≤ ${result.crit_threshold})`
        : "";

      const killLine = result.killed ? "\n💀 **Target defeated!**" : "";

      // Legendary secondary effects — only shown when present
      const extras: string[] = [];
      if (result.legendary_aoe_damage) extras.push(`💥 AoE damage: ${result.legendary_aoe_damage}`);
      if (result.legendary_chain_damage) extras.push(`⚡ Chain: ${result.legendary_chain_damage} dmg to ${result.legendary_chain_targets} targets`);
      if (result.legendary_shield) extras.push(`🛡️ Shield: +${result.legendary_shield}`);
      if (result.legendary_ammo_change) extras.push(`🔫 Ammo: +${result.legendary_ammo_change}`);
      if (result.legendary_reflect_damage) extras.push(`↩️ Reflect: ${result.legendary_reflect_damage} dmg`);
      if (result.legendary_summon) extras.push(`👤 Ally summoned!`);
      if (result.legendary_fear) extras.push(`😱 Defender feared!`);
      if (result.legendary_status_on_defender) extras.push(`☠️ Status on defender: ${result.legendary_status_on_defender.join(", ")}`);
      if (result.legendary_status_on_attacker) extras.push(`✨ Status on attacker: ${result.legendary_status_on_attacker.join(", ")}`);
      if (result.armor_legendary_damage_reduced) extras.push(`🛡️ Armor reduced damage: ${result.armor_legendary_damage_reduced}`);
      if (result.armor_legendary_thorns) extras.push(`🌵 Thorns: ${result.armor_legendary_thorns} dmg`);
      if (result.armor_legendary_reflect) extras.push(`↩️ Armor reflect: ${result.armor_legendary_reflect} dmg`);
      if (result.armor_legendary_aoe) extras.push(`💥 Retaliation AoE: ${result.armor_legendary_aoe} dmg`);
      if (result.armor_legendary_hp_restored) extras.push(`❤️ Element absorbed as healing: ${result.armor_legendary_hp_restored}`);
      if (result.armor_legendary_emergency_heal) extras.push(`💊 Emergency heal: ${result.armor_legendary_emergency_heal}`);
      if (result.armor_legendary_heal_on_kill) extras.push(`❤️ Heal on kill: ${result.armor_legendary_heal_on_kill}`);
      if (result.armor_legendary_retribution) extras.push(`⚰️ Retribution: ${result.armor_legendary_retribution} dmg`);
      if (result.armor_legendary_fear_aura) extras.push(`😱 Fear aura!`);
      if (result.armor_legendary_last_stand) extras.push(`🔥 Last stand!`);
      if (result.armor_legendary_cleansed) extras.push(`✨ Cleansed: ${result.armor_legendary_cleansed.join(", ")}`);
      if (result.armor_legendary_status_on_wearer) extras.push(`✨ Status on wearer: ${result.armor_legendary_status_on_wearer.join(", ")}`);
      if (result.armor_legendary_status_on_attacker) extras.push(`☠️ Status on attacker: ${result.armor_legendary_status_on_attacker.join(", ")}`);
      const extrasLine = extras.length > 0 ? `\n${extras.map(e => `  ${e}`).join("\n")}` : "";

      return {
        content: [{
          type: "text",
          text: [
            `🎯 **Hit!** Rolled ${result.hit_roll} (needed ≤ ${result.hit_threshold})`,
            `⚔️ Base damage: ${result.damage_raw} + strength bonus ${result.strength_bonus} = ${result.damage_raw + result.strength_bonus}`,
            `🛡️ Armor absorbed: ${result.damage_absorbed}`,
            `💥 **Final damage: ${result.damage_final}** (${result.damage_type})`,
            `❤️ Defender HP: ${result.hp_remaining + result.damage_final} → ${result.hp_remaining}`,
            critLine,
            elementLine,
            legendaryLine,
            armorLegendaryLine,
            extrasLine,
            killLine,
          ].filter(Boolean).join("\n"),
        }],
        details: result,
      };
    },
  });
}
