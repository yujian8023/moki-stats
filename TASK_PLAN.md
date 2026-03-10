# Moki-Stats v2.1 任务规划

**任务:** 添加数据分析 + 筛选功能  
**日期:** 2026-03-10  
**执行者:** Coding Agent (subagent)  
**监督者:** Nexus (主 agent)

---

## 📋 任务拆解 (Task Breakdown)

### 阶段 1: 分析现有代码 (15 分钟)

**子任务 1.1:** 分析项目结构
```bash
cd ~/aicoding/moki-stats
find src -name "*.js" -o -name "*.ts" | head -20
cat package.json
```

**输出:** 
- 代码结构图
- 依赖关系
- 现有功能清单

---

### 阶段 2: 提出实现方案 (20 分钟)

**子任务 2.1:** 设计方案 A（保守方案）
- 在现有 JS 代码上修改
- 最小改动
- 风险低

**子任务 2.2:** 设计方案 B（重构方案）
- TypeScript 重构
- 模块化设计
- 长期可维护

**子任务 2.3:** 设计方案 C（混合方案）
- 核心功能 TypeScript
- 保持现有 CLI 兼容
- 平衡方案

**输出:** 3 个方案对比文档

---

### 阶段 3: TDD - 编写测试 (30 分钟)

**子任务 3.1:** 配置测试框架
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  }
}
```

**子任务 3.2:** 编写测试用例
```typescript
// 时间筛选测试
describe('filterByTimeRange', () => {
  it('should filter today\'s contests', () => {
    // ...
  });
});

// 名称筛选测试
describe('filterByContestName', () => {
  it('should search by keyword', () => {
    // ...
  });
});
```

---

### 阶段 4: 实现功能 (1 小时)

**子任务 4.1:** 实现类型定义
```typescript
// src/types/index.ts
export type TimeRange = 'today' | 'yesterday' | 'last_7_days' | 'all';
export interface FilterOptions { ... }
```

**子任务 4.2:** 实现筛选函数
```typescript
// src/services/stats.ts
export function filterByTimeRange(contests: Contest[], range: TimeRange) { ... }
export function filterByContestName(contests: Contest[], keyword: string) { ... }
```

**子任务 4.3:** 实现统计计算
```typescript
export function calculateStats(contests: Contest[], leaderboards: any[]) {
  return {
    totalPlayers: ...,
    totalCards: ...,
    uniqueCards: ...,
    totalPrizePool: ...
  };
}
```

**子任务 4.4:** 实现奖池数据获取
```typescript
// src/api/contest-details.ts
export class ContestDetailsApi {
  async fetchDetails(contestId: string) { ... }
}
```

**子任务 4.5:** 实现原始数据持久化
```typescript
// src/services/raw-data.ts
export function saveRawData(type: 'contest' | 'leaderboard', id: string, data: any) { ... }
```

---

### 阶段 5: 测试验证 (20 分钟)

**子任务 5.1:** 运行单元测试
```bash
npm test
```

**子任务 5.2:** 运行类型检查
```bash
npm run typecheck
```

**子任务 5.3:** 集成测试
- 手动运行筛选功能
- 验证统计结果

---

### 阶段 6: 文档和提交 (10 分钟)

**子任务 6.1:** 更新文档
- README.md
- PROGRESS.md

**子任务 6.2:** Git 提交
```bash
git add -A
git commit -m "feat: 添加时间筛选、名称筛选、奖池数据功能"
```

---

## 📊 预计时间

| 阶段 | 预计时间 |
|------|----------|
| 1. 分析现有代码 | 15 分钟 |
| 2. 提出实现方案 | 20 分钟 |
| 3. TDD - 编写测试 | 30 分钟 |
| 4. 实现功能 | 60 分钟 |
| 5. 测试验证 | 20 分钟 |
| 6. 文档和提交 | 10 分钟 |
| **总计** | **2 小时 35 分钟** |

---

## ✅ 验收标准

### 功能验收
- [ ] 时间筛选正常工作
- [ ] 名称筛选正常工作
- [ ] 统计指标正确计算
- [ ] 奖池数据可以获取
- [ ] 原始数据正确保存

### 质量验收
- [ ] TypeScript 编译通过
- [ ] 单元测试通过率 > 80%
- [ ] 代码有完整注释
- [ ] 错误处理完善

### 兼容性验收
- [ ] 现有 CLI 命令正常
- [ ] 现有数据结构不变
- [ ] GitHub Pages 正常访问

---

## 🎯 下一步

**Coding Agent 请执行:**

1. 先完成 **阶段 1** - 分析现有代码
2. 然后完成 **阶段 2** - 提出 3 个实现方案
3. 等待 Nexus 确认方案后再继续编码

**输出格式:**
```markdown
## 方案对比

### 方案 A: [名称]
**优点:** ...
**缺点:** ...
**预计时间:** ...

### 方案 B: [名称]
**优点:** ...
**缺点:** ...
**预计时间:** ...

### 方案 C: [名称]
**优点:** ...
**缺点:** ...
**预计时间:** ...

## 推荐方案
我推荐 [方案 X]，因为...
```

---

_此计划由 task-dispatcher skill 生成_
