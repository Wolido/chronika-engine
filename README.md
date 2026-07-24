# Chronika Engine

一个数据驱动的文字 RPG 引擎，基于 [Pi](https://pi.dev) 扩展系统构建。

一个数据库 = 一个游戏世界。世界观、武器、怪物、物品、配方全部存储在 SQLite 中，引擎只负责计算和叙事。

## 安装

```bash
pi install npm:chronika-engine
```

安装完成后启动 pi，看到 `⚙️ Chronika Engine loaded` 即表示加载成功。

## 快速开始

启动 pi：

```bash
pi
```

然后初始化一个世界：

```
init_db db_path: "./my_world.db", world_name: "我的世界"
```

写入一些武器数据：

```
world_gen db_path: "./my_world.db", weapons: [{name: "铁管", category: "melee", damage_type: "bludgeoning", damage_min: 3, damage_max: 7, accuracy: 0.75, tier: 1, rarity: "common"}], monsters: [{name: "变异鼠", category: "beast", hp: 15, damage_min: 2, damage_max: 5, accuracy: 0.6, evasion: 0.3, armor: 0, tier: 1, xp_reward: 10, strength: 4, agility: 7, endurance: 3, perception: 6, intelligence: 2, willpower: 3}]
```

打一场：

```
combat_resolve attacker: {stats: {strength: 8, agility: 5, endurance: 6, perception: 4, intelligence: 3, willpower: 3}, weapon: {damage_min: 3, damage_max: 7, accuracy: 0.75, damage_type: "bludgeoning"}}, defender: {evasion: 0.3, armor: 0, hp: 15}
```

## 已注册的工具

| 工具 | 功能 |
|------|------|
| `dice` | 掷骰（2d6, 1d20+3, d100...） |
| `db_query` | SQLite 只读查询 |
| `db_exec` | SQLite 写入操作 |
| `init_db` | 创建游戏数据库 |
| `world_gen` | 世界数据校验+写入 |
| `skill_check` | 属性/技能检定（1d20） |
| `combat_resolve` | 一键战斗裁定（含元素触发 + 传奇特效） |
| `loot` | 掉落表掷骰 |
| `consume` | 消耗品使用 |
| `craft` | 配方制作 |
| `trade` | 买卖交易 |
| `equip_item` | 穿装备 |
| `unequip_item` | 脱装备 |
| `equipment_stats` | 查看装备总属性 |
| `status_apply` | 附着状态效果 |
| `status_tick` | 每回合状态结算 |
| `level_up` | 升级系统 |
| `legendary_gen` | 传奇特效生成 |
| `log_event` | 记录游戏事件到历史 |
| `get_history` | 查询游戏历史记录 |
| `discover_location` | 发现新地点 |
| `travel` | 在地点间移动 |
| `explore` | 搜索当前地点 |
| `get_map` | 查看地图 |
| `discover_poi` | 发现地点内的 POI |
| `move_to` | 在 POI 间移动 |

## 推荐启动命令

完整的 pg 命令（供 fish shell 用户参考）：

```fish
abbr --add pg "cd ~/pi-workspace/chronika && \
  pi \
  --tools read,ls,grep,find,bash,subagent,\
dice,db_query,db_exec,init_db,world_gen,\
skill_check,combat_resolve,loot,\
consume,craft,trade,\
status_apply,status_tick,\
level_up,legendary_gen,\
equip_item,unequip_item,equipment_stats,\
log_event,get_history,\
discover_location,travel,explore,get_map,\
discover_poi,move_to \
  --no-skills \
  --append-system-prompt .pi/CHRONIKA_SYSTEM.md --model deepseek-v4-flash"
```

## 存档管理

游戏数据库文件 (.db) 与引擎完全解耦，可以存放在任意位置：

- 项目内：`./worlds/my_campaign.db`
- 桌面：`~/Desktop/save.db`
- U 盘：`/Volumes/USB/wasteland.db`

一个 .db 文件 = 一个完整的游戏存档，拷走即可迁移。

## 数据库结构

引擎运行时使用 15 张表：

- `world_meta` — 世界观元数据
- `characters` — 角色
- `weapons` — 武器模板
- `items` — 物品模板
- `monsters` — 怪物模板
- `inventory` — 背包
- `event_log` — 事件日志
- `game_state` — 全局状态
- `plugin_registry` — 插件注册
- `status_effects` — 状态效果模板
- `actions` — 行为定义
- `brands` — 武器品牌
- `weapon_parts` — 武器部件
- `legendary_effects` — 传奇特效
- `generated_weapons` — 生成武器实例

## 开发

```bash
# 克隆后安装依赖
cd chronika
npm install

# 运行测试
find tests -name '*.test.ts' | xargs node --experimental-strip-types --test

# 本地安装
pi install ./

# 发布新版本
npm version patch
npm publish
pi update --all
```

## 技术栈

- **运行时**: [Pi](https://pi.dev) 扩展系统
- **语言**: TypeScript
- **数据库**: SQLite (通过 sql.js WASM)
- **依赖**: sql.js, typebox
