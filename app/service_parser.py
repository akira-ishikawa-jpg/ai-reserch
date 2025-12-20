python3 -m uvicorn app.main:app --reloadimport requests
from bs4 import BeautifulSoup
from typing import Optional, List
import openai
import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# サービス情報データ構造
class ServiceInfo:
    def __init__(self, name: str, summary: str, categories: List[str]):
        self.name = name
        self.summary = summary
        self.categories = categories

    def dict(self):
        return {
            "name": self.name,
            "summary": self.summary,
            "categories": self.categories
        }

def fetch_service_page(url: str) -> Optional[str]:
    try:
        res = requests.get(url, timeout=10)
        res.raise_for_status()
        return res.text
    except Exception:
        return None

def parse_service_info_from_html(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.string.strip() if soup.title else ""
    desc = ""
    desc_tag = soup.find("meta", attrs={"name": "description"})
    if desc_tag and desc_tag.get("content"):
        desc = desc_tag["content"].strip()
    return {"title": title, "description": desc}

def extract_service_info_with_ai(title: str, description: str) -> ServiceInfo:
    prompt = f"""
以下はWebサービスのタイトルと説明文です。
タイトル: {title}
説明: {description}

1. サービス名
2. サービス概要（50字以内）
3. 想定される課題カテゴリ（3つ以内、カンマ区切り）

この3点を日本語で出力してください。
"""
    openai.api_key = OPENAI_API_KEY
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}]
    )
    text = response.choices[0].message.content.strip()
    # シンプルなパース
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    name, summary, categories = "", "", []
    for l in lines:
        if l.startswith("1."):
            name = l[2:].strip()
        elif l.startswith("2."):
            summary = l[2:].strip()
        elif l.startswith("3."):
            categories = [c.strip() for c in l[2:].split(",") if c.strip()]
    return ServiceInfo(name, summary, categories)

def get_service_info(url: str) -> Optional[ServiceInfo]:
    html = fetch_service_page(url)
    if not html:
        return None
    parsed = parse_service_info_from_html(html)
    return extract_service_info_with_ai(parsed["title"], parsed["description"])
