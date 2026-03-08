/**
 * 补抓今日已结束但未抓取 leaderboard 的竞赛
 * 
 * 用法：
 * DATA_DIR=docs/data node scripts/backfill-today.js
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { readJson, writeJson, ensureDir, sleep } from '../src/utils.js';

const DATA_DIR_NAME = process.env.DATA_DIR || 'data';
const DATA_DIR = path.join(process.cwd(), DATA_DIR_NAME);
const contestsDir = path.join(DATA_DIR, 'contests');
const leaderboardsDir = path.join(DATA_DIR, 'leaderboards');

ensureDir(leaderboardsDir);

const today = new Date().toISOString().split('T')[0];
console.log(`🔍 查找今日 (${today}) 结束但未抓取 leaderboard 的竞赛...\n`);

const files = fs.readdirSync(contestsDir).filter(f => f.endsWith('.json'));
let needFetch = [];

files.forEach(file => {
  const contest = readJson(path.join(contestsDir, file));
  if (!contest || !contest.endDate) return;
  
  const endDate = contest.endDate.split('T')[0];
  const leaderboardExists = fs.existsSync(path.join(leaderboardsDir, file));
  
  if (endDate === today && !leaderboardExists) {
    needFetch.push(contest);
  }
});

console.log(`找到 ${needFetch.length} 个需要抓取的竞赛\n`);

if (needFetch.length === 0) {
  console.log('✅ 今日所有竞赛的 leaderboard 都已抓取');
  process.exit(0);
}

// 显示列表
console.log('需要抓取的竞赛:');
needFetch.forEach((c, i) => {
  console.log(`  ${i + 1}. ${c.name} (${c._id})`);
});

console.log(`\n🏆 开始抓取 leaderboard...\n`);

// 抓取 leaderboard
async function fetchLeaderboard(contestId) {
  const url = `https://fantasy.grandarena.gg/api/contests/${contestId}/leaderboard?limit=50&offset=0&includeUserPosition=true`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  // API 返回的是对象，entries 才是数组
  return data.entries || data.leaderboard || data || [];
}

function saveLeaderboard(contestId, contestName, endDate, leaderboard) {
  const filePath = path.join(leaderboardsDir, `${contestId}.json`);
  
  const saved = {
    contestId,
    contestName,
    endDate,
    fetchedAt: new Date().toISOString(),
    totalEntries: leaderboard.length,
    top50: leaderboard.map((entry, idx) => ({
      rank: idx + 1,
      playerId: entry.playerId || entry.userId || entry.player?._id || '',
      playerName: entry.playerName || entry.username || entry.player?.name || 'Unknown',
      score: entry.score || entry.points || 0,
      cardImages: entry.cardImages || []
    }))
  };
  
  writeJson(filePath, saved);
  return saved;
}

// 批量抓取
async function backfill() {
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < needFetch.length; i++) {
    const contest = needFetch[i];
    console.log(`[${i + 1}/${needFetch.length}] 抓取：${contest.name}`);
    
    try {
      const leaderboard = await fetchLeaderboard(contest._id);
      saveLeaderboard(contest._id, contest.name, contest.endDate, leaderboard);
      console.log(`  ✅ 成功 (${leaderboard.length} 条记录)`);
      success++;
      
      // 避免限流
      if (i < needFetch.length - 1) {
        await sleep(2000);
      }
    } catch (error) {
      console.log(`  ❌ 失败：${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n📊 完成：成功 ${success} 个，失败 ${failed} 个\n`);
  
  // 生成统计
  console.log('📊 生成统计报告...');
  const { generateStatsReport } = await import('../src/leaderboard.js');
  generateStatsReport('daily', today);
  generateStatsReport('weekly');
  
  console.log('\n✅ 补抓完成！\n');
}

backfill().catch(console.error);
