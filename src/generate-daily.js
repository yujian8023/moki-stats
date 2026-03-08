/**
 * 自动生成每日统计报告
 * 
 * 功能：
 * 1. 检测当前日期，生成今日统计
 * 2. 检测是否需要生成昨日统计（跨天时）
 * 3. 自动更新 7 天汇总
 */

import { generateStatsReport, getRecentContests } from './leaderboard.js';
import fs from 'fs';
import path from 'path';

const DATA_DIR_NAME = process.env.DATA_DIR || 'data';
const DATA_DIR = path.join(process.cwd(), DATA_DIR_NAME);
const statsDir = path.join(DATA_DIR, 'stats');
const dailyDir = path.join(statsDir, 'daily');

// 确保目录存在
[dailyDir, statsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

console.log('📊 自动生成每日统计...\n');
console.log(`今日：${today}`);
console.log(`昨日：${yesterday}\n`);

// 检查是否已存在今日统计
const todayPath = path.join(dailyDir, `${today}.json`);
const yesterdayPath = path.join(dailyDir, `${yesterday}.json`);

let generatedToday = false;
let generatedYesterday = false;

// 生成今日统计
if (!fs.existsSync(todayPath)) {
  console.log('📝 生成今日统计...');
  generateStatsReport('daily', today);
  generatedToday = true;
} else {
  console.log('⏭️  今日统计已存在，跳过');
}

// 生成昨日统计
if (!fs.existsSync(yesterdayPath)) {
  console.log('\n📝 生成昨日统计...');
  generateStatsReport('daily', yesterday);
  generatedYesterday = true;
} else {
  console.log('\n⏭️  昨日统计已存在，跳过');
}

// 重新生成 7 天汇总（确保包含最新数据）
console.log('\n📝 更新 7 天汇总...');
generateStatsReport('weekly');

console.log('\n✅ 每日统计生成完成！\n');
console.log('📋 生成报告:');
if (generatedToday) console.log(`   ✅ ${today}.json (今日)`);
if (generatedYesterday) console.log(`   ✅ ${yesterday}.json (昨日)`);
console.log('   ✅ summary.json (近 7 天)');
