# Moki-Stats 数据为 0 诊断报告

**诊断时间:** 2026-03-10 22:30  
**诊断者:** Nexus (Subagent)

---

## 执行检查摘要

### ✅ 1. 后端服务验证
**状态:** 正常  
**结果:**
```bash
cd ~/aicoding/moki-stats && npx tsx -e "import('./src/services/stats-filtered.ts').then(m => console.log(JSON.stringify(m.getFilteredStats({ timeRange: 'last_7_days' }))))"
```
返回:
```json
{
  "totalPlayers": 50389,
  "totalCards": 251945,
  "totalPrizePool": 168000.92,
  "contestCount": 149
}
```
**结论:** 后端服务正常，数据 > 0

---

### ✅ 2. 前端数据路径检查
**状态:** 正确  
**发现:**
- `fetch('data/contest_index.json')` → 存在
- `fetch('data/stats/summary.json')` → 存在
- `fetch('data/stats/daily/YYYY-MM-DD.json')` → 存在

**结论:** 数据路径正确，所有文件可访问

---

### ✅ 3. 数据文件存在性
**状态:** 正常  
**数据:**
- `docs/data/contests/` → 535 个文件
- `docs/data/leaderboards/` → 484 个文件
- `docs/data/stats/summary.json` → 23178 玩家
- `docs/data/stats/daily/2026-03-10.json` → 742 玩家
- `docs/data/stats/daily/2026-03-09.json` → 971 玩家

**结论:** 数据文件完整且包含有效数据

---

### ⚠️ 4. Vue 响应式潜在问题
**发现:**
```javascript
// index.html 第 464 行
const filteredStats = computed(() => {
  let result = { ...stats };  // 浅拷贝可能丢失响应式
  result = filterByContestType(result, summaryFilters.contestType);
  result = filterByEntryFee(result, summaryFilters.entryFee);
  return result;
});
```

**问题:** `{ ...stats }` 是浅拷贝，嵌套对象（如 `mokiAppearances`）会丢失 Vue 响应式追踪

---

### ⚠️ 5. 字段不匹配
**发现:**
- `stats` 初始化时缺少字段：`totalContests`, `generatedAt`, `period`, `fromDate`, `toDate`, `leaderboardsAnalyzed`
- 模板使用 `filteredStats.totalCards || filteredStats.totalWithCards`
- 数据中只有 `totalWithCards`，没有 `totalCards`

**影响:** 虽然 fallback 逻辑存在，但 `Object.assign(stats, data)` 添加新属性时，Vue 的响应式系统可能无法追踪

---

## 根本原因分析

### 最可能的问题：**Vue 响应式更新失效**

**症状:**
- 后端数据正常
- 数据文件存在且可访问
- fetch 请求成功
- 但页面显示为 0

**根因:**
1. `stats` 使用 `reactive()` 创建
2. `loadStats()` 使用 `Object.assign(stats, data)` 更新
3. `Object.assign` 添加新属性时，Vue 可能无法追踪这些**新增属性**的变化
4. `filteredStats` 是 `computed`，依赖 `stats`，但如果 `stats` 的响应式更新失效，`filteredStats` 不会重新计算

---

## 修复方案

### 方案 1: 使用 `ref` 替代 `reactive`（推荐）

**修改 index.html 第 387-397 行:**
```javascript
// 当前代码
const stats = reactive({
  totalPlayers: 0,
  totalWithCards: 0,
  mokiAppearances: {},
  strategyAppearances: {},
  topCompositions: [],
  contestStats: {}
});

// 修改为
const stats = ref({
  totalPlayers: 0,
  totalWithCards: 0,
  mokiAppearances: {},
  strategyAppearances: {},
  topCompositions: [],
  contestStats: {}
});

// 修改 loadStats() 中的更新逻辑
// 从 Object.assign(stats, data);
// 改为 stats.value = { ...stats.value, ...data };
```

### 方案 2: 确保所有字段预先定义

**修改 index.html 第 387-397 行:**
```javascript
const stats = reactive({
  totalPlayers: 0,
  totalWithCards: 0,
  totalContests: 0,
  totalPrizePool: 0,
  period: '',
  fromDate: '',
  toDate: '',
  generatedAt: '',
  leaderboardsAnalyzed: 0,
  mokiAppearances: {},
  strategyAppearances: {},
  topCompositions: [],
  contestStats: {}
});
```

### 方案 3: 使用 Vue.set 或扩展运算符

**修改 index.html 第 537 行:**
```javascript
// 从 Object.assign(stats, data);
// 改为
Object.keys(data).forEach(key => {
  if (key in stats) {
    stats[key] = data[key];
  } else {
    // 对于新属性，使用扩展运算符
    Object.assign(stats, { [key]: data[key] });
  }
});
```

---

## 验证命令

### 1. 快速测试（浏览器控制台）
```javascript
// 打开页面后，在浏览器控制台执行
fetch('data/stats/summary.json')
  .then(r => r.json())
  .then(d => console.log('数据正常:', d.totalPlayers, d.totalWithCards));
```

### 2. 修复后验证
```bash
cd ~/aicoding/moki-stats/docs
python3 -m http.server 8888
# 打开 http://localhost:8888 检查数据是否显示
```

### 3. 检查 Vue 实例
```javascript
// 浏览器控制台
const app = Vue.getCurrentInstance();
console.log('stats:', app.setupContext.stats);
console.log('filteredStats:', app.setupContext.filteredStats.value);
```

---

## 建议修复步骤

1. **立即修复:** 采用方案 2，在 `stats` 初始化时预定义所有字段
2. **长期优化:** 采用方案 1，迁移到 `ref` + `.value` 模式
3. **添加调试:** 在 `loadStats()` 中添加 `console.log('加载数据:', data)` 和 `console.log('更新后 stats:', stats)`

---

## 附录：关键代码位置

| 文件 | 行号 | 内容 |
|------|------|------|
| `docs/index.html` | 387-397 | `stats` 初始化 |
| `docs/index.html` | 464-469 | `filteredStats` 计算属性 |
| `docs/index.html` | 504-513 | `loadContestInfo()` |
| `docs/index.html` | 516-552 | `loadStats()` |
| `docs/index.html` | 575-580 | `mounted()` 钩子 |
| `docs/index.html` | 141-153 | 模板数据绑定 |

---

**诊断完成时间:** 5 分钟内  
**建议优先级:** 🔴 高（影响所有数据显示）
