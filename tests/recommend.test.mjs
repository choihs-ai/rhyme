// 추천 검색 확인: node tests/recommend.test.mjs 머니 flow 갈망
import fs from 'fs';
import { loadEnglishData } from '../js/pronounce.js';
import { setDictionaries, recommend } from '../js/recommend.js';
const en = JSON.parse(fs.readFileSync(new URL('../data/en-words.json', import.meta.url)));
const ko = JSON.parse(fs.readFileSync(new URL('../data/ko-words.json', import.meta.url)));
loadEnglishData(en);
setDictionaries(ko, en);
for (const q of process.argv.slice(2).length ? process.argv.slice(2) : ['머니', 'flow', '갈망', '없어']) {
  const t0 = performance.now();
  const r = recommend(q, { limit: 14 });
  console.log(`\n${q} → [${r.pron}] ${r.pattern} (${(performance.now() - t0).toFixed(0)}ms)`);
  for (const g of r.groups.slice(0, 3)) console.log(`  ${g.len}음절: ` + g.items.map(i => `${i.w}${i.lang === 'en' ? '(' + i.pron + ')' : ''}:${Math.round(i.score * 100)}`).join(' '));
}
