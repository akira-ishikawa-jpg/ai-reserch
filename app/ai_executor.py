import openai
import os
from dotenv import load_dotenv
from typing import List, Dict

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# AIツール種別（MVPではOpenAIのみ実装、他はダミー）
AI_TOOLS = {
    "OpenAI GPT-4": "openai_gpt4",
    "Anthropic Claude": "dummy_claude",
    "Google Gemini": "dummy_gemini",
    "Microsoft Azure OpenAI": "dummy_azure"
}

def call_openai(prompt: str) -> str:
    openai.api_key = OPENAI_API_KEY
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content.strip()

def call_dummy(prompt: str) -> str:
    return f"[ダミーAI回答] {prompt}"

def exec_ai_tools(prompts: List[str], ai_tools: List[str]) -> Dict[str, List[str]]:
    results = {}
    for tool in ai_tools:
        tool_key = AI_TOOLS.get(tool)
        answers = []
        for p in prompts:
            if tool_key == "openai_gpt4":
                answers.append(call_openai(p))
            else:
                answers.append(call_dummy(p))
        results[tool] = answers
    return results
