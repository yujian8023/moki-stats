/**
 * Moki-Stats 类型定义
 */

// ========== 竞赛相关类型 ==========

export type ContestStatus = 'OPEN' | 'LIVE' | 'COMPLETED' | 'UPCOMING' | 'STARTING_SOON' | 'ABANDONED';

export type ContestFormat = 
  | 'FIFTY_FIFTY' 
  | 'TOP_20_PCT' 
  | 'FREE_ENTRY' 
  | 'UNKNOWN';

export interface Contest {
  _id: string;
  name: string;
  description?: string;
  contestStatus: ContestStatus;
  format: ContestFormat;
  entryFee: number;
  prizePool: number;
  entries: number;
  maxEntries?: number;
  startDate: string;
  endDate: string;
  openDate?: string;
  showDate?: string;
  featured: boolean;
  isPrivate: boolean;
  lineupConfig?: Record<string, any>;
  prizeStructure?: Record<string, any>;
  matchGroups?: any[];
  gameTypes?: string[];
  contestGroup?: string;
  scoringRules?: any[];
  scoringMethod?: string;
  fetchedAt: string;
  leaderboardFetched: boolean;
}

export interface ContestIndex {
  version: number;
  generatedAt: string;
  total: number;
  byStatus: Record<ContestStatus, number>;
  contests: ContestSummary[];
}

export interface ContestSummary {
  _id: string;
  name: string;
  contestStatus: ContestStatus;
  startDate: string;
  endDate: string;
  entries: number;
  prizePool: number;
  format: ContestFormat;
}

// ========== Leaderboard 相关类型 ==========

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  score: number;
  mokiIds: string[];
}

export interface Leaderboard {
  contestId: string;
  contestName: string;
  endDate: string;
  fetchedAt: string;
  totalEntries: number;
  top50: LeaderboardEntry[];
}

// ========== Moki 卡牌相关类型 ==========

export interface MokiDetail {
  _id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  rarity?: string;
  type?: string;
  stats?: Record<string, any>;
  abilities?: any[];
  fetchedAt?: string;
}

export interface MokiManifest {
  version: number;
  generatedAt: string;
  total: number;
  mokiIds: string[];
}

// ========== 任务调度相关类型 ==========

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Task {
  id: string;
  contestId: string;
  type: TaskType;
  executeAt: string;
  status: TaskStatus;
  retryCount: number;
  createdAt: string;
  completedAt?: string;
  failedAt?: string;
  lastError?: string;
}

export interface TaskQueue {
  version: number;
  updatedAt: string;
  tasks: Task[];
}

export interface TaskStats {
  total: number;
  pending: number;
  due: number;
  scheduled: number;
}

// ========== 统计相关类型 ==========

export interface ContestStats {
  total: number;
  totalEntries: number;
  totalPrizePool: number;
  avgEntryFee: number;
  avgEntries: number;
  byFormat: Record<string, FormatStats>;
}

export interface FormatStats {
  count: number;
  entries: number;
  prizePool: number;
}

export interface DailyStats {
  date?: string;
  dateRange?: {
    from: string;
    to: string;
  };
  period: 'today' | 'yesterday' | 'last_7_days';
  generatedAt: string;
  total: number;
  totalEntries: number;
  totalPrizePool: number;
  avgEntryFee: number;
  avgEntries: number;
  byFormat: Record<string, FormatStats>;
}

export interface MokiStats {
  [mokiId: string]: MokiStatEntry;
}

export interface MokiStatEntry {
  count: number;
  percentage: number;
  avgRank: number;
  appearances: number;
}

export interface SummaryStats {
  version: number;
  period: string;
  dateRange: {
    from: string;
    to: string;
  };
  contestStats: {
    totalContests: number;
    totalPlayers: number;
    totalPrizePool: number;
    avgEntryFee: number;
    byFormat: Record<string, FormatStats>;
  };
  mokiStats: MokiStats;
  generatedAt: string;
}

// ========== API 相关类型 ==========

export interface FetchOptions {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface PaginationOptions {
  limit?: number;
  batchSize?: number;
  batchDelay?: number;
}

export interface LeaderboardOptions {
  limit?: number;
  offset?: number;
  includeUserPosition?: boolean;
}

// ========== 错误相关类型 ==========

export interface ErrorContext {
  code: string;
  message: string;
  context?: Record<string, any>;
  timestamp?: string;
}

// ========== 配置相关类型 ==========

export interface AppConfig {
  dataDir: string;
  apiBaseUrl: string;
  requestTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  batchSize: number;
  batchDelay: number;
  leaderboardBufferMinutes: number;
}

// ========== 时间范围与筛选 ==========

export type TimeRange = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'all' | 'custom';

export interface DateRange {
  from: string;  // ISO 日期
  to: string;    // ISO 日期
}

export interface FilterOptions {
  timeRange?: TimeRange;
  dateRange?: DateRange;  // 自定义时间范围
  contestName?: string;   // 支持模糊搜索
  contestFormat?: ContestFormat[];
  contestStatus?: ContestStatus[];
  minPrizePool?: number;
  minEntries?: number;
}

// ========== 扩展竞赛数据 ==========

export interface ContestWithDetails extends Contest {
  // 通过 /contests/{_id} 获取的额外数据
  detailedPrizePool?: number;
  detailedPrizeStructure?: Record<string, any>;
  detailedLineupConfig?: Record<string, any>;
  detailsFetchedAt?: string;
  detailsError?: string;
}

// ========== 统计汇总（支持筛选） ==========

export interface StatsSummary {
  totalPlayers: number;      // 总参赛人数
  totalCards: number;        // 总卡牌数据（top50 × 5 × 竞赛数）
  uniqueCards: number;       // 不同卡牌数量
  totalPrizePool: number;    // 总奖池
  totalContests: number;     // 竞赛总数
}

export interface TopDeckEntry {
  rank: number;
  deckHash: string;         // 卡牌 ID 排序后的 hash
  mokiIds: string[];        // 卡牌 ID 列表
  count: number;            // 出现次数
  percentage: number;       // 出场率
  avgRank: number;          // 平均排名
  prizePoolContribution?: number;  // 奖池贡献
}

export interface StatsWithFilters {
  version: number;
  timeRange: TimeRange;
  dateRange?: DateRange;
  filterOptions?: FilterOptions;
  summary: StatsSummary;
  topDecks: TopDeckEntry[];
  topCards: MokiStatEntry[];
  topStrategies: MokiStatEntry[];
  contestCount: number;     // 符合筛选条件的竞赛数
  generatedAt: string;
}

// ========== 卡牌统计扩展 ==========

export interface MokiStatEntryWithTrend extends MokiStatEntry {
  trend?: 'up' | 'down' | 'stable';  // 7 天趋势
  trendPercentage?: number;           // 趋势幅度
  byFormat?: Record<ContestFormat, MokiStatEntry>;  // 按格式分组
  avgScore?: number;                  // 平均得分
  top10Rate?: number;                 // 前 10% 出现率
}

// ========== 任务类型扩展 ==========

export type TaskType = 'fetchLeaderboard' | 'fetchContestDetails';

export interface TaskWithDetails extends Task {
  type: TaskType;
}

// ========== 原始数据保存 ==========

export interface RawDataRecord {
  type: 'contest' | 'leaderboard' | 'contest_details';
  id: string;
  fetchedAt: string;
  data: Record<string, any>;  // 完整 API 响应
  source: string;             // API endpoint
}
