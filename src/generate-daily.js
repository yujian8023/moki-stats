/**
 * 生成每日统计报告
 */

import { generateStatsReport } from './leaderboard.js';

const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

console.log(`📊 生成每日统计...\n`);
console.log(`今日：${today}`);
console.log(`昨日：${yesterday}\n`);

// 生成今日统计
console.log('生成今日统计...');
generateStatsReport('daily', today);

// 生成昨日统计
console.log('\n生成昨日统计...');
generateStatsReport('daily', yesterday);

// 生成昨日快捷方式
console.log('\n生成昨日快捷方式...');
generateStatsReport('yesterday');

console.log('\n✅ 每日统计生成完成！\n');
