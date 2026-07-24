# Changelog

## [Unreleased]

### Added

- 任务系统：create_quest / active_quests / complete_quest（4 种任务类型，含时间限制和奖励）
- 完整掉落生成：generate_loot（按敌人 tier 自动产出货币+物品+武器，内置稀有度概率表）
- NPC 库存生成：generate_stock（按 NPC 类型 villager/scavenger/trader/merchant 生成库存）
- 玩家自选 loot：take_loot（选择要拿的物品写入背包，其余留在原地）
- 时间系统：快速移动（quick_travel / check_arrival，真实时间等待）
- 完整日期/昼夜系统（2500 年起始，年月日时分秒星期 + 昼夜）
- 材料从 loot 和库存中移除（不再掉落废铁/布料等无用物品）
- gm_guide 新增 NPC 作息指引（按时间段判断 NPC 状态）
- gm_guide 稀有度掉落概率表（普通 2% / 精英 10% / Boss 35%）

### Fixed

- SQL 注入修复：exploration.ts 和 encounter.ts 全部改用参数化查询
- NaN 防御：checkTravelArrival 损坏状态不产生 NaN
- 日期系统：无效起始日期回退到默认值
- take_loot 数量校验拦截 NaN/浮点数/Infinity
- check_arrival 到达分支不可达的问题
- 事务保护：completeQuest 全程 BEGIN/COMMIT/ROLLBACK
- 路径安全：所有工具添加 db_path 目录遍历防护

### Changed

- 数据库 Schema：28 张表
- 测试覆盖：288 个测试用例
- 工具数量：32 个

## [0.3.0] - 2025-01-18

### Added

- 武器生成器：generate_weapon（按稀有度/类型随机生成，传奇含 LLM 命名）
- 属性系统实装：感知影响命中、敏捷影响闪避、耐力影响 HP
- 技能系统实装（8 技能全引擎效果）：
  - 生存 → loot 数量加成
  - 医疗 → consume 治疗加成
  - 机械 → craft 产量加成
  - 议价 → trade 价格修正
  - 潜行 → travel 避敌
  - 开锁 → loot 概率加成
  - 追踪 → travel 发现信息
  - 口才 → skill_check 检定
- 属性/技能分离，升级分别加点（属性 +1/级，技能 +3/级）
- 遭遇选取工具：get_encounter（按危险等级从 monsters 表选怪）
- GM 行为指南工具：gm_guide
- travel 自动遇敌（按危险等级概率触发，不限次数）

### Changed

- 魅力 → 议价（重命名）
- 口才从 trade 剥离，专注 skill_check
- 工具描述全部嵌入废土上下文
- README 更新完整工具列表和 pg 命令

### Fixed

- sql.js WASM 路径改用 createRequire 解析

## [0.2.1] - 2025-01-18

### Added

- POI 连接系统：poi_connections 表，move_to / explore 按连接驱动
- 两层地图系统：世界地图（locations）+ 局部地图（location_pois）
- 探索/地图系统：discover_location / travel / explore / get_map
- 事件日志系统：log_event / get_history
- 启动通知：`⚙️ Chronika Engine loaded`

### Fixed

- sql.js WASM 路径修复
- 工具描述嵌入废土上下文

### Changed

- 地图 POI 从自由列表改为连接驱动
- 项目结构重构为 npm 包格式

## [0.2.0] - 2025-01-18

### Added

- 初始版本：战斗/装备/生存/成长/传奇特效/地图/日志系统
- 数据库 Schema：20 张表
- 工具数量：23 个
- 测试覆盖：224 个测试用例
