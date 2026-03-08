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

// 使用上海时间（UTC+8）
const shanghaiTime = new Date(new Date().getTime() + (8 * 60 * 60 * 1000));
const today = shanghaiTime.toISOString().split('T')[0];
const yesterday = new Date(shanghaiTime.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

console.log('📊 自动生成每日统计...\n');
console.log(`今日：${today}`);
console.log(`昨日：${yesterday}\n`);

// 检查是否已存在昨日统计（昨日数据不需要重复生成）
const yesterdayPath = path.join(dailyDir, `${yesterday}.json`);
let generatedYesterday = false;

// 生成昨日统计（仅当不存在时）
if (!fs.existsSync(yesterdayPath)) {
  console.log('📝 生成昨日统计...');
  generateStatsReport('daily', yesterday);
  generatedYesterday = true;
} else {
  console.log('⏭️  昨日统计已存在，跳过');
}

// 每次都要重新生成今日统计（因为可能有新的 leaderboard）
console.log('\n📝 生成/更新今日统计...');
generateStatsReport('daily', today);

// 每次都要更新 7 天汇总（确保包含最新数据）
console.log('\n📝 更新 7 天汇总...');
generateStatsReport('weekly');

console.log('\n✅ 每日统计生成完成！\n');
if (generatedYesterday) console.log(`   ✅ ${yesterday}.json (昨日，新生成)`);
console.log(`   ✅ ${today}.json (今日，已更新)`);
console.log('   ✅ summary.json (近 7 天，已更新)');
