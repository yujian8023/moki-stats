/**
 * 数据分析脚本
 * 统计卡牌出场率、热门阵容等
 */

import fs from 'fs';
import path from 'path';
import {
  readJson,
  writeJson,
  ensureDir,
  getISODate,
  getISOWeek
} from './utils.js';

// 支持环境变量配置数据目录
const DATA_DIR_NAME = process.env.DATA_DIR || 'data';
const DATA_DIR = path.join(process.cwd(), DATA_DIR_NAME);
const LEADERBOARDS_DIR = path.join(DATA_DIR, 'leaderboards');
const STATS_DIR = path.join(DATA_DIR, 'stats');

console.log(`📈 分析数据目录：${DATA_DIR}`);

/**
 * 获取所有 leaderboard 文件
 */
function getAllLeaderboards() {
  ensureDir(LEADERBOARDS_DIR);
  const files = fs.readdirSync(LEADERBOARDS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => readJson(path.join(LEADERBOARDS_DIR, f))).filter(Boolean);
}

/**
 * 分析单个 leaderboard
 */
function analyzeLeaderboard(lb) {
  const results = [];
  
  for (const entry of lb.top50 || []) {
    results.push({
      contestId: lb.contestId,
      contestName: lb.contestName,
      endDate: lb.endDate,
      rank: entry.rank,
      playerId: entry.playerId,
      playerName: entry.playerName,
      score: entry.score,
      mokiIds: entry.mokiIds
    });
  }
  
  return results;
}

/**
 * 统计卡牌出场情况
 */
function calculateMokiStats(entries) {
  const mokiCount = {};
  const mokiRanks = {};
  const totalPlayers = entries.length;
  
  for (const entry of entries) {
    for (const mokiId of entry.mokiIds || []) {
      if (!mokiCount[mokiId]) {
        mokiCount[mokiId] = 0;
        mokiRanks[mokiId] = [];
      }
      mokiCount[mokiId]++;
      mokiRanks[mokiId].push(entry.rank);
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
  
  return stats;
}

/**
 * 统计热门阵容（5 卡组合）
 */
function calculateCompositionStats(entries, topN = 20) {
  const compositionCount = {};
  
  for (const entry of entries) {
    const mokiIds = entry.mokiIds || [];
    if (mokiIds.length >= 5) {
      // 取前 5 张卡作为阵容
      const composition = mokiIds.slice(0, 5).sort().join(',');
      compositionCount[composition] = (compositionCount[composition] || 0) + 1;
    }
  }
  
  // 排序并取 TOP N
  return Object.entries(compositionCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([composition, count]) => ({
      mokiIds: composition.split(','),
      count,
      percentage: parseFloat(((count / entries.length) * 100).toFixed(2))
    }));
}

/**
 * 按日期分组分析
 */
function analyzeByDate(entries) {
  const byDate = {};
  
  for (const entry of entries) {
    const date = entry.endDate?.split('T')[0] || 'unknown';
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(entry);
  }
  
  const results = {};
  for (const [date, dateEntries] of Object.entries(byDate)) {
    results[date] = {
      totalEntries: dateEntries.length,
      mokiStats: calculateMokiStats(dateEntries),
      topCompositions: calculateCompositionStats(dateEntries)
    };
  }
  
  return results;
}

/**
 * 生成每日统计
 */
function generateDailyStats(leaderboards) {
  console.log('📊 生成每日统计...');
  
  const dailyDir = path.join(STATS_DIR, 'daily');
  ensureDir(dailyDir);
  
  const byDate = analyzeByDate(
    leaderboards.flatMap(lb => analyzeLeaderboard(lb))
  );
  
  for (const [date, stats] of Object.entries(byDate)) {
    const filePath = path.join(dailyDir, `${date}.json`);
    writeJson(filePath, {
      date,
      totalContests: new Set(
        leaderboards
          .filter(lb => lb.endDate?.startsWith(date))
          .map(lb => lb.contestId)
      ).size,
      totalPlayers: stats.totalEntries,
      mokiAppearances: stats.mokiStats,
      topCompositions: stats.topCompositions,
      generatedAt: new Date().toISOString()
    });
    console.log(`  ✅ ${date}`);
  }
  
  return byDate;
}

/**
 * 生成每周统计
 */
function generateWeeklyStats(leaderboards) {
  console.log('\n📊 生成每周统计...');
  
  const weeklyDir = path.join(STATS_DIR, 'weekly');
  ensureDir(weeklyDir);
  
  const byWeek = {};
  
  for (const lb of leaderboards) {
    if (!lb.endDate) continue;
    const week = getISOWeek(new Date(lb.endDate));
    if (!byWeek[week]) byWeek[week] = [];
    byWeek[week].push(lb);
  }
  
  for (const [week, weekLeaderboards] of Object.entries(byWeek)) {
    const entries = weekLeaderboards.flatMap(lb => analyzeLeaderboard(lb));
    const filePath = path.join(weeklyDir, `${week}.json`);
    
    writeJson(filePath, {
      week,
      dateRange: getWeekDateRange(week),
      totalContests: weekLeaderboards.length,
      totalPlayers: entries.length,
      mokiAppearances: calculateMokiStats(entries),
      topCompositions: calculateCompositionStats(entries),
      generatedAt: new Date().toISOString()
    });
    console.log(`  ✅ ${week}`);
  }
  
  return byWeek;
}

/**
 * 获取周日期范围
 */
function getWeekDateRange(weekStr) {
  // 简单实现：返回周的周一和周日
  const [year, week] = weekStr.split('-W');
  const jan1 = new Date(year, 0, 1);
  const daysToAdd = (week - 1) * 7;
  const monday = new Date(jan1);
  monday.setDate(jan1.getDate() + daysToAdd - jan1.getDay() + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return [
    monday.toISOString().split('T')[0],
    sunday.toISOString().split('T')[0]
  ];
}

/**
 * 生成汇总统计（最近 7 天）
 */
function generateSummaryStats(leaderboards) {
  console.log('\n📊 生成汇总统计...');
  
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const recentEntries = leaderboards
    .filter(lb => {
      if (!lb.endDate) return false;
      return new Date(lb.endDate) >= sevenDaysAgo;
    })
    .flatMap(lb => analyzeLeaderboard(lb));
  
  const summary = {
    period: 'last_7_days',
    fromDate: sevenDaysAgo.toISOString().split('T')[0],
    toDate: getISODate(now),
    totalContests: new Set(recentEntries.map(e => e.contestId)).size,
    totalPlayers: recentEntries.length,
    mokiAppearances: calculateMokiStats(recentEntries),
    topCompositions: calculateCompositionStats(recentEntries, 50),
    generatedAt: new Date().toISOString()
  };
  
  writeJson(path.join(STATS_DIR, 'summary.json'), summary);
  console.log('  ✅ summary.json');
  
  return summary;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始数据分析...\n');
  
  const leaderboards = getAllLeaderboards();
  console.log(`找到 ${leaderboards.length} 个排行榜文件\n`);
  
  if (leaderboards.length === 0) {
    console.log('⚠️  暂无数据，先运行 fetch 脚本采集数据');
    return;
  }
  
  generateDailyStats(leaderboards);
  generateWeeklyStats(leaderboards);
  generateSummaryStats(leaderboards);
  
  console.log('\n✅ 数据分析完成！');
}

main().catch(console.error);
