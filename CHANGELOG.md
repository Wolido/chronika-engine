# Changelog

## [Unreleased]

### Added

- （暂无）

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
