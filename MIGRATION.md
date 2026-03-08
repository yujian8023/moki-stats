# 迁移指南 (v1.0 → v2.0)

## 📋 变更概览

| 模块 | v1.0 | v2.0 | 影响 |
|------|------|------|------|
| 数据获取 | 仅 OPEN/LIVE | 全量分页获取 | 需要初始化 |
| 任务调度 | 无 | 持久化任务队列 | 更可靠 |
| 统计维度 | 仅卡牌 | 卡牌 + 竞赛 | 新增统计 |
| GitHub Actions | 每小时整点 | 每小时第 6 分钟 | 需更新配置 |

## 🚀 迁移步骤

### 1. 备份现有数据

```bash
cd ~/aicoding/moki-stats
cp -r data data.backup
```

### 2. 更新代码

```bash
git pull origin main
```

### 3. 安装依赖

```bash
npm install
```

### 4. 初始化全量数据

```bash
# 首次运行，获取所有历史竞赛
npm run init
```

**预计耗时：** 5-10 分钟（取决于历史竞赛数量）

### 5. 验证数据

```bash
# 检查竞赛索引
cat data/contest_index.json | jq '.total'

# 检查统计报告
cat data/stats/summary.json | jq '.contestStats'
```

### 6. 更新 GitHub Actions

```bash
# 手动触发一次初始化工作流
# GitHub → Actions → "Initialize Contests" → Run workflow
```

### 7. 清理旧工作流

```bash
# 删除旧的 fetch-leaderboard.yml（如果存在）
rm .github/workflows/fetch-leaderboard.yml

# 提交变更
git add -A
git commit -m "🔄 迁移到 v2.0 重构版"
git push
```

## 📊 数据兼容性

### 保留的文件

- ✅ `data/contests/*.json` - 竞赛信息（会自动更新格式）
- ✅ `data/leaderboards/*.json` - 排行榜（格式不变）
- ✅ `data/mokis/*.json` - 卡牌详情（格式不变）

### 新增的文件

- 🆕 `data/contest_index.json` - 竞赛索引
- 🆕 `data/pending_tasks.json` - 任务队列
- 🆕 `data/stats/contest_daily.json` - 每日竞赛统计

### 格式变更

**竞赛信息 (data/contests/{_id}.json)：**

```javascript
// v1.0
{
  "status": "COMPLETED",
  "type": "WEEKLY"
}

// v2.0
{
  "contestStatus": "COMPLETED",  // 统一字段名
  "format": "FIFTY_FIFTY",        // 新增
  "entryFee": 100,                // 新增
  "prizePool": 500,               // 新增
  "entries": 50                   // 新增
}
```

## ⚠️ 注意事项

### 1. 初始化时间较长

首次获取全量数据需要 5-10 分钟，建议在低峰期执行。

### 2. GitHub Actions 需手动触发

`init-contests.yml` 不会自动运行，需要手动触发一次。

### 3. 旧统计数据

`data/stats/daily/` 和 `data/stats/weekly/` 中的旧统计仍然可用，但不会被更新。

### 4. 任务队列

如果程序重启，待执行的 leaderboard 任务会自动恢复（从 `pending_tasks.json` 读取）。

## 🔧 故障排除

### 问题：初始化失败

```bash
# 检查网络连接
curl https://fantasy.grandarena.gg/api/contests?limit=1

# 重试初始化
npm run init
```

### 问题：任务队列损坏

```bash
# 删除任务队列（会重新创建）
rm data/pending_tasks.json

# 重新生成索引
npm run stats
```

### 问题：统计报告为空

```bash
# 检查竞赛数据是否存在
ls data/contests/ | wc -l

# 重新生成统计
npm run stats
```

## 📞 需要帮助？

遇到问题请提交 Issue，附上：
- 错误日志
- Node.js 版本 (`node -v`)
- 数据目录大小 (`du -sh data/`)

---

**迁移完成后，删除此文件即可。**
