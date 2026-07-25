# Chronika Engine — 完整设计文档

## 1. 项目概述

### 项目定位

Chronika Engine 是一个**数据驱动的废土生存文字 RPG 引擎**，基于 Pi 扩展系统构建。玩家通过自然语言与游戏互动，但不依赖 LLM 做任何数值计算——LLM 只扮演游戏主持人（GM），负责叙事和决策。所有游戏机制（战斗、探索、交易、升级、掉落等）由 TypeScript 引擎层执行，数据持久化在 SQLite 中。

### 设计哲学

- **分工明确**：大模型做 GM，引擎做计算，SQLite 做存储
- **无状态引擎函数**：Engine 层全部是纯函数，可独立单元测试
- **校验优先**：所有数据写入前经过完整的校验体系
- **工具驱动交互**：玩家 ↔ LLM ↔ Tool（Pi 注册）↔ Engine ↔ SQLite
- **种子数据开箱即用**：初始化数据库即包含 75 怪物、13 物品、12 状态效果、15 地点

### 技术栈

| 层 | 技术 |
|---|---|
| 运行时 | Pi 扩展系统 |
| 语言 | TypeScript (ESM) |
| 数据库 | SQLite (sql.js WASM，无需外部依赖) |
| 参数校验 | TypeBox |
| 测试 | node:test + assert |

---

## 2. 架构总览

### 三层架构

```
┌────────────────────────────────────────────┐
│  LLM (GM/Narrative)                        │
│  叙事、决策、角色扮演                         │
└──────────────┬─────────────────────────────┘
               │ tool call
┌──────────────▼─────────────────────────────┐
│  Tools (Pi 注册层)                          │
│  参数校验 (TypeBox)、DB 操作、结果格式化       │
│  每个工具调用一个 engine 纯函数                │
└──────────────┬─────────────────────────────┘
               │ 纯函数调用
┌──────────────▼─────────────────────────────┐
│  Engine (纯逻辑，无副作用，可测试)             │
│  dice / combat / skill-check / loot /       │
│  craft / trade / equip / level-up / quest / │
│  exploration / time / status / legendary ... │
└──────────────┬─────────────────────────────┘
               │ SQL 读写
┌──────────────▼─────────────────────────────┐
│  SQLite (sql.js WASM, 21 张表)              │
│  world_meta / characters / weapons / items  │
│  / monsters / inventory / locations / ...   │
└────────────────────────────────────────────┘
```

### 数据流

```
玩家输入 → LLM 叙事/决策 → Tool Call → Engine 函数 → SQLite 读写
                                                    ↓
玩家阅读 ←── LLM 叙事 ←──── Tool 结果  ←── Engine 结果
```

关键原则：**LLM 不自行计算任何数值**。所有机制判定（命中、伤害、掉落、检定）必须通过 tool call 交给引擎。

### 架构图（ASCII）

```
 Pi 扩展入口 (index.ts)
     │
     ├─ 注册 24 个 Tool
     │
     ├── dice.ts        →  engine/dice.ts
     ├── db.ts          →  db/schema.ts + db/seed.ts + db/connection.ts
     ├── world-gen.ts   →  engine/world-gen.ts + validation/*
     ├── combat.ts      →  engine/combat.ts
     ├── skill-check.ts →  engine/skill-check.ts
     ├── loot.ts        →  engine/loot.ts
     ├── loot-gen.ts    →  engine/loot-gen.ts + engine/weapon-gen.ts
     ├── consume.ts     →  engine/consume.ts
     ├── craft.ts       →  engine/craft.ts
     ├── trade.ts       →  engine/trade.ts
     ├── equip.ts       →  engine/equip.ts
     ├── status-runtime.ts → engine/status-runtime.ts
     ├── level-up.ts    →  engine/level-up.ts
     ├── legendary-gen.ts → engine/legendary-gen.ts
     ├── weapon-gen.ts  →  engine/weapon-gen.ts
     ├── exploration.ts →  engine/exploration.ts
     ├── encounter.ts   →  engine/encounter.ts
     ├── quest.ts       →  engine/quest.ts
     ├── time.ts        →  engine/time.ts
     ├── trader.ts      →  engine/trader.ts
     ├── take-loot.ts   →  engine/take-loot.ts
     ├── event-log.ts   →  engine/event-log.ts
     ├── tool-help.ts   →  engine/tool-help.ts
     └── gm-guide.ts    →  (内置文本)
```

---

## 3. 目录结构

```
chronika/
├── index.ts                  # Pi 扩展入口，注册所有工具
├── package.json
├── engine/                    # 纯逻辑层（无副作用，可测试）
│   ├── dice.ts               # 骰子表达式解析与掷骰
│   ├── combat.ts             # 战斗裁定（命中→伤害→元素→传奇）
│   ├── skill-check.ts        # 1d20 属性/技能检定
│   ├── loot.ts               # 自定义掉落表掷骰
│   ├── loot-gen.ts           # 按 tier 自动生成掉落（货币+物品+武器）
│   ├── consume.ts            # 消耗品使用（heal/damage/restore）
│   ├── craft.ts              # 物品制作（材料扣除+产量计算）
│   ├── trade.ts              # 买卖交易（价格修正+议价技能）
│   ├── equip.ts              # 装备管理（6 槽位+统计）
│   ├── status-runtime.ts     # 状态效果附着/每回合结算
│   ├── level-up.ts           # 升级检查（XP→等级+属性点+技能点）
│   ├── legendary-gen.ts      # 传奇特效种子生成与校验
│   ├── weapon-gen.ts         # 武器随机生成（稀有度/类型/元素/传奇）
│   ├── world-gen.ts          # 世界数据批量写入（含全盘校验）
│   ├── exploration.ts        # 地图/探索/POI/移动系统
│   ├── encounter.ts          # 遇敌怪物选取
│   ├── quest.ts              # 任务创建/查询/完成（含事务保护）
│   ├── time.ts               # 游戏时间（1:1现实时间+快速移动）
│   ├── trader.ts             # 商人库存生成
│   ├── take-loot.ts          # 掉落物写入背包
│   ├── event-log.ts          # 事件日志记录与查询
│   ├── tool-help.ts          # 工具参数文档（39 工具 schema 注册表）
│   └── validation/           # 数据校验层
│       ├── weapon.ts         # 武器校验（13 条规则）
│       ├── monster.ts        # 怪物校验（~10 条规则+平衡性约束）
│       ├── item.ts           # 物品校验（条件依赖+枚举）
│       ├── action.ts         # 行为校验（类型+属性枚举）
│       └── status-effect.ts  # 状态效果校验（类型约束+magnitude 规则）
├── db/
│   ├── connection.ts         # sql.js WASM 加载单例
│   ├── schema.ts             # 21 张表 DDL（SCHEMA_VERSION=8）
│   └── seed.ts               # 种子数据（75 怪物/13 物品/12 状态/15 地点+连接）
├── tools/                     # Pi 工具注册（每个对应 engine/ 模块）
│   ├── dice.ts
│   ├── db.ts                 # init_db / db_query / db_exec
│   ├── world-gen.ts
│   ├── combat.ts
│   ├── skill-check.ts
│   ├── loot.ts
│   ├── loot-gen.ts
│   ├── consume.ts
│   ├── craft.ts
│   ├── trade.ts
│   ├── equip.ts
│   ├── status-runtime.ts
│   ├── level-up.ts
│   ├── legendary-gen.ts
│   ├── weapon-gen.ts
│   ├── exploration.ts        # 6 个子工具
│   ├── encounter.ts
│   ├── quest.ts
│   ├── time.ts
│   ├── trader.ts
│   ├── take-loot.ts
│   ├── event-log.ts
│   ├── tool-help.ts
│   └── gm-guide.ts           # GM 行为指南（7 个主题）
├── tests/
│   ├── engine/               # 引擎层单元测试（20 个文件）
│   │   └── validation/       # 校验器测试（5 个文件）
│   ├── db/                   # 数据库测试 + seed 验证（3 个文件）
│   └── tools/                # 工具层集成测试（1 个文件）
└── docs/
    └── ARCHITECTURE.md
```

---

## 4. 数据库 Schema（21 张表）

SCHEMA_VERSION = 8，所有表通过 `PRAGMA foreign_keys = ON` 启用外键约束。

### 4.1 world_meta

世界元数据，每个数据库一条。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| world_name | TEXT NOT NULL | 世界名称 |
| world_desc | TEXT | 世界描述 |
| tone | TEXT | 基调（如 "废土"） |
| created_at | TEXT | 创建时间 |
| version | INTEGER DEFAULT 1 | |

### 4.2 characters

角色（玩家和 NPC）。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT NOT NULL | |
| is_player | INTEGER DEFAULT 0 | 是否玩家角色 |
| level | INTEGER DEFAULT 1 | 等级 |
| xp | INTEGER DEFAULT 0 | 经验值 |
| hp / hp_max | INTEGER NOT NULL | 当前/最大 HP |
| strength ~ willpower | INTEGER DEFAULT 5 | 6 属性 |
| persuasion ~ mechanics | INTEGER DEFAULT 5 | 8 技能 |
| credits | INTEGER DEFAULT 0 | 瓶盖（货币） |
| current_location | TEXT | 当前位置名 |
| created_at | TEXT | |

### 4.3 weapons

武器数据表。初始化时为空，由 GM 用 `generate_weapon` 或 `world_gen` 填充。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT NOT NULL UNIQUE | |
| category | TEXT NOT NULL | melee/ranged/thrown/explosive |
| damage_type | TEXT NOT NULL | slashing/piercing/bludgeoning/thermal/explosive/chemical |
| damage_min / damage_max | INTEGER NOT NULL | |
| accuracy | REAL NOT NULL | 0.0-1.0 |
| durability | INTEGER | |
| rarity | TEXT NOT NULL | common/uncommon/rare/legendary |
| tier | INTEGER DEFAULT 1 | |
| weight | REAL | |
| value | INTEGER DEFAULT 0 | |
| range_min / range_max | INTEGER | 远程武器必填 |
| ammo_type | TEXT | 远程武器必填 |
| special_effect | TEXT | |
| description | TEXT | |
| flavor_text | TEXT | |

### 4.4 items

物品数据表。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT NOT NULL UNIQUE | |
| item_type | TEXT NOT NULL | consumable/material/armor/misc |
| rarity | TEXT NOT NULL | common/uncommon/rare/legendary |
| value | INTEGER DEFAULT 0 | |
| weight | REAL | |
| stackable | INTEGER DEFAULT 1 | |
| stack_max | INTEGER DEFAULT 99 | |
| effect_type | TEXT | heal/damage/restore |
| effect_value | INTEGER | |
| description | TEXT | |

### 4.5 monsters

怪物数据表。种子数据包含 75 种（5 tier × 15 种）。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT NOT NULL UNIQUE | |
| category | TEXT NOT NULL | beast/mutant/humanoid/mechanical/abomination |
| hp | INTEGER NOT NULL | |
| strength ~ willpower | INTEGER DEFAULT 5 | 6 属性 |
| damage_min / damage_max | INTEGER NOT NULL | |
| accuracy | REAL NOT NULL | 0.0-1.0 |
| evasion | REAL DEFAULT 0 | 0.0-1.0 |
| armor | INTEGER DEFAULT 0 | |
| tier | INTEGER DEFAULT 1 | |
| xp_reward | INTEGER DEFAULT 0 | |
| description | TEXT | |
| behavior_text | TEXT | |

### 4.6 inventory

角色背包（物品+武器）。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| character_id | INTEGER NOT NULL | FK → characters |
| item_id | INTEGER | FK → items |
| weapon_id | INTEGER | FK → weapons |
| quantity | INTEGER DEFAULT 1 | |
| is_equipped | INTEGER DEFAULT 0 | 0=背包, 1=已装备 |

### 4.7 event_log

游戏事件历史。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| turn | INTEGER DEFAULT 0 | 自动递增 |
| event_type | TEXT NOT NULL | combat/exploration/social/loot/level_up/quest/narrative/system |
| summary | TEXT | 一句话总结 |
| detail | TEXT | 详细数据 (JSON) |
| created_at | TEXT | |

### 4.8 game_state

键值对存储（快速移动状态、游戏时间基准等）。

| 列 | 类型 | 说明 |
|---|---|---|
| key | TEXT PK | |
| value | TEXT NOT NULL | JSON 值 |

### 4.9 plugin_registry

插件注册表。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| plugin_name | TEXT NOT NULL UNIQUE | |
| category | TEXT NOT NULL | |
| description | TEXT | |
| enabled | INTEGER DEFAULT 1 | |

### 4.10 status_effects

状态效果定义。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT NOT NULL UNIQUE | |
| effect_type | TEXT NOT NULL | dot/hot/buff/debuff/stun/root |
| target_attribute | TEXT NOT NULL | |
| magnitude | INTEGER NOT NULL | |
| duration | INTEGER NOT NULL | |
| stackable | INTEGER DEFAULT 0 | |
| max_stacks | INTEGER | |
| description | TEXT | |

### 4.11 actions

行为/动作定义。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT NOT NULL UNIQUE | |
| action_type | TEXT NOT NULL | combat/social/exploration/craft/survival |
| primary_attr | TEXT NOT NULL | strength/agility/... 或 survival/medicine/... |
| difficulty | INTEGER NOT NULL | 1-30 |
| cooldown | INTEGER DEFAULT 0 | |
| success_result | TEXT NOT NULL | JSON |
| failure_result | TEXT NOT NULL | JSON |
| description | TEXT | |

### 4.12 brands

武器品牌/制造商。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT NOT NULL UNIQUE | |
| tagline | TEXT | |
| stat_bias | TEXT | |
| unique_rule | TEXT | |
| description | TEXT | |

### 4.13 weapon_parts

武器部件（用于生成系统）。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT NOT NULL | |
| part_slot | TEXT NOT NULL | |
| rarity | TEXT NOT NULL | |
| stat_mods | TEXT NOT NULL | JSON |
| description | TEXT | |

### 4.14 legendary_effects

传奇特效定义。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT NOT NULL | |
| trigger | TEXT NOT NULL | on_hit/on_kill/on_crit/on_reload/on_empty_mag/on_low_hp/on_miss |
| effect_type | TEXT NOT NULL | multiply_damage/aoe_explosion/lifesteal/refill_ammo/chain_lightning/summon/debuff_enemy |
| magnitude | REAL NOT NULL | |
| description | TEXT | |
| created_by | TEXT DEFAULT 'legendary_gen' | |

### 4.15 generated_weapons

运行时生成的武器实例。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | |
| base_weapon_id | INTEGER | |
| brand_id | INTEGER | |
| part_ids | TEXT | JSON 数组 |
| element_id | INTEGER | |
| legendary_id | INTEGER | FK → legendary_effects |
| current_durability | INTEGER | |
| current_ammo | INTEGER | |
| owner_id | INTEGER | FK → characters |
| created_at | TEXT | |

### 4.16 locations

世界地图节点。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT NOT NULL UNIQUE | |
| region | TEXT | 所属区域 |
| description | TEXT | |
| danger_level | INTEGER DEFAULT 1 | 1-5 |
| has_shelter | INTEGER DEFAULT 0 | 是否可安全休息 |
| discovered | INTEGER DEFAULT 0 | |
| visited | INTEGER DEFAULT 0 | |

### 4.17 location_connections

地点之间的道路连接。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| from_location | TEXT NOT NULL | |
| to_location | TEXT NOT NULL | |
| distance_km | REAL DEFAULT 1 | |
| description | TEXT | |

### 4.18 location_encounters

地点特定遭遇表（可选）。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| location_name | TEXT NOT NULL | |
| encounter_type | TEXT NOT NULL | combat/loot/event/npc |
| description | TEXT | |
| probability | REAL DEFAULT 0.3 | |
| monster_id | INTEGER | |

### 4.19 location_pois

地点内的兴趣点（POI）——局部地图。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| location_name | TEXT NOT NULL | 父地点 |
| name | TEXT NOT NULL | POI 名称 |
| description | TEXT | |
| has_shelter | INTEGER DEFAULT 0 | |
| discovered | INTEGER DEFAULT 0 | |
| UNIQUE(location_name, name) | | |

### 4.20 poi_connections

POI 之间的连接（局部地图路径）。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| location_name | TEXT NOT NULL | |
| from_poi | TEXT NOT NULL | |
| to_poi | TEXT | 连向另一个 POI |
| to_location | TEXT | 出口→世界地图节点 |
| description | TEXT | |

### 4.21 quests

任务系统。

| 列 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | |
| title | TEXT NOT NULL | |
| description | TEXT | |
| quest_type | TEXT NOT NULL | delivery/exploration/fetch/kill |
| giver_npc | TEXT | |
| target_location | TEXT | |
| reward_credits | INTEGER DEFAULT 0 | |
| reward_item_name | TEXT | |
| reward_weapon_name | TEXT | |
| time_limit_minutes | INTEGER | |
| status | TEXT DEFAULT 'active' | active/completed |
| accepted_at | TEXT | |
| completed_at | TEXT | |

---

## 5. Engine 层详解

### 5.1 dice.ts — 骰子系统

- **接口**：`rollDice(expression: string): DiceResult`
- **功能**：解析 `2d6`、`1d20+3`、`3d8+2d6-1` 等表达式
- **返回**：`{ total, terms: [{rolls, sides, count, subtotal}], modifiers, expression }`
- **依赖**：无

### 5.2 combat.ts — 战斗裁定

- **接口**：`combatResolve(input: CombatInput): CombatResult`
- **流程**：命中判定 → 伤害计算 → 元素触发 → 传奇特效 → HP 结算
- **命中公式**：`hitThreshold = max(0, round((effectiveAccuracy - effectiveEvasion) * 100))`
  - `effectiveAccuracy = weapon.accuracy + (perception-5)*0.02 + (agility-5)*0.02`
  - `effectiveEvasion = defender.evasion + (defender.agility-5)*0.02`
- **伤害公式**：`finalDamage = rawDamage + floor(strength/4) - armor`
- **元素触发**：`rollD100() <= proc_chance * 100`
- **传奇处理**：`on_hit` 触发器 → `multiply_damage` / `lifesteal` / `aoe_explosion`
- **依赖**：无

### 5.3 skill-check.ts — 属性/技能检定

- **接口**：`skillCheck(input: SkillCheckInput): SkillCheckResult`
- **公式**：`total = rollD20() + modifier`，`success = total >= difficulty`
- **critical**：`margin >= 10` 或 `margin <= -10`
- **依赖**：无

### 5.4 loot.ts — 自定义掉落表掷骰

- **接口**：`rollLoot(input: LootInput): LootResult`
- **公式**：`threshold = max(0, min(100, drop_chance*100 + luckBonus))`
- **修正**：`luckBonus = luckModifier*100 + locksmith*2`，`survivalBonus = floor(survival/3)`
- **依赖**：无

### 5.5 loot-gen.ts — 按 tier 自动生成掉落

- **接口**：`generateLoot(input: GenerateLootInput): GenerateLootResult`
- **逻辑**：
  1. 货币（总是掉落）：`tier*2 + random(0, tier*3)` 瓶盖
  2. 物品（概率掉落）：`p = 0.3 + tier*0.12`
  3. 武器（概率掉落）：`p = 0.15 + tier*0.1`，通过稀有度表决定稀有度
- **稀有度表**（tier 1-5 各不同）：

| tier | common | uncommon | rare | legendary |
|------|--------|----------|------|-----------|
| 1-2  | 60%    | 30%      | 8%   | 2%        |
| 3    | 20%    | 40%      | 30%  | 10%       |
| 4-5  | 5%     | 20%      | 40%  | 35%       |

- **依赖**：`weapon-gen.ts`（生成武器掉落时调用 `generateWeapon`）

### 5.6 consume.ts — 消耗品使用

- **接口**：`consumeItem(input: ConsumeInput): ConsumeResult`
- **类型**：`heal`（不超过 hp_max，medicine 加成 `floor(medicine*1.5)`）、`damage`（不超过 hp）、`restore`（满血）
- **依赖**：无

### 5.7 craft.ts — 制作物品

- **接口**：`craftItem(input: CraftInput): CraftResult`
- **逻辑**：检查所有材料 → 不足则列出缺失项 → 充足则扣除材料并产出
- **加成**：`mechanicsBonus = floor(mechanics*0.2)` 额外产量
- **依赖**：无

### 5.8 trade.ts — 买卖交易

- **接口**：`trade(input: TradeInput): TradeResult`
- **公式**：`totalCost = round(Σ(quantity*price) * finalModifier)`
- **modifier**：`finalModifier = priceModifier + skillMod`
- **skillMod**（买）：`-barter*0.02`；**skillMod**（卖）：`+barter*0.02`
- **依赖**：无

### 5.9 equip.ts — 装备管理

- **接口**：`equipItem`, `unequipItem`, `calculateEquipmentStats`
- **槽位**：6 个（weapon/head/chest/legs/accessory1/accessory2）
- **计算**：装备时计算旧装备移除的 stat_changes 和新装备添加的 stat_changes，返回差值
- **依赖**：无

### 5.10 status-runtime.ts — 状态效果

- **接口**：`applyStatus`, `tickStatus`
- **附着**：同名效果刷新持续时间；不同类型追加
- **结算**：dot 扣血、hot 回血，每回合剩余次数-1，到期移除
- **依赖**：无

### 5.11 level-up.ts — 升级检查

- **接口**：`levelUp(input: LevelUpInput): LevelUpResult`
- **公式**：`needed = level * xpBase`（默认 xpBase=100）
- **奖励**：属性点 +1/级，技能点 +3/级
- **依赖**：无

### 5.12 legendary-gen.ts — 传奇特效生成

- **接口**：`generateSeed()`, `validateLegendaryEffect(input)`
- **触发类型**（7 种）：on_hit, on_kill, on_crit, on_reload, on_empty_mag, on_low_hp, on_miss
- **效果类型**（7 种）：multiply_damage, aoe_explosion, lifesteal, refill_ammo, chain_lightning, summon, debuff_enemy
- **Tier 上限**：tier 1→3.0, tier 2→5.0, tier 3→7.0, tier 4→9.0, tier 5→10.0
- **依赖**：无

### 5.13 weapon-gen.ts — 武器随机生成

- **接口**：`generateWeapon(input: GenerateWeaponInput): GenerateWeaponResult`
- **逻辑**：稀有度摇表 → 类型选择 → 伤害计算 → 远程属性 → 元素（uncommon+概率获取）→ 传奇（legendary 必得）
- **稀有度伤害范围**：

| 稀有度 | damage_min | damage_max | accuracy |
|--------|-----------|-----------|----------|
| melee  | 2-6       | 5-8       | 0.75 ± 0.1 |
| ranged | 2-6       | 5-8       | 0.60 ± 0.1 |
| thrown | 2-6       | 5-8       | 0.50 ± 0.1 |

- **依赖**：`legendary-gen.ts`

### 5.14 world-gen.ts — 世界数据批量写入

- **接口**：`generateWorld(db, input: WorldGenInput): WorldGenResult`
- **流程**：校验全部实体（weapons/monsters/items/status_effects/actions）→ 有错误则全盘拒绝 → 无错误则逐表写入
- **依赖**：`validation/weapon.ts`, `validation/monster.ts`, `validation/item.ts`, `validation/status-effect.ts`, `validation/action.ts`

### 5.15 exploration.ts — 探索/地图系统

- **子模块**（6 个函数）：
  - `discoverLocation(db, input)` — 从已有地点延伸发现新世界地图节点
  - `travel(db, input)` — 世界地图移动+自动遇敌判定
  - `explore(db, input)` — 搜索当前地点，显示 POI、连接和遭遇
  - `getKnownMap(db, currentLocation?)` — 查看已发现的地点与连接
  - `discoverPOI(db, input)` — 发现地点内的新兴趣点
  - `moveTo(db, input)` — 在当前地点的 POI 间移动
- **遇敌公式**（travel 中）：`avgDanger = (from.danger + to.danger) / 2`
  - 基准：`encounterChance = avgDanger*0.12 + 0.08`
  - 潜行修正：`finalChance = encounterChance * (1 - stealth*0.03)`
- **依赖**：无（直接操作 db）

### 5.16 encounter.ts — 遇敌怪物选取

- **接口**：`getEncounter(input: EncounterRequest): EncounterResult`
- **逻辑**：按 danger_level 精确匹配 → 无精确匹配则选最近 tier → 标记 approximate
- **依赖**：无（直接操作 db）

### 5.17 quest.ts — 任务系统

- **接口**：`createQuest`, `getActiveQuests`, `completeQuest`
- **类型**：delivery / exploration / fetch / kill
- **completeQuest**：事务保护（BEGIN/COMMIT/ROLLBACK）
  - 校验角色存在 → 校验任务存在且 active → 发放 credits → 发放 item → 发放 weapon → 标记 completed
- **依赖**：无（直接操作 db）

### 5.18 time.ts — 时间系统

- **接口**：`initGameTime`, `getGameTime`, `getFullTime`, `startQuickTravel`, `checkTravelArrival`
- **原理**：实际游戏时间 = `Date.now() - game_start_real`，游戏起始日期默认 2250-01-01T08:00
- **getFullTime**：返回年/月/日/时/分/星期/昼夜/时间描述（凌晨/早晨/上午/中午/下午/傍晚/夜间）
- **quickTravel**：`travelTime = distance_km / speed_kmh`，存储 `arrives_at` 时间戳到 game_state
- **依赖**：无（直接操作 db）

### 5.19 trader.ts — 商人库存生成

- **接口**：`generateStock(input: GenerateStockInput): GenerateStockResult`
- **类型**：villager / scavenger / trader / merchant，每种有不同物品数量和信用额度
- **逻辑**：优先从数据库 items/weapons 表取数据，无数据库则用默认列表
- **依赖**：无（直接操作 db）

### 5.20 take-loot.ts — 掉落物写入背包

- **接口**：`takeLoot(input: TakeLootInput): TakeLootResult`
- **逻辑**：currency→更新 credits，item→查 items 表再插 inventory，weapon→查 weapons 表再插 inventory
- **依赖**：无（直接操作 db）

### 5.21 event-log.ts — 事件日志

- **接口**：`logEvent(db, input)`, `getHistory(db, input?)`
- **逻辑**：turn 自动递增、支持按 event_type 和 since_id 过滤、默认返回最近 20 条
- **依赖**：无（直接操作 db）

### 5.22 tool-help.ts — 工具帮助文档

- **接口**：`getToolHelp(name: string): ToolHelpResult`
- **逻辑**：内置 39 个工具的完整参数 schema 和示例
- **依赖**：无

---

## 6. 属性与技能系统

### 6.1 属性（6 项）

| 属性 | 战斗影响 | 其他影响 |
|------|---------|----------|
| 力量 (strength) | 伤害加成 `floor(strength/4)` | |
| 敏捷 (agility) | 命中加成 `(agility-5)*0.02`、闪避加成 | 闪避/潜行检定 modifier |
| 耐力 (endurance) | HP 加成 `hp_max = 20 + endurance*2` | 扛伤害/长跑检定 |
| 感知 (perception) | 命中加成 `(perception-5)*0.02` | 侦查/搜索检定 |
| 智力 (intelligence) | | 知识/破解检定、craft 产量 `+floor(int*0.2)` |
| 意志 (willpower) | | 抗压/说服检定、状态抗性（时长减半） |

### 6.2 技能（8 项）

| 技能 | 引擎效果 | 公式 |
|------|---------|------|
| 生存 (survival) | 增加掉落数量 | `+floor(survival/3)` |
| 医疗 (medicine) | 增加治疗量 | `+floor(medicine*1.5)` |
| 机械 (mechanics) | 增加制作产量 | `+floor(mechanics*0.2)` |
| 议价 (barter) | 调整买卖价格 | 买 `-barter*2%`，卖 `+barter*2%` |
| 口才 (persuasion) | 交涉/欺骗检定 | skill_check modifier |
| 潜行 (stealth) | 降低遇敌概率 | `*(1-stealth*0.03)` |
| 开锁 (locksmith) | 开锁/陷阱检定，增加掉落概率 | `+locksmith*2` 到 looting threshold |
| 追踪 (tracking) | travel 中概率发现额外信息 | `p = tracking*0.05` |

### 6.3 升级

- **XP 公式**：`needed = level * 100`（默认，可通过 `xp_for_next` 自定义）
- **属性点**：+1/级
- **技能点**：+3/级
- **循环升级**：经验可能跨越多个等级，一次性计算所有晋级

---

## 7. 战斗系统

### 7.1 判定流程

```
combat_resolve(input)
 ├─ 1. 命中判定
 │     hitThreshold = max(0, round((effectiveAccuracy - effectiveEvasion) * 100))
 │     hitRoll = d100; hit = hitRoll <= hitThreshold
 │
 ├─ 2. 未命中 → 返回 { hit: false, hp_remaining, killed: false }
 │
 ├─ 3. 伤害计算
 │     rawDamage = rollBetween(damage_min, damage_max)
 │     strengthBonus = floor(strength / 4)
 │     beforeArmor = rawDamage + strengthBonus
 │     absorbed = min(armor, beforeArmor)
 │     finalDamage = beforeArmor - absorbed
 │
 ├─ 4. 元素触发
 │     procRoll = d100; elementalProc = procRoll <= proc_chance * 100
 │
 └─ 5. 传奇特效 (trigger = "on_hit" && hit)
       ├─ multiply_damage: finalDamage *= magnitude
       ├─ lifesteal: hpRestored = floor(finalDamage * magnitude)
       └─ aoe_explosion: aoeDamage = round(finalDamage * magnitude)
```

### 7.2 关键公式

| 公式 | 说明 |
|------|------|
| `effectiveAccuracy = weapon.accuracy + (perception-5)*0.02 + (agility-5)*0.02` | 攻击方法效命中 |
| `effectiveEvasion = defender.evasion + (defender.agility-5)*0.02` | 防御方法效闪避 |
| `hitThreshold = max(0, round((effectiveAccuracy - effectiveEvasion) * 100))` | d100 命中阈值 |
| `damage_final = max(0, rawDamage + floor(strength/4) - armor)` | 护甲吸收后的最终伤害 |

---

## 8. 装备系统

### 8.1 槽位（6 个）

```
weapon     — 武器
head       — 头盔
chest      — 胸甲
legs       — 腿甲
accessory1 — 饰品1
accessory2 — 饰品2
```

### 8.2 机制

- **equipItem**：计算旧装备移除的 stat_changes（sign=-1）和新装备添加的 stat_changes（sign=+1），返回差值
- **unequipItem**：返回移除装备的 stat_changes（sign=-1）
- **calculateEquipmentStats**：遍历所有已装备项，累加 defense 和 stat_bonuses

---

## 9. 地图与探索

### 9.1 两层地图

```
世界地图 (locations)
  ├─ 节点1: location
  │    ├─ POI a
  │    │    └─ poi_connections → POI b / to_location
  │    └─ POI b
  └─ 节点2: location
       └─ ...
```

- **世界地图**由 `locations` + `location_connections` 构成
- **局部地图**由 `location_pois` + `poi_connections` 构成
- 每个 POI 可以有 `to_location` 出口

### 9.2 travel 遇敌

- **内置自动遇敌**：每次 travel 独立判定，同一条路可重复遇敌
- **判定**：先查 `location_encounters` 表 → 无表数据则自动按 danger_level 生成
- **公式**：`encounterChance = avgDanger*0.12 + 0.08`，潜行修正后掷骰
- **type**：combat / loot / event / npc

### 9.3 扩展

- `discover_location`：从已有地点延伸世界地图（双向连接）
- `discover_poi`：在 location 内发现、命名和描述新场所
- `move_to`：在 location 内的 POI 间移动，可含跨世界地图出口

---

## 10. 任务系统

### 10.1 类型

- **delivery**：送货任务
- **exploration**：探索任务
- **fetch**：寻物任务
- **kill**：击杀任务

### 10.2 API

| 操作 | 函数 | 说明 |
|------|------|------|
| 创建 | `createQuest(db, input)` | 插入 quests 表，状态=active |
| 查询 | `getActiveQuests(db)` | 筛选所有 active 任务 |
| 完成 | `completeQuest(db, input)` | 事务保护，发放所有奖励 |

### 10.3 完成流程（事务内）

1. 校验角色存在
2. 校验任务存在且 status = active
3. 发放 credits（更新 characters 表）
4. 发放 item（查 items 表 → 插入 inventory）
5. 发放 weapon（查 weapons 表 → 插入 inventory）
6. 标记 quests.status = 'completed'

---

## 11. 时间系统

### 11.1 设计

- **1:1 对应现实时间**：`elapsed = Date.now() - game_start_real`
- **起始日期**：2250-01-01T08:00:00
- **getFullTime** 输出完整时间信息

### 11.2 昼夜

| 时间段 | 标签 | 夜晚 |
|--------|------|------|
| 05:00-07:00 | 凌晨 | — |
| 07:00-09:00 | 早晨 | — |
| 09:00-12:00 | 上午 | — |
| 12:00-13:00 | 中午 | — |
| 13:00-17:00 | 下午 | — |
| 17:00-19:00 | 傍晚 | — |
| 19:00-05:00 | 夜间 | ✓ |

### 11.3 快速移动

- **原理**：真实时间等待
- **公式**：`travelTime(分钟) = distance_km / speed_kmh * 60`
- **存储**：game_state 中 key="travel_status"
- **检测**：`checkTravelArrival` 比较 `Date.now()` 与 `arrives_at`

---

## 12. 掉落系统

### 12.1 generate_loot 流程

1. **货币**（100% 掉落）：`tier*2 + random(0, tier*3)` 瓶盖
2. **物品**（概率 `0.3 + tier*0.12`）：从默认物品表随机选取
3. **武器**（概率 `0.15 + tier*0.1`）：通过稀有度表决定稀有度，调用 `generateWeapon`

### 12.2 自定义 loot 表

- `rollLoot` 支持自定义掉落表
- `luckModifier`、`survival`、`locksmith` 技能影响掉率和数量

### 12.3 take_loot

- 玩家从掉落列表中自选物品，写入 inventory 表
- 未被选中的物品丢弃（不保留）

### 12.4 材料

- 材料（material 类型物品）已从掉落列表中移除
- 基础材料需在探索/采集/商人处获得

---

## 13. 种子数据

`init_db` 自动填充：

| 数据 | 数量 | 说明 |
|------|------|------|
| 怪物 | 75 | 5 tier × 15 种 |
| 物品 | 13 | 9 消耗品 + 4 杂项 |
| 状态效果 | 12 | dot/hot/buff/debuff/stun |
| 地点 | 15 | 分布 4 区域（中心/东/西/南/北） |
| 地点连接 | 15 | 双向道路 |

种子数据在 `db/seed.ts` 中维护，使用 `INSERT OR IGNORE` 防止重复。

武器、护甲、饰品不由种子数据生成——GM 在游戏过程中按需用 `generate_weapon` 生成。

---

## 14. 校验系统

### 14.1 5 个校验器

| 校验器 | 规则数 | 关键约束 |
|--------|--------|----------|
| weapon | 13 | category 枚举、damage_type 枚举、damage_min/max 范围、accuracy ∈ [0,1]、tier ∈ [1,5]、rarity 枚举、远程需 range+ammo |
| monster | ~10 | category 枚举、属性 1-20、accuracy+evasion ≤ 1.3、stat_sum ≤ tier×17 |
| item | ~8 | item_type 枚举、consumable → effect_type+effect_value、armor → defense+armor_slot、stackable → max_stacks |
| action | ~6 | action_type 枚举、primary_attr 枚举（属性+技能）、difficulty 1-30 |
| status-effect | ~7 | effect_type 枚举、buff→magnitude≥0、debuff→magnitude≤0、stun→magnitude=0 |

### 14.2 全盘拒绝策略

`world_gen` 采用全盘拒绝：所有实体通过校验后才写入任一数据。一条失败 = 零条写入。

---

## 15. 传奇特效

### 15.1 生成

- 传奇武器生成时自动调用 `generateSeed()` 生成 legend 种子
- 种子包含：trigger、effect_type、magnitude 范围、description_template
- 实际 magnitude 从种子范围中随机选取

### 15.2 触发类型（7 种）

on_hit / on_kill / on_crit / on_reload / on_empty_mag / on_low_hp / on_miss

### 15.3 效果类型（7 种）

| 效果 | 战斗实现 |
|------|---------|
| multiply_damage | `finalDamage *= magnitude` |
| lifesteal | `hpRestored = floor(finalDamage * magnitude)` |
| aoe_explosion | `aoeDamage = round(finalDamage * magnitude)` |
| refill_ammo | （未在 combat 实现，GM 叙事裁决） |
| chain_lightning | （未在 combat 实现，GM 叙事裁决） |
| summon | （未在 combat 实现，GM 叙事裁决） |
| debuff_enemy | （未在 combat 实现，GM 叙事裁决） |

### 15.4 Tier 上限

| tier | 最大 magnitude |
|------|---------------|
| 1 | 3.0 |
| 2 | 5.0 |
| 3 | 7.0 |
| 4 | 9.0 |
| 5 | 10.0 |

---

## 16. GM 辅助工具

### 16.1 gm_guide

行为指南，7 个主题：encounters / combat / loot / exploration / balance / attributes / schedule

覆盖：如何遇敌、如何生成武器、何时使用各项工具、NPC 作息参考、平衡建议。

### 16.2 tool_help

39 个工具的完整参数 schema、约束、示例调用。LLM 可随时查询任一工具的参数文档。

### 16.3 事件日志

- `log_event`：记录每次关键行动（含 event_type 分类）
- `get_history`：新会话恢复上下文（最近 N 条，可按类型过滤）

---

## 17. 测试策略

### 17.1 TDD 三阶段

```
RED    →  tests/ 中编写测试用例（tester 角色）
GREEN  →  engine/ 或 validation/ 中实现（coder 角色）
REFACTOR →  reviewer 角色审查
```

严格顺序：tester → coder → reviewer，不得跳过。

### 17.2 框架与运行时

- **框架**：`node:test` + `node:assert`
- **运行时**：`node --experimental-strip-types`
- **命令**：`find tests -name '*.test.ts' | xargs node --experimental-strip-types --test`

### 17.3 覆盖范围

| 测试层 | 文件数 | 说明 |
|--------|--------|------|
| engine/ | 20 | 覆盖所有 engine 模块 |
| engine/validation/ | 5 | 覆盖 5 个校验器 |
| db/ | 3 | connection + schema + seed 验证 |
| tools/ | 1 | 工具注册集成测试 |
| **合计** | **29** | 共约 297 个测试用例 |

### 17.4 关键原则

- 所有 engine 函数必须有对应测试
- 测试覆盖成功、失败、边界、异常路径
- 每次代码变更后运行 `npm test`（而非 `node --test`）

---

## 18. 开发流程

### 18.1 本地开发

```bash
npm install
find tests -name '*.test.ts' | xargs node --experimental-strip-types --test
pi install ./
```

### 18.2 发布

```bash
npm version patch   # 或 minor/major
npm publish
```

### 18.3 更新

```bash
pi update --all
```

### 18.4 版本控制

Git + GitHub，`.gitignore` 排除 `node_modules` 和 `.db` 数据库文件。

---

## 19. Pi 扩展约定

### 19.1 注册格式

```typescript
pi.registerTool({
  name: "tool_name",
  label: "Tool Label",
  description: "...",
  parameters: Type.Object({ ... }),    // TypeBox schema
  async execute(_toolCallId, params) {
    // 调用 engine 纯函数
    // 返回 { content, details }
  },
});
```

### 19.2 数据流

- **Engine 层**返回结构化数据
- **Tool 层**包一层描述文本（`content`）+ 结构化细节（`details`）
- **LLM** 读取 content 做叙事，细节仅做参考

### 19.3 数据库操作

- 所有 SQL 使用参数化查询（准备语句 + bind）
- 路径通过 `resolvePath` 安全检查（防止路径遍历）
- `db_query` 只读，`db_exec` 可写
- db 缓存：`getSQL()` 单例，避免重复加载 WASM
- 每次操作后导出 Buffer 写回文件系统

### 19.4 入口

```typescript
export default function (pi: ExtensionAPI) {
  registerDiceTool(pi);
  registerDBTools(pi);
  // ... 共 24 个 register 调用
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("⚙️ Chronika Engine loaded", "info");
  });
}
```

---

## 20. 设计约束与边界

| 约束 | 说明 |
|------|------|
| 不硬编码数值 | 所有属性/伤害/价格由数据库或 seed 数据决定，不写死在引擎代码中 |
| Engine 无状态 | 所有 engine 函数不接受全局状态，输入/输出纯函数 |
| 所有持久化走 SQLite | 不存在内存状态或文件缓存 |
| 存档即 .db 文件 | 备份/恢复/分享只需拷贝 .db 文件 |
| 不支持并发写入 | sql.js 单线程，同一个 .db 文件同时只能有一个写操作 |
| LLM 不做数值计算 | 一切机制判定必须通过 tool call |
| 种子数据开箱即用 | init_db 后即可开始游戏 |
