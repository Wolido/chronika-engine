# Changelog

## [Unreleased]

### Added
- 探索/地图系统：discover_location / travel / explore / get_map
- 数据库新增 3 张表：locations / location_connections / location_encounters
- 地图从 3-5 个初始节点开始，随游戏进行自动扩张
- 事件日志系统：log_event / get_history（持久化游戏历史记录）
- 启动通知：`⚙️ Chronika Engine loaded`
- README.md 文档
- 版本控制（git + .gitignore）

### Changed
- 项目结构重构为 npm 包格式
- 源码从 `.pi/extensions/` 迁移至包根目录

## [0.1.0] - 2025-01-18

### Added
- 基础设施：dice / db_query / db_exec / init_db
- 世界生成：world_gen + 5 个校验器
- 战斗系统：combat_resolve（含元素触发 + 传奇特效）
- 装备系统：equip_item / unequip_item / equipment_stats
- 生存交互：craft / trade / consume / loot
- 状态效果：status_apply / status_tick
- 角色成长：skill_check / level_up
- 传奇特效：legendary_gen
- 数据库 Schema：18 张表
- 测试覆盖：210 个测试用例
