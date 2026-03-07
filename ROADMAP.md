# Moki Stats 功能优化路线图

> 创建时间：2026-03-08  
> 项目位置：`~/aicoding/moki-stats/`

---

## 📋 功能规划总览

| 优先级 | 功能 | 状态 | 预计时间 | 依赖 |
|--------|------|------|---------|------|
| **P0** | 🃏 卡牌详情集成 | 📋 待开始 | 30 分钟 | API |
| **P0** | 🖼️ 网页显示卡牌图片 | 📋 待开始 | 30 分钟 | P0-1 |
| **P0** | 🏆 阵容推荐系统 | 📋 待开始 | 1 小时 | P0-1 |
| **P1** | 💎 竞赛性价比分析 | 📋 待开始 | 45 分钟 | API |
| **P1** | ⏳ 空数据状态优化 | 📋 待开始 | 15 分钟 | 无 |
| **P2** | 📈 数据可视化 | 📋 待开始 | 2 小时 | P0-1/2 |

---

## 🎯 P0 - 高优先级（立即实施）

### P0-1: 🃏 卡牌详情集成

**目标：** 获取并保存卡牌完整信息（名称、图片、稀有度等）

#### 技术方案

**数据源：**
```javascript
GET https://fantasy.grandarena.gg/api/moki/{tokenId}
```

**返回数据结构：**
```json
{
  "tokenId": "64f2a1b2c3d4e5f6",
  "name": "Tanuki Tim",
  "element": "Fire",
  "rarity": "Epic",
  "role": "Attacker",
  "imageUrl": "https://fantasy.grandarena.gg/images/moki/xxx.png",
  "stats": {
    "attack": 120,
    "defense": 80,
    "health": 200
  },
  "skills": ["Skill1", "Skill2"]
}
```

#### 实施步骤

**Step 1: 扩展数据存储结构** (10 分钟)
```javascript
// data/mokis/{tokenId}.json
{
  "tokenId": "xxx",
  "name": "Tanuki Tim",
  "element": "Fire",
  "rarity": "Epic",
  "role": "Attacker",
  "imageUrl": "...",
  "stats": {...},
  "lastUpdated": "2026-03-08T00:00:00Z"
}
```

**Step 2: 修改 fetch.js** (15 分钟)
```javascript
// src/fetch.js
async function fetchMokiDetails(tokenIds) {
  const mokiDetails = {};
  
  for (const tokenId of tokenIds) {
    // 检查本地缓存
    if (mokiExists(tokenId)) continue;
    
    const details = await fetchMoki(tokenId);
    saveMokiDetails(tokenId, details);
    await sleep(300); // 避免频率限制
  }
  
  return mokiDetails;
}
```

**Step 3: 集成到现有流程** (5 分钟)
- 在抓取竞赛后，自动获取涉及的卡牌详情
- 在抓取排行榜后，自动获取涉及的卡牌详情

#### 验收标准
- [ ] 所有出现过的卡牌都有详细信息
- [ ] 卡牌信息保存在 `data/mokis/` 目录
- [ ] 避免重复请求（本地缓存）
- [ ] 错误处理完善

---

### P0-2: 🖼️ 网页显示卡牌图片

**目标：** 在网页中显示卡牌图片，不只是 ID

#### 技术方案

**修改内容：**
1. 高频卡牌表格 - 添加卡牌图片列
2. 热门阵容 - 显示卡牌缩略图
3. 卡牌详情弹窗 - 点击查看完整信息

#### 实施步骤

**Step 1: 修改表格结构** (10 分钟)
```html
<!-- 高频卡牌表格 -->
<table>
  <thead>
    <tr>
      <th>排名</th>
      <th>卡牌</th>  <!-- 新增：图片 + 名称 -->
      <th>稀有度</th>
      <th>元素</th>
      <th>出场次数</th>
      <th>出场率</th>
      <th>平均排名</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>
        <div class="flex items-center gap-2">
          <img :src="moki.imageUrl" class="w-10 h-10" />
          <span>{{ moki.name }}</span>
        </div>
      </td>
      <td><rarity-badge :rarity="moki.rarity" /></td>
      <td><element-icon :element="moki.element" /></td>
      ...
    </tr>
  </tbody>
</table>
```

**Step 2: 添加卡牌组件** (15 分钟)
```vue
<!-- 稀有度徽章 -->
<component name="RarityBadge">
  <span :class="rarityClass">{{ rarityText }}</span>
</component>

<!-- 元素图标 -->
<component name="ElementIcon">
  <img :src="elementIconUrl" />
</component>

<!-- 卡牌卡片 -->
<component name="MokiCard">
  <div class="card">
    <img :src="moki.imageUrl" />
    <h3>{{ moki.name }}</h3>
    <p>{{ moki.rarity }} - {{ moki.element }}</p>
  </div>
</component>
```

**Step 3: 加载卡牌数据** (5 分钟)
```javascript
// 在 loadStats 中同时加载卡牌信息
async loadMokiDetails() {
  const response = await fetch('data/mokis/manifest.json');
  this.mokiDetails = await response.json();
}
```

#### 验收标准
- [ ] 卡牌表格显示图片和名称
- [ ] 稀有度用颜色区分（Common=灰色，Rare=蓝色，Epic=紫色，Legendary=橙色）
- [ ] 元素有对应图标
- [ ] 响应式设计（移动端友好）

---

### P0-3: 🏆 阵容推荐系统

**目标：** 基于数据智能推荐最强阵容

#### 技术方案

**推荐算法：**
```javascript
评分 = 出场率 * 40% + 胜率 * 30% + 稀有度 * 15% + 元素平衡 * 15%

// 胜率估算
胜率 = (1 / 平均排名) * 100

// 稀有度评分
Common = 4, Rare = 3, Epic = 2, Legendary = 1
(低稀有度高表现 = 高性价比)

// 元素平衡
检查 5 张卡的元素分布，避免单一元素
```

#### 实施步骤

**Step 1: 创建推荐引擎** (20 分钟)
```javascript
// src/recommend.js
class CompositionRecommender {
  constructor(mokiStats, mokiDetails) {
    this.mokiStats = mokiStats;
    this.mokiDetails = mokiDetails;
  }
  
  calculateScore(mokiId) {
    const stats = this.mokiStats[mokiId];
    const details = this.mokiDetails[mokiId];
    
    const appearanceScore = stats.percentage * 0.4;
    const winRateScore = (1 / stats.avgRank) * 100 * 0.3;
    const rarityScore = this.getRarityScore(details.rarity) * 0.15;
    
    return appearanceScore + winRateScore + rarityScore;
  }
  
  getRarityScore(rarity) {
    const scores = { Common: 4, Rare: 3, Epic: 2, Legendary: 1 };
    return scores[rarity] || 2;
  }
  
  generateRecommendations(count = 10) {
    const scoredMokis = Object.keys(this.mokiStats)
      .map(id => ({
        id,
        score: this.calculateScore(id),
        details: this.mokiDetails[id]
      }))
      .sort((a, b) => b.score - a.score);
    
    return scoredMokis.slice(0, count);
  }
  
  generateCompositions(count = 5) {
    const topMokis = this.generateRecommendations(20);
    const compositions = [];
    
    // 生成 5 卡阵容
    for (let i = 0; i < count; i++) {
      const composition = this.selectBalancedTeam(topMokis);
      compositions.push(composition);
    }
    
    return compositions;
  }
  
  selectBalancedTeam(mokis) {
    // 选择 5 张卡，确保元素平衡
    // 实现逻辑...
  }
}

export default CompositionRecommender;
```

**Step 2: 集成到分析流程** (15 分钟)
```javascript
// src/analyze.js
import CompositionRecommender from './recommend.js';

function generateRecommendations() {
  const mokiStats = loadMokiStats();
  const mokiDetails = loadMokiDetails();
  
  const recommender = new CompositionRecommender(mokiStats, mokiDetails);
  const recommendations = recommender.generateRecommendations(20);
  const compositions = recommender.generateCompositions(10);
  
  saveRecommendations({
    topMokis: recommendations,
    topCompositions: compositions,
    generatedAt: new Date().toISOString()
  });
}
```

**Step 3: 网页展示** (25 分钟)
```html
<!-- 推荐阵容区域 -->
<div class="recommendations">
  <h2>🏆 推荐阵容</h2>
  
  <!-- 推荐卡牌 -->
  <div class="top-mokis">
    <h3>🔥 推荐卡牌 TOP 10</h3>
    <div class="moki-grid">
      <moki-card v-for="moki in topMokis" :key="moki.id" :moki="moki" />
    </div>
  </div>
  
  <!-- 推荐阵容 -->
  <div class="top-compositions">
    <h3>💪 推荐阵容 TOP 5</h3>
    <div class="composition-list">
      <composition-card v-for="comp in topCompositions" :key="comp.id" :composition="comp" />
    </div>
  </div>
</div>
```

#### 验收标准
- [ ] 生成推荐卡牌列表（TOP 20）
- [ ] 生成推荐阵容（TOP 5）
- [ ] 每个推荐有评分和理由
- [ ] 网页展示推荐结果
- [ ] 支持刷新重新生成

---

## 🎯 P1 - 中优先级（随后实施）

### P1-1: 💎 竞赛性价比分析

**目标：** 计算每个 gems 的期望奖池价值，推荐最佳竞赛

#### 技术方案

**性价比公式：**
```javascript
性价比 = 奖池金额 / (报名费 * 参赛人数上限)

// 考虑中奖概率
期望收益 = 奖池 * 0.5 / 参赛人数  // 假设 50% 中奖率

// 综合评分
评分 = 性价比 * 50% + 奖池 * 30% + 剩余位置 * 20%
```

#### 实施步骤

**Step 1: 扩展竞赛数据** (10 分钟)
```javascript
// data/contests/{_id}.json 新增字段
{
  "_id": "xxx",
  ...
  "entryFee": 2000,           // 报名费（gems）
  "maxEntries": 350,          // 最大参赛数
  "currentEntries": 132,      // 当前参赛数
  "remainingSlots": 218,      // 剩余位置
  "valuePerGem": 0.0088,      // 每 gems 奖池价值
  "recommended": true,        // 是否推荐
  "recommendScore": 85        // 推荐评分
}
```

**Step 2: 修改 fetch.js** (15 分钟)
```javascript
// 在获取竞赛时计算性价比
function calculateContestValue(contest) {
  const prizePool = contest.prizePool || 0;
  const entryFee = contest.entryFee || 0;
  const maxEntries = contest.maxEntries || 1;
  
  const valuePerGem = prizePool / (entryFee * maxEntries);
  const fillRate = contest.participantCount / maxEntries;
  const remainingSlots = maxEntries - contest.participantCount;
  
  // 推荐评分
  let score = valuePerGem * 50;
  score += prizePool * 0.01 * 30;
  score += remainingSlots * 0.1 * 20;
  
  return {
    valuePerGem: parseFloat(valuePerGem.toFixed(4)),
    fillRate: parseFloat(fillRate.toFixed(2)),
    remainingSlots,
    recommendScore: Math.min(100, Math.round(score)),
    recommended: score > 60
  };
}
```

**Step 3: 网页展示** (20 分钟)
```html
<!-- 竞赛推荐区域 -->
<div class="contest-recommendations">
  <h2>💎 高性价比竞赛</h2>
  
  <div class="contest-grid">
    <div v-for="contest in recommendedContests" :key="contest._id" 
         class="contest-card" :class="contest.recommendScore > 80 ? 'hot' : ''">
      <div class="prize-pool">${{ contest.prizePool }}</div>
      <div class="contest-name">{{ contest.name }}</div>
      <div class="entry-fee">🔶 {{ contest.entryFee }} gems</div>
      <div class="value-per-gem">💰 ¥{{ contest.valuePerGem }}/gem</div>
      <div class="slots">{{ contest.participantCount }}/{{ contest.maxEntries }}</div>
      <div class="recommend-score" :class="getScoreClass(contest.recommendScore)">
        推荐度：{{ contest.recommendScore }}
      </div>
    </div>
  </div>
</div>
```

#### 验收标准
- [ ] 计算每个竞赛的性价比
- [ ] 生成推荐评分
- [ ] 网页显示推荐竞赛
- [ ] 高推荐度竞赛特殊标记（🔥）

---

### P1-2: ⏳ 空数据状态优化

**目标：** 改善无数据时的用户体验

#### 技术方案

**当前问题：**
- 显示"加载失败"不够友好
- 用户不知道为什么要等待
- 缺少预期时间

#### 实施步骤

**Step 1: 优化空状态提示** (10 分钟)
```html
<div v-if="stats.totalPlayers === 0" class="empty-state">
  <div class="icon">⏳</div>
  <h3>数据收集中</h3>
  <p>
    系统正在等待竞赛结束并自动抓取数据。<br/>
    当前已追踪 <strong>{{ contestCount }}</strong> 个竞赛，
    其中 <strong>{{ completedContests }}</strong> 个已完成。
  </p>
  
  <div class="countdown" v-if="nextContestEnds">
    <p>下一个竞赛预计结束时间：</p>
    <div class="timer">{{ countdownText }}</div>
  </div>
  
  <div class="tips">
    <h4>💡 小提示</h4>
    <ul>
      <li>竞赛结束后 6-10 分钟自动更新数据</li>
      <li>每小时自动检查新竞赛</li>
      <li>刷新页面获取最新数据</li>
    </ul>
  </div>
</div>
```

**Step 2: 添加倒计时功能** (5 分钟)
```javascript
data() {
  return {
    countdownText: '计算中...',
    nextContestEnds: null
  };
},

methods: {
  updateCountdown() {
    // 从竞赛数据中找到最近结束的
    const now = Date.now();
    const upcoming = this.contests
      .filter(c => new Date(c.endDate).getTime() > now)
      .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))[0];
    
    if (upcoming) {
      this.nextContestEnds = new Date(upcoming.endDate);
      this.updateCountdownText();
      setInterval(() => this.updateCountdownText(), 1000);
    }
  },
  
  updateCountdownText() {
    const diff = this.nextContestEnds - Date.now();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    this.countdownText = `${hours}小时 ${minutes}分钟 ${seconds}秒`;
  }
}
```

#### 验收标准
- [ ] 友好的空状态提示
- [ ] 显示已追踪竞赛数量
- [ ] 显示已完成竞赛数量
- [ ] 倒计时显示下一个结束时间
- [ ] 提供有用的小提示

---

## 🎯 P2 - 长期优化

### P2-1: 📈 数据可视化

**目标：** 添加图表展示数据趋势

#### 技术方案

**图表库：** Chart.js（已集成）

**图表类型：**
1. 卡牌出场率趋势（折线图）
2. 奖池金额对比（柱状图）
3. 阵容分布（饼图）
4. 时间序列分析（面积图）

#### 实施步骤

**Step 1: 准备数据** (30 分钟)
```javascript
// src/analyze.js - 生成趋势数据
function generateTrendData() {
  const dailyStats = loadDailyStats();
  
  const trendData = {
    dates: [],
    mokiAppearances: {}  // 每个卡牌的每日出场率
  };
  
  for (const day of dailyStats) {
    trendData.dates.push(day.date);
    
    for (const [mokiId, stats] of Object.entries(day.mokiAppearances)) {
      if (!trendData.mokiAppearances[mokiId]) {
        trendData.mokiAppearances[mokiId] = [];
      }
      trendData.mokiAppearances[mokiId].push(stats.percentage);
    }
  }
  
  return trendData;
}
```

**Step 2: 创建图表组件** (45 分钟)
```html
<!-- 出场率趋势图 -->
<div class="chart-container">
  <h3>📈 卡牌出场率趋势</h3>
  <canvas id="appearanceTrendChart"></canvas>
</div>

<!-- 奖池对比图 -->
<div class="chart-container">
  <h3>💰 竞赛奖池对比</h3>
  <canvas id="prizePoolChart"></canvas>
</div>
```

```javascript
// 初始化图表
function initTrendChart(trendData) {
  const ctx = document.getElementById('appearanceTrendChart');
  
  const datasets = Object.entries(trendData.mokiAppearances)
    .slice(0, 5)  // 只显示 TOP 5
    .map(([mokiId, data], index) => ({
      label: mokiId,
      data: data,
      borderColor: getColor(index),
      tension: 0.4
    }));
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: trendData.dates,
      datasets: datasets
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' }
      }
    }
  });
}
```

**Step 3: 集成到网页** (45 分钟)
- 添加图表展示区域
- 支持切换时间范围（7 天/30 天/全部）
- 支持点击图例隐藏/显示
- 移动端响应式

#### 验收标准
- [ ] 出场率趋势图（折线图）
- [ ] 奖池对比图（柱状图）
- [ ] 支持时间范围切换
- [ ] 响应式设计
- [ ] 图表交互（hover 显示详情）

---

## 📅 实施时间表

### Day 1 (今天)
- [x] 项目创建和基础功能
- [ ] P0-1: 卡牌详情集成
- [ ] P0-2: 网页显示卡牌图片

### Day 2
- [ ] P0-3: 阵容推荐系统
- [ ] P1-1: 竞赛性价比分析
- [ ] P1-2: 空数据状态优化

### Day 3-4
- [ ] P2-1: 数据可视化
- [ ] 整体测试和优化
- [ ] 文档完善

---

## 🔧 技术债务

- [ ] 添加单元测试
- [ ] 优化 API 请求频率
- [ ] 添加错误监控
- [ ] 性能优化（大数据量加载）
- [ ] SEO 优化

---

## 📝 待确定事项

1. **卡牌图片源** - 需要确认 API 是否返回图片 URL
2. **推荐算法权重** - 需要根据实际数据调整
3. **更新频率** - 是否需要更频繁的定时任务
4. **数据保留策略** - 历史数据保存多久

---

**下一步：** 开始实施 P0-1（卡牌详情集成）
