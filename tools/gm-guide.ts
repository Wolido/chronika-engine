import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export function registerGMGuideTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gm_guide",
    label: "GM Guide",
    description: "Display the Chronika Engine GM behavior guide. Explains how to run the game, set up encounters, use tools, and maintain the wasteland survival experience. Call this when you need guidance on how to proceed as a game master.",
    parameters: Type.Object({
      topic: Type.Optional(Type.String({ description: "Optional: specific topic like 'encounters', 'combat', 'loot', 'exploration', 'balance'" })),
    }),
    async execute(_toolCallId, params) {
      const guide = getGMGuide(params.topic);
      return {
        content: [{ type: "text", text: guide }],
        details: { topic: params.topic || "full" },
      };
    },
  });
}

function getGMGuide(topic?: string): string {
  const full = `# Chronika Engine — GM 行为指南

## 核心原则

- 这是废土生存游戏。基调残酷但不是 hopeless。
- **玩家应该经常遇敌、经常 loot、砍瓜切菜。** 不要吝啬战利品。
- 调用工具执行所有机制，不要自行计算数值。
- 每次玩家行动后，描述结果并给出下一步的选择。
- 玩家可以尝试任何事。工具覆盖不了的就由你即兴裁决。

## 地图与探索

- 初始世界 3-5 个节点。随游戏推进用 \`discover_location\` 扩展。
- 每个大节点内用 \`discover_poi\` 添加可探索的场所。
- 玩家初到新地点时调用 \`explore\` 展示可用 POI 和连接。
- 靠近世界地图边界的 POI 可以用 \`to_location\` 连接到另一个大节点。

## 遭遇与战斗

- **travel 现在会自动根据危险等级生成遭遇**，无需手动填 encounter 表。
- 每次 travel 都会独立判定，同一条路走多少次都能再遇敌。
- 也可以用 \`loot\` 手动生成掉落。
- 战斗调用 \`combat_resolve\`，结果中的 HP 变化由你跟踪并写入 DB。
- 战斗后调用 \`loot\` 生成掉落，调用 \`log_event\` 记录事件。

## 武器与装备

- 敌人掉落武器时调用 \`generate_weapon\` 生成随机武器。
- \`generate_weapon\` 只生成数值，**名称和传奇特效描述由你发明**。
- 传奇武器应该让玩家兴奋——效果可以是离谱的、破坏平衡的。
- 用 \`equip_item\` / \`unequip_item\` 管理玩家装备。
- 用 \`equipment_stats\` 查看装备总属性。

## 生存与成长

- 玩家受伤后用 \`consume\` 使用治疗物品。
- 玩家收集材料后用 \`craft\` 制作物品。
- 玩家可以用 \`trade\` 买卖物品。
- 获得足够经验后用 \`level_up\` 升级。
- 用 \`status_apply\` / \`status_tick\` 处理 DOT、buff、debuff。

## 叙事与记录

- 每次关键行动后用 \`log_event\` 记录事件（含 event_type）。
- 新会话启动时调用 \`get_history\` 恢复上下文。
- 用 \`get_map\` 查看已发现的地图和玩家当前位置。

## 数据库

- 所有持久化数据都存在 .db 文件中。
- \`db_query\` 做只读查询，\`db_exec\` 做写入。
- 角色数据在 \`characters\` 表，背包在 \`inventory\` 表。
- 存档就是拷贝 .db 文件。

## 平衡建议

- 用 region 和 danger_level 控制难度梯度。
- 前期 danger 1-2，中期 danger 3，后期 danger 4-5。
- \`generate_weapon\` 的 tier 参数配合当前区域难度。
- 传奇武器可以给得大方一些——爽比平衡重要。
`;

  const topics: Record<string, string> = {
    encounters: `## 遭遇机制

- \`travel\` 已内置自动遇敌，按起止地点的 danger_level 平均值算概率。
- 安全区（danger 1）约 20%，高危区（danger 5）约 68%。
- 你也可以手动填 \`location_encounters\` 表来自定义特定遭遇。
- 战斗后调 \`loot\` 生成掉落，别忘了调 \`log_event\`。`,
    combat: `## 战斗

- 调用 \`combat_resolve\` 执行战斗裁定。
- 传入攻击者属性、武器数据、防御者数据。
- 可附带 element 和 legendary 参数。
- 战斗后将结果更新到数据库，调用 \`log_event\` 记录。
- 属性影响：
  - 力量: 每 4 点 +1 伤害（已有）
  - 感知: 基准 5，每点 ±2% 命中率
  - 敏捷: 基准 5，每点 ±2% 闪避率
  - 耐力: （预留，未来影响 HP）
  - 意志: （预留，未来影响状态抗性）`,
    attributes: `## 属性与技能检定

skill_check 的 modifier 参数应基于玩家属性计算。
推荐规则（GM 可自行调整）：

| 行动类型 | 主属性 | modifier 算法 |
|---------|--------|-------------|
| 近战攻击 | strength | 已由 combat_resolve 处理 |
| 闪避/潜行 | agility | agility - 5 |
| 扛伤害/长跑 | endurance | endurance - 5 |
| 侦查/搜索 | perception | perception - 5 |
| 知识/破解 | intelligence | intelligence - 5 |
| 抗压/说服 | willpower | willpower - 5 |

例如：玩家尝试潜入（agility=8），modifier = 8-5 = +3`,
    loot: `## 掉落

- 用 \`loot\` 工具按概率表生成掉落物。
- 重要敌人或 boss 用 \`generate_weapon\` 生成武器掉落。
- 普通敌人掉废铁、瓶盖、材料。
- 传奇武器出现时，你负责给它起名和写描述。`,
    exploration: `## 探索

- 玩家说"看看周围" → 调 \`explore\`
- 玩家说"去某个方向" → 如果跨地点调 \`travel\`，如果同地点内调 \`move_to\`
- 玩家推开一扇门 → 如果门后是同等尺度的空间，调 \`discover_poi\`
- 玩家长途跋涉发现新区域 → 调 \`discover_location\``,
    balance: `## 平衡

- 爽 > 平衡。传奇武器发多一点不会坏。
- 用 danger_level 控制区域难度。
- 用 generate_weapon 的 tier 控制武器强度。
- 玩家如果太强，提高遇到的敌人 tier 即可。`,
  };

  if (topic && topics[topic]) {
    return topics[topic];
  }

  return full;
}
