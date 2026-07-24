# Chronika Engine

数据驱动的文字 RPG 引擎，基于 [Pi](https://pi.dev) 扩展系统构建。

一个数据库 = 一个游戏世界。世界观、武器、怪物、物品、配方全部存储在 SQLite 中，引擎只负责计算和叙事。

## 安装

```bash
pi install npm:chronika-engine
```

安装完成后启动 pi，看到 `⚙️ Chronika Engine loaded` 即表示加载成功。

## 快速开始

启动后，说一句：

```
开玩
```

系统会自动创建世界、生成初始地点和角色，开始废土生存冒险。之后你想做什么直接说，GM 会调用引擎工具推进游戏。

## 推荐启动命令

为 Pi 框架配置一个独立的启动状态，专用于运行 Chronika 游戏环境。不加载任何 skills 或额外的系统提示词。

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

## 工具列表（29 个）

| 工具 | 功能 |
|------|------|
| `dice` | 掷骰（2d6, 1d20+3, d100...） |
| `db_query` | SQLite 只读查询 |
| `db_exec` | SQLite 写入操作 |
| `init_db` | 创建游戏数据库 |
| `world_gen` | 世界数据校验+写入 |
| `skill_check` | 属性/技能检定（1d20） |
| `combat_resolve` | 一键战斗裁定（含元素 + 传奇） |
| `loot` | 掉落表掷骰（生存/开锁加成） |
| `consume` | 消耗品使用（医疗加成） |
| `craft` | 配方制作（机械加成） |
| `trade` | 买卖交易（议价加成） |
| `equip_item` | 穿装备 |
| `unequip_item` | 脱装备 |
| `equipment_stats` | 查看装备总属性 |
| `status_apply` | 附着状态效果 |
| `status_tick` | 每回合状态结算 |
| `level_up` | 升级（属性+1/级，技能+3/级） |
| `legendary_gen` | 传奇特效生成 |
| `generate_weapon` | 随机生成武器 |
| `log_event` | 记录游戏事件 |
| `get_history` | 查询游戏历史 |
| `discover_location` | 发现新地点 |
| `travel` | 地图间移动（自动遇敌 + 追踪发现） |
| `explore` | 搜索当前地点 |
| `get_map` | 查看地图 |
| `discover_poi` | 发现地点内 POI |
| `move_to` | POI 间移动 |
| `get_encounter` | 按危险等级选取怪物 |
| `gm_guide` | GM 行为指南 |

> 工具数量：29 个 · 测试覆盖：249 个测试用例

## 存档管理

游戏数据库文件 (.db) 与引擎完全解耦，可以存放在任意位置：

- 项目内：`./worlds/my_campaign.db`
- 桌面：`~/Desktop/save.db`
- U 盘：`/Volumes/USB/wasteland.db`

一个 .db 文件 = 一个完整的游戏存档，拷走即可迁移。

## 数据库结构

引擎运行时使用 20 张表，涵盖世界观、角色、武器、怪物、物品、地图、装备、日志等。

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
