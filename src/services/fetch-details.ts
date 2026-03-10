/**
 * 奖池数据获取服务
 * 获取竞赛详细信息（奖池结构、阵容配置等）
 */

import { ContestDetailsApi } from '../api/contest-details.js';
import { saveRawContestDetails } from './raw-data.js';
import { readJson, writeJson } from '../utils/fs.js';
import path from 'path';
import type { ContestWithDetails } from '../types/index.js';

const BASE_URL = 'https://fantasy.grandarena.gg/api';
const DATA_DIR_NAME = process.env.DATA_DIR || 'data';
const DATA_DIR = path.join(process.cwd(), DATA_DIR_NAME);

const detailsApi = new ContestDetailsApi(BASE_URL);

/**
 * 获取竞赛详情并保存
 */
export async function fetchAndSaveContestDetails(contestId: string): Promise<ContestWithDetails | null> {
  try {
    console.log(`📋 获取竞赛详情：${contestId}`);
    
    const details = await detailsApi.fetchDetails(contestId);
    
    // 保存原始数据
    saveRawContestDetails(contestId, details, '/api/contests/{id}');
    
    // 保存到 data/contests/（合并现有数据）
    const existingPath = path.join(DATA_DIR, 'contests', `${contestId}.json`);
    const existing = readJson(existingPath);
    
    if (existing) {
      const merged = {
        ...existing,
        detailedPrizePool: (details as any).prizePool,
        detailedPrizeStructure: (details as any).prizeStructure,
        detailedLineupConfig: (details as any).lineupConfig,
        detailsFetchedAt: new Date().toISOString()
      };
      
      writeJson(existingPath, merged);
    }
    
    console.log(`✅ 详情获取成功：${details.name}`);
    return details;
    
  } catch (error) {
    console.error(`❌ 获取详情失败：${contestId} - ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * 批量获取竞赛详情
 */
export async function fetchBatchContestDetails(
  contestIds: string[],
  options?: {
    batchSize?: number;
    batchDelay?: number;
  }
): Promise<void> {
  const { batchSize = 10, batchDelay = 3000 } = options || {};
  
  console.log(`📊 批量获取 ${contestIds.length} 个竞赛详情（每批 ${batchSize} 个）...\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < contestIds.length; i += batchSize) {
    const batch = contestIds.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(contestIds.length / batchSize);
    
    console.log(`📦 批次 ${batchNum}/${totalBatches}`);
    
    await Promise.all(
      batch.map(id => fetchAndSaveContestDetails(id).then(result => {
        if (result) successCount++;
        else failCount++;
      }))
    );
    
    console.log(`   进度：${Math.min(i + batchSize, contestIds.length)}/${contestIds.length}\n`);
    
    if (i + batchSize < contestIds.length) {
      console.log(`⏸️  等待 ${batchDelay/1000}秒...\n`);
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }
  
  console.log(`\n📊 完成：成功 ${successCount} 个，失败 ${failCount} 个\n`);
}

/**
 * CLI 入口
 */
const args = process.argv.slice(2);
const mode = args[0];

if (mode === '--single') {
  const contestId = args[1];
  if (!contestId) {
    console.error('用法：fetch-details --single <contest_id>');
    process.exit(1);
  }
  fetchAndSaveContestDetails(contestId);
} else if (mode === '--batch') {
  const ids = args[1]?.split(',') || [];
  if (ids.length === 0) {
    console.error('用法：fetch-details --batch <id1,id2,id3>');
    process.exit(1);
  }
  fetchBatchContestDetails(ids);
} else {
  console.log('用法:');
  console.log('  fetch-details --single <id>    获取单个竞赛详情');
  console.log('  fetch-details --batch <ids>    批量获取竞赛详情');
  process.exit(0);
}
