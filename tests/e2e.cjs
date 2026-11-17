// 브라우저 종단 테스트 (아이폰 13 화면 흉내, 오프라인 재시작 포함)
//   node tests/e2e.cjs [스크린샷 폴더]                         저장소를 임시 서버로 띄워서 검사
//   BASE=https://choihs-ai.github.io/rhyme/ node tests/e2e.cjs  배포된 주소를 검사
const { chromium, devices } = require('playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');

const SP = process.argv[2] || require('os').tmpdir() + '/rhyme-e2e';
fs.mkdirSync(SP + '/shots', { recursive: true });

// GitHub Pages 와 같은 /rhyme/ 경로로 저장소를 서비스한다 (서비스 워커 범위가 같아야 오프라인 검사가 맞다)
function serveRepo() {
  const root = path.resolve(__dirname, '..');
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!rel.startsWith('/rhyme/')) { res.writeHead(404).end(); return; }
    rel = rel.slice('/rhyme/'.length) || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}/rhyme/` })));
}

(async () => {
  const local = process.env.BASE ? null : await serveRepo();
  const BASE = process.env.BASE || local.base;
  let fail = 0;
  const check = (name, ok) => { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) fail++; };
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  // 광고 스크립트처럼 바깥 주소를 못 불러온 것은 앱 오류가 아니므로 세지 않는다
  const external = m => /Failed to load resource/.test(m.text()) && !(m.location().url || '').startsWith(new URL(BASE).origin);
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !external(m)) errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /사전 한국어/.test(document.querySelector('#dict-status').textContent), null, { timeout: 15000 });
  console.log('dict:', await page.textContent('#dict-status'), '| ver:', await page.textContent('#ver'));
  // 첫 방문은 예시 가사 분석이 바로 보인다 → '내 가사 넣기'로 입력칸을 연다
  await page.waitForSelector('#notice:not([hidden])', { timeout: 15000 });
  await page.screenshot({ path: SP + '/shots/01-home.png' });
  await page.click('#notice [data-mine]');
  await page.click('#btn-sample');
  await page.waitForSelector('#lyrics-view .m');
  await page.waitForTimeout(600);
  await page.screenshot({ path: SP + '/shots/02-highlight.png', fullPage: true });
  const chips = await page.$$eval('#legend .chip[data-g]', els => els.map(e => e.textContent.trim()));
  console.log('groups:', chips);
  check('예시 가사에서 라임 그룹이 보인다', chips.length >= 3);
  // 그룹 강조
  await page.click('#legend .chip[data-g="0"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: SP + '/shots/03-focus.png', fullPage: true });
  await page.click('#legend .chip[data-g="-1"]');
  // 음절 팝업
  await page.click('.m[data-g="0"] .s >> nth=2');
  await page.waitForSelector('#sheet:not([hidden])');
  await page.waitForTimeout(250);
  await page.screenshot({ path: SP + '/shots/04-sheet.png' });
  await page.click('#sheet .sheet-head [data-close]');
  // 발음 보기
  await page.check('#hl-pron', { force: true });
  await page.waitForTimeout(200);
  await page.screenshot({ path: SP + '/shots/05-pron.png', fullPage: true });
  // 점수
  await page.click('#tab-score');
  await page.waitForTimeout(200);
  await page.screenshot({ path: SP + '/shots/06-score.png', fullPage: true });
  // 구조도
  await page.click('#tab-struct');
  await page.waitForTimeout(200);
  await page.screenshot({ path: SP + '/shots/07-struct.png', fullPage: true });
  // 추천
  await page.click('#tab-rec');
  await page.fill('#rec-input', '머니');
  await page.click('#rec-form button[type=submit]');
  await page.waitForSelector('#rec-out .word');
  await page.screenshot({ path: SP + '/shots/08-rec.png', fullPage: true });
  const recWords = await page.$$eval('#rec-out .word', els => els.map(e => e.dataset.word));
  console.log('rec first:', recWords.slice(0, 8));
  check('추천: 머니 → honey', recWords.includes('honey'));
  // 이미지·JSON 내보내기
  await page.click('#tab-hl');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), page.click('#btn-image')]);
  if (dl) await dl.saveAs(SP + '/shots/export.png');
  check('이미지 저장', !!dl && fs.statSync(SP + '/shots/export.png').size > 10000);
  const [dj] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), page.click('#btn-json')]);
  if (dj) await dj.saveAs(SP + '/shots/export.json');
  check('JSON 저장', !!dj && JSON.parse(fs.readFileSync(SP + '/shots/export.json', 'utf8')).groups.length >= 3);
  // 오프라인
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => console.log('no controller yet'));
  console.log('sw status:', await page.textContent('#sw-status'));
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  check('오프라인: 사전 불러옴', await page.waitForFunction(() => /사전 한국어/.test(document.querySelector('#dict-status').textContent), null, { timeout: 15000 }).then(() => true, () => false));
  check('오프라인: 분석 결과 표시', await page.waitForSelector('#lyrics-view .m', { timeout: 10000 }).then(() => true, () => false));
  await page.screenshot({ path: SP + '/shots/09-offline.png' });
  check('콘솔 오류 없음', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
  console.log(`스크린샷: ${SP}/shots`);
  await browser.close();
  if (local) local.server.close();
  if (fail) process.exitCode = 1;
})();
