# Changelog

## [Unreleased]

### Added
- 启动通知：`⚙️ Chronika Engine loaded` 提示
- README.md 文档（安装、启动命令、工具列表、开发流程）
- 版本控制（git + .gitignore）

### Changed
- 项目结构重构为 npm 包格式，通过 `pi install` 安装
- 源码从 `.pi/extensions/` 迁移至包根目录
- 测试 import 路径更新为新的目录结构

## [0.1.0] - 2025-01-18

### Added
- 基础设施：dice / db_query / db_exec / init_db
- 世界生成：world_gen + 5 个校验器（weapon / monster / item / status_effect / action）
- 战斗系统：combat_resolve（含元素触发 + 传奇特效 multiply_damage / lifesteal / aoe_explosion）
- 装备系统：equip_item / unequip_item / equipment_stats（6 个槽位）
- 生存交互：craft / trade / consume / loot
- 状态效果：status_apply / status_tick（DOT / HOT / 到期移除）
- 角色成长：skill_check / level_up（连升多级）
- 传奇特效：legendary_gen（seed 生成 + validate 校验）
- 数据库 Schema：15 张表（含 brands / weapon_parts / legendary_effects / generated_weapons）
- 测试覆盖：193 个测试用例
