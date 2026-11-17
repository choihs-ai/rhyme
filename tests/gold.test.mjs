// 정답 세트 테스트: 개발용 65개와 검증용 24개 가사를 분석해 정답과 견준다.
//   node tests/gold.test.mjs        요약, 실패한 케이스는 엔진이 낸 그룹까지 출력
//   node tests/gold.test.mjs -v     모든 케이스 출력
// 통과 조건: 모든 케이스 통과 + 산문 대조군의 오탐 음절이 세트 전체에서 10% 이하
import { loadEngine, evaluate, summarize, formatSummary } from './gold/eval.mjs';
import { CASES } from './gold/cases.mjs';
import { HELDOUT } from './gold/heldout.mjs';

const PROSE_MAX_TOTAL = 0.1;
const verbose = process.argv.includes('-v');
const engine = await loadEngine();
let fail = 0;
for (const [label, set] of [['개발용', CASES], ['검증용', HELDOUT]]) {
  const results = evaluate(engine, set);
  const s = summarize(results);
  console.log(`\n== ${label} ${set.length}개`);
  for (const r of results) {
    if (r.pass && !verbose) continue;
    console.log(`${r.pass ? '✓' : '✗'} [${r.cat}] ${r.id}`);
    r.problems.forEach(p => console.log('    ' + p));
    r.groups.forEach(g => console.log('      ' + g));
  }
  console.log(formatSummary(s));
  if (s.pass < s.cases) fail++;
  if (s.proseUnits && s.proseFp / s.proseUnits > PROSE_MAX_TOTAL) {
    console.log(`✗ 산문 대조군 오탐이 ${PROSE_MAX_TOTAL * 100}% 를 넘음`);
    fail++;
  }
}
if (fail) process.exitCode = 1;
