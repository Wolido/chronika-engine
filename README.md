# Chronika Engine

**数据驱动的废土生存文字 RPG 引擎，基于 Pi 框架，用自然语言玩游戏。**

这不是一个纯 AI 聊天角色扮演——这是一个有真实数值机制的游戏。大语言模型只担任游戏主持人（GM），负责叙事和决策；所有战斗、探索、交易、升级等游戏机制由 TypeScript 插件执行，数值计算不依赖 LLM。游戏数据全部存储在 SQLite 中。

---

## 特性

- **真实数值机制** — 战斗、掉落、交易、升级等由 TypeScript 引擎计算，LLM 只做叙事
- **传奇装备系统** — 武器 625 种 + 防具 210 种 + 饰品 170 种 = 1005 种传奇组合
- **现实时间同步** — 游戏时间 1:1 对应现实，旅行、等待等行为需要真实时间流逝
- **统一计时器** — `set_timer` / `check_timers` 管理所有等待事务
- **本地存档** — SQLite 数据库，拷贝 .db 文件即可备份

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
  --no-extensions -e npm:chronika-engine \
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
