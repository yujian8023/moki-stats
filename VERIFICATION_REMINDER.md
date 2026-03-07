# ⏰ Moki Stats 验证提醒

## 📅 关键时间点

### 今天（2026-03-08）

| 时间（北京时间） | 事件 | 状态 |
|---------------|------|------|
| 05:00 | 8 个竞赛结束 | ✅ 已结束 |
| 05:06 | 应该抓取排行榜 | ⏳ 待验证 |
| 13:00 | 8 个新竞赛结束 | ⏳ 等待中 |
| 13:06 | 应该抓取排行榜 | ⏳ 待验证 |

---

## 🔔 设置提醒

### 方案 1：手机闹钟（推荐）

**设置两个闹钟：**
- ⏰ **05:06** - 验证早批竞赛排行榜
- ⏰ **13:06** - 验证午批竞赛排行榜

### 方案 2：电脑提醒

```bash
# macOS 使用 say 命令提醒
# 添加到 crontab: crontab -e

# 每天 05:06 提醒
6 5 * * * osascript -e 'display notification "验证 Moki 早批竞赛排行榜" with title "Moki Stats"'

# 每天 13:06 提醒  
6 13 * * * osascript -e 'display notification "验证 Moki 午批竞赛排行榜" with title "Moki Stats"'
```

### 方案 3：运行提醒脚本

```bash
cd ~/aicoding/moki-stats
chmod +x remind-verify.sh
./remind-verify.sh
```

---

## ✅ 验证清单

### 1. 检查 GitHub Actions

访问：https://github.com/yujian8023/moki-stats/actions

**检查项：**
- [ ] Fetch Contests workflow 是否运行成功（绿色✓）
- [ ] 是否有 "Fetch moki details" 步骤
- [ ] 是否有 "Run analysis" 步骤
- [ ] 是否有 "Commit and push changes" 步骤

### 2. 检查排行榜数据

访问：https://github.com/yujian8023/moki-stats/tree/main/data/leaderboards

**检查项：**
- [ ] 是否有新的 JSON 文件（应该 > 0 个）
- [ ] 文件名是否对应已结束的竞赛 ID
- [ ] 文件大小是否正常（应该 > 1KB）

### 3. 检查网页显示

访问：https://yujian8023.github.io/moki-stats/

**检查项：**
- [ ] "已完成" 竞赛数量是否 > 0
- [ ] 高频卡牌 TOP 20 是否有数据
- [ ] 热门阵容 TOP 10 是否有数据
- [ ] 卡牌是否显示图片和名称
- [ ] 稀有度和元素是否正确显示

### 4. 检查卡牌详情

访问：https://github.com/yujian8023/moki-stats/tree/main/data/mokis

**检查项：**
- [ ] manifest.json 是否有数据
- [ ] 是否有卡牌详情文件
- [ ] 卡牌信息是否完整（名称、稀有度、元素等）

---

## 🐛 问题排查

### 如果 Actions 失败

1. 点击失败的 workflow run
2. 查看具体哪个步骤失败
3. 检查错误日志
4. 常见问题：
   - API 限流 → 等待后重试
   - 网络问题 → 检查 GitHub 状态
   - 代码错误 → 查看错误信息

### 如果没有排行榜数据

1. 确认竞赛是否真的结束
2. 检查 fetch.js 的赛后检测逻辑
3. 查看 Actions 日志中的 "Fetch contests" 输出
4. 手动运行：`node src/fetch.js --leaderboards <contest_id>`

### 如果网页没有更新

1. 强制刷新（Cmd+Shift+R）
2. 检查 Pages 部署是否成功
3. 查看 pages-build-deployment workflow
4. 清除浏览器缓存

---

## 📝 记录验证结果

验证后请记录：

```markdown
## 验证记录

### 2026-03-08 早批（05:00 结束）

- 验证时间：____:____
- Actions 状态：✅ / ❌
- 排行榜数量：__ 个
- 网页显示：✅ / ❌
- 问题记录：

### 2026-03-08 午批（13:00 结束）

- 验证时间：____:____
- Actions 状态：✅ / ❌
- 排行榜数量：__ 个
- 网页显示：✅ / ❌
- 问题记录：
```

---

## 📞 需要帮助？

如果遇到问题：

1. 查看 SCHEDULE_ANALYSIS.md 了解赛程规律
2. 查看 ROADMAP.md 了解功能规划
3. 检查 GitHub Issues
4. 查看 Actions 日志

---

**下次验证时间：今天下午 13:06** ⏰
