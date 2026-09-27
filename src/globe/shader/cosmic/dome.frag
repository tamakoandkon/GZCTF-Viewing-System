// 星云穹顶片元着色器 v2：fbm 域扭曲流动 + 哈勃经典配色（深紫/青/橙金）+ 银河带 + 内置星点
// 性能：与 v1 相同 —— 每像素仍仅 2 次 fbm 采样；移动端 LOW_QUALITY 时 fbm 降为 3 阶
// v2 新增：银道带（沿水平大圆的密度增强）+ 星点亮度/色温分化，均为零新增噪声采样

uniform float uTime;
uniform vec3 uColorBase;    // 底色：近黑紫
uniform vec3 uColorA;       // 主云：深紫
uniform vec3 uColorB;       // 次云：青
uniform vec3 uColorAccent;  // 点缀：橙金
uniform float uIntensity;   // 整体强度
uniform float uStarGrid;    // 内置星点网格密度

varying vec3 vDir;

// ---------------- hash / value noise ----------------
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f); // smoothstep 缓动
  return mix(
    mix(mix(hash3(i + vec3(0, 0, 0)), hash3(i + vec3(1, 0, 0)), f.x),
        mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
        mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

// ---------------- fbm ----------------
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
#ifdef LOW_QUALITY
  for (int i = 0; i < 3; i++) {
#else
  for (int i = 0; i < 4; i++) {
#endif
    value += amplitude * noise3(p);
    p *= 2.1;
    amplitude *= 0.5;
  }
  return value;
}

// ---------------- 2D hash（星点/抖动用） ----------------
float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec3 dir = normalize(vDir);
  float t = uTime;

  // 域扭曲：时间系数极小 => 星云轻微流动
  vec3 p = dir * 2.4;
  float q = fbm(p + vec3(t * 0.005, t * 0.003, 0.0));
  float n = fbm(p + q * 1.7 + vec3(t * 0.008, 0.0, -t * 0.004));

  // 银道带：沿水平大圆的柔和密度增强（零额外噪声采样，只有一次 exp）
  float band = exp(-pow(dir.y * 2.6, 2.0));
  float nb = clamp(n + band * 0.22, 0.0, 1.0);

  // 哈勃配色映射
  vec3 col = uColorBase;
  col = mix(col, uColorA, smoothstep(0.35, 0.75, nb));
  col = mix(col, uColorB, smoothstep(0.55, 0.95, nb) * 0.6);
  // 高频亮区点缀橙金；银道带内更暖（星尘）
  float accent = smoothstep(0.72, 0.98, nb) * smoothstep(0.4, 0.8, q);
  col += uColorAccent * (accent * 0.35 + band * 0.05);
  // 整体亮度压暗，保证地球主体焦点
  col *= uIntensity;

  // 内置星点（球面网格 hash，微闪）：按到格心的角距离衰减
  // 注：旧实现是"整格加亮"，每个命中格会渲染成 2.5° 球面四边形投影出的
  //     30~40px 不规则白斑（随闪烁如碎块）。改为点状衰减后是 ~3px 的柔和小星。
  vec3 cell = floor(dir * uStarGrid);
  float starRand = hash3(cell);
  if (starRand > 0.99) {
    float cellSize = 1.0 / uStarGrid;                      // 单格角尺寸（弧度）
    vec3 cellCenter = normalize((cell + 0.5) / uStarGrid);  // 格心方向
    float d = distance(cellCenter, dir);                    // 到格心的角距离
    float falloff = 1.0 - smoothstep(0.0, cellSize * 0.38, d);
    if (falloff > 0.001) {
      float twinkle = 0.6 + 0.4 * sin(t * (0.4 + starRand * 2.0) + starRand * 40.0);
      float starBrightness = (starRand - 0.99) / 0.01; // 0~1
      // 用 cell 派生一个稳定色温（冷白 ~ 暖黄）
      float temp = hash3(cell + 7.3);
      vec3 tint = mix(vec3(0.82, 0.90, 1.0), vec3(1.0, 0.93, 0.80), temp);
      col += tint * starBrightness * twinkle * 0.55 * uIntensity * falloff;
    }
  }

  // 防色带抖动
  col += (hash2(gl_FragCoord.xy) - 0.5) / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
