from typing import List, Dict
from app.prompt_generator import generate_consult_prompts
from app.ai_executor import exec_ai_tools
from app.answer_judger import aggregate_results

def generate_candidate_issues(service_info: dict) -> List[str]:
    """
    サービス特性（概要・カテゴリ）から課題候補を自動生成（ルール＋AI生成併用可）
    MVPではカテゴリごとにテンプレート生成＋AI生成のダミー
    """
    base = service_info.get("summary", "")
    categories = service_info.get("categories", [])
    issues = []
    for cat in categories:
        issues.append(f"{cat}に関するよくある課題は何ですか？")
        issues.append(f"{cat}領域で現場が直面しやすい問題を教えてください")
    # AI生成ダミー
    issues.append(f"{base}に関連する業務課題を3つ挙げてください")
    return issues

def deep_research(service_info: dict, ai_tools: List[str], competitors: List[str], service_name: str) -> dict:
    issues = generate_candidate_issues(service_info)
    all_prompts = []
    for issue in issues:
        all_prompts.extend(generate_consult_prompts(issue))
    ai_results = exec_ai_tools(all_prompts, ai_tools)
    summary = aggregate_results(ai_results, service_name, competitors)
    # MVP: 頻出課題上位3件を抽出（単純集計）
    freq = {}
    for d in summary["details"]:
        if d["service_level"] > 0:
            key = d["answer"][:30]  # 回答冒頭でグルーピング
            freq[key] = freq.get(key, 0) + 1
    top3 = sorted(freq.items(), key=lambda x: -x[1])[:3]
    return {
        "candidate_issues": issues,
        "all_prompts": all_prompts,
        "ai_results": ai_results,
        "summary": summary,
        "top3": top3
    }
