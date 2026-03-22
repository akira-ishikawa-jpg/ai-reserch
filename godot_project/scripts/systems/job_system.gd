extends RefCounted
## ジョブシステム
## 四季に対応した職人ジョブの管理

class_name JobSystem

# ジョブIDから現在のレベル・経験値を管理
var job_levels: Dictionary = {}

func get_job_level(job_id: String) -> int:
	return job_levels.get(job_id, {}).get("level", 1)

func get_job_exp(job_id: String) -> int:
	return job_levels.get(job_id, {}).get("exp", 0)

func add_job_exp(job_id: String, amount: int):
	if not job_levels.has(job_id):
		job_levels[job_id] = {"level": 1, "exp": 0}

	job_levels[job_id]["exp"] += amount

	# レベルアップチェック
	while job_levels[job_id]["exp"] >= _exp_for_next_level(job_levels[job_id]["level"]):
		job_levels[job_id]["exp"] -= _exp_for_next_level(job_levels[job_id]["level"])
		job_levels[job_id]["level"] += 1

func _exp_for_next_level(current_level: int) -> int:
	# 必要経験値 = レベル * 100
	return current_level * 100

func get_available_skills(job_id: String) -> Array:
	var level = get_job_level(job_id)
	var job_data = JobsData.get_job(job_id)
	if job_data.is_empty():
		return []

	var skills = []
	for skill in job_data.get("skills", []):
		if skill.get("learn_level", 1) <= level:
			skills.append(skill)
	return skills
