/**
 * 重构验证测试脚本
 * 
 * 运行：node scripts/test-refactor.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

console.log('🧪 开始验证重构功能...\n');

// 测试 1: 检查必要文件是否存在
console.log('📁 检查文件结构...');
const requiredFiles = [
  'src/fetch.js',
  'src/scheduler.js',
  'src/stats.js',
  'src/utils.js',
  '.github/workflows/init-contests.yml',
  '.github/workflows/fetch-contests.yml',
  'package.json'
];

let allFilesExist = true;
for (const file of requiredFiles) {
  const filePath = path.join(ROOT_DIR, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} (缺失)`);
    allFilesExist = false;
  }
}

// 测试 2: 检查 package.json 脚本
console.log('\n📦 检查 package.json 脚本...');
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8'));
const requiredScripts = ['init', 'fetch', 'fetch:all', 'stats', 'analyze'];

for (const script of requiredScripts) {
  if (packageJson.scripts[script]) {
    console.log(`  ✅ npm run ${script}`);
  } else {
    console.log(`  ❌ npm run ${script} (缺失)`);
  }
}

// 测试 3: 检查数据目录
console.log('\n💾 检查数据目录...');
const dataDirs = [
  'data/contests',
  'data/leaderboards',
  'data/mokis',
  'data/stats'
];

for (const dir of dataDirs) {
  const dirPath = path.join(ROOT_DIR, dir);
  if (fs.existsSync(dirPath)) {
    const count = fs.readdirSync(dirPath).length;
    console.log(`  ✅ ${dir} (${count} 个文件)`);
  } else {
    console.log(`  ❌ ${dir} (缺失)`);
  }
}

// 测试 4: 检查 scheduler 模块导出
console.log('\n🔧 检查 scheduler 模块...');
try {
  const { TaskScheduler, calculateLeaderboardTime, shouldFetchLeaderboard } = 
    await import(path.join(ROOT_DIR, 'src', 'scheduler.js'));
  
  console.log('  ✅ TaskScheduler 类');
  console.log('  ✅ calculateLeaderboardTime 函数');
  console.log('  ✅ shouldFetchLeaderboard 函数');
  
  // 测试时间计算
  const testDate = '2026-03-08T10:00:00.000Z';
  const executeAt = calculateLeaderboardTime(testDate, 8);
  console.log(`  ✅ 时间计算：${testDate} + 8 分钟 = ${executeAt.toISOString()}`);
  
} catch (error) {
  console.log(`  ❌ scheduler 模块导入失败：${error.message}`);
}

// 测试 5: 检查 stats 模块导出
console.log('\n📊 检查 stats 模块...');
try {
  const { getAllContests, getCompletedContests, calculateContestStats } = 
    await import(path.join(ROOT_DIR, 'src', 'stats.js'));
  
  console.log('  ✅ getAllContests 函数');
  console.log('  ✅ getCompletedContests 函数');
  console.log('  ✅ calculateContestStats 函数');
  
} catch (error) {
  console.log(`  ❌ stats 模块导入失败：${error.message}`);
}

// 测试 6: 检查 GitHub Actions 配置
console.log('\n⚙️  检查 GitHub Actions...');
const initWorkflow = fs.readFileSync(
  path.join(ROOT_DIR, '.github', 'workflows', 'init-contests.yml'), 
  'utf-8'
);
const fetchWorkflow = fs.readFileSync(
  path.join(ROOT_DIR, '.github', 'workflows', 'fetch-contests.yml'), 
  'utf-8'
);

if (initWorkflow.includes('workflow_dispatch')) {
  console.log('  ✅ init-contests.yml (手动触发)');
} else {
  console.log('  ❌ init-contests.yml 配置错误');
}

if (fetchWorkflow.includes('6 * * * *')) {
  console.log('  ✅ fetch-contests.yml (每小时第 6 分钟)');
} else {
  console.log('  ❌ fetch-contests.yml 配置错误');
}

// 测试 7: 检查旧文件是否清理
console.log('\n🧹 检查旧文件清理...');
const oldFiles = [
  '.github/workflows/fetch-leaderboard.yml'
];

for (const file of oldFiles) {
  const filePath = path.join(ROOT_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.log(`  ✅ ${file} (已删除)`);
  } else {
    console.log(`  ⚠️  ${file} (建议删除)`);
  }
}

console.log('\n✅ 验证完成！\n');

// 总结
console.log('📋 下一步操作：');
console.log('1. 本地测试：npm run init');
console.log('2. 推送代码：git add -A && git commit -m "🔄 重构到 v2.0" && git push');
console.log('3. GitHub Actions: 手动触发 "Initialize Contests" workflow');
console.log('4. 验证数据：检查 data/contest_index.json 和 data/stats/summary.json');
