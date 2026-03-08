/**
 * 竞赛统计分析
 * 
 * 功能：
 * 1. 按日期统计竞赛（今日/昨日/最近 7 天）
 * 2. 按格式统计（FIFTY_FIFTY/TOP_20_PCT/FREE_ENTRY 等）
 * 3. 参赛人数、奖池统计
 * 4. 生成汇总报告
 */

import fs from 'fs';
import path from 'path';
import { readJson, writeJson, ensureDir, getISODate, getISOWeek } from './utils.js';

// 支持环境变量配置数据目录
const DATA_DIR_NAME = process.env.DATA_DIR || 'data';
const DATA_DIR = path.join(process.cwd(), DATA_DIR_NAME);
const STATS_DIR = path.join(DATA_DIR, 'stats');

console.log(`📊 统计输出目录：${STATS_DIR}`);

/**
 * 获取所有竞赛
 */
function getAllContests() {
  const contestsDir = path.join(DATA_DIR, 'contests');
  ensureDir(contestsDir);
  
  const files = fs.readdirSync(contestsDir).filter(f => f.endsWith('.json'));
  return files.map(f => readJson(path.join(contestsDir, f))).filter(Boolean);
}

/**
 * 获取日期范围（UTC+8）
 */
function getDateRanges() {
  const now = new Date();
  
  // 今日 00:00 (UTC+8)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStart = today.getTime() - (8 * 3600 * 1000); // 转换为 UTC
  
  // 昨日 00:00 (UTC+8)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = yesterday.getTime() - (8 * 3600 * 1000);
  
  // 7 天前 00:00 (UTC+8)
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStart = sevenDaysAgo.getTime() - (8 * 3600 * 1000);
  
  return {
    todayStart,
    yesterdayStart,
    sevenDaysAgoStart,
    now: now.getTime()
  };
}

/**
 * 筛选已结束的竞赛
 */
function getCompletedContests(contests) {
  return contests.filter(c => 
    c.contestStatus === 'COMPLETED' || c.status === 'COMPLETED'
  );
}

/**
 * 按日期筛选竞赛
 */
function filterByDateRange(contests, startTime, endTime = null) {
  return contests.filter(c => {
    if (!c.endDate) return false;
    const endTimeMs = new Date(c.endDate).getTime();
    
    if (endTime && endTimeMs >= endTime) return false;
    return endTimeMs >= startTime;
  });
}

/**
 * 统计竞赛数据
 */
function calculateContestStats(contests) {
  if (contests.length === 0) {
    return {
      total: 0,
      totalEntries: 0,
      totalPrizePool: 0,
      avgEntryFee: 0,
      avgEntries: 0,
      byFormat: {}
    };
  }
  
  const totalEntries = contests.reduce((sum, c) => sum + (c.entries || 0), 0);
  const totalPrizePool = contests.reduce((sum, c) => sum + (c.prizePool || 0), 0);
  const totalEntryFee = contests.reduce((sum, c) => sum + (c.entryFee || 0), 0);
  
  // 按格式分组
  const byFormat = {};
  for (const c of contests) {
    const format = c.format || 'UNKNOWN';
    if (!byFormat[format]) {
      byFormat[format] = { count: 0, entries: 0, prizePool: 0 };
    }
    byFormat[format].count++;
    byFormat[format].entries += (c.entries || 0);
    byFormat[format].prizePool += (c.prizePool || 0);
  }
  
  return {
    total: contests.length,
    totalEntries,
    totalPrizePool: parseFloat(totalPrizePool.toFixed(2)),
    avgEntryFee: Math.round(totalEntryFee / contests.length),
    avgEntries: Math.round(totalEntries / contests.length),
    byFormat
  };
}

/**
 * 生成每日统计
 */
function generateDailyStats() {
  console.log('📊 生成每日竞赛统计...\n');
  
  const contests = getAllContests();
  const completed = getCompletedContests(contests);
  const ranges = getDateRanges();
  
  // 今日
  const todayContests = filterByDateRange(completed, ranges.todayStart);
  const todayStats = {
    date: getISODate(),
    period: 'today',
    ...calculateContestStats(todayContests),
    generatedAt: new Date().toISOString()
  };
  
  // 昨日
  const yesterdayContests = filterByDateRange(completed, ranges.yesterdayStart, ranges.todayStart);
  const yesterdayStats = {
    date: getISODate(new Date(ranges.yesterdayStart + 8 * 3600 * 1000)),
    period: 'yesterday',
    ...calculateContestStats(yesterdayContests),
    generatedAt: new Date().toISOString()
  };
  
  // 最近 7 天
  const last7DaysContests = filterByDateRange(completed, ranges.sevenDaysAgoStart);
  const last7DaysStats = {
    dateRange: {
      from: getISODate(new Date(ranges.sevenDaysAgoStart + 8 * 3600 * 1000)),
      to: getISODate()
    },
    period: 'last_7_days',
    ...calculateContestStats(last7DaysContests),
    generatedAt: new Date().toISOString()
  };
  
  // 保存统计
  ensureDir(STATS_DIR);
  
  writeJson(path.join(STATS_DIR, 'contest_daily.json'), {
    today: todayStats,
    yesterday: yesterdayStats,
    last7Days: last7DaysStats
  });
  
  // 打印统计
  console.log('=== 今日统计 ===');
  printStats(todayStats);
  
  console.log('\n=== 昨日统计 ===');
  printStats(yesterdayStats);
  
  console.log('\n=== 最近 7 天统计 ===');
  printStats(last7DaysStats);
  
  console.log('\n✅ 每日统计完成！\n');
  
  return { today: todayStats, yesterday: yesterdayStats, last7Days: last7DaysStats };
}

/**
 * 打印统计信息
 */
function printStats(stats) {
  console.log(`竞赛数量：${stats.total}`);
  console.log(`总参赛人数：${stats.totalEntries}`);
  console.log(`总奖池：${stats.totalPrizePool} GEMs`);
  console.log(`平均报名费：${stats.avgEntryFee} GEMs`);
  console.log(`平均参赛人数：${stats.avgEntries}`);
  
  if (Object.keys(stats.byFormat).length > 0) {
    console.log('按格式分布:');
    for (const [format, data] of Object.entries(stats.byFormat)) {
      console.log(`  ${format}: ${data.count}个竞赛，${data.entries}人参赛，${data.prizePool} GEMs`);
    }
  }
}

/**
 * 生成汇总统计（包含卡牌 + 竞赛）
 */
function generateSummaryStats() {
  console.log('📊 生成汇总统计...\n');
  
  const contests = getAllContests();
  const completed = getCompletedContests(contests);
  const ranges = getDateRanges();
  
  // 最近 7 天竞赛
  const recentContests = filterByDateRange(completed, ranges.sevenDaysAgoStart);
  const contestStats = calculateContestStats(recentContests);
  
  // 读取卡牌统计（如果存在）
  let mokiStats = {};
  const existingSummary = readJson(path.join(STATS_DIR, 'summary.json'));
  if (existingSummary && existingSummary.mokiAppearances) {
    mokiStats = existingSummary.mokiAppearances;
  }
  
  // 读取排行榜计算卡牌统计
  const leaderboardsDir = path.join(DATA_DIR, 'leaderboards');
  if (fs.existsSync(leaderboardsDir)) {
    const files = fs.readdirSync(leaderboardsDir).filter(f => f.endsWith('.json'));
    const leaderboards = files.map(f => readJson(path.join(leaderboardsDir, f))).filter(Boolean);
    
    // 筛选最近 7 天的排行榜
    const recentLeaderboards = leaderboards.filter(lb => {
      if (!lb.endDate) return false;
      return new Date(lb.endDate).getTime() >= ranges.sevenDaysAgoStart;
    });
    
    // 计算卡牌出场率
    mokiStats = calculateMokiStats(recentLeaderboards);
  }
  
  // 生成汇总
  const summary = {
    version: 2, // 重构后版本
    period: 'last_7_days',
    dateRange: {
      from: getISODate(new Date(ranges.sevenDaysAgoStart + 8 * 3600 * 1000)),
      to: getISODate()
    },
    contestStats: {
      totalContests: contestStats.total,
      totalPlayers: contestStats.totalEntries,
      totalPrizePool: contestStats.totalPrizePool,
      avgEntryFee: contestStats.avgEntryFee,
      byFormat: contestStats.byFormat
    },
    mokiStats: mokiStats,
    generatedAt: new Date().toISOString()
  };
  
  writeJson(path.join(STATS_DIR, 'summary.json'), summary);
  console.log('✅ 汇总统计完成：summary.json\n');
  
  return summary;
}

/**
 * 计算卡牌出场统计
 */
function calculateMokiStats(leaderboards) {
  const mokiCount = {};
  const mokiRanks = {};
  let totalPlayers = 0;
  
  for (const lb of leaderboards) {
    for (const entry of lb.top50 || []) {
      totalPlayers++;
      for (const mokiId of entry.mokiIds || []) {
        if (!mokiCount[mokiId]) {
          mokiCount[mokiId] = 0;
          mokiRanks[mokiId] = [];
        }
        mokiCount[mokiId]++;
        mokiRanks[mokiId].push(entry.rank);
      }
    }
  }
  
  const stats = {};
  for (const [mokiId, count] of Object.entries(mokiCount)) {
    const avgRank = mokiRanks[mokiId].reduce((a, b) => a + b, 0) / mokiRanks[mokiId].length;
    stats[mokiId] = {
      count,
      percentage: parseFloat(((count / totalPlayers) * 100).toFixed(2)),
      avgRank: parseFloat(avgRank.toFixed(2)),
      appearances: mokiRanks[mokiId].length
    };
  }
  
  // 按出场率排序
  return Object.entries(stats)
    .sort((a, b) => b[1].count - a[1].count)
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {});
}

/**
 * 生成竞赛索引（快速查询）
 */
function generateContestIndex() {
  console.log('📑 生成竞赛索引...\n');
  
  const contests = getAllContests();
  const ranges = getDateRanges();
  
  const index = {
    version: 2,
    generatedAt: new Date().toISOString(),
    total: contests.length,
    byStatus: {
      COMPLETED: 0,
      LIVE: 0,
      OPEN: 0,
      UPCOMING: 0
    },
    dateStats: {
      today: 0,
      yesterday: 0,
      last7Days: 0
    },
    contests: contests.map(c => ({
      _id: c._id,
      name: c.name,
      contestStatus: c.contestStatus || c.status,
      format: c.format,
      entryFee: c.entryFee || 0,
      prizePool: c.prizePool || 0,
      entries: c.entries || 0,
      startDate: c.startDate,
      endDate: c.endDate
    }))
  };
  
  // 统计各状态数量
  for (const c of index.contests) {
    if (index.byStatus[c.contestStatus] !== undefined) {
      index.byStatus[c.contestStatus]++;
    }
    
    // 按日期统计
    if (c.endDate) {
      const endTime = new Date(c.endDate).getTime();
      if (endTime >= ranges.todayStart) index.dateStats.today++;
      else if (endTime >= ranges.yesterdayStart) index.dateStats.yesterday++;
      else if (endTime >= ranges.sevenDaysAgoStart) index.dateStats.last7Days++;
    }
  }
  
  const indexPath = path.join(DATA_DIR, 'contest_index.json');
  writeJson(indexPath, index);
  console.log(`✅ 索引完成：${index.total} 个竞赛\n`);
  
  return index;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始生成竞赛统计...\n');
  
  ensureDir(STATS_DIR);
  
  // 1. 生成每日统计
  generateDailyStats();
  
  // 2. 生成汇总统计
  generateSummaryStats();
  
  // 3. 生成索引
  generateContestIndex();
  
  console.log('✅ 所有统计完成！\n');
}

// CLI 入口
if (process.argv[1]?.endsWith('stats.js')) {
  main().catch(console.error);
}

export {
  getAllContests,
  getCompletedContests,
  calculateContestStats,
  generateDailyStats,
  generateSummaryStats,
  generateContestIndex
};
