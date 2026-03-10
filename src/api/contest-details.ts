/**
 * Contest Details API 客户端
 * 获取单个竞赛的详细信息（奖池结构、阵容配置等）
 */

import fetch from 'node-fetch';
import type { ContestWithDetails } from '../types/index.js';
import { ApiError, RateLimitError } from '../utils/errors.js';

const BASE_URL = 'https://fantasy.grandarena.gg/api';

export interface FetchDetailsOptions {
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * Contest Details API 客户端
 */
export class ContestDetailsApi {
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(
    baseUrl: string = BASE_URL,
    options: FetchDetailsOptions = {}
  ) {
    this.baseUrl = baseUrl;
    this.timeout = options.timeout || 10000;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 2000;
  }

  /**
   * 获取竞赛详细信息
   * GET /contests/{_id}
   */
  async fetchDetails(contestId: string): Promise<ContestWithDetails> {
    const url = `${this.baseUrl}/contests/${contestId}`;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
            throw new RateLimitError('API 频率限制', retryAfter);
          }
          throw new ApiError(`获取竞赛详情失败：${response.status}`, response.status, url);
        }

        const data = await response.json();
        
        // 转换为 ContestWithDetails 格式
        return {
          ...data,
          _id: contestId,
          detailedPrizePool: data.prizePool,
          detailedPrizeStructure: data.prizeStructure,
          detailedLineupConfig: data.lineupConfig,
          detailsFetchedAt: new Date().toISOString()
        };

      } catch (error) {
        if (error instanceof RateLimitError && attempt < this.retryAttempts) {
          console.log(`⏳ 频率限制，等待 ${(error as RateLimitError).retryAfter}秒后重试...`);
          await this.sleep((error as RateLimitError).retryAfter * 1000);
          continue;
        }

        if (error instanceof ApiError && attempt < this.retryAttempts) {
          console.log(`⚠️  重试 ${attempt}/${this.retryAttempts}: ${contestId} - ${(error as Error).message}`);
          await this.sleep(this.retryDelay * attempt);
          continue;
        }

        // 最后一次尝试失败，返回带错误的结果
        return {
          _id: contestId,
          name: 'Unknown',
          contestStatus: 'COMPLETED',
          format: 'UNKNOWN',
          entryFee: 0,
          prizePool: 0,
          entries: 0,
          startDate: '',
          endDate: '',
          featured: false,
          isPrivate: false,
          leaderboardFetched: false,
          fetchedAt: new Date().toISOString(),
          detailsError: error instanceof Error ? error.message : String(error)
        } as ContestWithDetails;
      }
    }

    throw new Error('获取竞赛详情失败：超过最大重试次数');
  }

  /**
   * 批量获取竞赛详情
   */
  async fetchBatch(
    contestIds: string[],
    options?: {
      batchSize?: number;
      batchDelay?: number;
      onProgress?: (current: number, total: number) => void;
    }
  ): Promise<ContestWithDetails[]> {
    const { 
      batchSize = 10, 
      batchDelay = 3000,
      onProgress
    } = options || {};

    const results: ContestWithDetails[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < contestIds.length; i += batchSize) {
      const batch = contestIds.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(contestIds.length / batchSize);

      console.log(`📦 批次 ${batchNum}/${totalBatches}`);

      const batchResults = await Promise.all(
        batch.map(id => this.fetchDetails(id))
      );

      for (const result of batchResults) {
        if (result.detailsError) {
          failCount++;
          console.log(`  ❌ ${result._id}: ${result.detailsError}`);
        } else {
          successCount++;
          console.log(`  ✅ ${result._id}: ${result.name}`);
        }
        results.push(result);
      }

      if (onProgress) {
        onProgress(Math.min(i + batchSize, contestIds.length), contestIds.length);
      }

      // 批间延迟
      if (i + batchSize < contestIds.length) {
        console.log(`⏸️  等待 ${batchDelay/1000}秒...`);
        await this.sleep(batchDelay);
      }
    }

    console.log(`\n📊 完成：成功 ${successCount} 个，失败 ${failCount} 个\n`);
    return results;
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ContestDetailsApi;
