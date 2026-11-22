// 라임 단어 추천 테스트
//   node tests/recommend.test.mjs              정해 둔 검색어로 확인
//   node tests/recommend.test.mjs 머니 flow    검색어를 주면 결과만 출력
import { recommend } from '../js/recommend.js';
import { loadData } from './data.mjs';
loadData();

// 검색어 → 추천에 꼭 들어 있어야 하는 단어
const EXPECT = {
  머니: ['honey', '주머니'],          // 한국어 검색어에 영어 단어가 섞여 나온다
  flow: ['slow', 'blow', '쓸모'],     // 영어 검색어에 한국어 단어가 섞여 나온다
  갈망: ['빨강', '할당'],
  없어: ['상관없어'],                 // 받침 발음(업써) 기준으로 찾는다
};

const args = process.argv.slice(2);
let fail = 0;
for (const q of args.length ? args : Object.keys(EXPECT)) {
  const t0 = performance.now();
  const r = recommend(q, { limit: 14 });
  const ms = performance.now() - t0;
  console.log(`\n${q} → [${r.pron}] ${r.pattern} (${ms.toFixed(0)}ms)`);
  for (const g of r.groups.slice(0, 3)) console.log(`  ${g.len}음절: ` + g.items.map(i => `${i.w}${i.lang === 'en' ? '(' + i.pron + ')' : ''}:${Math.round(i.score * 100)}`).join(' '));
  if (args.length) continue;
  const words = new Set(r.groups.flatMap(g => g.items.map(i => i.w)));
  for (const w of EXPECT[q]) {
    const ok = words.has(w);
    console.log(`${ok ? '✓' : '✗'} ${q} 추천에 ${w}`);
    if (!ok) fail++;
  }
}

// 이름·브랜드는 스위치를 켰을 때만 섞인다
if (!args.length) {
  const words = (q, opt) => new Set(recommend(q, { limit: 14, ...opt }).groups.flatMap(g => g.items.map(i => i.w)));
  for (const [q, name] of [['flow', '타블로'], ['love', '비너스'], ['돈', '신촌'], ['강남', '한남']]) {
    const on = words(q, { names: true }).has(name), off = !words(q).has(name);
    console.log(`${on && off ? '✓' : '✗'} ${q} 추천: 이름·브랜드를 켜면 ${name}, 끄면 없음`);
    if (!(on && off)) fail++;
  }
}
if (fail) process.exitCode = 1;
