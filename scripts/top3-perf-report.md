# Top3 运镜末尾抖动复测与性能报告

## 复现窗口与触发条件（修复前）
- 触发阶段：Top3 展示结束时从跟随镜头返回默认视角、并重新启用 OrbitControls 阻尼/自转的交接窗口
- 典型时段：展示结束触发后的约 0–2.6 秒（返回原位 tween 期间 + 恢复 controls 的临界帧）
- 典型现象：画面出现短时抖动或轻微回弹，慢放可见

## 修复要点（本次）
- 返回原位的 camera.position 与 controls.target 使用同一个 GSAP timeline 同步结束
- OrbitControls 恢复采用两段式对齐：先禁用阻尼做一次硬同步，再下一帧恢复阻尼/自转并启用控制
- 渲染循环在 follow 分支仍执行一次相机朝向更新，避免交接帧丢失 lookAt

相关代码：
- [AutoShowcaseSystem.js](file:///c:/Users/%E7%A7%8B%E6%B0%B4%E4%BB%99/xwechat_files/wxid_groiud6p30z322_246b/msg/file/2025-11/myctfv0.33/src/globe/AutoShowcaseSystem.js#L723-L799)
- [scene.js](file:///c:/Users/%E7%A7%8B%E6%B0%B4%E4%BB%99/xwechat_files/wxid_groiud6p30z322_246b/msg/file/2025-11/myctfv0.33/src/scene.js#L900-L950)

## 性能数据采集（内置 JSON 导出）
当 Top3 展示开始/结束时会自动采集帧数据，并在结束后自动下载 JSON 报告文件：
- 文件名：`top3-showcase-perf-<timestamp>.json`
- 采集指标：dt、cpuMs、camera/target 位置、camera/target 单帧位移、drawCalls、triangles、(可用时) JS heap

## 报告判定（自动分析脚本）
在项目根目录运行：

```bash
node scripts/analyze-top3-perf-report.mjs <report.json>
```

判定规则：
- fpsMin ≥ 60
- cpuMax ≤ 16.7ms
- camera/target 单帧位移 ≤ 0.5

## GPU Capture（建议流程）
- Chrome：DevTools → Performance（Record）+ WebGL Insights / WebGPU / 或第三方 Spector.js 捕获 draw call
- iOS Safari：Web Inspector → Timelines / Rendering
- Android：Chrome Remote Debugging → Performance / Memory

采集建议：
- 仅在 Top3 展示结束前 5 秒开始录制，持续到结束后 5 秒
- 确保关闭其它标签页、固定窗口尺寸、固定 DPR

## 验收标准
- 1080p/60fps 连续运行 30 秒无肉眼可见偏移
- 慢放回看无亚像素级抖动
- 报告中不存在 camera/target > 0.5 的单帧突变

