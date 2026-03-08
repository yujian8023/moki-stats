# 🔧 Leaderboard 数据修复指南

## ❌ 问题原因

发现 **446 个竞赛的 leaderboard 没有抓取**，导致今日数据一直停留在 400 人。

原因：
1. GitHub Actions 的 `fetch-contests.yml` 工作流多次被取消（cancelled）
2. `--check-finished` 功能可能没有正常工作
3. 大量历史竞赛的 leaderboard 缺失

## ✅ 解决方案

### 方案 A：手动触发工作流（推荐）

1. 访问：https://github.com/yujian8023/moki-stats/actions/workflows/fetch-contests.yml
2. 点击右上角 **"Run workflow"** 按钮
3. 选择 `main` 分支
4. 点击 **"Run workflow"**
5. 等待运行完成（约 10-15 分钟）

### 方案 B：本地运行完整抓取

```bash
cd ~/aicoding/moki-stats

# 抓取最近 30 天的 leaderboard
DATA_DIR=docs/data node src/leaderboard.js --recent 30

# 生成统计报告
DATA_DIR=docs/data node src/generate-daily.js

# 提交并推送
git add -A
git commit -m "📊 抓取缺失的 leaderboard 数据"
git push
```

### 方案 C：使用初始化工作流

1. 访问：https://github.com/yujian8023/moki-stats/actions/workflows/init-contests.yml
2. 点击 **"Run workflow"**
3. 等待完成（会抓取所有数据并重新生成统计）

## 📊 验证修复

修复后检查：

```bash
# 检查 leaderboard 文件数量
ls docs/data/leaderboards/*.json | wc -l
# 应该接近 470 个

# 检查今日数据
cat docs/data/stats/daily/2026-03-08.json | jq '.totalPlayers'
# 应该大于 400

# 检查网页
curl https://yujian8023.github.io/moki-stats/data/stats/daily/2026-03-08.json | jq '.totalPlayers'
```

## 🔍 监控工作流状态

访问：https://github.com/yujian8023/moki-stats/actions

查看最近的运行记录：
- ✅ completed successfully - 成功
- ❌ cancelled - 被取消（需要重新运行）
- ❌ failed - 失败（查看日志）

## 📝 后续优化

1. **检查工作流取消原因** - 可能是超时或其他问题
2. **增加错误日志** - 更好地调试问题
3. **设置告警** - 工作流失败时通知

---

**最后更新：** 2026-03-08 22:26
