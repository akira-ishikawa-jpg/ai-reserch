class_name BuildingGenerator
extends RefCounted
## CSGBox3Dを使ったプロシージャル建物生成
## HD-2D風の3D建物（屋根・ドア・窓・光源付き）を動的に構築する

# 建物タイプ
enum BuildingType { HOUSE_SMALL, INN, SHOP, GUILD }

# ==========================================
# 公開API
# ==========================================

static func create_building(type: BuildingType, position: Vector3) -> Node3D:
	match type:
		BuildingType.HOUSE_SMALL:
			return _create_small_house(position)
		BuildingType.INN:
			return _create_inn(position)
		BuildingType.SHOP:
			return _create_shop(position)
		BuildingType.GUILD:
			return _create_guild(position)
		_:
			return _create_small_house(position)

# ==========================================
# 小さな家（3x3ベース）
# ==========================================

static func _create_small_house(pos: Vector3) -> Node3D:
	var root = Node3D.new()
	root.name = "Building_SmallHouse"
	root.position = pos

	# 壁体
	var walls = CSGBox3D.new()
	walls.name = "Walls"
	walls.size = Vector3(3, 2, 3)
	walls.position = Vector3(0, 1, 0)
	walls.material = _make_wall_material()
	root.add_child(walls)

	# 屋根（左半分 + 右半分で切妻風）
	var roof_left = CSGBox3D.new()
	roof_left.name = "RoofLeft"
	roof_left.size = Vector3(3.5, 0.25, 1.9)
	roof_left.position = Vector3(0, 2.3, -0.45)
	roof_left.rotation_degrees = Vector3(20, 0, 0)
	roof_left.material = _make_roof_material()
	root.add_child(roof_left)

	var roof_right = CSGBox3D.new()
	roof_right.name = "RoofRight"
	roof_right.size = Vector3(3.5, 0.25, 1.9)
	roof_right.position = Vector3(0, 2.3, 0.45)
	roof_right.rotation_degrees = Vector3(-20, 0, 0)
	roof_right.material = _make_roof_material()
	root.add_child(roof_right)

	# 棟木（屋根の頂点）
	var ridge = CSGBox3D.new()
	ridge.name = "Ridge"
	ridge.size = Vector3(3.6, 0.15, 0.15)
	ridge.position = Vector3(0, 2.55, 0)
	ridge.material = _make_roof_material()
	root.add_child(ridge)

	# ドア（前面）
	var door = CSGBox3D.new()
	door.name = "Door"
	door.size = Vector3(0.6, 1.2, 0.08)
	door.position = Vector3(0, 0.6, 1.52)
	door.material = _make_door_material()
	root.add_child(door)

	# 窓（前面左右）
	_add_windows(root, [-0.85, 0.85], 1.3, 1.52)

	return root

# ==========================================
# 宿屋（4x4ベース、2階建て風）
# ==========================================

static func _create_inn(pos: Vector3) -> Node3D:
	var root = Node3D.new()
	root.name = "Building_Inn"
	root.position = pos

	# 1階壁体
	var walls_1f = CSGBox3D.new()
	walls_1f.name = "Walls1F"
	walls_1f.size = Vector3(4, 2, 4)
	walls_1f.position = Vector3(0, 1, 0)
	walls_1f.material = _make_wall_material()
	root.add_child(walls_1f)

	# 2階壁体（少し狭め）
	var walls_2f = CSGBox3D.new()
	walls_2f.name = "Walls2F"
	walls_2f.size = Vector3(3.6, 1.5, 3.6)
	walls_2f.position = Vector3(0, 2.75, 0)
	walls_2f.material = _make_wall_material_alt()
	root.add_child(walls_2f)

	# 2階の庇（ひさし）
	var awning = CSGBox3D.new()
	awning.name = "Awning"
	awning.size = Vector3(4.2, 0.1, 0.6)
	awning.position = Vector3(0, 2.05, 2.2)
	awning.material = _make_roof_material()
	root.add_child(awning)

	# 屋根
	var roof_left = CSGBox3D.new()
	roof_left.name = "RoofLeft"
	roof_left.size = Vector3(4.2, 0.25, 2.3)
	roof_left.position = Vector3(0, 3.8, -0.55)
	roof_left.rotation_degrees = Vector3(18, 0, 0)
	roof_left.material = _make_roof_material()
	root.add_child(roof_left)

	var roof_right = CSGBox3D.new()
	roof_right.name = "RoofRight"
	roof_right.size = Vector3(4.2, 0.25, 2.3)
	roof_right.position = Vector3(0, 3.8, 0.55)
	roof_right.rotation_degrees = Vector3(-18, 0, 0)
	roof_right.material = _make_roof_material()
	root.add_child(roof_right)

	# ドア（大きめ）
	var door = CSGBox3D.new()
	door.name = "Door"
	door.size = Vector3(0.8, 1.4, 0.08)
	door.position = Vector3(0, 0.7, 2.02)
	door.material = _make_door_material()
	root.add_child(door)

	# 1階窓
	_add_windows(root, [-1.2, 1.2], 1.3, 2.02)

	# 2階窓（暖色の光を強めに）
	_add_windows(root, [-1.0, 0.0, 1.0], 3.0, 1.82, 0.5)

	# 看板ライト（宿屋らしい暖色の光）
	var sign_light = OmniLight3D.new()
	sign_light.name = "SignLight"
	sign_light.position = Vector3(0, 1.8, 2.5)
	sign_light.light_color = Color(1.0, 0.85, 0.55)
	sign_light.light_energy = 0.6
	sign_light.omni_range = 3.0
	root.add_child(sign_light)

	return root

# ==========================================
# 商店（3.5x3ベース、庇付き）
# ==========================================

static func _create_shop(pos: Vector3) -> Node3D:
	var root = Node3D.new()
	root.name = "Building_Shop"
	root.position = pos

	# 壁体
	var walls = CSGBox3D.new()
	walls.name = "Walls"
	walls.size = Vector3(3.5, 2, 3)
	walls.position = Vector3(0, 1, 0)
	walls.material = _make_wall_material()
	root.add_child(walls)

	# 庇（ひさし）— 前面に張り出し
	var awning = CSGBox3D.new()
	awning.name = "Awning"
	awning.size = Vector3(3.8, 0.08, 1.2)
	awning.position = Vector3(0, 1.8, 2.0)
	awning.rotation_degrees = Vector3(-10, 0, 0)
	awning.material = _make_awning_material()
	root.add_child(awning)

	# 屋根（片流れ）
	var roof = CSGBox3D.new()
	roof.name = "Roof"
	roof.size = Vector3(3.8, 0.2, 3.4)
	roof.position = Vector3(0, 2.2, -0.1)
	roof.rotation_degrees = Vector3(8, 0, 0)
	roof.material = _make_roof_material()
	root.add_child(roof)

	# 商品台（前面の低い台）
	var counter = CSGBox3D.new()
	counter.name = "Counter"
	counter.size = Vector3(2.5, 0.6, 0.5)
	counter.position = Vector3(0, 0.3, 1.8)
	counter.material = _make_wood_material()
	root.add_child(counter)

	# ドア
	var door = CSGBox3D.new()
	door.name = "Door"
	door.size = Vector3(0.6, 1.2, 0.08)
	door.position = Vector3(-1.0, 0.6, 1.52)
	door.material = _make_door_material()
	root.add_child(door)

	# 窓（商品展示窓 — 大きめ）
	var display_window = CSGBox3D.new()
	display_window.name = "DisplayWindow"
	display_window.size = Vector3(1.2, 0.8, 0.08)
	display_window.position = Vector3(0.5, 1.2, 1.52)
	display_window.material = _make_window_material()
	root.add_child(display_window)

	var win_light = OmniLight3D.new()
	win_light.name = "DisplayLight"
	win_light.position = Vector3(0.5, 1.2, 1.3)
	win_light.light_color = Color(1.0, 0.95, 0.8)
	win_light.light_energy = 0.4
	win_light.omni_range = 2.0
	root.add_child(win_light)

	return root

# ==========================================
# ギルド（5x4ベース、重厚な建物）
# ==========================================

static func _create_guild(pos: Vector3) -> Node3D:
	var root = Node3D.new()
	root.name = "Building_Guild"
	root.position = pos

	# 本体壁（大きめ）
	var walls = CSGBox3D.new()
	walls.name = "Walls"
	walls.size = Vector3(5, 2.5, 4)
	walls.position = Vector3(0, 1.25, 0)
	walls.material = _make_wall_material()
	root.add_child(walls)

	# 柱（前面左右）
	for x_off in [-2.2, 2.2]:
		var pillar = CSGBox3D.new()
		pillar.name = "Pillar"
		pillar.size = Vector3(0.3, 2.8, 0.3)
		pillar.position = Vector3(x_off, 1.4, 2.1)
		pillar.material = _make_pillar_material()
		root.add_child(pillar)

	# 屋根（切妻・大きめ）
	var roof_left = CSGBox3D.new()
	roof_left.name = "RoofLeft"
	roof_left.size = Vector3(5.5, 0.3, 2.5)
	roof_left.position = Vector3(0, 2.9, -0.6)
	roof_left.rotation_degrees = Vector3(22, 0, 0)
	roof_left.material = _make_roof_material()
	root.add_child(roof_left)

	var roof_right = CSGBox3D.new()
	roof_right.name = "RoofRight"
	roof_right.size = Vector3(5.5, 0.3, 2.5)
	roof_right.position = Vector3(0, 2.9, 0.6)
	roof_right.rotation_degrees = Vector3(-22, 0, 0)
	roof_right.material = _make_roof_material()
	root.add_child(roof_right)

	# ドア（大きめ・装飾的）
	var door = CSGBox3D.new()
	door.name = "Door"
	door.size = Vector3(1.0, 1.6, 0.08)
	door.position = Vector3(0, 0.8, 2.02)
	door.material = _make_door_material()
	root.add_child(door)

	# 窓（左右に2つずつ）
	_add_windows(root, [-1.5, 1.5], 1.5, 2.02, 0.4)

	# ギルド看板光
	var guild_light = OmniLight3D.new()
	guild_light.name = "GuildLight"
	guild_light.position = Vector3(0, 2.0, 2.5)
	guild_light.light_color = Color(0.8, 1.0, 0.7)
	guild_light.light_energy = 0.5
	guild_light.omni_range = 3.5
	root.add_child(guild_light)

	return root

# ==========================================
# 窓ユーティリティ
# ==========================================

static func _add_windows(root: Node3D, x_offsets: Array, y_pos: float, z_pos: float, energy: float = 0.3):
	for x_off in x_offsets:
		var window = CSGBox3D.new()
		window.name = "Window"
		window.size = Vector3(0.5, 0.5, 0.08)
		window.position = Vector3(x_off, y_pos, z_pos)
		window.material = _make_window_material()
		root.add_child(window)

		# 窓からの暖色光
		var light = OmniLight3D.new()
		light.name = "WindowLight"
		light.position = Vector3(x_off, y_pos, z_pos - 0.2)
		light.light_color = Color(1.0, 0.9, 0.7)
		light.light_energy = energy
		light.omni_range = 2.0
		root.add_child(light)

# ==========================================
# マテリアル生成
# ==========================================

static func _make_wall_material() -> StandardMaterial3D:
	var mat = StandardMaterial3D.new()
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	var tex = TextureGenerator.textures.get("wall_stone", null)
	if tex:
		mat.albedo_texture = tex
	else:
		mat.albedo_color = Color(0.545, 0.451, 0.333)
	mat.roughness = 0.9
	return mat

static func _make_wall_material_alt() -> StandardMaterial3D:
	var mat = StandardMaterial3D.new()
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	var tex = TextureGenerator.textures.get("wall_wood", null)
	if tex:
		mat.albedo_texture = tex
	else:
		mat.albedo_color = Color(0.42, 0.27, 0.13)
	mat.roughness = 0.85
	return mat

static func _make_roof_material() -> StandardMaterial3D:
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.35, 0.2, 0.12)
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	mat.roughness = 0.8
	return mat

static func _make_door_material() -> StandardMaterial3D:
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.3, 0.18, 0.1)
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	mat.roughness = 0.7
	return mat

static func _make_window_material() -> StandardMaterial3D:
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.95, 0.9, 0.75, 0.85)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.92, 0.7)
	mat.emission_energy_multiplier = 0.8
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	return mat

static func _make_awning_material() -> StandardMaterial3D:
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.7, 0.15, 0.1)
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	mat.roughness = 0.9
	return mat

static func _make_wood_material() -> StandardMaterial3D:
	var mat = StandardMaterial3D.new()
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	var tex = TextureGenerator.textures.get("wall_wood", null)
	if tex:
		mat.albedo_texture = tex
	else:
		mat.albedo_color = Color(0.545, 0.353, 0.169)
	mat.roughness = 0.85
	return mat

static func _make_pillar_material() -> StandardMaterial3D:
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.5, 0.4, 0.3)
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	mat.roughness = 0.75
	return mat
