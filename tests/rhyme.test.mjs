// 2단계 검증: 라임 판정
//   node tests/rhyme.test.mjs ["가사"]
import fs from 'fs';
import { loadEnglishData, analyzePronunciation } from '../js/pronounce.js';
import { analyzeRhymes, describeGroups, setLexicon, lexiconFromKo } from '../js/rhyme.js';

loadEnglishData(JSON.parse(fs.readFileSync(new URL('../data/en-words.json', import.meta.url))));
setLexicon(lexiconFromKo(JSON.parse(fs.readFileSync(new URL('../data/ko-words.json', import.meta.url)))));
const TEST = `너의 money 내 머니 다 같은 소리
밤새 달려 갈망한 날 봐 이제 팔자
flow 위로 올라 so 높이 날아
문제없어 끝없어 계속 걸어`;
const text = process.argv[2] ? fs.existsSync(process.argv[2]) ? fs.readFileSync(process.argv[2], 'utf8') : process.argv[2] : TEST;
const opts = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const t0 = Date.now();
const pron = analyzePronunciation(text);
const r = analyzeRhymes(pron, opts);
const ms = Date.now() - t0;
console.log(describeGroups(pron, r).join('\n'));
console.log('\n끝라임:', r.scheme.verses.map(v => v.blocks.map(b => `${b.pattern}${b.name ? '(' + b.name + ')' : ''}`).join(' ')).join(' / '));
console.log(`점수 ${r.scores.total} (${r.scores.grade}) 밀도 ${(r.scores.density * 100).toFixed(1)}% · 다음절 ${r.scores.multiCount}개 평균 ${r.scores.avgLen.toFixed(2)} · ${ms}ms`);
r.scores.parts.forEach(p => console.log(`  ${p.label} ${p.value}/${p.max}  ${p.basis}`));
// 하이라이트 미리보기
for (const l of r.content) {
  let s = '';
  l.syl.forEach(i => { const g = r.sylGroup[i]; s += pron.syllables[i].ch + (g >= 0 ? `${r.sylRepeat[i] ? '~' : ''}${g + 1}` : '') + ' '; });
  console.log(`L${l.n + 1} ${s}`);
}

if (!process.argv[2]) {
  const has = (texts) => r.groups.some(g => texts.every(t => g.members.some(m => m.text.replace(/\s+/g, ' ').includes(t))));
  const checks = [['money/머니/너의', ['money', '머니', '너의']], ['날 봐/갈망/팔자', ['날 봐', '갈망', '팔자']], ['flow/so/위로', ['flow', 'so', '로']], ['없어/없어/걸어', ['없어', '걸어']]];
  let ok = 0;
  for (const [name, t] of checks) { const pass = has(t); if (pass) ok++; console.log(`${pass ? '✓' : '✗'} ${name}`); }
  const rep = r.groups.some(g => g.members.filter(m => m.text === '없어').length === 2 && g.members.some(m => m.repeat));
  console.log(`${rep ? '✓' : '✗'} 없어/없어 반복 표시`);
  if (ok < checks.length || !rep) process.exitCode = 1;
}
