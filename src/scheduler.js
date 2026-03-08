/**
 * 任务调度器
 * 负责管理 leaderboard 抓取任务的创建、执行和持久化
 */

import fs from 'fs';
import path from 'path';
import { readJson, writeJson, ensureDir, sleep } from './utils.js';

const TASKS_FILE = path.join(process.cwd(), 'data', 'pending_tasks.json');

/**
 * 任务队列格式
 * {
 *   version: 1,
 *   updatedAt: '2026-03-08T11:00:00.000Z',
 *   tasks: [
 *     {
 *       id: 'task_69ab46612fd78d57b701b5cd',
 *       contestId: '69ab46612fd78d57b701b5cd',
 *       type: 'fetchLeaderboard',
 *       executeAt: '2026-03-08T17:08:00.000Z',
 *       status: 'pending',
 *       retryCount: 0,
 *       createdAt: '2026-03-08T13:00:00.000Z'
 *     }
 *   ]
 * }
 */

export class TaskScheduler {
  constructor(tasksFile = TASKS_FILE) {
    this.tasksFile = tasksFile;
    this.tasks = this.loadTasks();
  }

  /**
   * 加载任务队列
   */
  loadTasks() {
    ensureDir(path.dirname(this.tasksFile));
    
    if (!fs.existsSync(this.tasksFile)) {
      return { version: 1, updatedAt: new Date().toISOString(), tasks: [] };
    }
    
    const data = readJson(this.tasksFile);
    return data || { version: 1, updatedAt: new Date().toISOString(), tasks: [] };
  }

  /**
   * 保存任务队列
   */
  saveTasks() {
    this.tasks.updatedAt = new Date().toISOString();
    writeJson(this.tasksFile, this.tasks);
  }

  /**
   * 添加任务
   * @param {string} contestId - 竞赛 ID
   * @param {number|Date} executeAt - 执行时间（时间戳或 Date 对象）
   */
  addTask(contestId, executeAt) {
    // 检查是否已存在
    const existing = this.tasks.tasks.find(t => t.contestId === contestId);
    if (existing) {
      console.log(`⏭️  任务已存在：${contestId}`);
      return existing;
    }

    const task = {
      id: `task_${contestId}`,
      contestId,
      type: 'fetchLeaderboard',
      executeAt: new Date(executeAt).toISOString(),
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString()
    };

    this.tasks.tasks.push(task);
    this.saveTasks();
    console.log(`✅ 添加任务：${contestId} @ ${task.executeAt}`);
    return task;
  }

  /**
   * 获取所有到期任务
   */
  getDueTasks() {
    const now = Date.now();
    return this.tasks.tasks.filter(t => 
      t.status === 'pending' && new Date(t.executeAt).getTime() <= now
    );
  }

  /**
   * 执行到期任务
   * @param {Function} executeFn - 执行函数 (contestId) => Promise
   */
  async executeDueTasks(executeFn) {
    const dueTasks = this.getDueTasks();
    
    if (dueTasks.length === 0) {
      console.log('⏰ 无到期任务');
      return { executed: 0, failed: 0 };
    }

    console.log(`⏰ 执行 ${dueTasks.length} 个到期任务...`);
    
    let executed = 0;
    let failed = 0;

    for (const task of dueTasks) {
      try {
        await executeFn(task.contestId);
        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        executed++;
        console.log(`✅ 任务完成：${task.contestId}`);
      } catch (error) {
        task.retryCount++;
        task.lastError = error.message;
        failed++;
        console.error(`❌ 任务失败：${task.contestId} - ${error.message}`);
        
        // 重试超过 3 次标记为失败
        if (task.retryCount >= 3) {
          task.status = 'failed';
          task.failedAt = new Date().toISOString();
        } else {
          // 重新安排执行时间（1 分钟后）
          task.executeAt = new Date(Date.now() + 60 * 1000).toISOString();
        }
      }

      await sleep(500); // 避免频率限制
    }

    // 清理已完成和失败的任务
    this.tasks.tasks = this.tasks.tasks.filter(t => t.status === 'pending');
    this.saveTasks();

    return { executed, failed };
  }

  /**
   * 启动时恢复任务
   * @param {Function} executeFn - 执行函数 (contestId) => Promise
   */
  async restoreTasks(executeFn) {
    const now = Date.now();
    let restored = 0;
    let expired = 0;

    for (const task of this.tasks.tasks) {
      const executeAt = new Date(task.executeAt).getTime();
      const delay = executeAt - now;

      if (delay <= 0) {
        // 已过期，立即执行
        console.log(`⚠️  任务已过期，立即执行：${task.contestId}`);
        try {
          await executeFn(task.contestId);
          task.status = 'completed';
          expired++;
        } catch (error) {
          console.error(`❌ 过期任务执行失败：${task.contestId} - ${error.message}`);
          task.retryCount++;
        }
      } else {
        // 设置定时器
        const delaySeconds = Math.round(delay / 1000);
        console.log(`⏰ 计划任务：${task.contestId} 在 ${delaySeconds}秒后执行`);
        
        setTimeout(async () => {
          try {
            await executeFn(task.contestId);
            task.status = 'completed';
          } catch (error) {
            console.error(`❌ 定时任务失败：${task.contestId} - ${error.message}`);
            task.retryCount++;
          }
          
          // 清理已完成的任务
          this.tasks.tasks = this.tasks.tasks.filter(t => t.status === 'pending');
          this.saveTasks();
        }, delay);
        
        restored++;
      }
    }

    this.saveTasks();
    console.log(`\n📊 任务恢复完成：${restored} 个待执行，${expired} 个已过期`);
    return { restored, expired };
  }

  /**
   * 获取任务统计
   */
  getStats() {
    const now = Date.now();
    return {
      total: this.tasks.tasks.length,
      pending: this.tasks.tasks.filter(t => t.status === 'pending').length,
      due: this.getDueTasks().length,
      scheduled: this.tasks.tasks.filter(t => 
        t.status === 'pending' && new Date(t.executeAt).getTime() > now
      ).length
    };
  }

  /**
   * 清除旧任务（超过 7 天）
   */
  cleanup(oldDays = 7) {
    const cutoff = Date.now() - oldDays * 24 * 60 * 60 * 1000;
    const before = this.tasks.tasks.length;
    
    this.tasks.tasks = this.tasks.tasks.filter(t => 
      new Date(t.createdAt).getTime() > cutoff
    );
    
    const removed = before - this.tasks.tasks.length;
    this.saveTasks();
    
    if (removed > 0) {
      console.log(`🧹 清理 ${removed} 个旧任务`);
    }
    
    return removed;
  }
}

/**
 * 计算 leaderboard 抓取时间（endDate + buffer）
 * @param {string} endDate - 竞赛结束时间 ISO 字符串
 * @param {number} bufferMinutes - 缓冲时间（分钟）
 */
export function calculateLeaderboardTime(endDate, bufferMinutes = 8) {
  return new Date(new Date(endDate).getTime() + bufferMinutes * 60 * 1000);
}

/**
 * 检查是否应该抓取 leaderboard
 * @param {Object} contest - 竞赛对象
 */
export function shouldFetchLeaderboard(contest) {
  if (contest.contestStatus !== 'COMPLETED') return false;
  if (contest.leaderboardFetched) return false;
  
  const now = Date.now();
  const executeAt = calculateLeaderboardTime(contest.endDate, 8).getTime();
  return now >= executeAt;
}

export default TaskScheduler;
