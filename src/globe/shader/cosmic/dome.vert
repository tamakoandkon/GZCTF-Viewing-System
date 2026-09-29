// 星云穹顶顶点着色器：传球面方向作为噪声输入，避免极点 UV 挤压
varying vec3 vDir;

void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
