# Moki Card 最强阵容统计 (v2.0 重构版)

自动采集 Moki Fantasy 竞赛数据，分析高频卡牌与热门阵容。

## 📊 功能

- **全量获取**：一次性获取所有历史竞赛数据（分页获取）
- **增量更新**：每小时获取新竞赛，自动监控 LIVE 竞赛
- **智能调度**：竞赛结束后 8 分钟自动抓取排行榜（带重试机制）
- **数据分析**：统计卡牌出场率、平均排名、热门阵容组合
- **竞赛统计**：参赛人数、奖池、格式分布等多维度统计
- **网页展示**：实时查看统计结果，支持日期筛选

## 🚀 快速开始

### 首次使用（初始化）

```bash
# 1. 安装依赖
npm install

# 2. 获取全量竞赛数据（一次性）
npm run init

# 3. 生成统计报告
npm run stats

# 4. 运行卡牌分析
npm run analyze
```

### 日常使用（增量更新）

```bash
# 获取新竞赛（定时任务）
npm run fetch

# 生成最新统计
npm run stats

# 抓取指定竞赛的排行榜
npm run fetch:leaderboards -- <contest_id1,contest_id2>
```

### 部署到 GitHub

1. 创建新仓库并推送代码
2. **手动触发一次** `Initialize Contests` workflow（初始化全量数据）
3. 启用 GitHub Pages（分支：`main`，目录：`/docs`）
4. `Fetch Contests` workflow 会自动每小时第 6 分钟运行

## 📁 项目结构

```
moki-stats/
├── .github/workflows/
│   ├── init-contests.yml      # 初始化工作流（手动触发）
│   └── fetch-contests.yml     # 增量更新（每小时第 6 分钟）
├── data/
│   ├── contests/              # 竞赛信息（每个竞赛一个 JSON）
│   ├── contest_index.json     # 竞赛索引（快速查询）
│   ├── leaderboards/          # 排行榜数据
│   ├── pending_tasks.json     # 待执行任务队列
│   ├── mokis/                 # 卡牌详情
│   └── stats/
│       ├── contest_daily.json # 每日竞赛统计
│       ├── summary.json       # 最近 7 天汇总
│       ├── daily/             # 每日卡牌统计
│       └── weekly/            # 每周卡牌统计
├── src/
│   ├── fetch.js               # 数据采集（分页 + 增量）
│   ├── scheduler.js           # 任务调度器（新增）
│   ├── stats.js               # 竞赛统计（新增）
│   ├── analyze.js             # 卡牌分析
│   └── utils.js               # 工具函数
├── docs/                      # GitHub Pages 输出
└── package.json
```

## 📈 数据说明

### 竞赛信息 (data/contests/{_id}.json)

```json
{
  "_id": "69ab453c2fd78d57b701b576",
  "name": "50/50 Open 10-Round Tanuki Tim",
  "contestStatus": "COMPLETED",
  "format": "FIFTY_FIFTY",
  "entryFee": 2000,
  "prizePool": 6055,
  "entries": 346,
  "maxEntries": 350,
  "startDate": "2026-03-07T17:00:00.000Z",
  "endDate": "2026-03-07T21:00:00.000Z",
  "leaderboardFetched": true
}
```

### 排行榜 (data/leaderboards/{_id}.json)

```json
{
  "contestId": "69ab453c2fd78d57b701b576",
  "contestName": "50/50 Open 10-Round Tanuki Tim",
  "endDate": "2026-03-07T21:00:00.000Z",
  "totalEntries": 50,
  "top50": [
    {
      "rank": 1,
      "playerId": "...",
      "playerName": "...",
      "score": 12345,
      "mokiIds": ["...", "...", "...", "...", "..."]
    }
  ]
}
```

### 统计结果 (data/stats/)

**contest_daily.json** - 每日竞赛统计：
- `today` - 今日统计
- `yesterday` - 昨日统计
- `last7Days` - 最近 7 天统计

**summary.json** - 最近 7 天汇总：
- `contestStats` - 竞赛统计（数量、参赛人数、奖池等）
- `mokiStats` - 卡牌统计（出场率、平均排名等）

## ⏰ 定时任务

| Workflow | 频率 | 说明 |
|---------|------|------|
| **init-contests.yml** | 手动触发 | 初始化全量数据（仅首次） |
| **fetch-contests.yml** | 每小时第 6 分钟 | 增量获取新竞赛 + 执行到期任务 |

### 任务调度逻辑

1. **初始化**：获取全部历史竞赛，批量抓取最近 7 天 leaderboard
2. **增量更新**：每小时获取 OPEN/LIVE 竞赛，监控新 LIVE 竞赛
3. **自动抓取**：LIVE 竞赛结束后 8 分钟自动抓取 leaderboard（带重试）
4. **任务持久化**：任务队列保存到 `pending_tasks.json`，重启不丢失

## 🔧 CLI 命令

```bash
# 初始化（全量获取）
npm run init

# 增量获取
npm run fetch

# 全量获取
npm run fetch:all

# 抓取指定 leaderboard
npm run fetch:leaderboards -- <id1,id2,id3>

# 生成统计
npm run stats

# 卡牌分析
npm run analyze
```

## 🌐 在线查看

启用 GitHub Pages 后，访问：
```
https://<username>.github.io/moki-stats/
```

## 📊 API 使用频率

| 操作 | 频率 | 估算次数/天 |
|------|------|-------------|
| 初始化全量获取 | 一次性 | ~10 次（10 页） |
| 增量获取 | 每小时 1 次 | ~24 次 |
| Leaderboard 抓取 | 按需 | ~50-100 次 |
| **总计** | - | **~100-150 次/天** |

## 🛠️ 开发说明

### 添加新统计维度

编辑 `src/stats.js`，在 `calculateContestStats()` 中添加新字段：

```javascript
function calculateContestStats(contests) {
  return {
    // ... 现有字段
    newField: contests.reduce(...)
  };
}
```

### 调整任务调度时间

编辑 `src/scheduler.js`，修改 `calculateLeaderboardTime()` 的缓冲时间：

```javascript
// 默认 8 分钟，可调整为其他值
calculateLeaderboardTime(endDate, 8);
```

## 📝 License

MIT
