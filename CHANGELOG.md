# Changelog

## [Unreleased]

- POI 连接系统：POI 间路径 + 跨地点出口
- poi_connections 表（第20张表）
- move_to / explore 现在按连接驱动
- 测试覆盖：224 个
### Added
- 两层地图系统：世界地图（locations）+ 局部地图（location_pois）
- discover_poi：在已有地点内发现新 POI（房间/建筑/地标）
- move_to：在 POI 间移动（免费、无遭遇）
- explore 工具现在显示当前地点的 POI 列表
- 探索/地图系统：discover_location / travel / explore / get_map
- 事件日志系统：log_event / get_history
- 启动通知与文档

### Changed
- 项目结构重构为 npm 包格式

## [0.1.0] - 2025-01-18

### Added
- 初始版本：战斗/装备/生存/成长/传奇特效等系统
- 数据库 Schema：19 张表
- 测试覆盖：218 个测试用例
