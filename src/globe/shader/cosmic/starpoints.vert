// 星点/银河点云顶点着色器 v2
// v2 新增（全部在 GPU 侧完成，CPU 每帧零开销）：
//   ① 逐点差速漂移：每颗星按自身速率绕 Y 轴微旋转 —— 星场"搅动"而非刚体转动
//   ② 低频摆动：轻微上下起伏，制造呼吸般的立体纵深感
//   ③ 双频闪烁：慢包络 × 快微闪，比单正弦更接近真实大气扰动
//   ④ 尺寸钳制：低 dpr 屏幕保底可见、高 dpr 屏幕不糊成大团块
attribute float aScale;   // 尺寸系数（幂律分布：多小星、少大星）
attribute float aPhase;   // 闪烁/摆动相位
attribute float aSpeed;   // 逐点速率（闪烁与漂移共用 -> 自然去同步）
attribute float aFlare;   // 0=普通星 1=亮星（片元阶段出十字衍射光芒）
attribute vec3 aColor;

uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;
uniform float uTwinkleSpeed;
uniform float uSizeAtten; // 1.0=随距离衰减（星点层）0.0=固定像素（银河带，杜绝近处大团块）
uniform float uDrift;     // 逐点差速漂移速率
uniform float uSway;      // 垂直摆动幅度（世界单位）
uniform float uMinSize;   // 最小像素（dpr 归一后）
uniform float uMaxSize;   // 最大像素（防止近距离星点糊成一坨）

varying float vTwinkle;
varying float vFlare;
varying vec3 vColor;

void main() {
  vec3 pos = position;

  // ① 逐点差速漂移（绕 Y 轴）
  float ang = uDrift * uTime * aSpeed;
  float cs = cos(ang);
  float sn = sin(ang);
  vec2 xz = pos.xz;
  pos.xz = vec2(xz.x * cs - xz.y * sn, xz.x * sn + xz.y * cs);

  // ② 低频摆动：与漂移同相位族，避免整齐划一
  pos.y += sin(uTime * 0.15 * aSpeed + aPhase) * uSway;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float atten = mix(1.0, 300.0 / max(-mvPosition.z, 1.0), uSizeAtten);
  float size = uSize * aScale * uPixelRatio * atten;
  gl_PointSize = clamp(size, uMinSize * uPixelRatio, uMaxSize * uPixelRatio);

  // ③ 双频闪烁：慢包络 × 快微闪
  float slow = 0.74 + 0.26 * sin(uTime * aSpeed * 0.35 * uTwinkleSpeed + aPhase);
  float fast = 0.90 + 0.10 * sin(uTime * aSpeed * 2.30 * uTwinkleSpeed + aPhase * 1.7);
  vTwinkle = slow * fast;

  vFlare = aFlare;
  vColor = aColor;
}
