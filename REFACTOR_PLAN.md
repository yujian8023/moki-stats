# Moki-Stats v2.0 重构计划

**分支:** `refactor-v2`  
**创建日期:** 2026-03-10  
**目标:** 提升代码质量、可维护性、性能，不影响现有用户

---

## 📊 当前问题分析

### 1. 代码结构问题

| 文件 | 行数 | 问题 |
|------|------|------|
| `fetch.js` | ~450 行 | 单文件职责过多，难以测试 |
| `scheduler.js` | ~200 行 | 良好，但缺少类型定义 |
| `stats.js` | ~300 行 | 统计计算重复，可优化 |
| `utils.js` | - | 工具函数混杂，缺少分类 |

**问题:**
- ❌ 无 TypeScript 类型检查
- ❌ 函数过长（`fetchAllContests` 80+ 行）
- ❌ 错误处理不统一
- ❌ 缺少单元测试

---

### 2. 性能问题

| 操作 | 当前实现 | 优化空间 |
|------|----------|----------|
| 统计生成 | 每次全量重算 | 增量计算 |
| 数据读取 | 同步 fs 读取 | 异步批量读取 |
| API 请求 | 串行 + sleep | 并发控制 |
| 索引生成 | 每次重建 | 增量更新 |

---

### 3. 错误处理问题

```javascript
// 当前实现
try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
} catch (error) {
  console.error(`❌ ${contestId}: ${error.message}`);
}

// 问题：
// 1. 错误信息不结构化
// 2. 无错误分类（网络错误/数据错误/配置错误）
// 3. 重试逻辑分散
```

---

### 4. 测试覆盖

- ❌ 无单元测试
- ❌ 无集成测试
- ❌ 无 E2E 测试

---

## 🎯 重构目标

### 优先级 P0（必须完成）

1. **TypeScript 迁移**
   - 添加类型定义
   - 编译时检查
   - IDE 智能提示

2. **错误处理统一**
   - 自定义错误类
   - 统一重试机制
   - 错误日志结构化

3. **模块化拆分**
   ```
   src/
   ├── api/           # API 客户端
   │   ├── contests.ts
   │   ├── leaderboard.ts
   │   └── moki.ts
   ├── services/      # 业务逻辑
   │   ├── fetch.ts
   │   ├── scheduler.ts
   │   └── stats.ts
   ├── types/         # 类型定义
   │   └── index.ts
   ├── utils/         # 工具函数
   │   ├── fs.ts
   │   ├── date.ts
   │   └── errors.ts
   └── index.ts       # 入口
   ```

4. **测试框架**
   - Jest/Vitest 配置
   - 核心函数单元测试
   - 关键流程集成测试

---

### 优先级 P1（应该完成）

5. **性能优化**
   - 增量统计计算
   - 数据缓存层
   - 并发请求控制

6. **配置管理**
   - 环境变量验证
   - 配置文件 schema
   - 默认值管理

7. **日志系统**
   - 结构化日志
   - 日志级别控制
   - 日志轮转

---

### 优先级 P2（可以完成）

8. **文档完善**
   - API 文档
   - 开发者指南
   - 部署手册

9. **监控告警**
   - 关键指标监控
   - 失败告警
   - 性能追踪

---

## 📝 实施计划

### 阶段 1: 基础重构 (2-3 小时)

**目标:** TypeScript 迁移 + 模块化拆分

#### 任务 1.1: 创建类型定义
```typescript
// src/types/index.ts
export interface Contest {
  _id: string;
  name: string;
  contestStatus: ContestStatus;
  format: ContestFormat;
  entryFee: number;
  prizePool: number;
  entries: number;
  startDate: string;
  endDate: string;
  leaderboardFetched: boolean;
}

export type ContestStatus = 'OPEN' | 'LIVE' | 'COMPLETED' | 'UPCOMING';
export type ContestFormat = 'FIFTY_FIFTY' | 'TOP_20_PCT' | 'FREE_ENTRY';

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  score: number;
  mokiIds: string[];
}

export interface Task {
  id: string;
  contestId: string;
  type: 'fetchLeaderboard';
  executeAt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  retryCount: number;
}
```

#### 任务 1.2: 拆分 API 客户端
```typescript
// src/api/contests.ts
export class ContestsApi {
  private baseUrl: string;
  
  async fetchContests(options: FetchOptions): Promise<Contest[]>;
  async fetchAll(options?: PaginationOptions): Promise<Contest[]>;
  async fetchById(id: string): Promise<Contest>;
}

// src/api/leaderboard.ts
export class LeaderboardApi {
  async fetchLeaderboard(contestId: string, options?: LeaderboardOptions): Promise<LeaderboardEntry[]>;
}

// src/api/moki.ts
export class MokiApi {
  async fetchMokiDetails(mokiId: string): Promise<MokiDetail>;
  async fetchBatch(mokiIds: string[]): Promise<MokiDetail[]>;
}
```

#### 任务 1.3: 重构错误处理
```typescript
// src/utils/errors.ts
export class MokiError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'MokiError';
  }
}

export class ApiError extends MokiError {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string
  ) {
    super(message, 'API_ERROR', { statusCode, endpoint });
    this.name = 'ApiError';
  }
}

export class RateLimitError extends MokiError {
  constructor(
    message: string,
    public retryAfter: number
  ) {
    super(message, 'RATE_LIMIT', { retryAfter });
    this.name = 'RateLimitError';
  }
}
```

---

### 阶段 2: 测试覆盖 (2-3 小时)

**目标:** 核心函数单元测试 + 关键流程集成测试

#### 任务 2.1: 配置测试框架
```json
// package.json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

#### 任务 2.2: 编写测试用例
```typescript
// src/api/__tests__/contests.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ContestsApi } from '../contests';

describe('ContestsApi', () => {
  it('should fetch contests with pagination', async () => {
    const api = new ContestsApi();
    const contests = await api.fetchAll({ limit: 50 });
    expect(contests.length).toBeGreaterThan(0);
  });

  it('should handle API errors', async () => {
    const api = new ContestsApi('invalid-url');
    await expect(api.fetchAll()).rejects.toThrow(ApiError);
  });
});

// src/services/__tests__/scheduler.test.ts
describe('TaskScheduler', () => {
  it('should add task correctly', () => {
    const scheduler = new TaskScheduler();
    const task = scheduler.addTask('contest-123', new Date());
    expect(task.status).toBe('pending');
  });

  it('should execute due tasks', async () => {
    const scheduler = new TaskScheduler();
    const result = await scheduler.executeDueTasks(mockExecuteFn);
    expect(result.executed).toBeGreaterThan(0);
  });
});
```

---

### 阶段 3: 性能优化 (1-2 小时)

**目标:** 增量统计 + 缓存层

#### 任务 3.1: 增量统计计算
```typescript
// src/services/stats.ts
export class StatsService {
  private cache: StatsCache;
  
  async generateDailyStats(): Promise<DailyStats> {
    const lastStats = await this.cache.getLatest();
    const newContests = await this.getNewContestsSince(lastStats.generatedAt);
    
    if (newContests.length === 0) {
      return lastStats; // 无新数据，返回缓存
    }
    
    return this.incrementalUpdate(lastStats, newContests);
  }
  
  private incrementalUpdate(base: DailyStats, newContests: Contest[]): DailyStats {
    // 增量计算逻辑
  }
}
```

#### 任务 3.2: 数据缓存层
```typescript
// src/cache/index.ts
export class DataCache {
  private ttl: number;
  private store: Map<string, CachedData>;
  
  async get<T>(key: string): Promise<T | null>;
  async set<T>(key: string, value: T, ttl?: number): Promise<void>;
  async invalidate(pattern: string): Promise<void>;
}
```

---

### 阶段 4: 文档与部署 (1 小时)

**目标:** API 文档 + 部署指南

#### 任务 4.1: 生成 API 文档
```bash
# 使用 TypeDoc
npm install -g typedoc
typedoc src/index.ts
```

#### 任务 4.2: 更新部署文档
```markdown
## 部署到 GitHub Actions

1. 推送到 `refactor-v2` 分支
2. 验证 CI/CD 通过
3. 创建 Pull Request 到 `main`
4. Review 完成后合并
5. GitHub Pages 自动更新
```

---

## ✅ 验收标准

### 代码质量
- [ ] TypeScript 编译无错误
- [ ] ESLint 检查通过
- [ ] 核心函数单元测试覆盖 > 80%

### 功能验证
- [ ] 全量获取竞赛正常
- [ ] 增量更新正常
- [ ] Leaderboard 抓取正常
- [ ] 统计生成正常
- [ ] 定时任务调度正常

### 性能指标
- [ ] 统计生成时间 < 5 秒（之前 ~30 秒）
- [ ] API 请求失败率 < 1%
- [ ] 内存占用 < 200MB

### 向后兼容
- [ ] 现有 data/ 目录结构不变
- [ ] GitHub Pages 输出格式不变
- [ ] CLI 命令兼容

---

## 🚀 执行命令

```bash
# 1. 切换到重构分支
cd ~/aicoding/moki-stats
git checkout refactor-v2

# 2. 安装 TypeScript 和测试框架
npm install -D typescript vitest @types/node

# 3. 初始化 TypeScript 配置
npx tsc --init

# 4. 开始重构（按阶段执行）
# ... 见上方详细计划
```

---

## 📋 风险控制

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 重构引入 Bug | 高 | 充分测试 + 分支开发 |
| 数据格式变更 | 高 | 保持向后兼容 |
| 性能下降 | 中 | 性能测试对比 |
| 超时未完成 | 低 | 分阶段实施 |

---

**预计总耗时:** 6-9 小时  
**建议执行方式:** 分 2-3 次会话完成

---

_此计划由 task-dispatcher skill 生成，支持动态调整。_
