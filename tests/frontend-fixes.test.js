/**
 * Moki-Stats 前端修复测试
 * 
 * 测试用例：
 * 1. 统计卡片字段映射验证
 * 2. 时间选项完整性验证
 * 3. 搜索功能验证
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取前端 HTML 文件
const htmlPath = path.join(__dirname, '../docs/index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// 读取后端统计数据示例
const statsPath = path.join(__dirname, '../data/stats/summary.json');
const statsContent = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));

// 测试结果
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, condition, details = '') {
  const result = {
    name,
    passed: condition,
    details
  };
  
  results.tests.push(result);
  if (condition) {
    results.passed++;
    console.log(`✅ ${name}`);
  } else {
    results.failed++;
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
  }
}

console.log('🧪 Moki-Stats 前端修复测试\n');
console.log('='.repeat(50));

// ========== 测试 1: 统计卡片字段映射 ==========
console.log('\n📋 测试组 1: 统计卡片字段映射\n');

// 卡片 1: 总参赛人数
test(
  '卡片 1: 总参赛人数 - 字段绑定正确',
  htmlContent.includes('总参赛人数') && htmlContent.includes('stats.totalPlayers'),
  '应显示 "总参赛人数" 并绑定 stats.totalPlayers'
);

// 卡片 2: 总卡牌数据（修复后）
test(
  '卡片 2: 总卡牌数据 - 标签已更新',
  htmlContent.includes('总卡牌数据'),
  '应将 "有卡牌数据" 改为 "总卡牌数据"'
);

test(
  '卡片 2: 总卡牌数据 - 字段绑定正确',
  htmlContent.includes('stats.totalCards') || htmlContent.includes('stats.totalWithCards'),
  '应绑定 stats.totalCards 或 stats.totalWithCards'
);

// 卡片 3: 不同卡牌
test(
  '卡片 3: 不同卡牌 - 字段绑定正确',
  htmlContent.includes('不同卡牌') && htmlContent.includes('cardCount'),
  '应显示 "不同卡牌" 并绑定 cardCount'
);

// 卡片 4: 总奖池（修复后）
test(
  '卡片 4: 总奖池 - 标签已更新',
  htmlContent.includes('总奖池'),
  '应将 "热门阵容" 改为 "总奖池"'
);

test(
  '卡片 4: 总奖池 - 字段绑定正确',
  htmlContent.includes('stats.totalPrizePool') || 
  htmlContent.includes('stats.contestStats?.totalPrizePool') ||
  htmlContent.includes('contestStats.totalPrizePool'),
  '应绑定 stats.totalPrizePool 或 stats.contestStats.totalPrizePool'
);

// ========== 测试 2: 时间选项完整性 ==========
console.log('\n📅 测试组 2: 时间选项完整性\n');

test(
  '时间选项: 包含"昨日"',
  htmlContent.includes('昨日'),
  '应包含昨日选项'
);

test(
  '时间选项: 包含"近 7 天"',
  htmlContent.includes('近 7 天'),
  '应包含近 7 天选项'
);

test(
  '时间选项: 包含"今日"',
  htmlContent.includes('今日'),
  '应包含今日选项'
);

test(
  '时间选项: 包含"近 30 天"',
  htmlContent.includes('近 30 天'),
  '应添加近 30 天选项'
);

test(
  '时间选项: 包含 last_30_days 值',
  htmlContent.includes('last_30_days') || htmlContent.includes('30days'),
  'timeRanges 数组应包含 last_30_days 或 30days 值'
);

// ========== 测试 3: 搜索功能 ==========
console.log('\n🔍 测试组 3: 搜索功能\n');

test(
  '搜索框: 存在搜索输入框',
  htmlContent.includes('type="search"') || htmlContent.includes('v-model="searchQuery"') || htmlContent.includes('searchQuery'),
  '应添加搜索输入框组件'
);

test(
  '搜索框: 存在搜索占位符',
  htmlContent.includes('搜索') || htmlContent.includes('竞赛名称'),
  '搜索框应有提示文本'
);

test(
  '搜索功能: loadStats 方法传递搜索参数',
  htmlContent.includes('contestName') || htmlContent.includes('searchQuery'),
  'loadStats 方法应将搜索参数传递给后端'
);

// ========== 测试 4: 后端数据结构验证 ==========
console.log('\n📊 测试组 4: 后端数据结构验证\n');

test(
  '后端数据: 包含 contestStats 对象',
  statsContent.contestStats !== undefined,
  'summary.json 应包含 contestStats 对象'
);

test(
  '后端数据: 包含 totalPrizePool 字段',
  statsContent.contestStats?.totalPrizePool !== undefined,
  'contestStats 应包含 totalPrizePool 字段'
);

test(
  '后端数据: 包含 totalPlayers 字段',
  statsContent.contestStats?.totalPlayers !== undefined,
  'contestStats 应包含 totalPlayers 字段'
);

// ========== 测试结果汇总 ==========
console.log('\n' + '='.repeat(50));
console.log(`\n📊 测试结果：${results.passed} 通过，${results.failed} 失败\n`);

if (results.failed > 0) {
  console.log('⚠️  需要修复的问题：\n');
  results.tests
    .filter(t => !t.passed)
    .forEach(t => {
      console.log(`  - ${t.name}`);
      if (t.details) console.log(`    ${t.details}`);
    });
  process.exit(1);
} else {
  console.log('✅ 所有测试通过！\n');
  process.exit(0);
}
