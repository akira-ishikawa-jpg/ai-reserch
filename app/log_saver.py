import json
import os
from datetime import datetime
from typing import Any

def save_log(data: Any, prefix: str = "log", dir_path: str = "data") -> str:
    os.makedirs(dir_path, exist_ok=True)
    dt = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = os.path.join(dir_path, f"{prefix}_{dt}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return file_path
