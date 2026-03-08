/**
 * Leaderboard 抓取与统计分析
 * 
 * 功能：
 * 1. 抓取指定竞赛的 leaderboard
 * 2. 批量抓取最近 N 天的 leaderboard
 * 3. 分析 leaderboard 数据，生成统计报告
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import {
  readJson,
  writeJson,
  ensureDir,
  sleep,
  getISODate
} from './utils.js';

const BASE_URL = 'https://fantasy.grandarena.gg/api';
const DATA_DIR_NAME = process.env.DATA_DIR || 'data';
const DATA_DIR = path.join(process.cwd(), DATA_DIR_NAME);

console.log(`📂 数据目录：${DATA_DIR}`);

/**
 * 获取竞赛 leaderboard
 * @param {string} contestId - 竞赛 ID
 * @param {number} maxRetries - 最大重试次数
 */
async function fetchLeaderboard(contestId, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const url = `${BASE_URL}/contests/${contestId}/leaderboard?limit=50&offset=0&includeUserPosition=true`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // 处理不同的返回格式
      let leaderboard = [];
      if (Array.isArray(data)) {
        leaderboard = data;
      } else if (Array.isArray(data.leaderboard)) {
        leaderboard = data.leaderboard;
      } else if (Array.isArray(data.entries)) {
        leaderboard = data.entries;
      } else if (data.top50 && Array.isArray(data.top50)) {
        leaderboard = data.top50;
      }
      
      // 检查 entry 结构
      if (leaderboard.length > 0 && leaderboard[0].player) {
        // 需要转换格式
        leaderboard = leaderboard.map(entry => ({
          playerId: entry.player?._id || entry.playerId || '',
          playerName: entry.player?.name || entry.playerName || 'Unknown',
          score: entry.score || entry.points || 0,
          mokiIds: entry.mokiIds || entry.team?.map(m => m.tokenId) || []
        }));
      }
      
      console.log(`✅ ${contestId}: ${leaderboard.length} 条记录`);
      return leaderboard;
      
    } catch (error) {
      console.error(`⚠️  ${contestId} 重试 ${i + 1}/${maxRetries}: ${error.message}`);
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      await sleep(2000 * (i + 1)); // 指数退避
    }
  }
}

/**
 * 保存 leaderboard
 */
function saveLeaderboard(contestId, contestName, endDate, leaderboard) {
  const dir = path.join(DATA_DIR, 'leaderboards');
  ensureDir(dir);
  
  const filePath = path.join(dir, `${contestId}.json`);
  
  const saved = {
    contestId,
    contestName,
    endDate,
    fetchedAt: new Date().toISOString(),
    totalEntries: leaderboard.length,
    top50: leaderboard.map((entry, idx) => ({
      rank: idx + 1,
      playerId: entry.playerId || entry.player?._id || '',
      playerName: entry.playerName || entry.player?.name || 'Unknown',
      score: entry.score || entry.points || 0,
      mokiIds: entry.mokiIds || entry.team?.map(m => m.tokenId) || []
    }))
  };
  
  writeJson(filePath, saved);
  return saved;
}

/**
 * 批量抓取 leaderboard
 * @param {Array} contests - 竞赛列表
 * @param {number} batchSize - 每批数量
 * @param {number} batchDelay - 批间延迟（毫秒）
 */
async function fetchLeaderboardsBatch(contests, batchSize = 10, batchDelay = 3000) {
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  
  const contestsDir = path.join(DATA_DIR, 'contests');
  const leaderboardsDir = path.join(DATA_DIR, 'leaderboards');
  
  ensureDir(leaderboardsDir);
  
  for (let i = 0; i < contests.length; i += batchSize) {
    const batch = contests.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(contests.length / batchSize);
    
    console.log(`\n📦 批次 ${batchNum}/${totalBatches} (${batch.length} 个竞赛)`);
    
    await Promise.all(batch.map(async (contest) => {
      const contestId = contest._id || contest.contestId;
      const leaderboardPath = path.join(leaderboardsDir, `${contestId}.json`);
      
      // 检查是否已存在
      if (fs.existsSync(leaderboardPath)) {
        console.log(`  ⏭️  跳过 ${contestId}（已存在）`);
        skipCount++;
        return;
      }
      
      // 检查竞赛信息
      const contestPath = path.join(contestsDir, `${contestId}.json`);
      let contestData = contest;
      
      if (!contestData.name && fs.existsSync(contestPath)) {
        contestData = readJson(contestPath);
      }
      
      if (!contestData) {
        console.log(`  ⚠️  跳过 ${contestId}（竞赛信息不存在）`);
        failCount++;
        return;
      }
      
      try {
        const leaderboard = await fetchLeaderboard(contestId);
        saveLeaderboard(contestId, contestData.name, contestData.endDate, leaderboard);
        
        // 标记竞赛已抓取
        if (fs.existsSync(contestPath)) {
          contestData.leaderboardFetched = true;
          writeJson(contestPath, contestData);
        }
        
        successCount++;
      } catch (error) {
        console.error(`  ❌ ${contestId}: ${error.message}`);
        failCount++;
      }
    }));
    
    console.log(`   进度：${Math.min(i + batchSize, contests.length)}/${contests.length}`);
    
    if (i + batchSize < contests.length) {
      console.log(`⏸️  等待 ${batchDelay/1000}秒...`);
      await sleep(batchDelay);
    }
  }
  
  console.log(`\n📊 完成：成功 ${successCount} 个，失败 ${failCount} 个，跳过 ${skipCount} 个`);
  return { success: successCount, failed: failCount, skipped: skipCount };
}

/**
 * 获取最近 N 天的竞赛
 * @param {number} days - 天数
 */
function getRecentContests(days = 7) {
  const contestsDir = path.join(DATA_DIR, 'contests');
  ensureDir(contestsDir);
  
  const files = fs.readdirSync(contestsDir).filter(f => f.endsWith('.json'));
  const now = Date.now();
  const daysAgo = now - (days * 24 * 60 * 60 * 1000);
  
  const recentContests = [];
  
  for (const file of files) {
    const contest = readJson(path.join(contestsDir, file));
    if (!contest || !contest.endDate) continue;
    
    const endTime = new Date(contest.endDate).getTime();
    
    // 只获取已结束的竞赛
    if (endTime <= now && endTime >= daysAgo) {
      recentContests.push(contest);
    }
  }
  
  // 按结束时间排序
  recentContests.sort((a, b) => 
    new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
  );
  
  return recentContests;
}

/**
 * 分析 leaderboard 数据
 */
function analyzeLeaderboards() {
  const leaderboardsDir = path.join(DATA_DIR, 'leaderboards');
  ensureDir(leaderboardsDir);
  
  const files = fs.readdirSync(leaderboardsDir).filter(f => f.endsWith('.json'));
  const leaderboards = files.map(f => readJson(path.join(leaderboardsDir, f))).filter(Boolean);
  
  console.log(`\n📊 分析 ${leaderboards.length} 个 leaderboard...`);
  
  const mokiStats = {};
  const compositionStats = {};
  let totalPlayers = 0;
  
  for (const lb of leaderboards) {
    for (const entry of lb.top50 || []) {
      totalPlayers++;
      
      // 统计卡牌
      for (const mokiId of entry.mokiIds || []) {
        if (!mokiStats[mokiId]) {
          mokiStats[mokiId] = {
            count: 0,
            ranks: [],
            appearances: 0
          };
        }
        mokiStats[mokiId].count++;
        mokiStats[mokiId].ranks.push(entry.rank);
      }
      
      // 统计阵容（前 5 名）
      if (entry.rank <= 5 && entry.mokiIds && entry.mokiIds.length >= 5) {
        const composition = entry.mokiIds.slice(0, 5).sort().join(',');
        if (!compositionStats[composition]) {
          compositionStats[composition] = {
            count: 0,
            avgRank: 0,
            mokiIds: entry.mokiIds.slice(0, 5)
          };
        }
        compositionStats[composition].count++;
      }
    }
  }
  
  // 计算卡牌平均排名
  const mokiAppearances = {};
  for (const [mokiId, stats] of Object.entries(mokiStats)) {
    const avgRank = stats.ranks.reduce((a, b) => a + b, 0) / stats.ranks.length;
    mokiAppearances[mokiId] = {
      count: stats.count,
      percentage: parseFloat(((stats.count / totalPlayers) * 100).toFixed(2)),
      avgRank: parseFloat(avgRank.toFixed(2)),
      appearances: stats.ranks.length
    };
  }
  
  // 排序阵容
  const topCompositions = Object.values(compositionStats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(comp => ({
      mokiIds: comp.mokiIds,
      count: comp.count,
      percentage: parseFloat(((comp.count / totalPlayers) * 100).toFixed(2))
    }));
  
  return {
    totalPlayers,
    mokiAppearances,
    topCompositions
  };
}

/**
 * 生成统计报告
 */
function generateStatsReport() {
  const statsDir = path.join(DATA_DIR, 'stats');
  ensureDir(statsDir);
  
  console.log('\n📊 生成统计报告...');
  
  // 分析 leaderboard
  const analysis = analyzeLeaderboards();
  
  // 读取现有 summary.json
  const summaryPath = path.join(statsDir, 'summary.json');
  let summary = readJson(summaryPath) || {};
  
  // 更新统计
  summary.mokiStats = analysis.mokiAppearances;
  summary.topCompositions = analysis.topCompositions;
  summary.totalPlayers = analysis.totalPlayers;
  summary.generatedAt = new Date().toISOString();
  
  writeJson(summaryPath, summary);
  console.log('✅ 统计报告已更新');
  
  return summary;
}

/**
 * 主函数：抓取最近 N 天的 leaderboard
 */
async function mainFetchRecent(days = 7) {
  console.log(`🚀 开始抓取最近 ${days} 天的 leaderboard...\n`);
  
  // 获取最近 N 天的竞赛
  const recentContests = getRecentContests(days);
  console.log(`找到 ${recentContests.length} 个已结束的竞赛\n`);
  
  if (recentContests.length === 0) {
    console.log('⚠️  没有需要抓取的竞赛');
    return;
  }
  
  // 批量抓取
  await fetchLeaderboardsBatch(recentContests, 10, 3000);
  
  // 生成统计
  generateStatsReport();
  
  console.log('\n✅ leaderboard 抓取完成！\n');
}

/**
 * 主函数：生成统计报告
 */
function mainGenerateStats() {
  console.log('🚀 开始生成统计报告...\n');
  generateStatsReport();
  console.log('\n✅ 统计报告生成完成！\n');
}

// CLI 入口
const args = process.argv.slice(2);
const mode = args[0];

if (mode === '--recent') {
  const days = parseInt(args[1]) || 7;
  mainFetchRecent(days);
} else if (mode === '--stats') {
  mainGenerateStats();
} else if (mode === '--contest') {
  const contestId = args[1];
  if (!contestId) {
    console.error('请提供竞赛 ID: node src/leaderboard.js --contest <contest_id>');
    process.exit(1);
  }
  
  fetchLeaderboard(contestId).then(leaderboard => {
    console.log(`获取到 ${leaderboard.length} 条记录`);
  }).catch(console.error);
} else {
  console.log('用法:');
  console.log('  node src/leaderboard.js --recent [days]  - 抓取最近 N 天的 leaderboard');
  console.log('  node src/leaderboard.js --stats          - 生成统计报告');
  console.log('  node src/leaderboard.js --contest <id>   - 抓取指定竞赛的 leaderboard');
}

export {
  fetchLeaderboard,
  saveLeaderboard,
  fetchLeaderboardsBatch,
  getRecentContests,
  analyzeLeaderboards,
  generateStatsReport
};
