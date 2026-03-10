/**
 * 原始数据持久化服务
 * 保存完整的 API 响应，便于后续分析和回溯
 */

import fs from 'fs';
import path from 'path';
import type { RawDataRecord, Contest, ContestWithDetails } from '../types/index.js';
import { writeJson, ensureDir } from '../utils/fs.js';

const DATA_DIR_NAME = process.env.DATA_DIR || 'data';
const DATA_DIR = path.join(process.cwd(), DATA_DIR_NAME);
const RAW_DIR = path.join(DATA_DIR, 'raw');

/**
 * 保存原始竞赛数据
 */
export function saveRawContest(contest: Contest, source: string = '/api/contests'): void {
  const record: RawDataRecord = {
    type: 'contest',
    id: contest._id,
    fetchedAt: new Date().toISOString(),
    data: contest as any,
    source
  };
  
  const filePath = path.join(RAW_DIR, 'contests', `${contest._id}.json`);
  ensureDir(path.dirname(filePath));
  writeJson(filePath, record);
}

/**
 * 保存原始排行榜数据
 */
export function saveRawLeaderboard(
  contestId: string,
  leaderboard: any,
  source: string = '/api/contests/{id}/leaderboard'
): void {
  const record: RawDataRecord = {
    type: 'leaderboard',
    id: contestId,
    fetchedAt: new Date().toISOString(),
    data: leaderboard,
    source
  };
  
  const filePath = path.join(RAW_DIR, 'leaderboards', `${contestId}.json`);
  ensureDir(path.dirname(filePath));
  writeJson(filePath, record);
}

/**
 * 保存竞赛详情数据
 */
export function saveRawContestDetails(
  contestId: string,
  details: ContestWithDetails,
  source: string = '/api/contests/{id}'
): void {
  const record: RawDataRecord = {
    type: 'contest_details',
    id: contestId,
    fetchedAt: new Date().toISOString(),
    data: details as any,
    source
  };
  
  const filePath = path.join(RAW_DIR, 'details', `${contestId}.json`);
  ensureDir(path.dirname(filePath));
  writeJson(filePath, record);
}

/**
 * 批量保存原始数据
 */
export function saveBatchRawData(
  records: RawDataRecord[],
  onProgress?: (current: number, total: number) => void
): void {
  console.log(`💾 保存 ${records.length} 条原始数据...\n`);
  
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const subDir = record.type === 'contest' ? 'contests' 
      : record.type === 'leaderboard' ? 'leaderboards' 
      : 'details';
    
    const filePath = path.join(RAW_DIR, subDir, `${record.id}.json`);
    ensureDir(path.dirname(filePath));
    writeJson(filePath, record);
    
    if (onProgress) {
      onProgress(i + 1, records.length);
    }
  }
  
  console.log(`✅ 原始数据保存完成\n`);
}

/**
 * 获取原始数据
 */
export function getRawData<T = any>(type: 'contest' | 'leaderboard' | 'contest_details', id: string): T | null {
  const subDir = type === 'contest' ? 'contests' 
    : type === 'leaderboard' ? 'leaderboards' 
    : 'details';
  
  const filePath = path.join(RAW_DIR, subDir, `${id}.json`);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const record = JSON.parse(content) as RawDataRecord;
    return record.data as T;
  } catch (error) {
    console.error(`读取原始数据失败 ${filePath}:`, error);
    return null;
  }
}

/**
 * 列出所有原始数据记录
 */
export function listRawData(type?: 'contest' | 'leaderboard' | 'contest_details'): RawDataRecord[] {
  const subDir = type ? (type === 'contest' ? 'contests' : type === 'leaderboard' ? 'leaderboards' : 'details') : '';
  const dirPath = path.join(RAW_DIR, subDir);
  
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  return files
    .map(f => {
      try {
        const content = fs.readFileSync(path.join(dirPath, f), 'utf-8');
        return JSON.parse(content) as RawDataRecord;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as RawDataRecord[];
}

/**
 * 获取原始数据统计
 */
export function getRawDataStats(): {
  contests: number;
  leaderboards: number;
  details: number;
  total: number;
  lastUpdated?: string;
} {
  const stats: {
    contests: number;
    leaderboards: number;
    details: number;
    total: number;
    lastUpdated?: string;
  } = {
    contests: 0,
    leaderboards: 0,
    details: 0,
    total: 0
  };
  
  const contestsDir = path.join(RAW_DIR, 'contests');
  if (fs.existsSync(contestsDir)) {
    stats.contests = fs.readdirSync(contestsDir).filter(f => f.endsWith('.json')).length;
  }
  
  const leaderboardsDir = path.join(RAW_DIR, 'leaderboards');
  if (fs.existsSync(leaderboardsDir)) {
    stats.leaderboards = fs.readdirSync(leaderboardsDir).filter(f => f.endsWith('.json')).length;
  }
  
  const detailsDir = path.join(RAW_DIR, 'details');
  if (fs.existsSync(detailsDir)) {
    stats.details = fs.readdirSync(detailsDir).filter(f => f.endsWith('.json')).length;
  }
  
  stats.total = stats.contests + stats.leaderboards + stats.details;
  
  // 获取最新更新时间
  const allRecords = listRawData();
  if (allRecords.length > 0) {
    const latest = allRecords.sort((a, b) => 
      new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()
    )[0];
    stats.lastUpdated = latest.fetchedAt;
  }
  
  return stats;
}

export default {
  saveRawContest,
  saveRawLeaderboard,
  saveRawContestDetails,
  saveBatchRawData,
  getRawData,
  listRawData,
  getRawDataStats
};
