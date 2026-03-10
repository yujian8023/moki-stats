#!/usr/bin/env python3
"""
Moki-Stats Phase 1: 数据嗅探与映射引擎
Senior Data Engineer 数据分析脚本
"""

import json
import os
import re
from collections import defaultdict
from pathlib import Path

DATA_DIR = Path("/Users/yujian/aicoding/moki-stats/docs/data")
CONTESTS_DIR = DATA_DIR / "contests"
LEADERBOARDS_DIR = DATA_DIR / "leaderboards"
STATS_DIR = DATA_DIR / "stats"
MOKIS_DIR = DATA_DIR / "mokis"

def load_json_file(filepath):
    """加载 JSON 文件"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        return None

def analyze_contests():
    """分析竞赛数据"""
    print("=" * 60)
    print("1. 竞赛数据分析")
    print("=" * 60)
    
    contest_files = list(CONTESTS_DIR.glob("*.json"))
    print(f"竞赛文件总数：{len(contest_files)} 个")
    
    all_contests = []
    core_fields = set()
    name_samples = []
    entry_fees = defaultdict(int)
    format_types = defaultdict(int)
    
    for cf in contest_files[:50]:  # 先分析前 50 个样本
        data = load_json_file(cf)
        if data:
            all_contests.append(data)
            core_fields.update(data.keys())
            name_samples.append(data.get('name', ''))
            entry_fees[data.get('entryFee', 'N/A')] += 1
            format_types[data.get('format', 'N/A')] += 1
    
    print(f"\n核心字段列表:")
    for field in sorted(core_fields):
        print(f"  - {field}")
    
    print(f"\n竞赛类型 (format) 分布:")
    for fmt, count in sorted(format_types.items(), key=lambda x: -x[1]):
        print(f"  {fmt}: {count} 个")
    
    return all_contests, name_samples, entry_fees, format_types

def analyze_leaderboards():
    """分析排行榜数据"""
    print("\n" + "=" * 60)
    print("2. 排行榜数据分析")
    print("=" * 60)
    
    lb_files = list(LEADERBOARDS_DIR.glob("*.json"))
    print(f"排行榜文件总数：{len(lb_files)} 个")
    
    core_fields = set()
    all_moki_images = set()
    
    # 分析前 10 个样本
    for lf in lb_files[:10]:
        data = load_json_file(lf)
        if data:
            core_fields.update(data.keys())
            # 提取 cardImages
            if 'top50' in data:
                for entry in data['top50'][:5]:  # 每个排行榜前 5 名
                    if 'cardImages' in entry:
                        all_moki_images.update(entry['cardImages'])
    
    print(f"\n核心字段列表:")
    for field in sorted(core_fields):
        print(f"  - {field}")
    
    print(f"\n唯一卡牌图片 URL 数量 (样本): {len(all_moki_images)} 张")
    
    return lb_files, all_moki_images

def analyze_stats():
    """分析统计数据"""
    print("\n" + "=" * 60)
    print("3. 统计数据 (summary.json) 分析")
    print("=" * 60)
    
    summary_file = STATS_DIR / "summary.json"
    data = load_json_file(summary_file)
    
    if data:
        print(f"\n核心字段列表:")
        for key in data.keys():
            print(f"  - {key}")
        
        if 'mokiAppearances' in data:
            moki_count = len(data['mokiAppearances'])
            print(f"\n卡牌统计数量：{moki_count} 张")
            
            # 提取 mokiId -> imageUrl 映射
            moki_mapping = {}
            for moki_id, info in data['mokiAppearances'].items():
                if 'imageUrl' in info:
                    moki_mapping[moki_id] = info['imageUrl']
            
            print(f"已建立 mokiId → imageUrl 映射：{len(moki_mapping)} 条")
            return data, moki_mapping
    
    return None, {}

def extract_contest_types(name_samples):
    """从竞赛名称提取类型标识"""
    print("\n" + "=" * 60)
    print("4. 竞赛类型映射字典")
    print("=" * 60)
    
    # 定义类型提取正则
    type_patterns = [
        (r'^50/50\s', '50/50'),
        (r'^Top 20%\s', 'Top 20%'),
        (r'^Free\s', 'Free Entry'),
    ]
    
    type_counts = defaultdict(int)
    type_examples = defaultdict(list)
    
    for name in name_samples:
        matched = False
        for pattern, type_name in type_patterns:
            if re.match(pattern, name):
                type_counts[type_name] += 1
                if len(type_examples[type_name]) < 3:
                    type_examples[type_name].append(name)
                matched = True
                break
        
        if not matched:
            type_counts['Other'] += 1
            if len(type_examples['Other']) < 3:
                type_examples['Other'].append(name)
    
    print(f"\n类型标识统计:")
    for type_name, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        examples = type_examples[type_name]
        print(f"\n  {type_name}: {count} 次")
        for ex in examples:
            print(f"    示例: \"{ex}\"")
    
    return type_counts, type_examples

def analyze_entry_fees_full():
    """完整分析所有竞赛的报名费"""
    print("\n" + "=" * 60)
    print("5. 报名费完整枚举统计")
    print("=" * 60)
    
    contest_files = list(CONTESTS_DIR.glob("*.json"))
    entry_fees = defaultdict(int)
    
    for cf in contest_files:
        data = load_json_file(cf)
        if data:
            fee = data.get('entryFee', 'N/A')
            entry_fees[fee] += 1
    
    print(f"\n报名费档次统计 (共 {len(contest_files)} 个竞赛):")
    for fee in sorted(entry_fees.keys()):
        count = entry_fees[fee]
        print(f"  {fee:>8} GEMs: {count} 个竞赛")
    
    return entry_fees

def main():
    """主函数"""
    print("\n" + "=" * 60)
    print("Moki-Stats Phase 1: 数据嗅探与映射引擎")
    print("Senior Data Engineer 执行报告")
    print("=" * 60)
    
    # 1. 分析竞赛数据
    all_contests, name_samples, entry_fees_sample, format_types = analyze_contests()
    
    # 2. 分析排行榜数据
    lb_files, moki_images_sample = analyze_leaderboards()
    
    # 3. 分析统计数据
    stats_data, moki_mapping = analyze_stats()
    
    # 4. 提取竞赛类型
    type_counts, type_examples = extract_contest_types(name_samples)
    
    # 5. 完整报名费统计
    entry_fees_full = analyze_entry_fees_full()
    
    # 汇总报告
    print("\n" + "=" * 60)
    print("Phase 1 完成报告 - 汇总")
    print("=" * 60)
    
    print(f"\n### 1. 数据结构概览")
    print(f"| 数据源 | 文件数 | 核心字段 |")
    print(f"|--------|--------|----------|")
    print(f"| contests | {len(list(CONTESTS_DIR.glob('*.json')))} 个 | _id, name, entryFee, prizePool, entries, format, ... |")
    print(f"| leaderboards | {len(list(LEADERBOARDS_DIR.glob('*.json')))} 个 | contestId, contestName, top50[], endDate, ... |")
    print(f"| stats | 1 个 (summary.json) | period, totalContests, totalPlayers, mokiAppearances |")
    
    print(f"\n### 2. 竞赛类型映射字典 (基于 format 字段)")
    print(f"| 类型标识 | 出现次数 (样本) | 示例名称 |")
    print(f"|----------|----------------|----------|")
    for type_name in sorted(type_counts.keys()):
        count = type_counts[type_name]
        example = type_examples[type_name][0] if type_examples[type_name] else "N/A"
        print(f"| {type_name} | {count} 次 | \"{example[:40]}...\" |")
    
    print(f"\n### 3. 报名费枚举 (完整统计)")
    print(f"| 报名费 (GEMs) | 竞赛数量 |")
    print(f"|---------------|----------|")
    for fee in sorted(entry_fees_full.keys()):
        print(f"| {fee} | {entry_fees_full[fee]} |")
    
    print(f"\n### 4. 卡牌映射")
    print(f"- 总卡牌数量 (summary.json): {len(moki_mapping)} 张")
    print(f"- mokiId → image URL 映射表：已建立 ({len(moki_mapping)} 条)")
    
    print(f"\n### 5. 遇到的问题")
    print(f"- mokis/manifest.json 为空壳文件，实际卡牌数据在 stats/summary.json 中")
    print(f"- leaderboard 数据中的 cardImages 是 URL 而非 mokiId，需要通过 URL 提取 ID")
    
    print(f"\n### 6. 下一步建议")
    print(f"1. 从 leaderboard 的 cardImages URL 中提取 mokiId (URL 倒数第二个路径段)")
    print(f"2. 建立完整的 mokiId → imageUrl 映射字典")
    print(f"3. 分析竞赛与排行榜的关联关系 (通过 contestId)")
    print(f"4. 统计每种竞赛类型的报名费分布")

if __name__ == "__main__":
    main()
