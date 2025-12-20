from typing import List, Dict
import re

def judge_service_appearance(answer: str, service_name: str) -> bool:
    return service_name.lower() in answer.lower()

def judge_proposal_level(answer: str, service_name: str) -> int:
    """
    0: 言及なし
    1: 単語一致のみ
    2: サービス名＋簡易的な説明
    3: 明確な提案・推奨
    """
    answer_l = answer.lower()
    name_l = service_name.lower()
    if name_l not in answer_l:
        return 0
    # 2,3の判定は簡易ルール
    if re.search(rf"{service_name}.*(おすすめ|提案|有効|最適|役立|解決)", answer, re.I):
        return 3
    if re.search(rf"{service_name}.*(です|ます|でき|可能)", answer, re.I):
        return 2
    return 1

def aggregate_results(ai_results: Dict[str, List[str]], service_name: str, competitors: List[str]) -> dict:
    summary = {"service_count": {}, "competitor_count": {}, "details": []}
    for tool, answers in ai_results.items():
        count = 0
        comp_count = {c: 0 for c in competitors}
        for ans in answers:
            if judge_service_appearance(ans, service_name):
                count += 1
            for c in competitors:
                if judge_service_appearance(ans, c):
                    comp_count[c] += 1
            summary["details"].append({
                "tool": tool,
                "answer": ans,
                "service_level": judge_proposal_level(ans, service_name)
            })
        summary["service_count"][tool] = count
        summary["competitor_count"][tool] = comp_count
    return summary
