
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


from app.service_parser import get_service_info
from app.prompt_generator import generate_consult_prompts
from app.ai_executor import exec_ai_tools
from app.answer_judger import aggregate_results
from app.deep_research import deep_research
from app.log_saver import save_log

app = FastAPI()

# CORS設定（Streamlit等フロントエンド連携用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "AIサービス認知・提案計測システム API"}


# サービス理解API
# サービス理解API
class ServiceUrlRequest(BaseModel):
    url: str

@app.post("/service_info")
async def service_info(req: ServiceUrlRequest):
    info = get_service_info(req.url)
    if not info:
        return {"error": "サービス情報の取得に失敗しました"}
    result = info.dict()
    save_log({"type": "service_info", "input": req.url, "output": result})
    return result


# 課題起点での提案率測定API
class ProposalMeasureRequest(BaseModel):
    issue: str
    ai_tools: list
    competitors: list = []
    service_name: str

@app.post("/measure_proposal")
async def measure_proposal(req: ProposalMeasureRequest):
    prompts = generate_consult_prompts(req.issue)
    ai_results = exec_ai_tools(prompts, req.ai_tools)
    summary = aggregate_results(ai_results, req.service_name, req.competitors)
    result = {
        "prompts": prompts,
        "ai_results": ai_results,
        "summary": summary
    }
    save_log({"type": "measure_proposal", "input": req.dict(), "output": result})
    return result
