// 점수: 라임 밀도 40 + 다음절 25 + 끝라임 15 + 다양성 10 + 반복 회피 10
import { canonVowel } from './similarity.js';

export function computeScores(pron, r) {
  const S = pron.syllables;
  const total = S.length || 1;
  let rhymeU = 0, repeatU = 0, multiU = 0;
  for (const g of r.groups) for (const m of g.members) {
    if (m.repeat) { repeatU += m.len; continue; }
    rhymeU += m.len;
    if (m.len >= 2) multiU += m.len;
  }
  const density = rhymeU / total;
  const multiGroups = r.groups.filter(g => g.len >= 2);
  const multiInst = r.groups.flatMap(g => g.members.filter(m => !m.repeat && m.len >= 2));
  const avgLen = multiInst.length ? multiInst.reduce((s, m) => s + m.len, 0) / multiInst.length : 0;
  const top5 = [...r.groups].sort((a, b) => b.len - a.len || b.members.length - a.members.length).slice(0, 5)
    .map(g => ({ id: g.id, len: g.len, pattern: g.pattern, rime: g.rime, texts: g.members.filter(m => !m.repeat).map(m => m.text) }));

  // 줄별·절별 밀도
  const perLine = r.content.map(l => {
    let u = 0;
    l.syl.forEach(i => { if (r.sylGroup[i] >= 0 && !r.sylRepeat[i]) u++; });
    return { line: l.idx, n: l.n, verse: l.verse, units: l.syl.length, rhyme: u, density: l.syl.length ? u / l.syl.length : 0 };
  });
  const perVerse = [];
  perLine.forEach(p => {
    let v = perVerse.find(x => x.verse === p.verse);
    if (!v) perVerse.push(v = { verse: p.verse, units: 0, rhyme: 0, lines: 0 });
    v.units += p.units; v.rhyme += p.rhyme; v.lines++;
  });
  perVerse.forEach(v => { v.density = v.units ? v.rhyme / v.units : 0; });

  const lines = r.content.length || 1;
  const endRhymed = r.scheme.lines.filter(l => l.letter !== 'X').length;
  const keys = new Set(r.groups.map(g => g.vowels.map(canonVowel).join('')));
  const repeatRatio = repeatU / ((rhymeU + repeatU) || 1);
  const dens30 = Math.min(1, density / 0.3); // 라임이 적으면 다양성·반복 점수도 줄인다

  const parts = [
    { key: 'density', label: '라임 밀도', max: 40, value: 40 * Math.min(1, density / 0.45), basis: `라임 음절 ${rhymeU} / 전체 ${S.length} = ${(density * 100).toFixed(1)}% (45% 이상 만점)` },
    { key: 'multi', label: '다음절 라임', max: 25, value: 15 * Math.min(1, (multiU / total) / 0.25) + 10 * Math.min(1, Math.max(0, avgLen - 1) / 2), basis: `다음절 음절 비율 ${((multiU / total) * 100).toFixed(1)}% (25% 만점, 15점) + 평균 길이 ${avgLen.toFixed(2)}음절 (3음절 만점, 10점)` },
    { key: 'end', label: '끝라임', max: 15, value: 15 * (endRhymed / lines), basis: `끝라임이 맞는 줄 ${endRhymed} / ${r.content.length}줄` },
    { key: 'variety', label: '다양성', max: 10, value: 10 * Math.min(1, keys.size / Math.max(3, lines * 0.6)) * dens30, basis: `서로 다른 모음 패턴 ${keys.size}개 (줄 수 × 0.6 = ${Math.max(3, lines * 0.6).toFixed(1)}개 만점)${dens30 < 1 ? ` × 밀도 보정 ${dens30.toFixed(2)}` : ''}` },
    { key: 'original', label: '반복 회피', max: 10, value: 10 * (1 - Math.min(1, repeatRatio * 2)) * dens30, basis: `같은 말 반복 음절 ${repeatU}개 (라임 대비 ${(repeatRatio * 100).toFixed(0)}%, 50% 이상이면 0점)${dens30 < 1 ? ` × 밀도 보정 ${dens30.toFixed(2)}` : ''}` },
  ];
  parts.forEach(p => { p.value = Math.round(p.value * 10) / 10; });
  const totalScore = Math.round(parts.reduce((s, p) => s + p.value, 0));
  return {
    total: totalScore, parts, density, rhymeUnits: rhymeU, repeatUnits: repeatU, totalUnits: S.length,
    multiCount: multiInst.length, multiGroups: multiGroups.length, avgLen, top5, perLine, perVerse,
    grade: totalScore >= 85 ? 'S' : totalScore >= 70 ? 'A' : totalScore >= 55 ? 'B' : totalScore >= 40 ? 'C' : 'D',
  };
}
