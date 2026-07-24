# Changelog

## [Unreleased]

### Added

- （暂无）

## [0.2.1] - 2025-01-18

### Added

- POI 连接系统：poi_connections 表，move_to / explore 按连接驱动
- 两层地图系统：世界地图（locations）+ 局部地图（location_pois）
- 探索/地图系统：discover_location / travel / explore / get_map
- 事件日志系统：log_event / get_history
- 启动通知：`⚙️ Chronika Engine loaded`

### Fixed

- sql.js WASM 路径改用 createRequire 解析，修复 npm 安装后找不到 sql-wasm.wasm 的问题
- 工具描述嵌入废土上下文，新 session 的 LLM 自动获知世界观

### Changed

- 地图 POI 从自由列表改为连接驱动
- 项目结构重构为 npm 包格式

## [0.2.0] - 2025-01-18

### Added

- 初始版本：战斗/装备/生存/成长/传奇特效/地图/日志系统
- 数据库 Schema：20 张表
- 工具数量：23 个
- 测试覆盖：224 个测试用例
