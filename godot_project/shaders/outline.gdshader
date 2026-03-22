shader_type spatial;
// アウトラインシェーダー
// キャラクターやオブジェクトの輪郭を強調する

render_mode unshaded, cull_front;

uniform vec4 outline_color : source_color = vec4(0.1, 0.08, 0.15, 1.0);
uniform float outline_width : hint_range(0.0, 0.1) = 0.02;

void vertex() {
	VERTEX += NORMAL * outline_width;
}

void fragment() {
	ALBEDO = outline_color.rgb;
	ALPHA = outline_color.a;
}
