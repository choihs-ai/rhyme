const { chromium, devices } = require('playwright');
// 브라우저 종단 테스트 (아이폰 13 화면 흉내, 오프라인 재시작 포함)
//   1) 저장소의 부모 폴더에서: python3 -m http.server 8765   (→ http://localhost:8765/rhyme/)
//   2) node tests/e2e.cjs [스크린샷 폴더]
const SP = process.argv[2] || require('os').tmpdir() + '/rhyme-e2e';
require('fs').mkdirSync(SP + '/shots', { recursive: true });
const BASE = process.env.BASE || 'http://localhost:8765/rhyme/';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => /사전 한국어/.test(document.querySelector('#dict-status').textContent), null, { timeout: 15000 });
  console.log('dict:', await page.textContent('#dict-status'), '| ver:', await page.textContent('#ver'));
  await page.screenshot({ path: SP + '/shots/01-home.png' });
  await page.click('#btn-sample');
  await page.waitForSelector('#lyrics-view .m');
  await page.waitForTimeout(600);
  await page.screenshot({ path: SP + '/shots/02-highlight.png', fullPage: true });
  console.log('groups:', await page.$$eval('#legend .chip[data-g]', els => els.map(e => e.textContent.trim())));
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
  console.log('rec first:', await page.$$eval('#rec-out .word', els => els.slice(0, 8).map(e => e.dataset.word)));
  // JSON / 이미지 생성 함수 직접 확인
  // 이미지 다운로드
  await page.click('#tab-hl');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), page.click('#btn-image')]);
  if (dl) { await dl.saveAs(SP + '/shots/export.png'); console.log('image saved'); } else console.log('no download event');
  const [dj] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), page.click('#btn-json')]);
  if (dj) { await dj.saveAs(SP + '/shots/export.json'); console.log('json saved'); }
  // 오프라인
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => console.log('no controller yet'));
  console.log('sw status:', await page.textContent('#sw-status'));
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => /사전 한국어/.test(document.querySelector('#dict-status').textContent), null, { timeout: 15000 }).catch(() => console.log('offline dict FAIL'));
  await page.waitForSelector('#lyrics-view .m', { timeout: 10000 }).then(() => console.log('offline analysis OK')).catch(() => console.log('offline analysis FAIL'));
  await page.screenshot({ path: SP + '/shots/09-offline.png' });
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  if (errors.length) process.exitCode = 1;
  await browser.close();
})();
