export interface ParamInfo {
  name: string;
  type: string;
  required: boolean;
  description: string;
  constraints?: string;
  example?: string;
}

export interface ToolHelp {
  name: string;
  description: string;
  parameters: ParamInfo[];
  example_call?: string;
}

export interface ToolHelpResult {
  found: boolean;
  tool: ToolHelp;
  error?: string;
}

const TOOLS: Record<string, ToolHelp> = {
  world_gen: {
    name: "world_gen",
    description: "批量生成世界数据（武器/怪物/物品/状态效果/行为）",
    parameters: [
      { name: "world_meta", type: "object", required: false, description: "世界元数据 {world_name, world_desc?, tone?}", example: "{world_name: \"废土\"}" },
      { name: "db_path", type: "string", required: true, description: "数据库文件路径", example: "./worlds/game.db" },
      { name: "weapons", type: "array", required: false, description: "武器数组，每个需: name/category(melee/ranged/thrown/explosive)/damage_type(slashing/piercing/bludgeoning/thermal/explosive/chemical)/damage_min/damage_max/accuracy(0-1)/tier(1-5)/rarity(common/uncommon/rare/legendary)", constraints: "远程需额外: range_min/range_max/ammo_type" },
      { name: "monsters", type: "array", required: false, description: "怪物数组，每个需: name/category(beast/mutant/humanoid/mechanical/abomination)/hp/damage_min/damage_max/accuracy(0-1)/evasion(0-1)/armor/tier(1-5)/xp_reward/strength(1-20)/agility(1-20)/endurance(1-20)/perception(1-20)/intelligence(1-20)/willpower(1-20)", constraints: "6属性总和 ≤ tier×17, accuracy+evasion ≤ 1.3" },
      { name: "items", type: "array", required: false, description: "物品数组，每个需: name/item_type(consumable/material/armor/misc)/rarity(common/uncommon/rare/legendary)/value", constraints: "consumable必填: effect_type(heal/damage/restore)/effect_value(数字)；misc为null" },
      { name: "status_effects", type: "array", required: false, description: "状态效果数组，每个需: name/effect_type(buff/debuff/dot/hot/stun/root)/target_attribute(hp/strength/agility/endurance/perception/intelligence/willpower)/magnitude/duration", constraints: "target_attribute 必填" },
      { name: "actions", type: "array", required: false, description: "行为数组，每个需: name/action_type(combat/social/exploration/craft/survival)/primary_attr/difficulty(1-30)/success_result(JSON)/failure_result(JSON)" },
    ],
    example_call: `world_gen db_path: "./worlds/game.db", weapons: [{name: "铁管", category: "melee", damage_type: "bludgeoning", damage_min: 3, damage_max: 7, accuracy: 0.75, tier: 1, rarity: "common"}], monsters: [{name: "变异鼠", category: "beast", hp: 12, damage_min: 2, damage_max: 4, accuracy: 0.6, evasion: 0.35, armor: 0, tier: 1, xp_reward: 6, strength: 3, agility: 5, endurance: 3, perception: 4, intelligence: 1, willpower: 1}], items: [{name: "治疗粉", item_type: "consumable", rarity: "common", value: 15, effect_type: "heal", effect_value: 20}]`,
  },

  combat_resolve: {
    name: "combat_resolve",
    description: "一键战斗裁定（命中+暴击+伤害+元素+传奇特效）。支持 25 种触发器 × 25 种效果类型 = 625 种传奇组合",
    parameters: [
      { name: "attacker.stats", type: "object", required: true, description: "6属性: strength/agility/endurance/perception/intelligence/willpower (各0-20)" },
      { name: "attacker.weapon", type: "object", required: true, description: "武器: damage_min/damage_max/accuracy(0-1)/damage_type(slashing/piercing/bludgeoning/thermal/explosive/chemical)" },
      { name: "attacker.element", type: "object", required: false, description: "元素效果: {element_type(fire/corrosive/shock/frost/explosive), proc_chance(0-1)}" },
      { name: "attacker.legendary", type: "object", required: false, description: "传奇特效: {effect_name, trigger(25种), effect_type(25种), magnitude}" },
      { name: "attacker.crit_chance", type: "number", required: false, description: "暴击概率 0.0-1.0 (默认0.05)" },
      { name: "attacker.flags", type: "array", required: false, description: "战斗标记: stealth/counter_attack/reload/empty_mag/full_mag/weapon_jam/first_blood/reflect/dodge/parry" },
      { name: "attacker.hp", type: "number", required: false, description: "攻击者当前HP (用于on_low_attacker_hp/on_berserk等触发器)" },
      { name: "attacker.hp_max", type: "number", required: false, description: "攻击者最大HP" },
      { name: "attacker.ammo", type: "number", required: false, description: "当前弹药数" },
      { name: "attacker.max_ammo", type: "number", required: false, description: "最大弹药容量" },
      { name: "defender.evasion", type: "number", required: true, description: "防御者闪避 0.0-1.0" },
      { name: "defender.armor", type: "number", required: true, description: "防御者护甲值" },
      { name: "defender.hp", type: "number", required: true, description: "防御者当前HP" },
      { name: "defender.hp_max", type: "number", required: false, description: "防御者最大HP" },
    ],
    example_call: `combat_resolve attacker: {stats: {strength:8,...}, weapon: {damage_min:5,damage_max:10,accuracy:0.75,damage_type:"slashing"}, legendary: {effect_name:"断骨", trigger:"on_crit", effect_type:"bleed", magnitude:3}, crit_chance:0.05}, defender: {evasion:0.2, armor:3, hp:30, hp_max:30}`,
  },

  skill_check: {
    name: "skill_check",
    description: "属性/技能检定（1d20）",
    parameters: [
      { name: "difficulty", type: "number", required: true, description: "难度值", constraints: "1-30" },
      { name: "modifier", type: "number", required: false, description: "属性修正值。推荐: attribute_value - 5。例如敏捷8→+3", example: "3" },
    ],
  },

  craft: {
    name: "craft",
    description: "制作物品",
    parameters: [
      { name: "recipe", type: "object", required: true, description: "制作配方，包含 result_item/result_quantity/ingredients" },
      { name: "inventory", type: "array", required: true, description: "玩家背包 [{item_name, quantity}]" },
      { name: "mechanics", type: "number", required: false, description: "机械技能等级，提高产量" },
    ],
  },

  travel: {
    name: "travel",
    description: "世界地图节点间移动，自动遇敌。需要 db_path",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库文件路径" },
      { name: "current_location", type: "string", required: true, description: "当前位置" },
      { name: "target_location", type: "string", required: true, description: "目标位置" },
      { name: "stealth", type: "number", required: false, description: "潜行技能，降低遇敌概率" },
      { name: "tracking", type: "number", required: false, description: "追踪技能，发现额外信息" },
    ],
  },

  init_db: {
    name: "init_db",
    description: "创建游戏数据库 + 自动填充种子数据（75怪/13物品/12状态/15地点）",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库文件路径", example: "./worlds/game.db" },
      { name: "world_name", type: "string", required: false, description: "世界名称" },
    ],
  },

  generate_loot: {
    name: "generate_loot",
    description: "按敌人tier生成完整掉落（货币+物品+武器含稀有度表）",
    parameters: [
      { name: "tier", type: "number", required: true, description: "敌人tier 1-5", constraints: "1-5" },
    ],
  },

  generate_weapon: {
    name: "generate_weapon",
    description: "随机生成武器（稀有度/类型/属性/元素/传奇特效）。名称和描述由LLM填充",
    parameters: [
      { name: "weapon_type", type: "string", required: false, description: "melee/ranged/thrown（不传则随机）" },
      { name: "min_rarity", type: "string", required: false, description: "最低稀有度 common/uncommon/rare/legendary" },
      { name: "max_rarity", type: "string", required: false, description: "最高稀有度" },
      { name: "tier", type: "number", required: false, description: "武器层级 1-5" },
      { name: "name_hint", type: "string", required: false, description: "名称提示" },
    ],
  },

  trade: {
    name: "trade",
    description: "买卖交易，使用generate_stock先生成库存",
    parameters: [
      { name: "credits", type: "number", required: true, description: "玩家当前货币" },
      { name: "items", type: "array", required: true, description: "购买项 [{item_name, quantity, price_per_unit}]" },
      { name: "mode", type: "string", required: true, description: "buy/sell", constraints: "buy/sell" },
      { name: "barter", type: "number", required: false, description: "议价技能，买-2%/点，卖+2%/点" },
      { name: "price_modifier", type: "number", required: false, description: "价格修正系数" },
    ],
  },

  loot: {
    name: "loot",
    description: "自定义掉落表掷骰",
    parameters: [
      { name: "table", type: "array", required: true, description: "掉落表 [{item_name, drop_chance(0-1), quantity_min, quantity_max}]" },
      { name: "luck_modifier", type: "number", required: false, description: "幸运修正" },
      { name: "survival", type: "number", required: false, description: "生存技能，增加数量上限" },
      { name: "locksmith", type: "number", required: false, description: "开锁技能，增加掉落概率" },
    ],
  },

  consume: {
    name: "consume",
    description: "使用消耗品",
    parameters: [
      { name: "item", type: "object", required: true, description: "物品 {name, effect_type, effect_value}" },
      { name: "target", type: "object", required: true, description: "目标 {hp, hp_max}" },
      { name: "medicine", type: "number", required: false, description: "医疗技能" },
    ],
  },

  equip_item: {
    name: "equip_item",
    description: "装备物品到槽位 (weapon/head/chest/legs/accessory1/accessory2)",
    parameters: [
      { name: "slot", type: "string", required: true, description: "装备槽位" },
      { name: "item", type: "object", required: true, description: "装备数据 {name, item_type, defense?, stat_bonuses?}" },
      { name: "current_equipment", type: "object", required: true, description: "当前装备状态" },
    ],
  },

  explore: {
    name: "explore",
    description: "搜索当前POI/地点",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
      { name: "location_name", type: "string", required: true, description: "地点名称" },
    ],
  },

  get_encounter: {
    name: "get_encounter",
    description: "按危险等级从monsters表选取遇敌怪物",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
      { name: "danger_level", type: "number", required: true, description: "危险等级 1-5" },
    ],
  },

  create_quest: {
    name: "create_quest",
    description: "创建任务 (delivery/exploration/fetch/kill)",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
      { name: "title", type: "string", required: true, description: "任务标题" },
      { name: "description", type: "string", required: true, description: "任务描述" },
      { name: "quest_type", type: "string", required: true, description: "delivery/exploration/fetch/kill" },
      { name: "giver_npc", type: "string", required: true, description: "给任务的NPC" },
      { name: "target_location", type: "string", required: false, description: "目标地点" },
      { name: "reward_credits", type: "number", required: false, description: "奖励瓶盖" },
      { name: "reward_item_name", type: "string", required: false, description: "奖励物品名" },
      { name: "time_limit_minutes", type: "number", required: false, description: "时限（分钟）" },
      { name: "reward_weapon_name", type: "string", required: false, description: "奖励武器名" },
    ],
  },

  level_up: {
    name: "level_up",
    description: "升级检查（每级+1属性点 +3技能点）",
    parameters: [
      { name: "level", type: "number", required: true, description: "当前等级" },
      { name: "xp", type: "number", required: true, description: "当前经验值" },
      { name: "xp_for_next", type: "number", required: false, description: "每级XP公式，默认100" },
      { name: "attribute_points", type: "number", required: false, description: "属性点数量" },
      { name: "skill_points", type: "number", required: false, description: "技能点数量" },
    ],
  },

  quick_travel: {
    name: "quick_travel",
    description: "快速移动（消耗真实时间等待）",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
      { name: "from", type: "string", required: true, description: "出发地" },
      { name: "to", type: "string", required: true, description: "目的地" },
      { name: "distance_km", type: "number", required: true, description: "距离（公里）" },
      { name: "speed_kmh", type: "number", required: false, description: "移动速度 km/h" },
    ],
  },

  generate_stock: {
    name: "generate_stock",
    description: "按NPC类型生成交易库存 (villager/scavenger/trader/merchant)",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
      { name: "type", type: "string", required: true, description: "villager/scavenger/trader/merchant" },
    ],
  },

  dice: {
    name: "dice",
    description: "掷骰 (2d6, 1d20+3, d100)",
    parameters: [
      { name: "notation", type: "string", required: true, description: "骰子表达式", example: "2d6", constraints: "2d6/1d20+3/d100/3d8+2d6-1" },
    ],
  },

  db_query: {
    name: "db_query",
    description: "SQLite 只读查询",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
      { name: "sql", type: "string", required: true, description: "SELECT语句" },
      { name: "params", type: "array", required: false, description: "查询参数" },
    ],
  },

  db_exec: {
    name: "db_exec",
    description: "SQLite 写入操作 (INSERT/UPDATE/DELETE)",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
      { name: "sql", type: "string", required: true, description: "SQL语句" },
      { name: "params", type: "array", required: false, description: "查询参数" },
    ],
  },

  legendary_gen: {
    name: "legendary_gen",
    description: "传奇特效生成/校验。支持25种触发器×25种效果类型",
    parameters: [
      { name: "mode", type: "string", required: true, description: "seed(生成种子) 或 validate(校验效果)" },
      { name: "effect", type: "object", required: false, description: "要校验的效果 {name, trigger(25种之一), effect_type(25种之一), magnitude, description} (validate模式)" },
      { name: "weapon_tier", type: "number", required: false, description: "武器tier 1-5 (validate模式)", constraints: "1-5" },
      { name: "weapon_context", type: "object", required: false, description: "武器上下文用于适配性检查 {weapon_type(melee/ranged/thrown), tier, damage_type?, ammo_type?} (validate模式)" },
    ],
    example_call: `legendary_gen mode: "validate", effect: {name:"断骨", trigger:"on_crit", effect_type:"bleed", magnitude:3, description:"暴击时撕裂伤口"}, weapon_tier: 3, weapon_context: {weapon_type:"melee", tier:3}`,
  },

  status_apply: {
    name: "status_apply",
    description: "附着状态效果 (DOT/HOT/buff/debuff)",
    parameters: [
      { name: "effect.name", type: "string", required: true, description: "效果名" },
      { name: "effect.effect_type", type: "string", required: true, description: "dot/hot/buff/debuff/stun/root" },
      { name: "effect.magnitude", type: "number", required: true, description: "效果强度 (负=伤害, 正=回复)" },
      { name: "effect.duration", type: "number", required: true, description: "持续回合" },
      { name: "current_effects", type: "array", required: true, description: "当前效果列表" },
    ],
  },

  status_tick: {
    name: "status_tick",
    description: "每回合状态结算 (DOT扣血/HOT回血/到期移除)",
    parameters: [
      { name: "active_effects", type: "array", required: true, description: "当前效果列表 [{effect_name, effect_type, magnitude, remaining_turns}]" },
      { name: "target_hp", type: "number", required: true, description: "当前HP" },
      { name: "target_hp_max", type: "number", required: true, description: "最大HP" },
    ],
  },

  check_arrival: {
    name: "check_arrival",
    description: "检查快速移动是否已到达目的地",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
    ],
  },

  game_time: {
    name: "game_time",
    description: "查询当前游戏时间 (年/月/日/时/分/星期/昼夜)",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
    ],
  },

  discover_location: {
    name: "discover_location",
    description: "发现新世界地图节点，从已有地点延伸",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
      { name: "name", type: "string", required: true, description: "新地点名称" },
      { name: "connected_to", type: "string", required: true, description: "从哪个已有地点连接" },
      { name: "description", type: "string", required: true, description: "地点描述" },
      { name: "danger_level", type: "number", required: false, description: "危险等级 1-5" },
      { name: "distance_km", type: "number", required: false, description: "距离" },
      { name: "has_shelter", type: "boolean", required: false, description: "是否可安全休息" },
      { name: "region", type: "string", required: false, description: "所属区域" },
      { name: "connection_description", type: "string", required: false, description: "连接描述" },
    ],
  },

  discover_poi: {
    name: "discover_poi",
    description: "发现当前地点内的新POI（房间/建筑/地标）— 不是世界地图节点",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
      { name: "location_name", type: "string", required: true, description: "父地点名称" },
      { name: "name", type: "string", required: true, description: "POI名称" },
      { name: "description", type: "string", required: true, description: "POI描述" },
      { name: "connected_to", type: "string", required: false, description: "从哪个已有POI连接" },
      { name: "to_location", type: "string", required: false, description: "出口→世界地图节点" },
      { name: "has_shelter", type: "boolean", required: false, description: "是否有庇护所" },
    ],
  },

  move_to: {
    name: "move_to",
    description: "在当前地点内的POI间移动",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
      { name: "location_name", type: "string", required: true, description: "当前地点" },
      { name: "target_poi", type: "string", required: true, description: "目标POI" },
    ],
  },

  get_map: {
    name: "get_map",
    description: "查看已发现的地点地图和连接",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
      { name: "current_location", type: "string", required: false, description: "当前所在位置" },
    ],
  },

  log_event: {
    name: "log_event",
    description: "记录游戏事件到历史（每次关键行动后调用）",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
      { name: "event_type", type: "string", required: true, description: "combat/exploration/social/loot/level_up/quest/narrative/system" },
      { name: "summary", type: "string", required: true, description: "一句话总结" },
      { name: "detail", type: "string", required: false, description: "详细数据 (JSON)" },
    ],
  },

  get_history: {
    name: "get_history",
    description: "读取最近游戏事件（新会话启动时恢复上下文）",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
      { name: "limit", type: "number", required: false, description: "最多返回条数 (默认20)" },
      { name: "event_type", type: "string", required: false, description: "按类型过滤" },
    ],
  },

  active_quests: {
    name: "active_quests",
    description: "查看当前进行中的任务列表",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
    ],
  },

  complete_quest: {
    name: "complete_quest",
    description: "完成任务并发放奖励（credits/items/weapons）",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
      { name: "quest_id", type: "number", required: true, description: "任务ID" },
      { name: "character_id", type: "number", required: true, description: "玩家角色ID" },
    ],
  },

  take_loot: {
    name: "take_loot",
    description: "将选中的掉落物品写入背包（未被选中的留在原地）",
    parameters: [
      { name: "db_path", type: "string", required: true, description: "数据库路径" },
      { name: "character_id", type: "number", required: true, description: "角色ID" },
      { name: "items", type: "array", required: true, description: "要拿的物品 [{type:currency/item/weapon, name, quantity}]" },
    ],
  },

  gm_guide: {
    name: "gm_guide",
    description: "GM行为指南 (encounters/combat/loot/exploration/balance/attributes/schedule)",
    parameters: [
      { name: "topic", type: "string", required: false, description: "主题名", constraints: "encounters/combat/loot/exploration/balance/attributes/schedule" },
    ],
  },

  unequip_item: {
    name: "unequip_item",
    description: "脱掉装备",
    parameters: [
      { name: "slot", type: "string", required: true, description: "装备槽位 weapon/head/chest/legs/accessory1/accessory2" },
      { name: "current_equipment", type: "object", required: true, description: "当前装备状态" },
    ],
  },

  equipment_stats: {
    name: "equipment_stats",
    description: "查看总装备属性（防御+加成）",
    parameters: [
      { name: "equipment", type: "object", required: true, description: "当前装备状态" },
    ],
  },

  tool_help: {
    name: "tool_help",
    description: "查看工具的完整参数schema和约束",
    parameters: [
      { name: "name", type: "string", required: true, description: "工具名或'list'查看全部", example: "world_gen" },
    ],
  },
};

export function getToolHelp(name: string): ToolHelpResult {
  if (name === "list") {
    const names = Object.keys(TOOLS);
    return {
      found: true,
      tool: {
        name: "list",
        description: `Available tools: ${names.join(", ")}`,
        parameters: [],
      },
    };
  }

  const tool = TOOLS[name];
  if (!tool) {
    return {
      found: false,
      tool: { name, description: "", parameters: [] },
      error: `Tool "${name}" not found. Use 'list' to see available tools.`,
    };
  }

  return { found: true, tool };
}
