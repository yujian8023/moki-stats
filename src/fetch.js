/**
 * 数据采集脚本（重构版）
 * 
 * 功能：
 * 1. 分页获取全量竞赛数据（初始化用）
 * 2. 增量获取 OPEN/LIVE 竞赛（定时任务用）
 * 3. 批量获取 leaderboard（带重试机制）
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
  flattenLeaderboardEntry,
  sleep,
  ensureDir,
  mokiExists,
  saveMokiDetails,
  generateMokiManifest,
  extractMokiIdsFromLeaderboards
} from './utils.js';
import path from 'path';
import TaskScheduler, { calculateLeaderboardTime, shouldFetchLeaderboard } from './scheduler.js';

const BASE_URL = 'https://fantasy.grandarena.gg/api';

/**
 * 获取竞赛列表（支持分页）
 * @param {Object} options - 选项
 * @param {string} options.status - 状态过滤（逗号分隔，如 'OPEN,LIVE'）
 * @param {number} options.limit - 每页数量（默认 50）
 * @param {number} options.offset - 偏移量
 */
async function fetchContests({ status = null, limit = 50, offset = 0 } = {}) {
  let url = `${BASE_URL}/contests?limit=${limit}&offset=${offset}`;
  
  if (status) {
    url += `&status=${encodeURIComponent(status)}`;
  }
  
  url += '&includeUserContext=true&hidePrivate=true';
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`获取竞赛失败：${response.status}`);
  }
  
  const data = await response.json();
  return data.contests || data || [];
}

/**
 * 分页获取全部竞赛（初始化用）
 * @returns {Promise<Array>} 所有竞赛
 */
async function fetchAllContests() {
  console.log('📋 分页获取全部竞赛数据...\n');
  
  const allContests = [];
  let offset = 0;
  const limit = 50;
  let pageCount = 0;
  
  while (true) {
    pageCount++;
    console.log(`📄 获取第 ${pageCount} 页（offset=${offset}）...`);
    
    const contests = await fetchContests({ limit, offset });
    allContests.push(...contests);
    
    console.log(`   获取到 ${contests.length} 个竞赛`);
    
    if (contests.length < limit) {
      console.log('✅ 已是最后一页\n');
      break;
    }
    
    offset += limit;
    await sleep(500); // 避免频率限制
  }
  
  console.log(`📊 总计：${allContests.length} 个竞赛，共 ${pageCount} 页\n`);
  return allContests;
}

/**
 * 增量获取竞赛（定时任务用）
 * @returns {Promise<Array>} 新竞赛列表
 */
async function fetchIncrementalContests() {
  console.log('📋 增量获取 OPEN/LIVE 竞赛...\n');
  
  const allNewContests = [];
  let offset = 0;
  const limit = 50;
  
  while (true) {
    const contests = await fetchContests({ 
      status: 'OPEN,UPCOMING,STARTING_SOON,LIVE', 
      limit, 
      offset 
    });
    
    // 过滤新竞赛
    const newContests = contests.filter(c => !contestExists(c._id));
    allNewContests.push(...newContests);
    
    if (contests.length < limit) break;
    offset += limit;
    await sleep(500);
  }
  
  console.log(`📊 新增竞赛：${allNewContests.length} 个\n`);
  return allNewContests;
}

/**
 * 保存竞赛信息
 */
function saveContest(contest) {
  const filePath = path.join(process.cwd(), 'data', 'contests', `${contest._id}.json`);
  
  const saved = {
    _id: contest._id,
    name: contest.name,
    description: contest.description || '',
    contestStatus: contest.contestStatus || contest.status,
    format: contest.format,
    entryFee: contest.entryFee || 0,
    prizePool: contest.prizePool || 0,
    entries: contest.entries || 0,
    maxEntries: contest.maxEntries || 0,
    startDate: contest.startDate,
    endDate: contest.endDate,
    openDate: contest.openDate,
    showDate: contest.showDate,
    featured: contest.featured || false,
    isPrivate: contest.isPrivate || false,
    lineupConfig: contest.lineupConfig || {},
    prizeStructure: contest.prizeStructure || {},
    matchGroups: contest.matchGroups || [],
    gameTypes: contest.gameTypes || [],
    contestGroup: contest.contestGroup || '',
    scoringRules: contest.scoringRules || [],
    scoringMethod: contest.scoringMethod || 'V4',
    fetchedAt: new Date().toISOString(),
    leaderboardFetched: false
  };
  
  writeJson(filePath, saved);
  return saved;
}

/**
 * 保存所有竞赛并生成索引
 */
function saveAllContests(contests) {
  console.log('💾 保存竞赛数据...\n');
  
  let newCount = 0;
  let updatedCount = 0;
  
  for (const contest of contests) {
    if (!contest._id) continue;
    
    if (contestExists(contest._id)) {
      // 更新现有竞赛（状态可能变化）
      const existingPath = path.join(process.cwd(), 'data', 'contests', `${contest._id}.json`);
      const existing = readJson(existingPath);
      
      if (existing && existing.contestStatus !== contest.contestStatus) {
        saveContest(contest);
        updatedCount++;
        console.log(`🔄 更新竞赛状态：${contest.name} (${existing.contestStatus} → ${contest.contestStatus})`);
      }
    } else {
      saveContest(contest);
      newCount++;
      console.log(`✅ 新竞赛：${contest.name}`);
    }
    
    // 避免频率限制
    // sleep 已在调用方处理
  }
  
  // 生成索引文件
  generateContestIndex(contests);
  
  console.log(`\n📊 新增：${newCount} 个，更新：${updatedCount} 个\n`);
  return { newCount, updatedCount };
}

/**
 * 生成竞赛索引文件（快速查询）
 */
function generateContestIndex(contests) {
  const index = {
    version: 1,
    generatedAt: new Date().toISOString(),
    total: contests.length,
    byStatus: {
      COMPLETED: 0,
      LIVE: 0,
      OPEN: 0,
      UPCOMING: 0
    },
    contests: contests.map(c => ({
      _id: c._id,
      name: c.name,
      contestStatus: c.contestStatus || c.status,
      startDate: c.startDate,
      endDate: c.endDate,
      entries: c.entries || 0,
      prizePool: c.prizePool || 0,
      format: c.format
    }))
  };
  
  // 统计各状态数量
  for (const c of index.contests) {
    if (index.byStatus[c.contestStatus] !== undefined) {
      index.byStatus[c.contestStatus]++;
    }
  }
  
  const indexPath = path.join(process.cwd(), 'data', 'contest_index.json');
  writeJson(indexPath, index);
  console.log(`📑 生成索引文件：contest_index.json (${index.total} 个竞赛)\n`);
  
  return index;
}

/**
 * 获取竞赛 leaderboard（带重试）
 * @param {string} contestId - 竞赛 ID
 * @param {number} maxRetries - 最大重试次数
 */
async function fetchLeaderboard(contestId, maxRetries = 3) {
  console.log(`🏆 获取竞赛 ${contestId} 的排行榜...`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const url = `${BASE_URL}/contests/${contestId}/leaderboard?limit=50&offset=0&includeUserPosition=true`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const leaderboard = data.leaderboard || data || [];
      
      console.log(`✅ 获取成功（${leaderboard.length} 条记录）`);
      return leaderboard;
      
    } catch (error) {
      console.error(`⚠️  重试 ${i + 1}/${maxRetries}: ${contestId} - ${error.message}`);
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      await sleep(2000 * (i + 1)); // 指数退避
    }
  }
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
 * 批量获取 leaderboard（带延迟控制）
 * @param {Array<string>} contestIds - 竞赛 ID 列表
 * @param {number} batchSize - 每批数量
 * @param {number} batchDelay - 批间延迟（毫秒）
 */
async function fetchLeaderboardsBatch(contestIds, batchSize = 10, batchDelay = 3000) {
  console.log(`📊 批量获取 ${contestIds.length} 个排行榜（每批 ${batchSize} 个）...\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < contestIds.length; i += batchSize) {
    const batch = contestIds.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(contestIds.length / batchSize);
    
    console.log(`📦 批次 ${batchNum}/${totalBatches}`);
    
    await Promise.all(batch.map(async (contestId) => {
      try {
        if (leaderboardExists(contestId)) {
          console.log(`  ⏭️  跳过 ${contestId}（已存在）`);
          return;
        }
        
        const contest = readJson(
          path.join(process.cwd(), 'data', 'contests', `${contestId}.json`)
        );
        
        if (!contest) {
          console.log(`  ⚠️  跳过 ${contestId}（竞赛信息不存在）`);
          failCount++;
          return;
        }
        
        const leaderboard = await fetchLeaderboard(contestId);
        saveLeaderboard(contestId, contest.name, contest.endDate, leaderboard);
        successCount++;
        
      } catch (error) {
        console.error(`  ❌ ${contestId}: ${error.message}`);
        failCount++;
      }
    }));
    
    console.log(`   进度：${Math.min(i + batchSize, contestIds.length)}/${contestIds.length}\n`);
    
    if (i + batchSize < contestIds.length) {
      console.log(`⏸️  等待 ${batchDelay/1000}秒...\n`);
      await sleep(batchDelay);
    }
  }
  
  console.log(`\n📊 完成：成功 ${successCount} 个，失败 ${failCount} 个\n`);
  return { success: successCount, failed: failCount };
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
      await sleep(300);
      const url = `${BASE_URL}/moki/${tokenId}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const details = await response.json();
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
  
  generateMokiManifest();
  return { fetched, skipped };
}

/**
 * 主流程：获取全量竞赛（初始化）
 */
async function mainFetchAll() {
  console.log('🚀 开始全量获取竞赛数据...\n');
  
  try {
    // 1. 获取全量竞赛
    const allContests = await fetchAllContests();
    
    // 2. 保存竞赛
    saveAllContests(allContests);
    
    // 3. 筛选最近 7 天 COMPLETED 竞赛
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentCompleted = allContests.filter(c => 
      (c.contestStatus === 'COMPLETED' || c.status === 'COMPLETED') && 
      new Date(c.endDate).getTime() >= sevenDaysAgo
    );
    
    console.log(`📅 最近 7 天已完成竞赛：${recentCompleted.length} 个\n`);
    
    // 4. 批量获取 leaderboard
    if (recentCompleted.length > 0) {
      const contestIds = recentCompleted.map(c => c._id);
      await fetchLeaderboardsBatch(contestIds, 10, 3000);
    }
    
    // 5. 筛选 LIVE 竞赛，创建调度任务
    const liveContests = allContests.filter(c => 
      c.contestStatus === 'LIVE' || c.status === 'LIVE'
    );
    
    console.log(`🔴 LIVE 竞赛：${liveContests.length} 个\n`);
    
    const scheduler = new TaskScheduler();
    for (const contest of liveContests) {
      const executeAt = calculateLeaderboardTime(contest.endDate, 8);
      scheduler.addTask(contest._id, executeAt);
    }
    
    // 6. 恢复任务调度
    await scheduler.restoreTasks(async (contestId) => {
      const contest = readJson(
        path.join(process.cwd(), 'data', 'contests', `${contestId}.json`)
      );
      
      if (!contest) throw new Error('竞赛信息不存在');
      
      const leaderboard = await fetchLeaderboard(contestId);
      saveLeaderboard(contestId, contest.name, contest.endDate, leaderboard);
    });
    
    console.log('\n✅ 初始化完成！\n');
    return { total: allContests.length, live: liveContests.length };
    
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  }
}

/**
 * 主流程：增量获取竞赛（定时任务）
 */
async function mainFetchIncremental() {
  console.log('🚀 开始增量获取竞赛数据...\n');
  
  try {
    // 1. 增量获取新竞赛
    const newContests = await fetchIncrementalContests();
    
    if (newContests.length > 0) {
      saveAllContests(newContests);
    }
    
    // 2. 筛选新 LIVE 竞赛，创建调度任务
    const liveContests = newContests.filter(c => 
      c.contestStatus === 'LIVE' || c.status === 'LIVE'
    );
    
    if (liveContests.length > 0) {
      console.log(`🔴 新 LIVE 竞赛：${liveContests.length} 个\n`);
      
      const scheduler = new TaskScheduler();
      for (const contest of liveContests) {
        const executeAt = calculateLeaderboardTime(contest.endDate, 8);
        scheduler.addTask(contest._id, executeAt);
      }
    }
    
    // 3. 执行到期的 leaderboard 任务
    const scheduler = new TaskScheduler();
    const result = await scheduler.executeDueTasks(async (contestId) => {
      const contest = readJson(
        path.join(process.cwd(), 'data', 'contests', `${contestId}.json`)
      );
      
      if (!contest) throw new Error('竞赛信息不存在');
      
      const leaderboard = await fetchLeaderboard(contestId);
      saveLeaderboard(contestId, contest.name, contest.endDate, leaderboard);
    });
    
    console.log(`\n📊 任务执行：成功 ${result.executed} 个，失败 ${result.failed} 个\n`);
    console.log('✅ 增量获取完成！\n');
    
    return { new: newContests.length, live: liveContests.length, ...result };
    
  } catch (error) {
    console.error('❌ 增量获取失败:', error.message);
    process.exit(1);
  }
}

/**
 * 主流程：抓取指定竞赛的 leaderboard
 */
async function mainFetchLeaderboards(contestIds) {
  console.log('🚀 开始抓取排行榜...\n');
  
  if (!contestIds || contestIds.length === 0) {
    console.log('没有需要抓取的排行榜');
    return;
  }
  
  await fetchLeaderboardsBatch(contestIds, 10, 3000);
  console.log('\n✅ 排行榜抓取完成');
}

// CLI 入口
const args = process.argv.slice(2);
const mode = args[0];

if (mode === '--all') {
  // 全量获取（初始化）
  mainFetchAll();
} else if (mode === '--incremental') {
  // 增量获取（定时任务）
  mainFetchIncremental();
} else if (mode === '--leaderboards') {
  // 抓取指定 leaderboard
  const ids = args[1]?.split(',') || [];
  mainFetchLeaderboards(ids);
} else if (mode === '--fetch-mokis') {
  // 从 leaderboard 提取 moki IDs
  const leaderboardsDir = path.join(process.cwd(), 'data', 'leaderboards');
  ensureDir(leaderboardsDir);
  
  const files = fs.readdirSync(leaderboardsDir).filter(f => f.endsWith('.json'));
  const leaderboards = files.map(f => readJson(path.join(leaderboardsDir, f))).filter(Boolean);
  
  const mokiIds = extractMokiIdsFromLeaderboards(leaderboards);
  console.log(`📋 从 ${leaderboards.length} 个排行榜中提取到 ${mokiIds.length} 个卡牌 ID\n`);
  
  fetchMokiDetails(mokiIds);
} else {
  // 默认：增量获取
  mainFetchIncremental();
}
