import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2];
if (!input) {
    console.error('Usage: node scripts/analyze-top3-perf-report.mjs <report.json>');
    process.exit(1);
}

const filePath = path.resolve(process.cwd(), input);
const raw = fs.readFileSync(filePath, 'utf8');
const report = JSON.parse(raw);

const summary = report.summary ?? {};
const spikes = Array.isArray(report.spikes) ? report.spikes : [];

const fmt = (n, digits = 3) => (typeof n === 'number' ? n.toFixed(digits) : 'null');

console.log('name:', report.name);
console.log('durationMs:', fmt(report.durationMs, 1));
console.log('frameCount:', summary.frameCount ?? null);
console.log('fpsAvg:', fmt(summary.fpsAvg, 2));
console.log('fpsMin:', fmt(summary.fpsMin, 2));
console.log('cpuMax(ms):', fmt(summary.cpuMax, 2));
console.log('camDMax:', fmt(summary.camDMax, 4));
console.log('tgtDMax:', fmt(summary.tgtDMax, 4));
console.log('spikes:', spikes.length);
if (summary.spikeWindow) {
    console.log('spikeWindow(ms since start):', fmt(summary.spikeWindow.firstSinceStart, 1), '-', fmt(summary.spikeWindow.lastSinceStart, 1));
}

const violations = [];
if (typeof summary.fpsMin === 'number' && summary.fpsMin < 60) violations.push(`fpsMin < 60 (${summary.fpsMin.toFixed(2)})`);
if (typeof summary.cpuMax === 'number' && summary.cpuMax > 16.7) violations.push(`cpuMax > 16.7ms (${summary.cpuMax.toFixed(2)})`);
if (typeof summary.camDMax === 'number' && summary.camDMax > 0.5) violations.push(`camera jump > 0.5 (${summary.camDMax.toFixed(4)})`);
if (typeof summary.tgtDMax === 'number' && summary.tgtDMax > 0.5) violations.push(`target jump > 0.5 (${summary.tgtDMax.toFixed(4)})`);

if (violations.length) {
    console.log('status: FAIL');
    for (const v of violations) console.log('-', v);
    process.exit(2);
} else {
    console.log('status: PASS');
}

