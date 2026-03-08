# 🤖 Moki Stats 自动化数据增长流程

## 📋 自动化流程说明

### 🕐 每小时自动执行（第 6 分钟）

```
GitHub Actions → fetch-contests.yml
├─ 1. 抓取新竞赛（OPEN/LIVE 状态）
├─ 2. 检查已结束的竞赛
├─ 3. 抓取已结束竞赛的 leaderboard（结束后 8 分钟）
├─ 4. 生成统计报告
└─ 5. 提交并推送数据
```

### 📅 每日自动增长

```
跨天逻辑（0 点后）：
├─ 检测新日期 → 生成今日统计
├─ 检测昨日 → 生成昨日统计（如不存在）
└─ 更新 7 天汇总 → 自动包含最新 7 天
```

## 📊 数据文件结构

```
docs/data/
├── contests/              # 竞赛信息
│   ├── {_id}.json        # 每个竞赛一个文件
│   └── ...
├── leaderboards/          # 排行榜数据
│   ├── {_id}.json        # 竞赛结束后 8 分钟生成
│   └── ...
└── stats/
    ├── summary.json       # 近 7 天汇总（自动更新）
    ├── daily/             # 每日统计
    │   ├── 2026-03-08.json
    │   ├── 2026-03-09.json
    │   └── ...
    └── weekly/            # 每周统计（可选）
```

## 🔄 数据增长示例

### 场景：3 月 8 日 → 3 月 9 日（跨天）

**3 月 8 日 23:59（跨天前）：**
```
今日：2026-03-08 ✅
昨日：2026-03-07 ✅
近 7 天：03-02 ~ 03-08 ✅
```

**3 月 9 日 00:01（跨天后）：**
```
今日：2026-03-09 ✅ (新生成)
昨日：2026-03-08 ✅ (已存在)
近 7 天：03-03 ~ 03-09 ✅ (自动更新)
```

## ⏰ 时间线示例（3 月 9 日）

| 时间 | 事件 | 操作 |
|------|------|------|
| 00:00 | 跨天 | 生成 `daily/2026-03-09.json` |
| 06:06 | 每小时任务 | 抓取新竞赛，检查 leaderboard |
| 10:00 | 竞赛结束 | 10:08 自动抓取 leaderboard |
| 12:06 | 每小时任务 | 生成统计，更新汇总 |
| 18:06 | 每小时任务 | 生成统计，更新汇总 |
| 23:59 | 一天结束 | 当日数据完整 |

## 🎯 自动化保证

### ✅ 数据完整性
- 每小时检查新竞赛
- 竞赛结束后 8 分钟自动抓取 leaderboard
- 每日自动生成统计报告
- 7 天汇总自动滚动更新

### ✅ 容错机制
- 失败重试（最多 3 次）
- 限流保护（请求间隔 1.5 秒）
- 数据验证（检查文件格式）
- 降级处理（数据不存在时回退）

### ✅ 无需手动干预
- ⏰ 定时任务自动运行
- 📊 统计数据自动生成
- 🔄 数据文件自动更新
- 📈 前端数据自动刷新

## 🔧 手动操作（可选）

### 本地测试
```bash
cd ~/aicoding/moki-stats

# 抓取今日新竞赛
DATA_DIR=docs/data node src/fetch.js --incremental

# 检查已结束的竞赛
DATA_DIR=docs/data node src/leaderboard.js --check-finished

# 生成每日统计
DATA_DIR=docs/data node src/generate-daily.js

# 生成 7 天汇总
DATA_DIR=docs/data node src/stats.js
```

### 触发 GitHub Actions
```bash
# 手动触发工作流
gh workflow run fetch-contests.yml

# 或访问 GitHub 网页
https://github.com/yujian8023/moki-stats/actions
```

## 📈 监控与维护

### 检查工作流状态
```bash
# 查看最近的运行记录
https://github.com/yujian8023/moki-stats/actions

# 检查数据文件
ls -lh docs/data/stats/daily/
ls -lh docs/data/leaderboards/
```

### 验证数据
```bash
# 检查今日数据
curl https://yujian8023.github.io/moki-stats/data/stats/daily/2026-03-09.json | jq

# 检查 7 天汇总
curl https://yujian8023.github.io/moki-stats/data/stats/summary.json | jq
```

---

## 🎉 总结

**系统已完全自动化！**

- ✅ 每小时自动抓取新竞赛
- ✅ 竞赛结束后 8 分钟自动抓取 leaderboard
- ✅ 跨天自动生成新的每日统计
- ✅ 7 天汇总自动滚动更新
- ✅ 前端自动加载最新数据

**无需手动干预，数据自然增长！** 🚀
