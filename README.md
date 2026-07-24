# Chronika Engine

用自然语言玩文字 RPG。一个 `.db` 文件就是一个废土世界——LLM 当 GM 负责叙事，TypeScript 插件执行所有数值判定。

## 设计

- **LLM 是 GM，不是计算器** — 命中、伤害、掉落、制作全由引擎工具裁定，LLM 专注沉浸叙事
- **数据驱动** — 武器、怪物、物品、地图都定义在数据库里，改数据不改代码
- **一切皆插件** — 29 个 Pi 工具覆盖战斗、探索、交易、制作、升级等完整游戏循环
- **图层地图** — 世界地图 + 局部地图（POI），探索有空间感

## 快速开始

### 安装

```bash
pi install npm:chronika-engine
```

### 配置启动别名

```bash
alias pg='pi \
  --tools read,ls,grep,find,bash,subagent,\
dice,db_query,db_exec,init_db,world_gen,\
skill_check,combat_resolve,loot,\
consume,craft,trade,\
status_apply,status_tick,\
level_up,legendary_gen,generate_weapon,\
equip_item,unequip_item,equipment_stats,\
log_event,get_history,\
discover_location,travel,explore,get_map,\
discover_poi,move_to,\
get_encounter,gm_guide \
  --no-skills --no-context-files'
```

### 开玩

```bash
pg
```

然后说：

```
开玩
```

系统会自动创建废土世界、生成初始地点和角色。之后想做什么直接说中文，GM 会调用引擎工具推进游戏。

## 核心系统

### 战斗

`combat_resolve` 一键裁定——命中判定、伤害计算、护甲吸收、元素触发、传奇特效全部自动完成：

```
你: "用铁管砸那只变异鼠！"
引擎: 命中判定 → 伤害计算 → 护甲吸收 → 传奇触发 → 返回结果
GM:  "你抡起铁管砸在变异鼠背上，-8 HP。传奇特效「穷途末路」触发，额外 ×2.5 伤害！"
```

### 属性与技能

| 属性 | 影响 | 技能 | 影响 |
|------|------|------|------|
| 力量 | 战斗伤害 | 生存 | 掉落数量 |
| 敏捷 | 战斗闪避 | 医疗 | 治疗量 |
| 感知 | 战斗命中 | 机械 | 制作产量 |
| 耐力 | HP 上限 | 议价 | 交易价格 |
| 智力 | 制作产量 | 潜行 | 遇敌概率 |
| 意志 | 状态抗性 | 开锁 | 掉落概率 |
| — | — | 追踪 | 旅行发现 |
| — | — | 口才 | 社交检定 |

升级时属性 +1、技能 +3。

### 地图

两层设计：世界地图（`travel` 在地点间移动，按危险等级自动触发遭遇）和局部地图（`move_to` 在 POI 间移动，`explore` 搜索当前区域）。

### 武器

6 层随机生成：品牌 × 主体 × 部件 × 元素 × 稀有度 × 传奇特效。传奇武器的名称和描述由 LLM 即时创作，每把独一无二。

### 装备

6 个槽位：武器、头盔、胸甲、腿甲、饰品 ×2。每件装备提供属性和防御加成，替换时自动计算差值。

### 状态效果

DOT / HOT / Buff / Debuff 系统，支持附着、每回合结算、到期移除、多效果叠加。

## 工具（29 个）

| 工具 | 功能 |
|------|------|
| `dice` | 掷骰 |
| `db_query` / `db_exec` | 数据库读写 |
| `init_db` | 创建游戏数据库 |
| `world_gen` | 世界数据生成 |
| `skill_check` | 属性/技能检定 |
| `combat_resolve` | 战斗裁定 |
| `loot` | 掉落生成 |
| `consume` | 消耗品使用 |
| `craft` | 物品制作 |
| `trade` | 交易 |
| `equip_item` / `unequip_item` | 装备管理 |
| `equipment_stats` | 装备总览 |
| `status_apply` / `status_tick` | 状态效果 |
| `level_up` | 升级 |
| `legendary_gen` | 传奇特效生成 |
| `generate_weapon` | 武器生成 |
| `log_event` / `get_history` | 事件日志 |
| `discover_location` / `travel` / `explore` / `get_map` | 地图探索 |
| `discover_poi` / `move_to` | POI 探索 |
| `get_encounter` | 遭遇选取 |
| `gm_guide` | GM 行为指南 |

测试覆盖：249 个用例。

## 数据库

20 张 SQLite 表，涵盖世界观、角色、武器、怪物、物品、地图、装备、日志。存档即 `.db` 文件，与引擎解耦，可自由拷贝迁移。

## 开发

```bash
# 安装依赖
npm install

# 运行测试
find tests -name '*.test.ts' | xargs node --experimental-strip-types --test

# 本地安装
pi install ./
```

## 技术栈

- **运行时**: [Pi](https://pi.dev) 扩展系统
- **语言**: TypeScript
- **数据库**: SQLite（sql.js WASM）
- **依赖**: sql.js, typebox

## License

MIT
