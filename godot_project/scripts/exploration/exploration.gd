extends Node3D
## 探索シーンメイン
## マップデータを3D空間に配置し、プレイヤーの移動・マップ遷移を管理する
## HD-2D演出：建物CSG生成、降り注ぐ光、光の粒パーティクル、スプライトリムライト

@onready var camera: Camera3D = $Camera3D
@onready var player: Node3D = $Characters/Player
@onready var player_sprite: Sprite3D = $Characters/Player/PlayerSprite
@onready var ground_node: Node3D = $Ground

# 現在のマップデータ
var current_map_data: Dictionary = {}
var npc_sprites: Array[Sprite3D] = []

# HD-2D演出ノード
var _floating_particles: GPUParticles3D = null
var _light_rays_mesh: MeshInstance3D = null
var _rimlight_shader: ShaderMaterial = null

func _ready():
	# カメラのターゲット設定
	camera.target = player

	# マップロード（初回は霞花里）
	var map_id = "kasumikari"
	if GameState.current_map != "":
		map_id = GameState.current_map
	load_map(map_id)

	GameState.current_map = current_map_data.get("id", "kasumikari")
	_setup_season_lighting()

	# HD-2D演出セットアップ
	_setup_floating_particles()
	_setup_light_rays()
	_setup_rimlight_shader()

# ==========================================
# マップ構築
# ==========================================

func load_map(map_id: String, spawn_pos: Vector2i = Vector2i(-1, -1)):
	_clear_map()
	current_map_data = MapsData.get_map(map_id)
	if current_map_data.is_empty():
		push_error("Failed to load map: " + map_id)
		return

	GameState.current_map = map_id

	var tiles: Array = current_map_data["tiles"]
	var map_w: int = current_map_data["width"]
	var map_h: int = current_map_data["height"]

	# タイルを3D空間に配置
	for y in range(map_h):
		for x in range(map_w):
			var tile_type: int = tiles[y][x]
			_place_tile(x, y, tile_type, map_id)

	# 建物配置（町マップのみ）
	if not map_id.begins_with("sennen"):
		_place_buildings()

	# NPC配置
	_place_npcs()

	# セーブポイントのエフェクト配置
	_place_save_point_markers()

	# 宝箱配置
	_place_chest_markers()

	# プレイヤー配置
	var start: Vector2i
	if spawn_pos.x >= 0:
		start = spawn_pos
	else:
		start = current_map_data.get("player_start", Vector2i(10, 10))

	player.position = Vector3(start.x, 0.01, start.y)
	player_sprite.texture = TextureGenerator.textures.get("hero_sprite", null)
	player_sprite.pixel_size = 0.04

	# GroundPlane を非表示に（個別タイルで描画するため）
	var ground_plane = ground_node.get_node_or_null("GroundPlane")
	if ground_plane:
		ground_plane.visible = false

func _clear_map():
	# 既存の動的ノードを削除
	for child in ground_node.get_children():
		if child.name != "GroundPlane":
			child.queue_free()
	# NPC削除
	for npc_sprite in npc_sprites:
		if is_instance_valid(npc_sprite):
			npc_sprite.get_parent().queue_free()
	npc_sprites.clear()
	# 建物ノード削除
	for child in get_children():
		if child.name.begins_with("Building_"):
			child.queue_free()

func _place_tile(x: int, y: int, tile_type: int, map_id: String):
	if tile_type == MapsData.TILE_WALL:
		_place_wall(x, y, map_id)
	else:
		_place_floor(x, y, tile_type, map_id)

func _place_floor(x: int, y: int, tile_type: int, _map_id: String):
	var mesh_inst = MeshInstance3D.new()
	var plane = PlaneMesh.new()
	plane.size = Vector2(1, 1)
	mesh_inst.mesh = plane

	var mat = StandardMaterial3D.new()
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST

	# タイルタイプに応じたテクスチャ
	match tile_type:
		MapsData.TILE_FLOOR, MapsData.TILE_EMPTY, MapsData.TILE_NPC, MapsData.TILE_DOOR:
			# マップが洞窟かどうかで床テクスチャを切り替え
			if _map_id.begins_with("sennen"):
				mat.albedo_texture = TextureGenerator.textures.get("floor_cave", null)
			else:
				mat.albedo_texture = TextureGenerator.textures.get("floor_stone", null)
		MapsData.TILE_WATER:
			mat.albedo_texture = TextureGenerator.textures.get("floor_water", null)
		MapsData.TILE_ENTRANCE:
			mat.albedo_texture = TextureGenerator.textures.get("floor_entrance", null)
		MapsData.TILE_SAVE:
			mat.albedo_texture = TextureGenerator.textures.get("floor_save", null)
		MapsData.TILE_CHEST:
			mat.albedo_texture = TextureGenerator.textures.get("floor_chest", null)
		_:
			mat.albedo_texture = TextureGenerator.textures.get("floor_stone", null)

	mesh_inst.material_override = mat
	mesh_inst.position = Vector3(x, 0, y)
	ground_node.add_child(mesh_inst)

func _place_wall(x: int, y: int, map_id: String):
	var mesh_inst = MeshInstance3D.new()
	var box = BoxMesh.new()
	box.size = Vector3(1, 1.5, 1)
	mesh_inst.mesh = box

	var mat = StandardMaterial3D.new()
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	if map_id.begins_with("sennen"):
		mat.albedo_texture = TextureGenerator.textures.get("wall_cave", null)
	else:
		mat.albedo_texture = TextureGenerator.textures.get("wall_stone", null)

	mesh_inst.material_override = mat
	mesh_inst.position = Vector3(x, 0.75, y)
	ground_node.add_child(mesh_inst)

# ==========================================
# NPC配置
# ==========================================

func _place_npcs():
	var npcs: Array = current_map_data.get("npcs", [])
	for npc_data in npcs:
		var npc_root = Node3D.new()
		npc_root.name = "NPC_" + str(npc_data["id"])
		npc_root.position = Vector3(npc_data["x"], 0.01, npc_data["y"])

		var sprite = Sprite3D.new()
		sprite.pixel_size = 0.04
		sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
		sprite.position = Vector3(0, 0.5, 0)

		var tex_key: String = npc_data.get("texture_key", "npc_yakushi")
		sprite.texture = TextureGenerator.textures.get(tex_key, null)

		npc_root.add_child(sprite)
		$Characters.add_child(npc_root)
		npc_sprites.append(sprite)

# ==========================================
# セーブポイントマーカー
# ==========================================

func _place_save_point_markers():
	var save_points: Array = current_map_data.get("save_points", [])
	for sp in save_points:
		var light = OmniLight3D.new()
		light.name = "SavePointLight"
		light.position = Vector3(sp.x, 1.0, sp.y)
		light.light_color = Color(0.498, 1.0, 0.831)
		light.light_energy = 1.5
		light.omni_range = 3.0
		light.omni_attenuation = 1.5
		ground_node.add_child(light)

# ==========================================
# 宝箱マーカー
# ==========================================

func _place_chest_markers():
	var chests: Array = current_map_data.get("chests", [])
	for chest_data in chests:
		var chest_id: String = chest_data["id"]
		if GameState.get_flag("chest_" + chest_id):
			continue  # 既に開けた宝箱はスキップ
		var sprite = Sprite3D.new()
		sprite.name = "Chest_" + chest_id
		sprite.pixel_size = 0.03
		sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
		sprite.position = Vector3(chest_data["x"], 0.5, chest_data["y"])
		sprite.texture = TextureGenerator.textures.get("floor_chest", null)
		ground_node.add_child(sprite)

# ==========================================
# 季節ライティング
# ==========================================

func _setup_season_lighting():
	var dir_light = $DirectionalLight3D
	var omni_light = $OmniLight3D

	match GameState.current_season:
		"spring":
			dir_light.light_color = Color(1.0, 0.98, 0.92)
			dir_light.light_energy = 1.2
			omni_light.light_color = Color(1.0, 0.85, 0.6)
		"summer":
			dir_light.light_color = Color(1.0, 1.0, 0.95)
			dir_light.light_energy = 1.5
			omni_light.light_color = Color(1.0, 0.9, 0.7)
		"autumn":
			dir_light.light_color = Color(1.0, 0.9, 0.75)
			dir_light.light_energy = 1.0
			omni_light.light_color = Color(1.0, 0.7, 0.4)
		"winter":
			dir_light.light_color = Color(0.85, 0.9, 1.0)
			dir_light.light_energy = 0.8
			omni_light.light_color = Color(0.8, 0.85, 1.0)

# ==========================================
# タイル通行判定（player.gd から呼ばれる）
# ==========================================

func _is_tile_passable(world_pos: Vector3) -> bool:
	if current_map_data.is_empty():
		return true
	var tile_x = roundi(world_pos.x)
	var tile_y = roundi(world_pos.z)

	var tiles: Array = current_map_data["tiles"]
	var map_w: int = current_map_data["width"]
	var map_h: int = current_map_data["height"]

	if tile_x < 0 or tile_x >= map_w or tile_y < 0 or tile_y >= map_h:
		return false

	var tile_type: int = tiles[tile_y][tile_x]
	return MapsData.is_passable(tile_type)

# ==========================================
# 毎フレーム：出口チェック
# ==========================================

func _process(_delta):
	_check_exit()

func _check_exit():
	if current_map_data.is_empty():
		return
	var exits: Array = current_map_data.get("exits", [])
	var tile_x = roundi(player.position.x)
	var tile_y = roundi(player.position.z)

	for exit_data in exits:
		if tile_x == exit_data["x"] and tile_y == exit_data["y"]:
			var target_map: String = exit_data["target_map"]
			var target_pos = Vector2i(exit_data["target_x"], exit_data["target_y"])
			load_map(target_map, target_pos)
			_setup_season_lighting()
			return

# ==========================================
# 入力
# ==========================================

func _input(event):
	if event.is_action_pressed("cancel"):
		# メニューを開く（将来実装）
		pass
	if event.is_action_pressed("interact"):
		_try_interact()

func _try_interact():
	var tile_x = roundi(player.position.x)
	var tile_y = roundi(player.position.z)

	# セーブポイント判定
	var save_points: Array = current_map_data.get("save_points", [])
	for sp in save_points:
		if tile_x == sp.x and tile_y == sp.y:
			GameState.save_game(0)
			print("[セーブ完了]")
			return

	# NPC判定（隣接タイル）
	var facing = player.facing_direction if "facing_direction" in player else Vector2.DOWN
	var check_x = tile_x + roundi(facing.x)
	var check_y = tile_y + roundi(facing.y)
	var npcs: Array = current_map_data.get("npcs", [])
	for npc_data in npcs:
		if check_x == npc_data["x"] and check_y == npc_data["y"]:
			print("[NPC] " + npc_data["name"] + " に話しかけた")
			return

# ==========================================
# HD-2D: 建物配置
# ==========================================

func _place_buildings():
	var npcs: Array = current_map_data.get("npcs", [])
	for npc_data in npcs:
		var btype = BuildingGenerator.BuildingType.HOUSE_SMALL
		match npc_data["id"]:
			"innkeeper":
				btype = BuildingGenerator.BuildingType.INN
			"merchant":
				btype = BuildingGenerator.BuildingType.SHOP
			"yakushi_master":
				btype = BuildingGenerator.BuildingType.GUILD

		# NPC位置から少し奥（-Z方向）に建物を配置
		var build_pos = Vector3(npc_data["x"], 0, npc_data["y"] - 2)
		var building = BuildingGenerator.create_building(btype, build_pos)
		add_child(building)

# ==========================================
# HD-2D: 光の粒パーティクル（フワフワ舞う）
# ==========================================

func _setup_floating_particles():
	if _floating_particles != null:
		return

	var particles = GPUParticles3D.new()
	particles.name = "FloatingLights"
	particles.amount = 30
	particles.lifetime = 8.0
	particles.visibility_aabb = AABB(Vector3(-15, -2, -15), Vector3(30, 6, 30))

	var mat = ParticleProcessMaterial.new()
	mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	mat.emission_box_extents = Vector3(10, 3, 10)
	mat.direction = Vector3(0, 1, 0)
	mat.initial_velocity_min = 0.1
	mat.initial_velocity_max = 0.3
	mat.gravity = Vector3(0, -0.05, 0)
	mat.turbulence_enabled = true
	mat.turbulence_noise_speed_random = 0.5
	mat.scale_min = 0.02
	mat.scale_max = 0.05
	mat.color = Color(1.0, 0.95, 0.8, 0.6)

	particles.process_material = mat

	# ドローパス（小さな光る球）
	var sphere = SphereMesh.new()
	sphere.radius = 0.02
	sphere.height = 0.04
	var draw_mat = StandardMaterial3D.new()
	draw_mat.albedo_color = Color(1.0, 0.95, 0.8)
	draw_mat.emission_enabled = true
	draw_mat.emission = Color(1.0, 0.9, 0.7)
	draw_mat.emission_energy_multiplier = 2.0
	draw_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sphere.material = draw_mat
	particles.draw_pass_1 = sphere

	add_child(particles)
	_floating_particles = particles

# ==========================================
# HD-2D: 降り注ぐ光（LightRays）
# ==========================================

func _setup_light_rays():
	if _light_rays_mesh != null:
		return

	# light_rays.gdshader をロード
	var shader = load("res://shaders/light_rays.gdshader")
	if shader == null:
		push_warning("light_rays.gdshader not found — skipping light rays setup")
		return

	var shader_mat = ShaderMaterial.new()
	shader_mat.shader = shader

	# 大きな垂直面メッシュ（カメラに向かって配置）
	var mesh_inst = MeshInstance3D.new()
	mesh_inst.name = "LightRaysMesh"

	var quad = QuadMesh.new()
	quad.size = Vector2(20, 10)
	mesh_inst.mesh = quad

	mesh_inst.material_override = shader_mat
	# プレイヤーの前方上空に配置（カメラの視界に入るよう）
	mesh_inst.position = Vector3(14, 5, 10)
	# カメラと平行になるよう少し傾ける
	mesh_inst.rotation_degrees = Vector3(-30, 0, 0)

	# 季節に応じた光の色
	match GameState.current_season:
		"spring":
			shader_mat.set_shader_parameter("color_bright", Color(1.0, 0.95, 0.85, 0.12))
			shader_mat.set_shader_parameter("color_dim", Color(1.0, 0.9, 0.75, 0.02))
		"summer":
			shader_mat.set_shader_parameter("color_bright", Color(1.0, 1.0, 0.9, 0.15))
			shader_mat.set_shader_parameter("color_dim", Color(1.0, 0.95, 0.8, 0.03))
		"autumn":
			shader_mat.set_shader_parameter("color_bright", Color(1.0, 0.85, 0.6, 0.13))
			shader_mat.set_shader_parameter("color_dim", Color(1.0, 0.8, 0.55, 0.02))
		"winter":
			shader_mat.set_shader_parameter("color_bright", Color(0.85, 0.9, 1.0, 0.1))
			shader_mat.set_shader_parameter("color_dim", Color(0.8, 0.85, 0.95, 0.02))

	add_child(mesh_inst)
	_light_rays_mesh = mesh_inst

# ==========================================
# HD-2D: スプライトリムライト
# ==========================================

func _setup_rimlight_shader():
	var shader = load("res://shaders/sprite_rimlight.gdshader")
	if shader == null:
		push_warning("sprite_rimlight.gdshader not found — skipping rimlight setup")
		return

	_rimlight_shader = ShaderMaterial.new()
	_rimlight_shader.shader = shader

	# 季節に応じたリムライト色
	match GameState.current_season:
		"spring":
			_rimlight_shader.set_shader_parameter("rim_color", Color(1.0, 0.95, 0.85, 1.0))
		"summer":
			_rimlight_shader.set_shader_parameter("rim_color", Color(1.0, 1.0, 0.9, 1.0))
		"autumn":
			_rimlight_shader.set_shader_parameter("rim_color", Color(1.0, 0.85, 0.6, 1.0))
		"winter":
			_rimlight_shader.set_shader_parameter("rim_color", Color(0.85, 0.9, 1.0, 1.0))

	_rimlight_shader.set_shader_parameter("rim_width", 1.5)
	_rimlight_shader.set_shader_parameter("rim_intensity", 0.6)
	_rimlight_shader.set_shader_parameter("rim_softness", 0.4)

	# プレイヤースプライトに適用
	var player_tex = player_sprite.texture
	if player_tex:
		_rimlight_shader.set_shader_parameter("sprite_texture", player_tex)
		player_sprite.material_override = _rimlight_shader

	# NPC スプライトにもリムライト適用
	for npc_sprite in npc_sprites:
		if is_instance_valid(npc_sprite) and npc_sprite.texture:
			var npc_rim = _rimlight_shader.duplicate()
			npc_rim.set_shader_parameter("sprite_texture", npc_sprite.texture)
			npc_sprite.material_override = npc_rim
