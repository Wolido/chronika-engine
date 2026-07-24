# Changelog

## [Unreleased]

### Added

- POI 连接系统：poi_connections 表，move_to / explore 按连接驱动
- 两层地图系统：世界地图（locations）+ 局部地图（location_pois）
- 探索/地图系统：discover_location / travel / explore / get_map
- 事件日志系统：log_event / get_history
- 启动通知：`⚙️ Chronika Engine loaded`

### Changed

- README 更新 pg 命令工具列表，补齐所有 23 个工具
- 项目结构重构为 npm 包格式，通过 `pi install` 安装
- 地图 POI 从自由列表改为连接驱动

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
- 数据库 Schema：20 张表
- 测试覆盖：224 个测试用例
