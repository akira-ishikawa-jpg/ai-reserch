shader_type spatial;
render_mode unshaded, cull_disabled;

// ==========================================
// バトル用シェーダー
// ダメージフラッシュ（白/赤に一瞬光る）＋ スキル発動時のオーラ
// ==========================================

// --- ダメージフラッシュ ---
uniform float flash_intensity : hint_range(0.0, 1.0) = 0.0;
uniform vec4 flash_color : source_color = vec4(1.0, 0.3, 0.3, 1.0);

// --- オーラエフェクト ---
uniform float aura_intensity : hint_range(0.0, 1.0) = 0.0;
uniform vec4 aura_color : source_color = vec4(1.0, 0.75, 0.8, 1.0);
uniform float aura_speed : hint_range(0.0, 5.0) = 2.0;
uniform float aura_thickness : hint_range(0.0, 0.2) = 0.05;

// --- 季節カラーモーフ ---
uniform vec4 season_color_from : source_color = vec4(1.0, 1.0, 1.0, 1.0);
uniform vec4 season_color_to : source_color = vec4(1.0, 1.0, 1.0, 1.0);
uniform float season_morph : hint_range(0.0, 1.0) = 0.0;

// --- アウトライン ---
uniform float outline_width : hint_range(0.0, 0.1) = 0.0;
uniform vec4 outline_color : source_color = vec4(1.0, 1.0, 1.0, 1.0);

// --- テクスチャ ---
uniform sampler2D main_texture : source_color, filter_nearest;

// ==========================================
// ノイズ関数（オーラの波紋用）
// ==========================================

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// ==========================================
// 頂点シェーダー
// ==========================================

void vertex() {
    // オーラ発動時：頂点を法線方向に膨張
    if (aura_intensity > 0.0) {
        float wave = sin(TIME * aura_speed + VERTEX.y * 4.0) * 0.5 + 0.5;
        VERTEX += NORMAL * aura_thickness * aura_intensity * wave;
    }

    // アウトライン（バックフェース方式ではなく、スケールで対応）
    if (outline_width > 0.0) {
        // アウトラインはフラグメントで処理するため、頂点では何もしない
    }
}

// ==========================================
// フラグメントシェーダー
// ==========================================

void fragment() {
    // ベースカラー取得
    vec4 base_color = texture(main_texture, UV);

    // 透明部分は捨てる
    if (base_color.a < 0.1) {
        discard;
    }

    vec3 final_color = base_color.rgb;

    // --- 季節カラーモーフ ---
    if (season_morph > 0.0) {
        vec3 season_tint = mix(season_color_from.rgb, season_color_to.rgb, season_morph);
        final_color = mix(final_color, final_color * season_tint, 0.3);
    }

    // --- ダメージフラッシュ ---
    // flash_intensity が 1.0 のとき完全に flash_color になる
    if (flash_intensity > 0.0) {
        final_color = mix(final_color, flash_color.rgb, flash_intensity);
    }

    // --- オーラエフェクト ---
    if (aura_intensity > 0.0) {
        // UV端に近いほどオーラが強い（輪郭発光）
        float edge_dist = min(min(UV.x, 1.0 - UV.x), min(UV.y, 1.0 - UV.y));
        float edge_factor = 1.0 - smoothstep(0.0, 0.15, edge_dist);

        // 時間で波打つノイズ
        float n = noise(UV * 8.0 + TIME * aura_speed);
        float aura_mask = edge_factor * n * aura_intensity;

        // オーラ色を加算
        vec3 aura = aura_color.rgb * aura_mask * 2.0;
        final_color += aura;

        // 発光（エミッション的な明るさ追加）
        final_color += aura_color.rgb * aura_intensity * 0.15;
    }

    // --- アウトライン（エッジ検出の簡易版）---
    if (outline_width > 0.0) {
        vec2 tex_size = vec2(textureSize(main_texture, 0));
        vec2 pixel = 1.0 / tex_size;

        float a_left   = texture(main_texture, UV + vec2(-pixel.x * 2.0, 0.0)).a;
        float a_right  = texture(main_texture, UV + vec2( pixel.x * 2.0, 0.0)).a;
        float a_up     = texture(main_texture, UV + vec2(0.0, -pixel.y * 2.0)).a;
        float a_down   = texture(main_texture, UV + vec2(0.0,  pixel.y * 2.0)).a;

        float edge = step(0.1, base_color.a) * (1.0 - step(0.1, min(min(a_left, a_right), min(a_up, a_down))));

        if (edge > 0.5 && outline_width > 0.0) {
            final_color = outline_color.rgb;
        }
    }

    ALBEDO = final_color;
    ALPHA = base_color.a;
}
