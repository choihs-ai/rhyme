// 배포 점검: 버전 번호와 오프라인 캐시 목록
//   - js/app.js 와 sw.js 의 VERSION 이 같아야 새 캐시로 교체된다
//   - js/ 아래 모든 모듈이 서비스 워커 캐시 목록에 있어야 오프라인에서 실행된다
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const app = read('js/app.js').match(/VERSION = '([^']+)'/)[1];
const sw = read('sw.js').match(/const VERSION = '([^']+)'/)[1];
const cached = read('sw.js').match(/APP_FILES = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));

const modules = [];
(function walk(dir) {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (e.isDirectory()) walk(`${dir}/${e.name}`); else if (e.name.endsWith('.js')) modules.push(`${dir}/${e.name}`);
  }
})('js');

const missingFiles = cached.filter(f => f !== './' && !fs.existsSync(path.join(root, f)));
const uncached = modules.filter(f => !cached.includes(f));
const problems = [];
if (app !== sw) problems.push(`버전 불일치: app ${app} / sw ${sw}`);
if (missingFiles.length) problems.push(`캐시 목록에 있지만 없는 파일: ${missingFiles.join(', ')}`);
if (uncached.length) problems.push(`캐시 목록에서 빠진 모듈: ${uncached.join(', ')}`);
console.log(problems.length ? problems.map(p => '✗ ' + p).join('\n') : `✓ 버전 ${app} 일치 · 모듈 ${modules.length}개 모두 오프라인 캐시 목록에 있음`);
if (problems.length) process.exitCode = 1;
