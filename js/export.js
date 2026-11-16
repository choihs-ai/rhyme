// 분석 결과를 글과 JSON 으로 내보낸다 (화면 요소를 쓰지 않는 순수 변환)
import { groupStyle, TAG_LABEL, pct } from './ui/highlight.js';

export function buildTextSummary(st, version) {
  const { pron, rhyme } = st;
  const sc = rhyme.scores;
  const out = [];
  out.push(`[라임 스캐너 ${version}] 점수 ${sc.total}/100 (${sc.grade}) · 라임 밀도 ${pct(sc.density)} · 다음절 ${sc.multiCount}개(평균 ${sc.avgLen.toFixed(2)}음절)`);
  out.push(`끝라임 구조: ${rhyme.scheme.verses.map(v => v.blocks.map(b => b.pattern + (b.name ? `(${b.name})` : '')).join(' ')).join(' / ')}`);
  out.push('');
  out.push('라임 그룹');
  for (const g of rhyme.groups) {
    out.push(`#${g.id + 1} [${g.pattern}] ${g.len}음절 ${g.tags.map(t => TAG_LABEL[t]).join('·')}: ${g.members.map(m => m.text + (m.repeat ? '(반복)' : '')).join(' / ')}`);
  }
  out.push('');
  out.push('점수 근거');
  for (const p of sc.parts) out.push(`- ${p.label} ${p.value}/${p.max}: ${p.basis}`);
  out.push('');
  out.push('발음');
  for (const l of rhyme.content) out.push(`${l.n + 1}. ${l.words.map(wi => pron.words[wi].pron).join(' ')}`);
  return out.join('\n');
}

// 가사 모션 엔진 연동용 JSON: 음절별 발음, 라임 그룹 ID, 원문 위치
export function buildExport(st, version) {
  const { pron, rhyme, theme, options } = st;
  const S = pron.syllables;
  const schemeOf = new Map(rhyme.scheme.lines.map(l => [l.line, l.letter]));
  return {
    format: 'rhyme-scanner/v1',
    app: { name: '라임 스캐너', version },
    createdAt: new Date().toISOString(),
    options,
    notes: 'start/end = 원문(text) 문자 오프셋 [start, end). group/member = groups[].id / members 인덱스 (라임 아니면 null). epenthetic = 영어 음차에서 끼워 넣은 모음(으 등). extended = 표시용으로만 그룹 색을 이어 칠한 삽입모음 음절.',
    text: pron.text,
    lines: rhyme.content.map(l => ({ index: l.n, rawIndex: l.idx, verse: l.verse, text: l.text, start: l.start, end: l.end, scheme: schemeOf.get(l.idx) || null, syllables: l.syl.slice(), words: l.words.slice() })),
    words: pron.words.map(w => ({ index: w.idx, text: w.text, start: w.start, end: w.end, line: pron.lines[w.line].n, lang: w.lang, orth: w.orth, pron: w.pron, syllables: w.syl.map(s => s.i) })),
    syllables: S.map((s, i) => ({
      index: i, text: s.ch, orth: s.orth, onset: s.cho, vowel: s.jung, coda: s.jong, epenthetic: s.ep, lang: s.lang,
      line: s.ln, word: s.word, start: s.src[0], end: s.src[1],
      group: rhyme.sylColor[i] >= 0 ? rhyme.sylColor[i] : null,
      member: rhyme.sylColor[i] >= 0 ? rhyme.sylMember[i] : null,
      repeat: !!rhyme.sylRepeat[i], extended: !!rhyme.sylExt[i],
    })),
    groups: rhyme.groups.map(g => ({
      id: g.id, length: g.len, pattern: g.pattern, vowels: g.vowels, rime: g.rime, tags: g.tags, color: groupStyle(g.id, theme).c,
      members: g.members.map(m => ({ syllables: m.units, length: m.len, start: m.src[0], end: m.src[1], text: m.text, pron: m.pron, line: m.ln, lineEnd: m.lineEnd, repeat: m.repeat })),
    })),
    scheme: rhyme.scheme.verses.map(v => ({ verse: v.verse, pattern: v.pattern, blocks: v.blocks })),
    scores: {
      total: rhyme.scores.total, grade: rhyme.scores.grade, density: rhyme.scores.density, rhymeSyllables: rhyme.scores.rhymeUnits,
      totalSyllables: rhyme.scores.totalUnits, repeatSyllables: rhyme.scores.repeatUnits, multiCount: rhyme.scores.multiCount, averageMultiLength: rhyme.scores.avgLen,
      parts: rhyme.scores.parts, top5: rhyme.scores.top5,
      perLine: rhyme.scores.perLine.map(l => ({ line: l.n, density: l.density, rhyme: l.rhyme, syllables: l.units })),
      perVerse: rhyme.scores.perVerse,
    },
  };
}
