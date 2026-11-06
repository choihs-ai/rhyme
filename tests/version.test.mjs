// 버전 동기화 확인: js/app.js 와 sw.js 의 VERSION 이 같아야 새 캐시로 교체된다.
import fs from 'fs';
const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8').match(/VERSION = '([^']+)'/)[1];
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8').match(/const VERSION = '([^']+)'/)[1];
const files = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8').match(/APP_FILES = \[([\s\S]*?)\]/)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
const missing = files.filter(f => f !== './' && !fs.existsSync(new URL('../' + f, import.meta.url)));
console.log(`app ${app} / sw ${sw} → ${app === sw ? '일치' : '불일치!'}${missing.length ? ` · 캐시 목록에 없는 파일: ${missing.join(', ')}` : ' · 캐시 목록 파일 모두 존재'}`);
if (app !== sw || missing.length) process.exitCode = 1;
