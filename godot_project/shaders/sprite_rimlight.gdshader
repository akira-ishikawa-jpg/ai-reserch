shader_type spatial;
render_mode unshaded, cull_disabled;

// 2Dスプライトにリムライト（輪郭光）を付与するシェーダー
// HD-2D風：光源の色でスプライト輪郭が柔らかく光る

uniform sampler2D sprite_texture : source_color, filter_nearest;
uniform vec4 rim_color : source_color = vec4(1.0, 0.95, 0.8, 1.0);
uniform float rim_width : hint_range(0.5, 5.0) = 1.5;
uniform float rim_intensity : hint_range(0.0, 3.0) = 0.6;
uniform float rim_softness : hint_range(0.0, 1.0) = 0.4;

void fragment() {
	vec4 tex = texture(sprite_texture, UV);

	// テクセルサイズ（ピクセル単位でのエッジ検出用）
	vec2 tex_size = vec2(textureSize(sprite_texture, 0));
	float px = rim_width / tex_size.x;
	float py = rim_width / tex_size.y;

	// 8方向のアルファをサンプリング（エッジ検出）
	float alpha_sum = 0.0;
	alpha_sum += texture(sprite_texture, UV + vec2(px, 0.0)).a;
	alpha_sum += texture(sprite_texture, UV + vec2(-px, 0.0)).a;
	alpha_sum += texture(sprite_texture, UV + vec2(0.0, py)).a;
	alpha_sum += texture(sprite_texture, UV + vec2(0.0, -py)).a;
	// 斜め方向（少し弱く）
	float diag = 0.707;
	alpha_sum += texture(sprite_texture, UV + vec2(px, py) * diag).a * 0.7;
	alpha_sum += texture(sprite_texture, UV + vec2(-px, py) * diag).a * 0.7;
	alpha_sum += texture(sprite_texture, UV + vec2(px, -py) * diag).a * 0.7;
	alpha_sum += texture(sprite_texture, UV + vec2(-px, -py) * diag).a * 0.7;

	// エッジ強度：周囲にアルファがあるが自身のアルファが低い → 輪郭
	float edge = clamp(alpha_sum - tex.a * 6.8, 0.0, 1.0);
	edge = smoothstep(0.0, rim_softness + 0.01, edge);

	// リムライトの合成
	vec3 final_color = mix(tex.rgb, rim_color.rgb, edge * rim_intensity);
	float final_alpha = max(tex.a, edge * rim_color.a * rim_intensity * 0.8);

	ALBEDO = final_color;
	ALPHA = final_alpha;
}
