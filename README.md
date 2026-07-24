# Chronika Engine

**数据驱动的废土生存文字 RPG 引擎，基于 Pi 框架，用自然语言玩游戏。**

Chronika 将大语言模型作为游戏主持人（GM），所有游戏机制由 TypeScript 插件执行，LLM 只负责叙事。游戏数据全部存储在 SQLite 中。

---

## 安装

```bash
pi install npm:chronika-engine
```

## 快速开始

安装完成后直接运行：

```bash
pi
```

输入 `开玩` 即可开始游戏。之后直接用自然语言与 GM 交互。

如果需要隔离游戏环境（不加载 skills、context files 等），可以配置一个独立的启动别名：

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

然后运行 `pg` 即可。

---

## 开发

```bash
npm install
find tests -name '*.test.ts' | xargs node --experimental-strip-types --test
pi install ./
```

---

## 技术栈

- **运行时**: [Pi](https://pi.dev) 扩展系统
- **语言**: TypeScript
- **数据库**: SQLite（通过 sql.js WASM）

---

## License

MIT
