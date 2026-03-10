/**
 * 竞赛统计分析（重构版）
 * 
 * 功能：
 * 1. 支持时间范围筛选（今日/昨日/近 7 天/近 30 天/自定义）
 * 2. 支持竞赛名称筛选
 * 3. 增量统计计算
 * 4. 原始数据持久化
 */

import fs from 'fs';
import path from 'path';
import type {
  Contest,
  TimeRange,
  FilterOptions,
  StatsWithFilters,
  StatsSummary,
  TopDeckEntry,
  MokiStatEntry,
  DateRange,
  ContestWithDetails
} from '../types/index.js';
import { readJson, writeJson, ensureDir, getISODate } from '../utils/fs.js';
import { ContestDetailsApi } from '../api/contest-details.js';
import { saveRawContestDetails, getRawData } from './raw-data.js';

// 支持环境变量配置数据目录
const DATA_DIR_NAME = process.env.DATA_DIR || 'data';
const DATA_DIR = path.join(process.cwd(), DATA_DIR_NAME);
const STATS_DIR = path.join(DATA_DIR, 'stats');

/**
 * 获取日期范围（UTC+8）
 */
export function getDateRanges(): Record<TimeRange, DateRange> {
  const now = new Date();
  
  // 今日 00:00 (UTC+8)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStart = new Date(today.getTime() - (8 * 3600 * 1000));
  
  // 昨日 00:00 (UTC+8)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = new Date(yesterday.getTime() - (8 * 3600 * 1000));
  
  // 7 天前 00:00 (UTC+8)
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStart = new Date(sevenDaysAgo.getTime() - (8 * 3600 * 1000));
  
  // 30 天前 00:00 (UTC+8)
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStart = new Date(thirtyDaysAgo.getTime() - (8 * 3600 * 1000));
  
  return {
    today: {
      from: getISODate(todayStart),
      to: getISODate(now)
    },
    yesterday: {
      from: getISODate(yesterdayStart),
      to: getISODate(todayStart)
    },
    'last_7_days': {
      from: getISODate(sevenDaysAgoStart),
      to: getISODate(now)
    },
    'last_30_days': {
      from: getISODate(thirtyDaysAgoStart),
      to: getISODate(now)
    },
    all: {
      from: '2024-01-01',
      to: getISODate(now)
    },
    custom: {
      from: getISODate(sevenDaysAgoStart),
      to: getISODate(now)
    }
  };
}

/**
 * 按日期范围筛选竞赛
 */
export function filterByDateRange(
  contests: Contest[],
  dateRange: DateRange
): Contest[] {
  const startTime = new Date(dateRange.from).getTime();
  const endTime = new Date(dateRange.to).getTime();
  
  return contests.filter(c => {
    if (!c.endDate) return false;
    const contestEndTime = new Date(c.endDate).getTime();
    return contestEndTime >= startTime && contestEndTime <= endTime;
  });
}

/**
 * 按竞赛名称筛选
 */
export function filterByContestName(
  contests: Contest[],
  keyword: string
): Contest[] {
  if (!keyword || keyword.trim() === '') {
    return contests;
  }
  
  const normalized = keyword.toLowerCase().trim();
  return contests.filter(c => 
    c.name.toLowerCase().includes(normalized)
  );
}

/**
 * 应用筛选条件
 */
export function applyFilters(
  contests: Contest[],
  options: FilterOptions = {}
): Contest[] {
  let filtered = [...contests];
  
  // 时间范围筛选
  if (options.timeRange) {
    const ranges = getDateRanges();
    const dateRange = options.dateRange || ranges[options.timeRange];
    filtered = filterByDateRange(filtered, dateRange);
  } else if (options.dateRange) {
    filtered = filterByDateRange(filtered, options.dateRange);
  }
  
  // 名称筛选
  if (options.contestName) {
    filtered = filterByContestName(filtered, options.contestName);
  }
  
  // 格式筛选
  if (options.contestFormat && options.contestFormat.length > 0) {
    filtered = filtered.filter(c => 
      options.contestFormat!.includes(c.format)
    );
  }
  
  // 状态筛选
  if (options.contestStatus && options.contestStatus.length > 0) {
    filtered = filtered.filter(c => 
      options.contestStatus!.includes(c.contestStatus)
    );
  }
  
  // 最小奖池筛选
  if (options.minPrizePool !== undefined) {
    filtered = filtered.filter(c => 
      (c.prizePool || 0) >= options.minPrizePool!
    );
  }
  
  // 最小参赛人数筛选
  if (options.minEntries !== undefined) {
    filtered = filtered.filter(c => 
      (c.entries || 0) >= options.minEntries!
    );
  }
  
  return filtered;
}

/**
 * 计算统计汇总
 */
export function calculateStatsSummary(
  contests: Contest[],
  leaderboards: any[]
): StatsSummary {
  const totalPlayers = contests.reduce((sum, c) => sum + (c.entries || 0), 0);
  const totalPrizePool = contests.reduce((sum, c) => sum + (c.prizePool || 0), 0);
  
  // 总卡牌数据 = 每个排行榜 top50 × 5 张卡
  const totalCards = leaderboards.reduce(
    (sum, lb) => sum + (lb.top50?.length || 0) * 5, 
    0
  );
  
  // 不同卡牌数量
  const allMokiIds = new Set<string>();
  for (const lb of leaderboards) {
    for (const entry of lb.top50 || []) {
      for (const mokiId of entry.mokiIds || []) {
        allMokiIds.add(mokiId);
      }
    }
  }
  
  return {
    totalPlayers,
    totalCards,
    uniqueCards: allMokiIds.size,
    totalPrizePool: parseFloat(totalPrizePool.toFixed(2)),
    totalContests: contests.length
  };
}

/**
 * 计算热门阵容
 */
export function calculateTopDecks(
  leaderboards: any[],
  limit: number = 12
): TopDeckEntry[] {
  const deckMap = new Map<string, {
    mokiIds: string[];
    count: number;
    ranks: number[];
  }>();
  
  for (const lb of leaderboards) {
    for (const entry of lb.top50 || []) {
      // 创建阵容 hash（排序后的卡牌 ID）
      const sortedMokiIds = [...(entry.mokiIds || [])].sort();
      const deckHash = sortedMokiIds.join('|');
      
      if (!deckMap.has(deckHash)) {
        deckMap.set(deckHash, {
          mokiIds: sortedMokiIds,
          count: 0,
          ranks: []
        });
      }
      
      const deck = deckMap.get(deckHash)!;
      deck.count++;
      deck.ranks.push(entry.rank);
    }
  }
  
  // 转换为数组并排序
  const topDecks: TopDeckEntry[] = Array.from(deckMap.entries())
    .map(([deckHash, data]) => ({
      rank: 0,  // 后续填充
      deckHash,
      mokiIds: data.mokiIds,
      count: data.count,
      percentage: 0,  // 后续计算
      avgRank: data.ranks.length > 0 
        ? parseFloat((data.ranks.reduce((a, b) => a + b, 0) / data.ranks.length).toFixed(2))
        : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
  
  // 计算排名和百分比
  const totalDecks = Array.from(deckMap.values()).reduce((sum, d) => sum + d.count, 0);
  topDecks.forEach((deck, idx) => {
    deck.rank = idx + 1;
    deck.percentage = parseFloat(((deck.count / totalDecks) * 100).toFixed(2));
  });
  
  return topDecks;
}

/**
 * 计算卡牌统计
 */
export function calculateMokiStats(
  leaderboards: any[]
): MokiStatEntry[] {
  const mokiCount = new Map<string, number>();
  const mokiRanks = new Map<string, number[]>();
  let totalPlayers = 0;
  
  for (const lb of leaderboards) {
    for (const entry of lb.top50 || []) {
      totalPlayers++;
      for (const mokiId of entry.mokiIds || []) {
        if (!mokiCount.has(mokiId)) {
          mokiCount.set(mokiId, 0);
          mokiRanks.set(mokiId, []);
        }
        mokiCount.set(mokiId, mokiCount.get(mokiId)! + 1);
        mokiRanks.get(mokiId)!.push(entry.rank);
      }
    }
  }
  
  const stats: MokiStatEntry[] = Array.from(mokiCount.entries())
    .map(([mokiId, count]) => {
      const ranks = mokiRanks.get(mokiId) || [];
      const avgRank = ranks.length > 0 
        ? ranks.reduce((a, b) => a + b, 0) / ranks.length 
        : 0;
      
      return {
        count,
        percentage: parseFloat(((count / totalPlayers) * 100).toFixed(2)),
        avgRank: parseFloat(avgRank.toFixed(2)),
        appearances: ranks.length
      };
    })
    .sort((a, b) => b.count - a.count);
  
  return stats;
}

/**
 * 生成带筛选条件的统计
 */
export function generateStatsWithFilters(
  options: FilterOptions = {},
  timeRange: TimeRange = 'last_7_days'
): StatsWithFilters {
  console.log(`📊 生成统计数据（时间范围：${timeRange}）...\n`);
  
  // 读取所有竞赛
  const contestsDir = path.join(DATA_DIR, 'contests');
  ensureDir(contestsDir);
  
  const files = fs.readdirSync(contestsDir).filter(f => f.endsWith('.json'));
  const contests: Contest[] = files
    .map(f => readJson(path.join(contestsDir, f)))
    .filter(Boolean);
  
  // 应用筛选
  const filteredContests = applyFilters(contests, { ...options, timeRange });
  
  // 读取对应时间范围的排行榜
  const leaderboardsDir = path.join(DATA_DIR, 'leaderboards');
  const leaderboardFiles = fs.readdirSync(leaderboardsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => readJson(path.join(leaderboardsDir, f)))
    .filter(Boolean);
  
  // 筛选对应竞赛的排行榜
  const contestIds = new Set(filteredContests.map(c => c._id));
  const filteredLeaderboards = leaderboardFiles.filter(lb => 
    contestIds.has(lb.contestId)
  );
  
  // 计算统计
  const summary = calculateStatsSummary(filteredContests, filteredLeaderboards);
  const topDecks = calculateTopDecks(filteredLeaderboards);
  const topCards = calculateMokiStats(filteredLeaderboards).slice(0, 20);
  const topStrategies = calculateMokiStats(filteredLeaderboards).slice(0, 20);
  
  const ranges = getDateRanges();
  
  const result: StatsWithFilters = {
    version: 2,
    timeRange,
    dateRange: options.dateRange || ranges[timeRange],
    filterOptions: options,
    summary,
    topDecks,
    topCards,
    topStrategies,
    contestCount: filteredContests.length,
    generatedAt: new Date().toISOString()
  };
  
  // 保存统计
  ensureDir(STATS_DIR);
  const outputPath = path.join(STATS_DIR, `stats_${timeRange}.json`);
  writeJson(outputPath, result);
  
  console.log(`✅ 统计完成：${outputPath}`);
  console.log(`   竞赛数：${result.contestCount}`);
  console.log(`   总参赛人数：${result.summary.totalPlayers}`);
  console.log(`   总奖池：${result.summary.totalPrizePool} GEMs`);
  console.log(`   卡牌数据：${result.summary.totalCards} 条`);
  console.log(`   不同卡牌：${result.summary.uniqueCards} 张\n`);
  
  return result;
}

/**
 * 打印详细统计信息
 */
export function printDetailedStats(result: StatsWithFilters): void {
  console.log('📊 详细统计报告\n');
  console.log('='.repeat(50));
  
  console.log(`时间范围：${result.timeRange}`);
  if (result.dateRange) {
    console.log(`日期：${result.dateRange.from} ~ ${result.dateRange.to}`);
  }
  console.log('');
  
  console.log('【竞赛汇总】');
  console.log(`  竞赛数量：${result.contestCount}`);
  console.log(`  总参赛人数：${result.summary.totalPlayers.toLocaleString()}`);
  console.log(`  总奖池：${result.summary.totalPrizePool.toLocaleString()} GEMs`);
  console.log(`  卡牌数据：${result.summary.totalCards.toLocaleString()} 条`);
  console.log(`  不同卡牌：${result.summary.uniqueCards} 张`);
  console.log('');
  
  console.log('【热门阵容 TOP 5】');
  result.topDecks.slice(0, 5).forEach((deck, idx) => {
    console.log(`  ${idx + 1}. 出场 ${deck.count} 次 (${deck.percentage}%) - 平均排名 ${deck.avgRank}`);
    console.log(`     卡牌：${deck.mokiIds.join(', ')}`);
  });
  console.log('');
  
  console.log('【热门卡牌 TOP 10】');
  result.topCards.slice(0, 10).forEach((card, idx) => {
    console.log(`  ${idx + 1}. 出场 ${card.count} 次 (${card.percentage}%) - 平均排名 ${card.avgRank}`);
  });
  console.log('');
  
  console.log('='.repeat(50));
}

/**
 * 生成所有时间范围的统计
 */
export function generateAllStats(): Record<TimeRange, StatsWithFilters> {
  const timeRanges: TimeRange[] = ['today', 'yesterday', 'last_7_days', 'last_30_days', 'all'];
  const results: Record<TimeRange, StatsWithFilters> = {} as any;
  
  for (const range of timeRanges) {
    try {
      results[range] = generateStatsWithFilters({}, range);
    } catch (error) {
      console.error(`❌ 生成 ${range} 统计失败:`, error);
    }
  }
  
  // 生成汇总索引
  const indexPath = path.join(STATS_DIR, 'stats_index.json');
  writeJson(indexPath, {
    version: 2,
    generatedAt: new Date().toISOString(),
    availableRanges: timeRanges.filter(r => results[r]),
    lastUpdated: new Date().toISOString()
  });
  
  return results;
}

/**
 * 获取奖池数据（从原始数据或 API）
 */
export async function fetchPrizePoolData(
  contestIds: string[],
  options?: {
    useCache?: boolean;
    batchSize?: number;
    onProgress?: (current: number, total: number) => void;
  }
): Promise<Record<string, number>> {
  const { useCache = true, batchSize = 10, onProgress } = options || {};
  const prizePools: Record<string, number> = {};
  
  // 尝试从原始数据读取
  if (useCache) {
    for (const id of contestIds) {
      const cached = getRawData<ContestWithDetails>('contest_details', id);
      if (cached && cached.detailedPrizePool !== undefined) {
        prizePools[id] = cached.detailedPrizePool;
      }
    }
  }
  
  // 获取未缓存的竞赛详情
  const uncachedIds = contestIds.filter(id => !prizePools[id]);
  if (uncachedIds.length > 0) {
    console.log(`🔍 获取 ${uncachedIds.length} 个竞赛的奖池数据...`);
    
    const api = new ContestDetailsApi();
    const details = await api.fetchBatch(uncachedIds, {
      batchSize,
      onProgress
    });
    
    // 保存原始数据并提取奖池
    for (const detail of details) {
      if (!detail.detailsError) {
        prizePools[detail._id] = detail.detailedPrizePool || detail.prizePool || 0;
        saveRawContestDetails(detail._id, detail);
      }
    }
  }
  
  return prizePools;
}

/**
 * 生成包含奖池数据的统计
 */
export async function generateStatsWithPrizePool(
  options: FilterOptions = {},
  timeRange: TimeRange = 'last_7_days'
): Promise<StatsWithFilters & { prizePoolData?: Record<string, number> }> {
  console.log(`📊 生成统计数据（含奖池详情，时间范围：${timeRange}）...\n`);
  
  // 读取所有竞赛
  const contestsDir = path.join(DATA_DIR, 'contests');
  ensureDir(contestsDir);
  
  const files = fs.readdirSync(contestsDir).filter(f => f.endsWith('.json'));
  const contests: Contest[] = files
    .map(f => readJson(path.join(contestsDir, f)))
    .filter(Boolean);
  
  // 应用筛选
  const filteredContests = applyFilters(contests, { ...options, timeRange });
  const contestIds = filteredContests.map(c => c._id);
  
  // 获取奖池数据
  const prizePoolData = await fetchPrizePoolData(contestIds, {
    batchSize: 10,
    onProgress: (current, total) => {
      if (current % 10 === 0 || current === total) {
        console.log(`   进度：${current}/${total}`);
      }
    }
  });
  
  // 更新竞赛数据的奖池
  for (const contest of filteredContests) {
    if (prizePoolData[contest._id]) {
      contest.prizePool = prizePoolData[contest._id];
    }
  }
  
  // 读取排行榜
  const leaderboardsDir = path.join(DATA_DIR, 'leaderboards');
  const leaderboardFiles = fs.readdirSync(leaderboardsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => readJson(path.join(leaderboardsDir, f)))
    .filter(Boolean);
  
  const filteredContestIds = new Set(contestIds);
  const filteredLeaderboards = leaderboardFiles.filter(lb => 
    filteredContestIds.has(lb.contestId)
  );
  
  // 计算统计
  const summary = calculateStatsSummary(filteredContests, filteredLeaderboards);
  const topDecks = calculateTopDecks(filteredLeaderboards);
  const topCards = calculateMokiStats(filteredLeaderboards).slice(0, 20);
  const topStrategies = calculateMokiStats(filteredLeaderboards).slice(0, 20);
  
  const ranges = getDateRanges();
  
  const result: StatsWithFilters & { prizePoolData?: Record<string, number> } = {
    version: 2,
    timeRange,
    dateRange: options.dateRange || ranges[timeRange],
    filterOptions: options,
    summary,
    topDecks,
    topCards,
    topStrategies,
    contestCount: filteredContests.length,
    generatedAt: new Date().toISOString(),
    prizePoolData
  };
  
  // 保存统计
  ensureDir(STATS_DIR);
  const outputPath = path.join(STATS_DIR, `stats_${timeRange}_detailed.json`);
  writeJson(outputPath, result);
  
  console.log(`\n✅ 统计完成：${outputPath}`);
  printDetailedStats(result);
  
  return result;
}

export default {
  getDateRanges,
  filterByDateRange,
  filterByContestName,
  applyFilters,
  calculateStatsSummary,
  calculateTopDecks,
  calculateMokiStats,
  generateStatsWithFilters,
  generateAllStats,
  fetchPrizePoolData,
  generateStatsWithPrizePool,
  printDetailedStats
};
