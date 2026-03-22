shader_type spatial;
render_mode unshaded, blend_add, cull_disabled;

// 降り注ぐ光のエフェクト（HD-2D LightRays）
// 斜めに差し込む光の筋を複数本描画する

uniform vec4 color_bright : source_color = vec4(1.0, 0.95, 0.8, 0.15);
uniform vec4 color_dim : source_color = vec4(1.0, 0.9, 0.7, 0.03);
uniform float speed : hint_range(0.0, 2.0) = 0.2;
uniform float ray_count : hint_range(1.0, 10.0) = 4.0;
uniform float ray_width : hint_range(0.01, 0.5) = 0.12;
uniform float angle : hint_range(-1.0, 1.0) = 0.4;
uniform float fade_top : hint_range(0.0, 1.0) = 0.2;
uniform float fade_bottom : hint_range(0.0, 1.0) = 0.8;

void fragment() {
	vec2 uv = UV;

	// UV を角度で回転させ、斜めの光筋を作る
	float rotated_x = uv.x * cos(angle) - uv.y * sin(angle);

	// 複数の光の筋を合成
	float rays = 0.0;
	for (float i = 0.0; i < ray_count; i++) {
		float phase = i / ray_count;
		float scroll = TIME * speed * (0.08 + phase * 0.04);
		float ray = smoothstep(ray_width, 0.0,
			abs(fract(rotated_x * (1.5 + i * 0.3) + phase + scroll) - 0.5));
		// 各光線で幅に微妙な差を出す
		rays += ray * (0.7 + phase * 0.3);
	}
	rays = clamp(rays, 0.0, 1.0);

	// 上下方向のフェード（光は上から降ってくるので上が明るく下が暗い）
	float vertical_fade = smoothstep(fade_top, fade_bottom, uv.y);
	vertical_fade = 1.0 - vertical_fade;

	vec4 col = mix(color_dim, color_bright, rays);
	float final_alpha = col.a * rays * vertical_fade;

	ALBEDO = col.rgb;
	ALPHA = final_alpha;
}
