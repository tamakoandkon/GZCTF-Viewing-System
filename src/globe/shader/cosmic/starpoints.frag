// 星点/银河点云片元着色器 v2：柔光核 + 白热核心 + 亮星十字衍射 + 加法发光
// 光影层次：外圈柔和光晕（纹理径向渐变）→ 内圈高光核 → 亮星四向星芒
uniform sampler2D uTexture;
uniform float uIntensity;
uniform float uFlareStrength; // 亮星十字光芒强度（银河带可调低）

varying float vTwinkle;
varying float vFlare;
varying vec3 vColor;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  vec4 tex = texture2D(uTexture, gl_PointCoord);

  // 白热核心：高次幂让中心向白偏（模拟真实恒星的高斯核 + 饱和）
  float core = pow(tex.a, 3.0);
  vec3 col = mix(vColor, vec3(1.0), core * 0.85) * tex.rgb;

  // 亮星十字衍射光芒（四向星芒，仅在亮星上出现）
  if (vFlare > 0.001) {
    float spike = exp(-abs(uv.x) * 26.0) + exp(-abs(uv.y) * 26.0);
    float halo = smoothstep(0.5, 0.05, length(uv));
    col += vec3(1.0) * spike * halo * vFlare * uFlareStrength;
  }

  float alpha = tex.a * vTwinkle * uIntensity;
  if (alpha < 0.008) discard;
  gl_FragColor = vec4(col, alpha);
}
