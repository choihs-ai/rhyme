// 라임 단어 추천 테스트
//   node tests/recommend.test.mjs              정해 둔 검색어로 확인
//   node tests/recommend.test.mjs 머니 flow    검색어를 주면 결과만 출력
import fs from 'fs';
import { loadEnglishData } from '../js/pronounce.js';
import { setDictionaries, recommend } from '../js/recommend.js';
const en = JSON.parse(fs.readFileSync(new URL('../data/en-words.json', import.meta.url)));
const ko = JSON.parse(fs.readFileSync(new URL('../data/ko-words.json', import.meta.url)));
loadEnglishData(en);
setDictionaries(ko, en);

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
if (fail) process.exitCode = 1;
