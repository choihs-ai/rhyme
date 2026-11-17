// 테스트를 한 번에 돌린다: npm test (= node tests/run.mjs)
//   -v  통과한 테스트의 출력도 모두 보여 준다
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const SUITES = [
  ['pronounce.test.mjs', '발음 변환'],
  ['rhyme.test.mjs', '라임 판정 (예시 가사)'],
  ['regress.test.mjs', '회귀 (제보로 고친 판정)'],
  ['gold.test.mjs', '정답 세트 (개발용 + 검증용)'],
  ['recommend.test.mjs', '라임 단어 추천'],
  ['version.test.mjs', '버전·오프라인 캐시 목록'],
];
const verbose = process.argv.includes('-v');
let failed = 0;
for (const [file, label] of SUITES) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [fileURLToPath(new URL(file, import.meta.url))], { encoding: 'utf8' });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${label.padEnd(28)} ${file}  (${Date.now() - t0}ms)`);
  if (!ok || verbose) console.log((r.stdout + r.stderr).replace(/^/gm, '    '));
}
console.log(failed ? `\n실패 ${failed}개` : `\n모두 통과 (${SUITES.length}개 묶음)`);
process.exitCode = failed ? 1 : 0;
