// 회귀 테스트: 사용자 제보로 고친 판정
//   node tests/regress.test.mjs
import fs from 'fs';
import { loadEnglishData, analyzePronunciation } from '../js/pronounce.js';
import { analyzeRhymes, setLexicon, lexiconFromKo } from '../js/rhyme.js';

loadEnglishData(JSON.parse(fs.readFileSync(new URL('../data/en-words.json', import.meta.url))));
setLexicon(lexiconFromKo(JSON.parse(fs.readFileSync(new URL('../data/ko-words.json', import.meta.url)))));
const run = t => analyzeRhymes(analyzePronunciation(t));
const texts = g => g.members.filter(m => !m.repeat).map(m => m.text);
const has = (g, w) => texts(g).some(t => t.includes(w));
let fail = 0;
const check = (name, ok) => { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) fail++; };

// 1) 같은 글자로만 끝나는 줄(원투훅/이건훅)은 라임이 아니라 반복
{
  const r = run('원투훅\n이건훅\n너는훅');
  check('훅/훅/훅 = 반복 (라임 그룹 없음)', !r.groups.some(g => texts(g).filter(t => t.endsWith('훅')).length >= 2));
}
// 2) 거의 같은 구절(인조이라는게/인조이하는게)은 반복
{
  const r = run('인조이라는게 뭐 어렵냐\n인조이하는게 뭐 어렵냐');
  check('인조이라는게/인조이하는게 = 반복', !r.groups.some(g => g.len >= 4 && texts(g).length >= 2));
}
// 3) 사전에 있는 낱말의 끝 음절(종이의 '이')은 조사로 보지 않는다
{
  const r = run('그건 그냥 종이\n너는 내가 좋니');
  check('종이/좋니 라임', r.groups.some(g => has(g, '종이') && has(g, '좋니')));
}
// 4) 단어 첫머리 멤버(조이|보이가)도 같은 소리 그룹에 붙는다
{
  const r = run('이건 그저 종이\n너는 그게 좋니\n다 조이보이가 돼');
  check('종이/좋니/조이', r.groups.some(g => ['종이', '좋니', '조이'].every(t => has(g, t))));
}
// 5) 여러 단어에 걸친 첫머리 구간(다 같)은 그렇게 붙지 않는다 — 기존 동작 유지 확인용으로 산문 밀도
{
  const prose = fs.readFileSync(new URL('./fixtures/prose.txt', import.meta.url), 'utf8');
  const d = run(prose).scores.density;
  check(`산문 라임 밀도 낮게 유지 (${(d * 100).toFixed(1)}% < 6%)`, d < 0.06);
}
// 6) '훅'으로 시작하는 가사 줄은 머리말이 아니다
{
  const lines = ['(훅 가버려)', '훅 가버려', 'Intro는 짧게 갈게'].map(t => analyzePronunciation(t).lines[0]);
  const heads = ['[Verse 1: 이름]', '(Hook)', '훅 2'].map(t => analyzePronunciation(t).lines[0]);
  check('가사 줄은 머리말로 빼지 않음', lines.every(l => !l.header) && heads.every(l => l.header));
}
if (fail) process.exitCode = 1;
