#!/usr/bin/env python3
"""
Moki-Stats Phase 1: 完整数据报告生成器
生成详细的 Markdown 报告
"""

import json
import os
from collections import defaultdict
from pathlib import Path
from datetime import datetime

DATA_DIR = Path("/Users/yujian/aicoding/moki-stats/docs/data")
CONTESTS_DIR = DATA_DIR / "contests"
LEADERBOARDS_DIR = DATA_DIR / "leaderboards"
STATS_DIR = DATA_DIR / "stats"
OUTPUT_DIR = Path("/Users/yujian/aicoding/moki-stats/docs/reports")

OUTPUT_DIR.mkdir(exist_ok=True)

def load_json_file(filepath):
    """加载 JSON 文件"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        return None

def analyze_all_contests():
    """分析所有竞赛数据"""
    contest_files = list(CONTESTS_DIR.glob("*.json"))
    
    all_contests = []
    name_samples = []
    entry_fees = defaultdict(int)
    format_types = defaultdict(int)
    
    for cf in contest_files:
        data = load_json_file(cf)
        if data:
            all_contests.append(data)
            name_samples.append(data.get('name', ''))
            entry_fees[data.get('entryFee', 'N/A')] += 1
            format_types[data.get('format', 'N/A')] += 1
    
    return all_contests, name_samples, entry_fees, format_types

def extract_contest_types_from_name(name_samples):
    """从竞赛名称提取类型标识（基于 name 字段）"""
    import re
    
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
    
    return type_counts, type_examples

def analyze_leaderboards():
    """分析排行榜数据结构"""
    lb_files = list(LEADERBOARDS_DIR.glob("*.json"))
    
    # 分析几个样本获取字段信息
    sample_fields = set()
    for lf in lb_files[:5]:
        data = load_json_file(lf)
        if data:
            sample_fields.update(data.keys())
    
    return lb_files, sample_fields

def analyze_stats():
    """分析统计数据"""
    summary_file = STATS_DIR / "summary.json"
    data = load_json_file(summary_file)
    
    if data:
        moki_mapping = {}
        if 'mokiAppearances' in data:
            for moki_id, info in data['mokiAppearances'].items():
                if 'imageUrl' in info:
                    moki_mapping[moki_id] = info['imageUrl']
        
        return data, moki_mapping
    
    return None, {}

def generate_report():
    """生成完整的 Phase 1 报告"""
    
    print("正在分析数据...")
    
    # 分析所有数据
    all_contests, name_samples, entry_fees, format_types = analyze_all_contests()
    type_counts_name, type_examples_name = extract_contest_types_from_name(name_samples)
    lb_files, lb_fields = analyze_leaderboards()
    stats_data, moki_mapping = analyze_stats()
    
    # 生成报告
    report = []
    report.append("# Moki-Stats Phase 1 完成报告")
    report.append("")
    report.append(f"**生成时间:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append(f"**数据目录:** `/Users/yujian/aicoding/moki-stats/docs/data/`")
    report.append("")
    
    # 1. 数据结构概览
    report.append("## 1. 数据结构概览")
    report.append("")
    report.append("| 数据源 | 文件数 | 核心字段 |")
    report.append("|--------|--------|----------|")
    report.append(f"| contests | {len(all_contests)} 个 | `_id`, `name`, `entryFee`, `prizePool`, `entries`, `format`, `contestStatus`, `lineupConfig`, `prizeStructure`, `matchGroups`, `startDate`, `endDate` |")
    report.append(f"| leaderboards | {len(lb_files)} 个 | `contestId`, `contestName`, `top50[]`, `endDate`, `fetchedAt`, `totalEntries` |")
    report.append(f"| stats | 1 个 | `period`, `fromDate`, `toDate`, `totalContests`, `totalPlayers`, `mokiAppearances`, `topCompositions`, `generatedAt` |")
    report.append("")
    report.append("### 字段关联关系")
    report.append("")
    report.append("```")
    report.append("contests._id  →  leaderboards.contestId  (一对一对应)")
    report.append("leaderboards.top50[].cardImages[]  →  mokiId (从 URL 提取)")
    report.append("stats.mokiAppearances[mokiId]  →  imageUrl, count, avgRank")
    report.append("```")
    report.append("")
    
    # 2. 竞赛类型映射字典（基于 name 字段）
    report.append("## 2. 竞赛类型映射字典（基于 name 字段）")
    report.append("")
    report.append("| 类型标识 | 出现次数 | 示例名称 |")
    report.append("|----------|----------|----------|")
    for type_name in sorted(type_counts_name.keys(), key=lambda x: -type_counts_name[x]):
        count = type_counts_name[type_name]
        examples = type_examples_name[type_name]
        example_str = "; ".join([f'"{ex[:50]}..."' for ex in examples[:2]])
        report.append(f"| {type_name} | {count} 次 | {example_str} |")
    report.append("")
    
    report.append("### 补充：基于 format 字段的类型分布")
    report.append("")
    report.append("| format 值 | 出现次数 | 对应类型标识 |")
    report.append("|-----------|----------|--------------|")
    for fmt in sorted(format_types.keys(), key=lambda x: -format_types[x]):
        count = format_types[fmt]
        mapping = {
            'FIFTY_FIFTY': '50/50',
            'TOP_20_PCT': 'Top 20%',
            'FREE_ENTRY': 'Free Entry'
        }
        report.append(f"| {fmt} | {count} 个 | {mapping.get(fmt, 'Other')} |")
    report.append("")
    
    # 3. 报名费枚举
    report.append("## 3. 报名费枚举")
    report.append("")
    report.append("| 报名费 (GEMs) | 竞赛数量 | 占比 |")
    report.append("|---------------|----------|------|")
    total_contests = sum(entry_fees.values())
    for fee in sorted(entry_fees.keys()):
        count = entry_fees[fee]
        pct = (count / total_contests * 100) if total_contests > 0 else 0
        report.append(f"| {fee} | {count} | {pct:.1f}% |")
    report.append("")
    report.append(f"**总计:** {total_contests} 个竞赛")
    report.append("")
    
    # 4. 卡牌映射
    report.append("## 4. 卡牌映射")
    report.append("")
    report.append(f"- **总卡牌数量:** {len(moki_mapping)} 张")
    report.append(f"- **mokiId → image URL 映射表:** ✅ 已建立 ({len(moki_mapping)} 条)")
    report.append("")
    report.append("### 映射示例（前 10 张）")
    report.append("")
    report.append("| mokiId | image URL |")
    report.append("|--------|-----------|")
    for i, (moki_id, url) in enumerate(list(moki_mapping.items())[:10]):
        report.append(f"| `{moki_id}` | `{url[:60]}...` |")
    report.append("")
    report.append("### 卡牌 URL 规律")
    report.append("")
    report.append("```")
    report.append("URL 格式：https://fhs9t4t52f1kkfmo.public.blob.vercel-storage.com/season1-launch/{mokiId}_thumb.webp")
    report.append("mokiId 提取：从 URL 路径中提取倒数第二个段（去掉 _thumb 后缀）")
    report.append("```")
    report.append("")
    
    # 5. 遇到的问题
    report.append("## 5. 遇到的问题")
    report.append("")
    report.append("1. **mokis/manifest.json 为空壳文件**")
    report.append("   - 实际卡牌数据存储在 `stats/summary.json` 的 `mokiAppearances` 字段中")
    report.append("   - manifest.json 仅包含 `{\"total\": 1, \"mokis\": [{}]}` 占位内容")
    report.append("")
    report.append("2. **leaderboard 数据中的卡牌标识为 URL 而非 mokiId**")
    report.append("   - `top50[].cardImages[]` 存储完整 URL")
    report.append("   - 需要通过解析 URL 提取 mokiId")
    report.append("")
    report.append("3. **竞赛名称格式不完全统一**")
    report.append("   - 大部分遵循「类型标识 + 描述」格式")
    report.append("   - 建议使用 `format` 字段作为主要分类依据，`name` 字段作为辅助")
    report.append("")
    
    # 6. 下一步建议
    report.append("## 6. 下一步建议")
    report.append("")
    report.append("### Phase 2: 数据关联与聚合")
    report.append("")
    report.append("1. **建立完整的 contest ↔ leaderboard 关联**")
    report.append("   - 通过 `contests._id = leaderboards.contestId` 进行关联")
    report.append("   - 统计每个竞赛的参赛人数、奖金池、获奖分布")
    report.append("")
    report.append("2. **构建 mokiId 完整映射字典**")
    report.append("   - 从 `stats/summary.json` 提取所有 mokiId → imageUrl")
    report.append("   - 从 `leaderboards` 的 cardImages URL 验证映射关系")
    report.append("   - 输出为 JSON 文件供后续分析使用")
    report.append("")
    report.append("3. **竞赛类型 × 报名费交叉分析**")
    report.append("   - 统计每种竞赛类型 (50/50, Top 20%, Free Entry) 的报名费分布")
    report.append("   - 分析不同报名费档位的竞赛数量与参赛人数关系")
    report.append("")
    report.append("4. **卡牌出现频率统计**")
    report.append("   - 基于 `stats.mokiAppearances` 的 count 字段")
    report.append("   - 识别高频率卡牌（热门）与低频率卡牌（稀有）")
    report.append("")
    
    # 写入报告文件
    report_path = OUTPUT_DIR / "phase1_data_analysis.md"
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report))
    
    print(f"报告已生成：{report_path}")
    
    # 同时输出到控制台
    print("\n" + "=" * 60)
    print("报告内容预览:")
    print("=" * 60)
    print('\n'.join(report[:80]))
    print("...")
    print(f"\n完整报告请查看：{report_path}")
    
    return report_path

if __name__ == "__main__":
    generate_report()
