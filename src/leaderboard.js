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
    top50: leaderboard.map((entry, idx) => {
      // 处理不同的 API 返回格式
      const cardImages = entry.cardImages || entry.cards?.map(c => c.imageUrl) || [];
      
      return {
        rank: entry.rank || idx + 1,
        playerId: entry.playerId || entry.userId || entry.player?._id || '',
        playerName: entry.playerName || entry.username || entry.player?.name || 'Unknown',
        score: entry.score || entry.points || 0,
        cardImages: cardImages,  // 保存卡牌图片 URL
        // 保留有用的元数据
        entryNumber: entry.entryNumber || null,
        matchesCompleted: entry.matchesCompleted || 0
      };
    })
  };
  
  writeJson(filePath, saved);
  return saved;
}

/**
 * 批量抓取 leaderboard
 * @param {Array} contests - 竞赛列表
 * @param {number} batchSize - 每批数量
 * @param {number} batchDelay - 批间延迟（毫秒）
 * @param {number} requestDelay - 请求间延迟（毫秒）
 */
async function fetchLeaderboardsBatch(contests, batchSize = 5, batchDelay = 10000, requestDelay = 1000) {
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  let rateLimitCount = 0;
  
  const contestsDir = path.join(DATA_DIR, 'contests');
  const leaderboardsDir = path.join(DATA_DIR, 'leaderboards');
  
  ensureDir(leaderboardsDir);
  
  console.log(`📋 配置：每批 ${batchSize} 个，批间延迟 ${batchDelay/1000}秒，请求间隔 ${requestDelay/1000}秒\n`);
  
  for (let i = 0; i < contests.length; i += batchSize) {
    const batch = contests.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(contests.length / batchSize);
    
    console.log(`📦 批次 ${batchNum}/${totalBatches} (${batch.length} 个竞赛)`);
    
    // 串行请求，避免并发限流
    for (const contest of batch) {
      const contestId = contest._id || contest.contestId;
      const leaderboardPath = path.join(leaderboardsDir, `${contestId}.json`);
      
      // 检查是否已存在
      if (fs.existsSync(leaderboardPath)) {
        console.log(`  ⏭️  跳过 ${contestId}（已存在）`);
        skipCount++;
        await sleep(requestDelay);
        continue;
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
        await sleep(requestDelay);
        continue;
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
        console.log(`  ✅ ${contestId}`);
        
      } catch (error) {
        if (error.message.includes('429')) {
          rateLimitCount++;
          console.log(`  ⚠️  ${contestId}: 限流，跳过`);
        } else {
          console.error(`  ❌ ${contestId}: ${error.message}`);
          failCount++;
        }
      }
      
      // 每个请求后延迟
      await sleep(requestDelay);
    }
    
    console.log(`   进度：${Math.min(i + batchSize, contests.length)}/${contests.length} (成功:${successCount}, 失败:${failCount}, 限流:${rateLimitCount})`);
    
    if (i + batchSize < contests.length) {
      console.log(`⏸️  等待 ${batchDelay/1000}秒...\n`);
      await sleep(batchDelay);
    }
  }
  
  console.log(`\n📊 完成：成功 ${successCount} 个，失败 ${failCount} 个，跳过 ${skipCount} 个，限流 ${rateLimitCount} 个`);
  return { success: successCount, failed: failCount, skipped: skipCount, rateLimited: rateLimitCount };
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
 * @param {string} dateRange - 日期范围 'daily', 'weekly', 'yesterday'
 * @param {string} date - 具体日期（daily 模式用）
 */
function analyzeLeaderboards(dateRange = 'weekly', date = null) {
  const leaderboardsDir = path.join(DATA_DIR, 'leaderboards');
  ensureDir(leaderboardsDir);
  
  const files = fs.readdirSync(leaderboardsDir).filter(f => f.endsWith('.json'));
  const leaderboards = files.map(f => readJson(path.join(leaderboardsDir, f))).filter(Boolean);
  
  // 按日期过滤
  let filteredLeaderboards = leaderboards;
  if (dateRange === 'daily' && date) {
    filteredLeaderboards = leaderboards.filter(lb => lb.endDate?.startsWith(date));
  } else if (dateRange === 'yesterday') {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    filteredLeaderboards = leaderboards.filter(lb => lb.endDate?.startsWith(yesterday));
  }
  // weekly 模式不过滤，使用所有数据
  
  console.log(`\n📊 分析 ${filteredLeaderboards.length} 个 leaderboard (${dateRange})...`);
  
  const cardStats = {};  // 卡牌图片统计
  const compositionStats = {};  // 阵容统计
  let totalPlayers = 0;
  let totalWithCards = 0;
  
  for (const lb of filteredLeaderboards) {
    for (const entry of lb.top50 || []) {
      totalPlayers++;
      
      const cardImages = entry.cardImages || [];
      if (cardImages.length > 0) {
        totalWithCards++;
      }
      
      // 统计卡牌图片出现频率
      for (const imgUrl of cardImages) {
        // 从 URL 提取卡牌标识（文件名）
        const cardId = imgUrl.split('/').pop()?.split('_')[0] || imgUrl;
        
        if (!cardStats[cardId]) {
          cardStats[cardId] = {
            count: 0,
            ranks: [],
            imageUrl: imgUrl
          };
        }
        cardStats[cardId].count++;
        cardStats[cardId].ranks.push(entry.rank);
      }
      
      // 统计阵容（前 5 名，基于图片）
      if (entry.rank <= 5 && cardImages.length >= 4) {
        // 使用图片 URL 的哈希作为阵容标识
        const compositionKey = cardImages.slice(0, 5).map(url => url.split('/').pop()).sort().join(',');
        
        if (!compositionStats[compositionKey]) {
          compositionStats[compositionKey] = {
            count: 0,
            avgRank: 0,
            cardImages: cardImages.slice(0, 5)
          };
        }
        compositionStats[compositionKey].count++;
      }
    }
  }
  
  // 计算卡牌平均排名
  const cardAppearances = {};
  for (const [cardId, stats] of Object.entries(cardStats)) {
    const avgRank = stats.ranks.reduce((a, b) => a + b, 0) / stats.ranks.length;
    cardAppearances[cardId] = {
      count: stats.count,
      percentage: parseFloat(((stats.count / totalPlayers) * 100).toFixed(2)),
      avgRank: parseFloat(avgRank.toFixed(2)),
      imageUrl: stats.imageUrl
    };
  }
  
  // 排序阵容
  const topCompositions = Object.values(compositionStats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(comp => ({
      cardImages: comp.cardImages,
      count: comp.count,
      percentage: parseFloat(((comp.count / totalPlayers) * 100).toFixed(2))
    }));
  
  console.log(`   总玩家数：${totalPlayers}`);
  console.log(`   有卡牌数据的玩家：${totalWithCards}`);
  
  return {
    totalPlayers,
    totalWithCards,
    cardAppearances,
    topCompositions,
    leaderboardCount: filteredLeaderboards.length
  };
}

/**
 * 生成统计报告
 * @param {string} dateRange - 日期范围 'daily', 'weekly', 'yesterday'
 * @param {string} date - 具体日期（daily 模式用）
 */
function generateStatsReport(dateRange = 'weekly', date = null) {
  const statsDir = path.join(DATA_DIR, 'stats');
  ensureDir(statsDir);
  
  console.log(`\n📊 生成统计报告 (${dateRange})...`);
  
  // 分析 leaderboard
  const analysis = analyzeLeaderboards(dateRange, date);
  
  // 生成文件名
  let outputPath;
  if (dateRange === 'daily' && date) {
    // 每日统计
    const dailyDir = path.join(statsDir, 'daily');
    ensureDir(dailyDir);
    outputPath = path.join(dailyDir, `${date}.json`);
  } else if (dateRange === 'yesterday') {
    outputPath = path.join(statsDir, 'yesterday.json');
  } else {
    outputPath = path.join(statsDir, 'summary.json');
  }
  
  // 读取现有数据
  let report = readJson(outputPath) || {};
  
  // 更新统计
  report.cardAppearances = analysis.cardAppearances;
  report.topCompositions = analysis.topCompositions;
  report.totalPlayers = analysis.totalPlayers;
  report.totalWithCards = analysis.totalWithCards;
  report.dateRange = dateRange === 'daily' ? { from: date, to: date } : report.dateRange;
  report.period = dateRange;
  report.leaderboardsAnalyzed = analysis.leaderboardCount;
  report.generatedAt = new Date().toISOString();
  
  writeJson(outputPath, report);
  console.log(`✅ 统计报告已更新：${outputPath}`);
  
  return report;
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
  
  // 批量抓取 - 保守配置避免限流
  await fetchLeaderboardsBatch(recentContests, 5, 10000, 1500);
  
  // 生成统计报告
  // 1. 生成最近 7 天汇总
  generateStatsReport('weekly');
  
  // 2. 生成每日统计
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  generateStatsReport('daily', today);
  generateStatsReport('daily', yesterday);
  
  // 3. 生成昨日统计（快捷方式）
  generateStatsReport('yesterday');
  
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
