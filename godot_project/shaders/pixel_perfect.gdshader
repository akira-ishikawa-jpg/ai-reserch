shader_type spatial;
// ピクセルパーフェクト描画シェーダー
// Sprite3Dに適用してピクセルアートの鮮明な表示を保つ

render_mode unshaded, cull_disabled;

uniform sampler2D albedo_texture : source_color, filter_nearest;
uniform float alpha_cutoff : hint_range(0.0, 1.0) = 0.5;

void fragment() {
	vec4 color = texture(albedo_texture, UV);
	if (color.a < alpha_cutoff) {
		discard;
	}
	ALBEDO = color.rgb;
	ALPHA = color.a;
}
