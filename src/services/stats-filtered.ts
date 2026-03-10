/**
 * 筛选统计服务（Phase 2）
 * 
 * 功能：
 * 1. 支持时间范围筛选（today / yesterday / last_7_days）
 * 2. 支持竞赛类型筛选（50/50 / Top 20% / Free Entry / All）
 * 3. 支持报名费筛选
 * 4. 通过 _id 关联 contests 和 leaderboards 数据
 * 5. 计算核心统计指标
 */

import fs from 'fs';
import path from 'path';
import type { Contest, Leaderboard } from '../types/index.js';
import { readJson, ensureDir } from '../utils/fs.js';

// ========== 类型定义 ==========

export interface Filters {
  timeRange: 'last_7_days' | 'yesterday' | 'today';
  contestType?: '50/50' | 'Top 20%' | 'Free Entry' | 'All';
  entryFee?: number | 'All';
}

export interface FilteredStats {
  totalPlayers: number;      // 总参赛人数（人次，不去重）
  totalCards: number;        // 总卡牌数据
  uniqueCards: number;       // 不同卡牌（去重后）
  totalPrizePool: number;    // 总奖池
  contestCount: number;      // 符合条件的竞赛数量
}

// ========== 数据目录配置 ==========

const DATA_DIR_NAME = process.env.DATA_DIR || 'data';
const DATA_DIR = path.join(process.cwd(), DATA_DIR_NAME);
const CONTESTS_DIR = path.join(DATA_DIR, 'contests');
const LEADERBOARDS_DIR = path.join(DATA_DIR, 'leaderboards');

// ========== 竞赛类型映射字典（Phase 1） ==========

const CONTEST_TYPE_MAP: Record<string, string> = {
  '50/50': 'FIFTY_FIFTY',
  'Top 20%': 'TOP_20_PCT',
  'Free Entry': 'FREE_ENTRY'
};

/**
 * 从竞赛名称或格式中提取竞赛类型
 */
export function extractContestType(contest: Contest): string {
  const name = contest.name.toLowerCase();
  
  if (name.includes('50/50') || name.includes('50 / 50')) {
    return '50/50';
  }
  
  if (name.includes('top 20%') || name.includes('top20%')) {
    return 'Top 20%';
  }
  
  if (name.includes('free') && name.includes('entry')) {
    return 'Free Entry';
  }
  
  //  fallback 到 format 字段
  if (contest.format === 'FIFTY_FIFTY') {
    return '50/50';
  }
  if (contest.format === 'TOP_20_PCT') {
    return 'Top 20%';
  }
  if (contest.format === 'FREE_ENTRY') {
    return 'Free Entry';
  }
  
  return 'All';
}

// ========== 数据加载函数 ==========

/**
 * 加载所有竞赛数据
 */
export function loadAllContests(): Contest[] {
  ensureDir(CONTESTS_DIR);
  
  const files = fs.readdirSync(CONTESTS_DIR).filter(f => f.endsWith('.json'));
  const contests: Contest[] = files
    .map(f => readJson(path.join(CONTESTS_DIR, f)))
    .filter(Boolean);
  
  return contests;
}

/**
 * 加载所有排行榜数据
 */
export function loadAllLeaderboards(): Leaderboard[] {
  ensureDir(LEADERBOARDS_DIR);
  
  if (!fs.existsSync(LEADERBOARDS_DIR)) {
    return [];
  }
  
  const files = fs.readdirSync(LEADERBOARDS_DIR).filter(f => f.endsWith('.json'));
  const leaderboards: Leaderboard[] = files
    .map(f => readJson(path.join(LEADERBOARDS_DIR, f)))
    .filter(Boolean);
  
  return leaderboards;
}

// ========== 筛选逻辑实现 ==========

/**
 * 时间筛选辅助函数：判断日期是否在同一天（UTC+8）
 */
function isSameDay(date1: Date, date2: Date): boolean {
  // 转换为 UTC+8
  const utc8Time1 = date1.getTime() + (8 * 3600 * 1000);
  const utc8Time2 = date2.getTime() + (8 * 3600 * 1000);
  
  const d1 = new Date(utc8Time1);
  const d2 = new Date(utc8Time2);
  
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

/**
 * 时间筛选：筛选 endDate 在指定时间范围的竞赛
 */
export function filterByTimeRange(
  contests: Contest[],
  range: 'last_7_days' | 'yesterday' | 'today'
): Contest[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  return contests.filter(contest => {
    if (!contest.endDate) return false;
    
    const endDate = new Date(contest.endDate);
    
    switch (range) {
      case 'today':
        return isSameDay(endDate, now);
      
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return isSameDay(endDate, yesterday);
      }
      
      case 'last_7_days': {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return endDate >= sevenDaysAgo && endDate <= now;
      }
      
      default:
        return true;
    }
  });
}

/**
 * 竞赛类型筛选
 */
export function filterByContestType(
  contests: Contest[],
  type: '50/50' | 'Top 20%' | 'Free Entry' | 'All' | undefined
): Contest[] {
  if (!type || type === 'All') {
    return contests;
  }
  
  return contests.filter(contest => {
    const contestType = extractContestType(contest);
    return contestType === type;
  });
}

/**
 * 报名费筛选
 */
export function filterByEntryFee(
  contests: Contest[],
  fee: number | 'All' | undefined
): Contest[] {
  if (fee === undefined || fee === 'All') {
    return contests;
  }
  
  return contests.filter(contest => contest.entryFee === fee);
}

// ========== 数据关联与计算 ==========

/**
 * 关联 contests 和 leaderboards 数据
 */
export function joinContestsWithLeaderboards(
  contests: Contest[],
  leaderboards: Leaderboard[]
): Array<Contest & { leaderboard?: Leaderboard }> {
  return contests.map(contest => ({
    ...contest,
    leaderboard: leaderboards.find(lb => lb.contestId === contest._id)
  }));
}

/**
 * 从排行榜中提取所有卡牌图片 URL
 */
export function extractAllCardImages(leaderboards: Leaderboard[]): string[] {
  const allImages: string[] = [];
  
  for (const lb of leaderboards) {
    for (const entry of lb.top50 || []) {
      if (entry.cardImages && Array.isArray(entry.cardImages)) {
        allImages.push(...entry.cardImages);
      }
    }
  }
  
  return allImages;
}

/**
 * 核心统计计算
 */
export function calculateFilteredStats(
  filteredContests: Contest[],
  leaderboards: Leaderboard[]
): FilteredStats {
  // 1. 总参赛人数 = 所有竞赛的 entries 字段求和
  const totalPlayers = filteredContests.reduce(
    (sum, c) => sum + (c.entries || 0), 
    0
  );
  
  // 2. 总卡牌数据 = 总参赛人数 * 5 (每人 5 张卡)
  const totalCards = totalPlayers * 5;
  
  // 3. 不同卡牌 = 从所有 leaderboard 的 cardImages 去重
  const allCardImages = extractAllCardImages(leaderboards);
  const uniqueCards = new Set(allCardImages).size;
  
  // 4. 总奖池 = 所有竞赛的 prizePool 求和
  const totalPrizePool = filteredContests.reduce(
    (sum, c) => sum + (c.prizePool || 0), 
    0
  );
  
  return {
    totalPlayers,
    totalCards,
    uniqueCards,
    totalPrizePool: parseFloat(totalPrizePool.toFixed(2)),
    contestCount: filteredContests.length
  };
}

// ========== 主函数 ==========

/**
 * 获取筛选后的统计数据
 * 
 * @param filters 筛选条件
 * @returns 筛选后的统计结果
 */
export function getFilteredStats(filters: Filters): FilteredStats {
  // 加载所有数据
  const allContests = loadAllContests();
  const allLeaderboards = loadAllLeaderboards();
  
  // 应用筛选
  let filteredContests = filterByTimeRange(allContests, filters.timeRange);
  filteredContests = filterByContestType(filteredContests, filters.contestType);
  filteredContests = filterByEntryFee(filteredContests, filters.entryFee);
  
  // 获取筛选后竞赛对应的排行榜
  const filteredContestIds = new Set(filteredContests.map(c => c._id));
  const filteredLeaderboards = allLeaderboards.filter(lb => 
    filteredContestIds.has(lb.contestId)
  );
  
  // 计算统计
  return calculateFilteredStats(filteredContests, filteredLeaderboards);
}

/**
 * 生成筛选统计并保存到文件
 */
export function generateFilteredStatsFile(
  filters: Filters,
  outputPath?: string
): FilteredStats {
  console.log(`📊 生成筛选统计数据...`);
  console.log(`   时间范围：${filters.timeRange}`);
  console.log(`   竞赛类型：${filters.contestType || 'All'}`);
  console.log(`   报名费：${filters.entryFee !== undefined ? filters.entryFee : 'All'}`);
  console.log('');
  
  const stats = getFilteredStats(filters);
  
  console.log(`✅ 统计完成:`);
  console.log(`   竞赛数量：${stats.contestCount}`);
  console.log(`   总参赛人数：${stats.totalPlayers.toLocaleString()}`);
  console.log(`   总卡牌数据：${stats.totalCards.toLocaleString()}`);
  console.log(`   不同卡牌：${stats.uniqueCards} 张`);
  console.log(`   总奖池：${stats.totalPrizePool.toLocaleString()} GEMs`);
  console.log('');
  
  // 保存到文件
  if (outputPath) {
    ensureDir(path.dirname(outputPath));
    const outputData = {
      version: 2,
      filters,
      stats,
      generatedAt: new Date().toISOString()
    };
    
    const jsonPath = outputPath.endsWith('.json') 
      ? outputPath 
      : `${outputPath}.json`;
    
    fs.writeFileSync(jsonPath, JSON.stringify(outputData, null, 2));
    console.log(`💾 已保存到：${jsonPath}\n`);
  }
  
  return stats;
}

// ========== 导出默认对象 ==========

export default {
  // 数据加载
  loadAllContests,
  loadAllLeaderboards,
  
  // 筛选函数
  filterByTimeRange,
  filterByContestType,
  filterByEntryFee,
  extractContestType,
  
  // 数据关联
  joinContestsWithLeaderboards,
  extractAllCardImages,
  
  // 计算函数
  calculateFilteredStats,
  
  // 主函数
  getFilteredStats,
  generateFilteredStatsFile
};
