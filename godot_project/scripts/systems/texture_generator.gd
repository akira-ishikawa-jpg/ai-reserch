extends Node
## プロシージャルテクスチャ生成
## 外部画像不要 — Image + GDScript でゲーム内テクスチャを全てコード生成する

var textures: Dictionary = {}

func _ready():
	_generate_all()

# ==========================================
# 生成エントリ
# ==========================================

func _generate_all():
	# タイル（床）
	textures["floor_stone"] = _make_stone_floor()
	textures["floor_wood"] = _make_wood_floor()
	textures["floor_cave"] = _make_cave_floor()
	textures["floor_grass"] = _make_grass_floor()
	textures["floor_entrance"] = _make_entrance_floor()
	textures["floor_save"] = _make_save_point()
	textures["floor_chest"] = _make_chest_tile()
	textures["floor_water"] = _make_water()
	# 壁
	textures["wall_stone"] = _make_stone_wall()
	textures["wall_cave"] = _make_cave_wall()
	textures["wall_top"] = _make_wall_top()
	textures["wall_wood"] = _make_wood_wall()
	# キャラクター
	textures["hero_sprite"] = _make_hero_sprite()
	textures["healer_sprite"] = _make_healer_sprite()
	# NPC
	textures["npc_yakushi"] = _make_npc_sprite(Color(0.545, 0.271, 0.075), Color(0.871, 0.722, 0.529))
	textures["npc_innkeeper"] = _make_npc_sprite(Color(0.396, 0.263, 0.129), Color(0.961, 0.871, 0.702))
	textures["npc_merchant"] = _make_npc_sprite(Color(0.180, 0.545, 0.341), Color(0.596, 0.984, 0.596))
	# 敵
	textures["enemy_fairy"] = _make_enemy_fairy()
	textures["enemy_bee"] = _make_enemy_bee()
	textures["enemy_fox"] = _make_enemy_fox()
	textures["enemy_boss"] = _make_enemy_boss()

# ==========================================
# ユーティリティ
# ==========================================

func _create_img(w: int = 32, h: int = 32) -> Image:
	return Image.create(w, h, false, Image.FORMAT_RGBA8)

func _to_tex(img: Image) -> ImageTexture:
	return ImageTexture.create_from_image(img)

func _color_vary(base: Color, amount: float = 0.05) -> Color:
	return Color(
		clampf(base.r + randf_range(-amount, amount), 0, 1),
		clampf(base.g + randf_range(-amount, amount), 0, 1),
		clampf(base.b + randf_range(-amount, amount), 0, 1),
		base.a
	)

func _fill_rect(img: Image, x0: int, y0: int, w: int, h: int, c: Color):
	for yy in range(y0, mini(y0 + h, img.get_height())):
		for xx in range(x0, mini(x0 + w, img.get_width())):
			if xx >= 0 and yy >= 0:
				img.set_pixel(xx, yy, c)

# ==========================================
# タイル — 床
# ==========================================

func _make_stone_floor() -> ImageTexture:
	var img = _create_img()
	var base = Color(0.91, 0.84, 0.72)  # #E8D5B7
	# 4x4 石畳グリッド
	for gy in range(4):
		for gx in range(4):
			var stone_color = _color_vary(base, 0.06)
			var sx = gx * 8
			var sy = gy * 8
			_fill_rect(img, sx, sy, 8, 8, stone_color)
			# 目地（暗い線）
			for i in range(8):
				if sx + i < 32:
					img.set_pixel(sx + i, sy, base.darkened(0.25))
				if sy + i < 32:
					img.set_pixel(sx, sy + i, base.darkened(0.25))
			# ハイライト
			if sx + 1 < 32 and sy + 1 < 32:
				img.set_pixel(sx + 1, sy + 1, stone_color.lightened(0.15))
	return _to_tex(img)

func _make_wood_floor() -> ImageTexture:
	var img = _create_img()
	var base = Color(0.545, 0.353, 0.169)
	for y in range(32):
		for x in range(32):
			var grain = sin(float(x) * 0.8 + float(y) * 0.1) * 0.05
			var c = Color(base.r + grain, base.g + grain * 0.7, base.b + grain * 0.3)
			img.set_pixel(x, y, _color_vary(c, 0.02))
	return _to_tex(img)

func _make_cave_floor() -> ImageTexture:
	var img = _create_img()
	var base = Color(0.627, 0.490, 0.420)  # #A0926B 寄り
	for y in range(32):
		for x in range(32):
			var noise_val = sin(float(x) * 1.3) * cos(float(y) * 0.9) * 0.08
			img.set_pixel(x, y, _color_vary(Color(base.r + noise_val, base.g + noise_val, base.b + noise_val), 0.04))
	return _to_tex(img)

func _make_grass_floor() -> ImageTexture:
	var img = _create_img()
	var base = Color(0.396, 0.663, 0.318)
	for y in range(32):
		for x in range(32):
			img.set_pixel(x, y, _color_vary(base, 0.06))
	# 草の模様（緑の縦線を数本）
	for i in range(8):
		var gx = randi_range(2, 29)
		var gy = randi_range(0, 24)
		for dy in range(8):
			if gy + dy < 32:
				img.set_pixel(gx, gy + dy, base.lightened(0.2))
	return _to_tex(img)

func _make_entrance_floor() -> ImageTexture:
	var img = _create_img()
	var base = Color(0.941, 0.902, 0.549)  # #F0E68C
	for y in range(32):
		for x in range(32):
			img.set_pixel(x, y, _color_vary(base, 0.03))
	# 矢印模様（中央に三角）
	for dy in range(8):
		var half_w = dy
		for dx in range(-half_w, half_w + 1):
			var px = 16 + dx
			var py = 12 + dy
			if px >= 0 and px < 32 and py >= 0 and py < 32:
				img.set_pixel(px, py, base.darkened(0.3))
	return _to_tex(img)

func _make_save_point() -> ImageTexture:
	var img = _create_img()
	var base = Color(0.498, 1.0, 0.831)  # #7FFFD4
	# 背景
	for y in range(32):
		for x in range(32):
			img.set_pixel(x, y, Color(0.91, 0.84, 0.72))  # 普通の床色
	# 光の円
	var cx = 16
	var cy = 16
	for y in range(32):
		for x in range(32):
			var dist = sqrt(pow(x - cx, 2) + pow(y - cy, 2))
			if dist < 10:
				var alpha = 1.0 - dist / 10.0
				var glow = base.lightened(alpha * 0.3)
				glow.a = 0.5 + alpha * 0.5
				img.set_pixel(x, y, glow)
	return _to_tex(img)

func _make_chest_tile() -> ImageTexture:
	var img = _create_img()
	# 床
	for y in range(32):
		for x in range(32):
			img.set_pixel(x, y, Color(0.91, 0.84, 0.72))
	# 宝箱（中央に箱を描画）
	var chest_color = Color(0.855, 0.647, 0.125)  # #DAA520
	_fill_rect(img, 10, 14, 12, 10, chest_color)
	_fill_rect(img, 10, 14, 12, 2, chest_color.darkened(0.2))  # 蓋
	_fill_rect(img, 14, 18, 4, 4, Color(1, 1, 0.6))  # 鍵穴
	return _to_tex(img)

func _make_water() -> ImageTexture:
	var img = _create_img()
	var base = Color(0.392, 0.584, 0.929)  # #6495ED
	for y in range(32):
		for x in range(32):
			var wave = sin(float(x) * 0.5 + float(y) * 0.3) * 0.08
			var c = Color(base.r + wave, base.g + wave, base.b)
			img.set_pixel(x, y, _color_vary(c, 0.03))
	# 波紋ハイライト
	for i in range(4):
		var wx = randi_range(4, 27)
		var wy = randi_range(4, 27)
		img.set_pixel(wx, wy, Color(1, 1, 1, 0.6))
		if wx + 1 < 32:
			img.set_pixel(wx + 1, wy, Color(1, 1, 1, 0.4))
	return _to_tex(img)

# ==========================================
# タイル — 壁
# ==========================================

func _make_stone_wall() -> ImageTexture:
	var img = _create_img()
	var base = Color(0.545, 0.451, 0.333)  # #8B7355
	# レンガパターン
	for row in range(4):
		var offset_x = 0 if row % 2 == 0 else 4
		for col in range(4):
			var bx = col * 8 + offset_x
			var by = row * 8
			var brick_color = _color_vary(base, 0.07)
			_fill_rect(img, bx % 32, by, 7, 7, brick_color)
			# モルタル
			for i in range(8):
				var px = (bx + i) % 32
				if by + 7 < 32:
					img.set_pixel(px, by + 7, base.darkened(0.3))
	return _to_tex(img)

func _make_cave_wall() -> ImageTexture:
	var img = _create_img()
	var base = Color(0.361, 0.251, 0.133)  # #5C4033
	for y in range(32):
		for x in range(32):
			var noise_val = sin(float(x) * 2.1 + float(y) * 1.7) * 0.1
			img.set_pixel(x, y, _color_vary(Color(base.r + noise_val, base.g + noise_val, base.b + noise_val), 0.05))
	return _to_tex(img)

func _make_wall_top() -> ImageTexture:
	var img = _create_img()
	var base = Color(0.4, 0.35, 0.3)
	for y in range(32):
		for x in range(32):
			img.set_pixel(x, y, _color_vary(base, 0.04))
	return _to_tex(img)

func _make_wood_wall() -> ImageTexture:
	var img = _create_img()
	var base = Color(0.42, 0.27, 0.13)
	for y in range(32):
		for x in range(32):
			var grain = sin(float(y) * 1.5 + float(x) * 0.05) * 0.06
			img.set_pixel(x, y, Color(base.r + grain, base.g + grain * 0.5, base.b))
	# 板目の境界線
	for bx in [0, 8, 16, 24]:
		for y in range(32):
			img.set_pixel(bx, y, base.darkened(0.3))
	return _to_tex(img)

# ==========================================
# キャラクター — 主人公
# ==========================================

func _make_hero_sprite() -> ImageTexture:
	var img = _create_img(16, 24)
	var skin = Color(0.961, 0.871, 0.702)     # 肌色
	var hair = Color(0.2, 0.15, 0.35)          # 紫がかった黒髪
	var body_main = Color(0.35, 0.2, 0.55)     # 紫の着物
	var body_accent = Color(0.5, 0.3, 0.7)     # 着物アクセント
	var belt = Color(0.85, 0.65, 0.2)          # 帯
	var pants = Color(0.25, 0.25, 0.35)        # 袴
	var shoes = Color(0.3, 0.2, 0.15)          # 靴

	# 髪（上部）
	_fill_rect(img, 4, 0, 8, 3, hair)
	_fill_rect(img, 3, 1, 10, 2, hair)
	# 顔
	_fill_rect(img, 5, 3, 6, 5, skin)
	# 目
	img.set_pixel(6, 5, Color(0.1, 0.1, 0.2))
	img.set_pixel(9, 5, Color(0.1, 0.1, 0.2))
	# 口
	img.set_pixel(7, 7, Color(0.8, 0.4, 0.4))
	img.set_pixel(8, 7, Color(0.8, 0.4, 0.4))
	# 着物（胴体）
	_fill_rect(img, 4, 8, 8, 5, body_main)
	_fill_rect(img, 6, 8, 4, 5, body_accent)  # 前合わせ
	# 帯
	_fill_rect(img, 4, 12, 8, 2, belt)
	# 袴
	_fill_rect(img, 4, 14, 8, 6, pants)
	# 足
	_fill_rect(img, 4, 20, 3, 4, shoes)
	_fill_rect(img, 9, 20, 3, 4, shoes)
	# 腕
	_fill_rect(img, 2, 9, 2, 5, body_main)
	_fill_rect(img, 12, 9, 2, 5, body_main)
	# 手
	_fill_rect(img, 2, 13, 2, 2, skin)
	_fill_rect(img, 12, 13, 2, 2, skin)

	return _to_tex(img)

func _make_healer_sprite() -> ImageTexture:
	var img = _create_img(16, 24)
	var skin = Color(0.961, 0.871, 0.702)
	var hair = Color(0.1, 0.1, 0.5)            # 藍色の髪
	var body_main = Color(1.0, 0.95, 0.95)     # 白衣
	var body_accent = Color(0.7, 0.85, 1.0)    # 水色のアクセント
	var belt = Color(0.6, 0.3, 0.5)
	var skirt = Color(0.9, 0.85, 0.95)
	var shoes = Color(0.6, 0.45, 0.35)

	# 髪（長め）
	_fill_rect(img, 4, 0, 8, 3, hair)
	_fill_rect(img, 3, 1, 10, 3, hair)
	_fill_rect(img, 3, 4, 2, 6, hair)  # 左サイドの髪
	_fill_rect(img, 11, 4, 2, 6, hair) # 右サイドの髪
	# 顔
	_fill_rect(img, 5, 3, 6, 5, skin)
	# 目
	img.set_pixel(6, 5, Color(0.1, 0.2, 0.5))
	img.set_pixel(9, 5, Color(0.1, 0.2, 0.5))
	# 口
	img.set_pixel(7, 7, Color(0.85, 0.5, 0.5))
	img.set_pixel(8, 7, Color(0.85, 0.5, 0.5))
	# 白衣
	_fill_rect(img, 4, 8, 8, 4, body_main)
	_fill_rect(img, 5, 8, 6, 4, body_accent)
	# 帯
	_fill_rect(img, 4, 11, 8, 2, belt)
	# スカート
	_fill_rect(img, 3, 13, 10, 6, skirt)
	# 足
	_fill_rect(img, 5, 19, 2, 5, shoes)
	_fill_rect(img, 9, 19, 2, 5, shoes)
	# 腕
	_fill_rect(img, 2, 9, 2, 4, body_main)
	_fill_rect(img, 12, 9, 2, 4, body_main)
	_fill_rect(img, 2, 12, 2, 2, skin)
	_fill_rect(img, 12, 12, 2, 2, skin)

	return _to_tex(img)

# ==========================================
# NPC汎用
# ==========================================

func _make_npc_sprite(body_color: Color, head_color: Color) -> ImageTexture:
	var img = _create_img(16, 24)
	var skin = head_color
	var hair = body_color.darkened(0.3)
	var clothes = body_color
	var shoes = Color(0.3, 0.2, 0.15)

	# 髪
	_fill_rect(img, 4, 0, 8, 3, hair)
	_fill_rect(img, 3, 1, 10, 2, hair)
	# 顔
	_fill_rect(img, 5, 3, 6, 5, skin)
	# 目
	img.set_pixel(6, 5, Color(0.15, 0.15, 0.15))
	img.set_pixel(9, 5, Color(0.15, 0.15, 0.15))
	# 胴体
	_fill_rect(img, 4, 8, 8, 6, clothes)
	# 足元
	_fill_rect(img, 4, 14, 8, 6, clothes.darkened(0.15))
	_fill_rect(img, 4, 20, 3, 4, shoes)
	_fill_rect(img, 9, 20, 3, 4, shoes)
	# 腕
	_fill_rect(img, 2, 9, 2, 5, clothes)
	_fill_rect(img, 12, 9, 2, 5, clothes)

	return _to_tex(img)

# ==========================================
# 敵キャラクター
# ==========================================

func _make_enemy_fairy() -> ImageTexture:
	var img = _create_img(16, 16)
	var wing = Color(0.9, 0.75, 1.0, 0.7)
	var body = Color(0.6, 1.0, 0.7)
	# 羽（左右）
	_fill_rect(img, 1, 3, 4, 6, wing)
	_fill_rect(img, 11, 3, 4, 6, wing)
	# 体（楕円風）
	_fill_rect(img, 5, 2, 6, 10, body)
	_fill_rect(img, 6, 1, 4, 12, body)
	# 目
	img.set_pixel(6, 5, Color(0, 0, 0))
	img.set_pixel(9, 5, Color(0, 0, 0))
	return _to_tex(img)

func _make_enemy_bee() -> ImageTexture:
	var img = _create_img(16, 16)
	var yellow = Color(1.0, 0.85, 0.0)
	var black = Color(0.1, 0.1, 0.1)
	var wing = Color(0.8, 0.9, 1.0, 0.5)
	# 体（横縞）
	for row in range(4, 12):
		var stripe = yellow if (row % 2 == 0) else black
		_fill_rect(img, 5, row, 6, 1, stripe)
	# 羽
	_fill_rect(img, 2, 2, 4, 4, wing)
	_fill_rect(img, 10, 2, 4, 4, wing)
	# 針
	img.set_pixel(8, 12, black)
	img.set_pixel(8, 13, black)
	# 目
	img.set_pixel(6, 5, Color(1, 0, 0))
	img.set_pixel(9, 5, Color(1, 0, 0))
	return _to_tex(img)

func _make_enemy_fox() -> ImageTexture:
	var img = _create_img(16, 16)
	var fur = Color(0.9, 0.7, 0.3)
	var white = Color(1.0, 0.95, 0.9)
	# 体
	_fill_rect(img, 3, 5, 10, 8, fur)
	# 顔
	_fill_rect(img, 5, 2, 6, 5, fur)
	# 耳
	_fill_rect(img, 4, 0, 3, 3, fur)
	_fill_rect(img, 9, 0, 3, 3, fur)
	# 腹
	_fill_rect(img, 5, 8, 6, 4, white)
	# 目
	img.set_pixel(6, 4, Color(0.8, 0.2, 0.1))
	img.set_pixel(9, 4, Color(0.8, 0.2, 0.1))
	# しっぽ
	_fill_rect(img, 12, 6, 3, 2, fur)
	img.set_pixel(14, 5, white)
	return _to_tex(img)

func _make_enemy_boss() -> ImageTexture:
	var img = _create_img(24, 24)
	var bark = Color(0.45, 0.25, 0.15)
	var sakura = Color(1.0, 0.72, 0.77)
	var glow = Color(0.9, 0.6, 0.85)
	# 幹
	_fill_rect(img, 9, 10, 6, 14, bark)
	_fill_rect(img, 8, 12, 8, 10, bark)
	# 枝
	_fill_rect(img, 4, 8, 6, 3, bark)
	_fill_rect(img, 14, 8, 6, 3, bark)
	# 桜の花（上部に丸く）
	for y in range(0, 12):
		for x in range(0, 24):
			var dist = sqrt(pow(x - 12, 2) + pow(y - 6, 2))
			if dist < 8:
				img.set_pixel(x, y, _color_vary(sakura, 0.08))
	# 目（幹の上部）
	img.set_pixel(10, 13, glow)
	img.set_pixel(13, 13, glow)
	# 口
	_fill_rect(img, 10, 16, 4, 1, Color(0.3, 0.1, 0.1))
	return _to_tex(img)
