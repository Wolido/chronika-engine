# Changelog

## [0.8.4] - 2026-07-28

### Added

- session_start 时自动检测 pi 扩展缓存版本：如果缓存版本与 npm 安装版本不一致，自动清除缓存并提示重启，无需手动清理

## [0.9.1] - 2026-07-28

### Added

- 启动时显示当前加载的 Chronika Engine 版本号（⚙️ Chronika Engine vX.X.X loaded），方便确认实际运行的版本
## [0.9.0] - 2026-07-28

### Added

- move_to 工具新增 current_poi 参数，支持按 POI 连接导航；无直达连接时自动回退到列表模式
- create_character 自动赠送初始武器（生锈匕首，damage 2-5, accuracy 0.72），写入背包并装备
- create_character 新增 skip_initial_weapon 参数，可跳过初始武器
- GM 指南补充 travel 途中遭遇处理指引：路上遇敌打怪没问题，到达目的地才需等计时器
- generate_loot 新增防具掉落（60%概率）和饰品掉落（50%概率），调用 generateArmor/generateAccessory 生成
- generate_loot 武器掉率提升至 70%（原为 25%-65% 随 tier）
- 稀有度表统一为 common 15% / uncommon 25% / rare 35% / legendary 25%（原按 tier 区分，低 tier 传奇仅 2%）
- generate_weapon/generate_armor/generate_accessory 自动生成装备名，不再返回空名（基于类型+稀有度 deterministic 生成）
- GM 指南新增「战斗回合约束」硬规则：每次 combat_resolve 后必须停等玩家决策，不得连续自动多回合

### Fixed

- create_character 第二个角色创建失败：weapons.name UNIQUE 约束冲突（生锈匕首重复插入），改为先查后插
- move_to 输出未展示回退模式提示 note

### Changed

- generate_loot 的 LootItemEntry.type 新增 "armor" 和 "accessory" 类型
- rollRarity 不再按 tier 区分稀有度，使用统一概率表
- generate_weapon/generate_armor/generate_accessory 的 description 字段改为基于属性自动生成
- 测试用例从断言 name="" 改为断言 name.length>0

## [Unreleased]

## [0.8.1] - 2026-07-28

### Changed
- init_db 返回消息改为中文，明确告知 GM 世界已就绪、直接用 create_character 创建角色
- tool-help 的 example 值从 world_gen 改为 combat_resolve

### Fixed
- GM 在 init_db 后仍尝试调用已删除的 world_gen 工具


## [0.8.0] - 2026-07-28

### Removed

- world_gen 工具及 engine/validation 校验模块（共约 10 个文件），init_db 已提供完整可玩世界，无需 world_gen
- GM 指南中 world_gen 相关描述，encounter 工具描述不再引用 world_gen

### Changed

- [Chronika 时间] 注入简化：去掉"第 X 天"和"游戏内已流逝 X 小时"，只保留当前日期时间和时段

## [0.7.0] - 2026-07-27

### Added

- before_agent_start 钩子：GM 每次回答前自动注入 [Chronika 时间]，持久化到会话并在 TUI 可见
- 时间注入包含当前游戏时间、时段、天数；有待处理计时器（含旅行）时附带剩余时间与约束文本

### Changed

- 无等待事件时时间注入精简为一行，降低上下文占用

### Fixed

- 游戏时钟自动初始化未写盘，导致时钟丢失（存档可用时初始化后立即持久化）
- GM 主动跳过等待时间、反复轮询 check_timers（每回合自动注入 + 全仓库文案统一为无需手动查询）

### Removed

- 双轨旅行追踪死代码：startQuickTravel / checkTravelArrival（约 95 行），旅行统一走计时器系统

### Tests

- 全量 444 个测试通过；time-context 测试对齐生产路径

## [0.6.0] - 2026-07-27

### Added

- 统一计时器系统：set_timer / check_timers 工具，替代 quick_travel / check_arrival
- travel 自动使用 set_timer，返回预计到达时间和倒计时
- 游戏时间自动初始化：续玩旧存档时首次调 game_time 自动设时间基准
- WALK_SPEED_KMH=5 常量，距离/时间关系统一管理
- discover_location 拒绝超过 20km 的连接

### Changed

- travel 输出从 "Traveled" 改为 "出发！正在从 X 前往 Y"，明确未到达
- 命中公式加 0.5 基准：(0.5 + accuracy - evasion) × 100，普通武器 ~70-80% 命中
- 属性修正钳制为非负（低属性不扣命中）

### Fixed

- init_db 种子数据插入失败：SEED_CONNECTIONS 字段名修复，全列映射加 ?? null
- SEED_ITEMS 缺失字段补全
- characters 表补齐 barter/stealth/locksmith/tracking 四列
- world_gen 工具描述补全所有必需字段和约束
- 游戏时间改为与现实时间 1:1 对应

### Docs

- GM 指南：时间规则改为系统硬约束，禁止叙述跳过时间
- GM 指南：禁止 check_timers 轮询

## [0.5.0] - 2026-07-26

### Added

- 武器传奇系统：从 7×7 扩展到 25 触发器 × 25 效果类型 = 625 种组合，全部在 combat 引擎实装
- 新增触发器（17 种）：on_attack_start, on_damage_dealt, on_overkill, on_armor_pierce, on_low_attacker_hp, on_low_defender_hp, on_parry, on_full_mag, on_weapon_jam, on_elemental_proc, on_stealth_attack, on_counter_attack, on_finishing_blow, on_berserk, on_last_stand, on_first_blood, on_reflect, on_wound
- 新增效果类型（17 种）：add_flat_damage, life_drain, armor_pierce, armor_shred, stun, bleed, burn, poison, frost_slow, shock_proc, mental_break, debuff_attack, debuff_defense, buff_attack, buff_accuracy, buff_evasion, summon_ally, refill_ammo, shield, reflect_damage
- 防具传奇系统：14 触发器 × 15 效果 = 210 种组合，全部在 combat 引擎实装
- 防具触发器：on_hit_taken, on_crit_taken, on_damage_taken, on_heavy_damage, on_block, on_dodged, on_low_wearer_hp, on_critical_hp, on_combat_start, on_kill_response, on_debuff_received, on_elemental_hit, on_fatal_hit, passive
- 防具效果：damage_reduction, flat_damage_block, thorns, reflect_percent, hp_regen, emergency_heal, heal_on_kill, explosive_retaliation, elemental_absorption, status_cleanse, fear_aura, pain_to_power, last_stand, stat_boost, retribution
- 饰品传奇系统：10 触发器 × 17 效果 = 170 种组合，分布在 6 个 engine 模块（combat/exploration/loot-gen/trade/craft/consume）
- generate_armor 和 generate_accessory 工具（含 appropriateness_warnings GM 审查流程）
- 暴击系统：combat 新增 crit_chance 参数（默认 5%），暴击时伤害 ×1.5，支持 on_crit 传奇触发器
- 双阶段传奇触发架构：pre-damage（命中/暴击/攻击开始等）+ post-damage（击杀/溢出/终结等）
- CombatFlag 系统：10 种战斗标记（stealth, counter_attack, reload, empty_mag, full_mag, weapon_jam, first_blood, reflect, dodge, parry），通过 flags 参数传入
- generate_weapon 返回 appropriateness_warnings，武器-特效不匹配时提示 GM 重 roll
- legendary_gen 新增 weapon_context 参数，validate 模式支持 validateLegendaryForWeapon() 武器适配性检查
- magnitude 按效果类型返回 6 组不同范围，替代旧版统一范围
- create_character 工具：一键创建玩家角色（支持自定义属性/技能/初始HP/瓶盖/位置）

### Changed

- combat.ts 重构为双表驱动架构（TRIGGER_CONDITIONS + EFFECT_HANDLERS），LegendaryModifications 累积器模式
- CombatInput 新增 7 个可选字段（crit_chance, flags, hp, hp_max, ammo, max_ammo, defender.hp_max）
- CombatResult 新增 20+ 字段（crit, legendary_aoe_damage, legendary_status_*, legendary_summon 等）
- 传奇武器生成后自动附带适配性警告
- tools 层 schema 全部更新为 25×25 描述
- 旧效果 refill_ammo/chain_lightning/summon/debuff_enemy 从"GM 叙事裁决"改为完整 engine 实现
- SCHEMA_VERSION 8 → 9：characters 表补齐 barter/stealth/locksmith/tracking 四列
- pg 别名简化：--no-extensions -e npm:chronika-engine，不再穷举工具名
- world_gen 描述补全所有必需字段和约束（远程武器 range/ammo、消耗品 effect_type/value、状态效果 target_attribute）
- 游戏时间改为与现实时间 1:1 对应（不再固定在 2250 年）

### Fixed

- init_db 种子数据插入失败：SEED_CONNECTIONS 字段名 from→from_location 修复，全部种子列映射加 ?? null 防护

### Tests

- 测试用例：398 个（+67 新增：武器修正、防具传奇、饰品传奇、生成器测试）

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
