// 두 버전의 정확도 비교: 지금 코드와 예전 커밋을 같은 정답 세트로 채점한다.
//   node tests/gold/compare.mjs [git-ref]      (기본: v1.3.2 = 8edb4da)
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { loadEngine, evaluate, summarize, formatSummary } from './eval.mjs';
import { CASES } from './cases.mjs';
import { HELDOUT } from './heldout.mjs';

const ref = process.argv[2] || '8edb4da';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rhyme-old-'));
execSync(`git archive ${ref} js data | tar -x -C "${dir}"`, { cwd: new URL('../../', import.meta.url) });
for (const [name, root] of [[`이전 (${ref})`, pathToFileURL(dir + path.sep)], ['현재', new URL('../../', import.meta.url)]]) {
  const engine = await loadEngine(root);
  for (const [label, set] of [['개발용', CASES], ['검증용', HELDOUT]]) {
    console.log(`\n== ${name} · ${label} ${set.length}개`);
    console.log(formatSummary(summarize(evaluate(engine, set))));
  }
}
fs.rmSync(dir, { recursive: true, force: true });
