/**
 * 文件系统工具函数
 */

import fs from 'fs';
import path from 'path';

/**
 * 读取 JSON 文件
 */
export function readJson<T = any>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`读取文件失败 ${filePath}:`, error);
    return null;
  }
}

/**
 * 写入 JSON 文件
 */
export function writeJson<T = any>(filePath: string, data: T): void {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`写入文件失败 ${filePath}:`, error);
    throw error;
  }
}

/**
 * 确保目录存在
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 获取 ISO 日期字符串（UTC+8）
 */
export function getISODate(date: Date = new Date()): string {
  const utc8 = new Date(date.getTime() + (8 * 3600 * 1000));
  return utc8.toISOString().split('T')[0];
}

/**
 * 获取 ISO 周数
 */
export function getISOWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

/**
 * 检查文件是否存在
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * 删除文件
 */
export function deleteFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * 列出目录中的所有 JSON 文件
 */
export function listJsonFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
}

/**
 * 读取目录中的所有 JSON 文件
 */
export function readAllJsonFiles<T = any>(dirPath: string): T[] {
  const files = listJsonFiles(dirPath);
  return files
    .map(f => readJson<T>(path.join(dirPath, f)))
    .filter(Boolean) as T[];
}

/**
 * 延迟函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 格式化数字（添加千分位）
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * 格式化奖池（GEMs）
 */
export function formatPrizePool(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(2)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toString();
}
