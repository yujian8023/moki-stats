# Moki Card 最强阵容统计

自动采集 Moki Fantasy 竞赛数据，分析高频卡牌与热门阵容。

## 📊 功能

- **自动采集**：每小时获取新竞赛，赛后 6 分钟自动抓取排行榜
- **数据分析**：统计卡牌出场率、平均排名、热门阵容组合
- **网页展示**：实时查看统计结果，支持日期筛选

## 🚀 快速开始

### 本地测试

```bash
# 安装依赖
npm install

# 获取竞赛数据
npm run fetch

# 抓取指定竞赛的排行榜
node src/fetch.js --leaderboards <contest_id1,contest_id2>

# 运行分析
npm run analyze
```

### 部署到 GitHub

1. 创建新仓库并推送代码
2. 启用 GitHub Actions
3. 开启 GitHub Pages（分支：`main`，目录：`/docs`）
4. Actions 会自动每小时运行

## 📁 项目结构

```
moki-stats/
├── .github/workflows/    # GitHub Actions 配置
├── data/                 # 数据存储
│   ├── contests/         # 竞赛信息
│   ├── leaderboards/     # 排行榜数据
│   └── stats/            # 统计结果
├── src/                  # 源代码
│   ├── fetch.js          # 数据采集
│   ├── analyze.js        # 数据分析
│   └── utils.js          # 工具函数
├── docs/                 # GitHub Pages 输出
└── package.json
```

## 📈 数据说明

### 竞赛信息 (data/contests/{_id}.json)
- `_id`: 竞赛 ID
- `name`: 竞赛名称
- `type`: 竞赛类型 (WEEKLY/DAILY/SPECIAL)
- `startDate/endDate`: 开始/结束时间
- `status`: 状态

### 排行榜 (data/leaderboards/{_id}.json)
- `contestId`: 关联竞赛 ID
- `top50`: 前 50 名玩家数据
  - `rank`: 排名
  - `playerName`: 玩家名
  - `score`: 分数
  - `mokiIds`: 使用的卡牌 ID 列表

### 统计结果 (data/stats/)
- `daily/`: 每日统计
- `weekly/`: 每周统计
- `summary.json`: 最近 7 天汇总

## ⏰ 定时任务

| Workflow | 频率 | 说明 |
|---------|------|------|
| fetch-contests.yml | 每小时整点 | 获取新竞赛 + 检查赛后排行榜 |
| fetch-leaderboard.yml | 每小时第 6 分钟 | 备份检查（防止遗漏） |

## 🌐 在线查看

启用 GitHub Pages 后，访问：
```
https://<username>.github.io/moki-stats/
```

## 📝 License

MIT
