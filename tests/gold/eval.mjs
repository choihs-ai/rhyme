// 정답 세트 채점기
//   node tests/gold/eval.mjs            요약 + 실패 목록
//   node tests/gold/eval.mjs -v         모든 케이스의 그룹 출력
//   node tests/gold/eval.mjs --json     결과를 JSON 으로 (전후 비교 기록용)
import fs from 'fs';
import { CASES } from './cases.mjs';

export async function loadEngine(root = new URL('../../', import.meta.url)) {
  const P = await import(new URL('js/pronounce.js', root));
  const R = await import(new URL('js/rhyme.js', root));
  const en = JSON.parse(fs.readFileSync(new URL('data/en-words.json', root)));
  const ko = JSON.parse(fs.readFileSync(new URL('data/ko-words.json', root)));
  P.loadEnglishData(en);
  if (R.setLexicon) R.setLexicon(R.lexiconFromKo(ko));
  return { analyze: (text, opt) => { const pron = P.analyzePronunciation(text); return { pron, rhyme: R.analyzeRhymes(pron, opt) }; }, describe: R.describeGroups };
}

// "2:갈망#1" → 그 조각에 걸친 음절 번호들
function resolve(pron, content, spec) {
  const m = /^(\d+):(.+?)(?:#(\d+))?$/.exec(spec);
  if (!m) throw new Error('조각 표기 오류: ' + spec);
  const line = content[+m[1] - 1];
  if (!line) throw new Error(`줄 없음: ${spec}`);
  let at = -1;
  for (let k = 0; k < (+m[3] || 1); k++) at = line.text.indexOf(m[2], at + 1);
  if (at < 0) throw new Error(`"${m[2]}" 를 ${m[1]}번 줄에서 찾지 못함`);
  const s = line.start + at, e = s + m[2].length;
  return line.syl.filter(i => pron.syllables[i].src[0] < e && pron.syllables[i].src[1] > s && pron.syllables[i].src[1] > pron.syllables[i].src[0]);
}

export const PROSE_MAX_DENSITY = 0.2;

export function evaluate(engine, cases = CASES, opt = {}) {
  const out = [];
  for (const c of cases) {
    const { pron, rhyme } = engine.analyze(c.text, opt);
    const content = pron.lines.filter(l => !l.blank && !l.header && l.syl.length);
    const groupsOf = spec => new Map(resolve(pron, content, spec).filter(i => rhyme.sylGroup[i] >= 0).map(i => [rhyme.sylGroup[i], !!rhyme.sylRepeat[i]]));
    const r = { id: c.id, cat: c.cat, pairs: 0, found: 0, nots: 0, notBad: 0, reps: 0, repOk: 0, scheme: null, fp: 0, proseUnits: 0, problems: [] };
    for (const set of c.rhymes || []) {
      for (let i = 0; i < set.w.length; i++) for (let j = i + 1; j < set.w.length; j++) {
        r.pairs++;
        const A = groupsOf(set.w[i]), B = groupsOf(set.w[j]);
        const shared = [...A.keys()].filter(g => B.has(g) && rhyme.groups[g].len >= (set.len || 1));
        if (shared.length) r.found++;
        else {
          const any = [...A.keys()].filter(g => B.has(g));
          r.problems.push(`놓침: ${set.w[i]} ↔ ${set.w[j]}${any.length ? ` (${rhyme.groups[any[0]].len}음절로만 잡힘, ${set.len}음절 기대)` : ''}`);
        }
      }
    }
    for (const [a, b] of c.not || []) {
      r.nots++;
      const A = groupsOf(a), B = groupsOf(b);
      if ([...A.keys()].some(g => B.has(g) && !A.get(g) && !B.get(g))) { r.notBad++; r.problems.push(`오탐: ${a} ↔ ${b}`); }
    }
    for (const spec of c.repeat || []) {
      r.reps++;
      const G = groupsOf(spec);
      if ([...G.values()].every(rep => rep)) r.repOk++; else r.problems.push(`반복인데 라임으로 셈: ${spec}`);
    }
    if (c.none) {
      // 산문에도 우연히 맞는 소리는 있다. 랩 가사(30~60%)와 뚜렷이 갈리는지를 본다: 한 편당 밀도 20% 이하면 통과,
      // 오탐 음절 수는 따로 합산해서 보고한다.
      r.fp = rhyme.scores.rhymeUnits;
      r.proseUnits = rhyme.scores.totalUnits;
      if (rhyme.scores.density > PROSE_MAX_DENSITY) r.problems.push(`산문에서 라임 음절 ${r.fp}개 (밀도 ${(rhyme.scores.density * 100).toFixed(1)}%)`);
    }
    if (c.scheme) {
      const got = rhyme.scheme.verses.map(v => v.pattern).join('/');
      r.scheme = got === c.scheme;
      if (!r.scheme) r.problems.push(`끝라임 구조: ${got} (정답 ${c.scheme})`);
    }
    r.pass = r.problems.length === 0;
    r.groups = engine.describe(pron, rhyme);
    out.push(r);
  }
  return out;
}

export function summarize(results) {
  const sum = k => results.reduce((a, r) => a + r[k], 0);
  const schemes = results.filter(r => r.scheme !== null);
  const cats = {};
  for (const r of results) { const c = (cats[r.cat] = cats[r.cat] || { pass: 0, total: 0 }); c.total++; if (r.pass) c.pass++; }
  return {
    cases: results.length, pass: results.filter(r => r.pass).length,
    pairs: sum('pairs'), found: sum('found'), recall: sum('found') / (sum('pairs') || 1),
    nots: sum('nots') + sum('reps'), notOk: sum('nots') - sum('notBad') + sum('repOk'),
    proseFp: sum('fp'), proseUnits: sum('proseUnits'), schemes: schemes.length, schemeOk: schemes.filter(r => r.scheme).length, cats,
  };
}

export function formatSummary(s) {
  const pct = (a, b) => `${a}/${b} (${b ? Math.round((a / b) * 100) : 100}%)`;
  const lines = [
    `케이스 통과        ${pct(s.pass, s.cases)}`,
    `라임 쌍 재현율     ${pct(s.found, s.pairs)}`,
    `오탐·반복 구분     ${pct(s.notOk, s.nots)}`,
    `끝라임 구조 일치   ${pct(s.schemeOk, s.schemes)}`,
    `산문 대조군 오탐   ${s.proseFp}/${s.proseUnits} 음절 (${s.proseUnits ? ((s.proseFp / s.proseUnits) * 100).toFixed(1) : 0}%)`,
    '분류별: ' + Object.entries(s.cats).map(([k, v]) => `${k} ${v.pass}/${v.total}`).join(' · '),
  ];
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const engine = await loadEngine();
  const results = evaluate(engine);
  const s = summarize(results);
  if (process.argv.includes('--json')) { console.log(JSON.stringify({ summary: s, failed: results.filter(r => !r.pass).map(r => ({ id: r.id, problems: r.problems })) }, null, 1)); }
  else {
    for (const r of results) {
      if (r.pass && !process.argv.includes('-v')) continue;
      console.log(`${r.pass ? '✓' : '✗'} [${r.cat}] ${r.id}`);
      r.problems.forEach(p => console.log('    ' + p));
      if (!r.pass || process.argv.includes('-v')) r.groups.forEach(g => console.log('      ' + g));
    }
    console.log('\n' + formatSummary(s));
  }
}
