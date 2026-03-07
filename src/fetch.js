/**
 * 数据采集脚本
 * 1. 获取 contests 列表
 * 2. 保存新竞赛
 * 3. 检查赛后竞赛并抓取 leaderboard
 */

import fetch from 'node-fetch';
import fs from 'fs';
import {
  readJson,
  writeJson,
  getAllContests,
  contestExists,
  leaderboardExists,
  markLeaderboardFetched,
  getContestsNeedingLeaderboard,
  flattenMoki,
  flattenLeaderboardEntry,
  sleep,
  ensureDir,
  mokiExists,
  saveMokiDetails,
  getMokiDetails,
  getAllMokiDetails,
  generateMokiManifest,
  extractMokiIdsFromLeaderboards
} from './utils.js';
import path from 'path';

const BASE_URL = 'https://fantasy.grandarena.gg/api';

/**
 * 获取所有竞赛
 */
async function fetchContests() {
  console.log('📋 获取竞赛列表...');
  
  const url = `${BASE_URL}/contests?status=OPEN,UPCOMING,STARTING_SOON,LIVE&limit=50&offset=0&includeUserContext=true&hidePrivate=true`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`获取竞赛失败：${response.status}`);
  }
  
  const data = await response.json();
  return data.contests || data || [];
}

/**
 * 获取单个 Moki 信息
 */
async function fetchMoki(tokenId) {
  const url = `${BASE_URL}/moki/${tokenId}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  return await response.json();
}

/**
 * 批量获取 Moki 详情
 */
async function fetchMokiDetails(tokenIds, showLog = true) {
  if (showLog) {
    console.log(`🃏 获取 ${tokenIds.length} 个卡牌详情...`);
  }
  
  let fetched = 0;
  let skipped = 0;
  
  for (const tokenId of tokenIds) {
    if (mokiExists(tokenId)) {
      skipped++;
      continue;
    }
    
    try {
      await sleep(300); // 避免频率限制
      const details = await fetchMoki(tokenId);
      
      if (details) {
        saveMokiDetails(tokenId, details);
        fetched++;
        if (showLog) {
          console.log(`  ✅ ${details.name || tokenId}`);
        }
      }
    } catch (error) {
      console.error(`  ❌ ${tokenId}: ${error.message}`);
    }
  }
  
  if (showLog) {
    console.log(`📊 新增：${fetched}个，跳过：${skipped}个\n`);
  }
  
  // 生成清单文件
  generateMokiManifest();
  
  return { fetched, skipped };
}

/**
 * 获取竞赛 leaderboard
 */
async function fetchLeaderboard(contestId) {
  console.log(`🏆 获取竞赛 ${contestId} 的排行榜...`);
  
  const url = `${BASE_URL}/contests/${contestId}/leaderboard?limit=50&offset=0&includeUserPosition=true`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`获取排行榜失败：${response.status}`);
  }
  
  const data = await response.json();
  return data.leaderboard || data || [];
}

/**
 * 保存竞赛信息
 */
function saveContest(contest) {
  const filePath = path.join(process.cwd(), 'data', 'contests', `${contest._id}.json`);
  
  const saved = {
    _id: contest._id,
    name: contest.name,
    type: contest.type || 'UNKNOWN',
    startDate: contest.startDate,
    endDate: contest.endDate,
    status: contest.status,
    participantCount: contest.participantCount || 0,
    prizePool: contest.prizePool,
    fetchedAt: new Date().toISOString(),
    leaderboardFetched: false
  };
  
  writeJson(filePath, saved);
  console.log(`✅ 保存新竞赛：${contest.name}`);
  return saved;
}

/**
 * 保存 leaderboard 并获取卡牌详情
 */
async function saveLeaderboard(contestId, contestName, endDate, leaderboard) {
  const filePath = path.join(process.cwd(), 'data', 'leaderboards', `${contestId}.json`);
  
  const flattened = leaderboard.map((entry, idx) => flattenLeaderboardEntry(entry, idx));
  
  const saved = {
    contestId,
    contestName,
    endDate,
    fetchedAt: new Date().toISOString(),
    totalEntries: flattened.length,
    top50: flattened
  };
  
  writeJson(filePath, saved);
  console.log(`✅ 保存排行榜：${contestName} (${flattened.length} 条记录)`);
  
  // 标记已抓取
  markLeaderboardFetched(contestId);
  
  // 提取并获取卡牌详情
  const mokiIds = flattened.flatMap(e => e.mokiIds || []);
  const uniqueMokiIds = [...new Set(mokiIds)];
  
  if (uniqueMokiIds.length > 0) {
    await fetchMokiDetails(uniqueMokiIds, false);
  }
  
  return saved;
}

/**
 * 主流程：获取 contests
 */
async function mainFetchContests() {
  console.log('🚀 开始获取竞赛数据...\n');
  
  try {
    const contests = await fetchContests();
    console.log(`获取到 ${contests.length} 个竞赛\n`);
    
    let newCount = 0;
    let endedContests = [];
    
    for (const contest of contests) {
      if (!contest._id) continue;
      
      if (!contestExists(contest._id)) {
        saveContest(contest);
        newCount++;
      }
      
      // 检查是否已结束
      if (contest.endDate) {
        const endTime = new Date(contest.endDate).getTime();
        const now = Date.now();
        const sixMinutes = 6 * 60 * 1000;
        
        if (endTime < now - sixMinutes && !leaderboardExists(contest._id)) {
          endedContests.push(contest);
        }
      }
      
      await sleep(300); // 避免频率限制
    }
    
    console.log(`\n📊 新增竞赛：${newCount} 个`);
    console.log(`⏰ 待抓取排行榜：${endedContests.length} 个\n`);
    
    // 输出需要触发 leaderboard 抓取的 contest IDs
    if (endedContests.length > 0) {
      const ids = endedContests.map(c => c._id).join(',');
      console.log(`LEADERBOARD_IDS=${ids}`);
    }
    
    return { newCount, endedContests };
    
  } catch (error) {
    console.error('❌ 获取竞赛失败:', error.message);
    process.exit(1);
  }
}

/**
 * 抓取指定竞赛的 leaderboard
 */
async function mainFetchLeaderboards(contestIds) {
  console.log('🚀 开始抓取排行榜...\n');
  
  if (!contestIds || contestIds.length === 0) {
    console.log('没有需要抓取的排行榜');
    return;
  }
  
  for (const contestId of contestIds) {
    try {
      if (leaderboardExists(contestId)) {
        console.log(`⏭️  跳过 ${contestId}（已存在）`);
        continue;
      }
      
      const contest = readJson(path.join(process.cwd(), 'data', 'contests', `${contestId}.json`));
      if (!contest) {
        console.log(`⚠️  跳过 ${contestId}（竞赛信息不存在）`);
        continue;
      }
      
      await sleep(500);
      const leaderboard = await fetchLeaderboard(contestId);
      saveLeaderboard(contestId, contest.name, contest.endDate, leaderboard);
      
    } catch (error) {
      console.error(`❌ 抓取 ${contestId} 失败:`, error.message);
    }
  }
  
  console.log('\n✅ 排行榜抓取完成');
}

// CLI 入口
const args = process.argv.slice(2);
const mode = args[0];

if (mode === '--leaderboards') {
  const ids = args[1]?.split(',') || [];
  mainFetchLeaderboards(ids);
} else if (mode === '--fetch-mokis') {
  // 从所有 leaderboard 中提取 moki IDs 并获取详情
  const leaderboardsDir = path.join(process.cwd(), 'data', 'leaderboards');
  ensureDir(leaderboardsDir);
  
  const files = fs.readdirSync(leaderboardsDir).filter(f => f.endsWith('.json'));
  const leaderboards = files.map(f => readJson(path.join(leaderboardsDir, f))).filter(Boolean);
  
  const mokiIds = extractMokiIdsFromLeaderboards(leaderboards);
  console.log(`📋 从 ${leaderboards.length} 个排行榜中提取到 ${mokiIds.length} 个卡牌 ID\n`);
  
  fetchMokiDetails(mokiIds);
} else {
  mainFetchContests();
}
