import { Pane } from 'tweakpane'

const pane = new Pane({ title: '🎛️ 场景调试' })
pane.hidden = true

// 默认折叠状态，只在按 G 时显示
export { pane }
