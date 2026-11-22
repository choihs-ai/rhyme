// 회귀 테스트: 사용자 제보로 고친 판정
//   node tests/regress.test.mjs
import fs from 'fs';
import { analyzePronunciation } from '../js/pronounce.js';
import { analyzeRhymes } from '../js/rhyme.js';
import { loadData } from './data.mjs';

loadData();
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
  // v1.4.0 부터 10%: 조사가 다른 낱말 쌍(아침|에 / 많이)도 잡게 하면서 우연한 일치가 한두 개 늘었다 (랩 가사는 30~60%)
  check(`산문 라임 밀도 낮게 유지 (${(d * 100).toFixed(1)}% < 10%)`, d < 0.1);
}
// 6) '훅'으로 시작하는 가사 줄은 머리말이 아니다
{
  const lines = ['(훅 가버려)', '훅 가버려', 'Intro는 짧게 갈게'].map(t => analyzePronunciation(t).lines[0]);
  const heads = ['[Verse 1: 이름]', '(Hook)', '훅 2'].map(t => analyzePronunciation(t).lines[0]);
  check('가사 줄은 머리말로 빼지 않음', lines.every(l => !l.header) && heads.every(l => l.header));
}
// 7) 같은 말로 끝나는 줄은 그 앞에서 라임을 듣는다 (간다 아이가 / 안다 아이가)
{
  const r = run('니 뭐하노 내 지금 간다 아이가\n밥은 뭇나 걱정 마라 내 다 안다 아이가');
  check('반복 꼬리 앞 라임: 간다/안다', r.groups.some(g => has(g, '간다') && has(g, '안다')));
}
// 8) 라임 조각이 단어 중간에서 끝나지 않는다 (발자|국), 약한 다음절과 받침 없는 1음절 잡음은 잡지 않는다
{
  const r = run(`새벽 네 시 반 꺼지지 않는 모니터
식어 버린 커피 옆에 쌓인 메모지
남들 잘 때 깨어 있는 게 내 습관
날 비웃던 놈들 지금은 숨 참아
바닥부터 기어 올라온 내 발자국`);
  const all = r.groups.flatMap(g => g.members.map(m => m.text.trim()));
  check('단어 중간에서 끝나는 조각 없음 (발자)', !all.includes('발자'));
  check('약한 다음절 없음 (않는 모니터 / 닥부터 기어)', !r.groups.some(g => has(g, '모니터') && has(g, '기어')));
  check('줄 안 받침 없는 1음절 잡음 없음 (때 / 게 / 내)', !r.groups.some(g => ['때', '게'].every(t => texts(g).includes(t))));
}
// 9) 영어 단어는 일부만 라임이어도 단어 전체로 보인다 (ti 가 아니라 bugatti)
{
  const r = run('람보르기니 타고 달려 옆엔 bugatti\n어제의 나는 없어 이제는 다 my time');
  const all = r.groups.flatMap(g => g.members.map(m => m.text.trim()));
  check('영어 조각은 단어 전체 (bugatti)', all.includes('bugatti') && !all.includes('ti'));
}

if (fail) process.exitCode = 1;
