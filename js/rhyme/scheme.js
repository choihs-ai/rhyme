// 끝라임 구조: 줄 끝끼리의 라임을 AABB / ABAB / ABBA 같은 기호로 나타낸다.
// 하이라이트 그룹과 따로 계산한다 (줄 끝 음절이 다른 다음절 그룹에 묶여 있어도 구조는 보이게).
import { isLexical } from './endings.js';

const SCHEME_NAMES = { AABB: '커플릿(AABB)', ABAB: '교차운(ABAB)', ABBA: '포옹운(ABBA)', AAAA: '모노라임(AAAA)', AAXA: '루바이(AABA)', ABCB: '발라드(ABCB)', XAXA: '발라드(XAXA)' };

export function computeScheme(pron, r, { ending, pairV, pairC }) {
  const S = pron.syllables;
  const opt = r.options;
  // 각 줄의 끝 음절 = 마지막 실제(삽입모음 아닌) 음절
  const endOf = l => { for (let i = l.syl[l.syl.length - 1]; i >= l.syl[0]; i--) if (!S[i].ep) return i; return l.syl[l.syl.length - 1]; };
  const verses = new Map();
  for (const l of r.content) { if (!verses.has(l.verse)) verses.set(l.verse, []); verses.get(l.verse).push(l); }
  // 두 줄 끝이 라임인가
  const rhymes = (x, y) => {
    let i = endOf(x), j = endOf(y);
    const gi = r.sylGroup[i], gj = r.sylGroup[j];
    if (gi >= 0 && gi === gj) return true;
    // 양쪽 줄 끝에 같은 소리의 조사·어미가 붙어 있으면 그 앞(어간 끝)을 비교한다: 간다/산다 → 간/산, 갔다/먹는다 → 갇/는
    let stripped = false;
    while (ending[i] && ending[j] && pairV(i, j) >= 0.9 && i > x.syl[0] && j > y.syl[0]) { i--; j--; stripped = true; }
    if (stripped && (ending[i] || ending[j])) return false;
    if (pairV(i, j) < 0.9) return false;
    if (!opt.vowelOnly && pairC(i, j) < 0.6) return false;
    if (stripped) return pairC(i, j) >= 0.6;   // 어간 한 음절만 근거일 때는 받침까지
    // 같은 글자로 끝나는 줄: 앞 음절까지 맞거나, 사전에 실린 낱말이 낀 서로 다른 단어(기억/추억)일 때만 라임
    if (S[i].orth === S[j].orth && S[i].lang === 'ko' && S[j].lang === 'ko') {
      const prev = i > x.syl[0] && j > y.syl[0] ? pairV(i - 1, j - 1) : 0;
      if (prev >= 0.9) return true;
      const wi = pron.words[S[i].word], wj = pron.words[S[j].word];
      return wi.text !== wj.text && (isLexical(wi) || isLexical(wj));
    }
    return true;
  };
  const lines = [];
  const verseOut = [];
  for (const [v, ls] of verses) {
    const parent = ls.map((_, k) => k);
    const find = k => (parent[k] === k ? k : (parent[k] = find(parent[k])));
    for (let x = 0; x < ls.length; x++) for (let y = x + 1; y < ls.length && y - x <= 3; y++) {
      if (rhymes(ls[x], ls[y])) parent[find(y)] = find(x);
    }
    const size = new Map();
    ls.forEach((_, k) => size.set(find(k), (size.get(find(k)) || 0) + 1));
    const letter = new Map();
    let next = 0;
    const letters = ls.map((_, k) => {
      const root = find(k);
      if (size.get(root) < 2) return 'X';
      if (!letter.has(root)) letter.set(root, String.fromCharCode(65 + (next++ % 26)));
      return letter.get(root);
    });
    ls.forEach((l, k) => lines.push({ line: l.idx, n: l.n, verse: v, letter: letters[k], group: r.sylGroup[endOf(l)], end: endOf(l) }));
    const blocks = [];
    for (let k = 0; k < letters.length; k += 4) {
      const chunk = letters.slice(k, k + 4);
      blocks.push({ from: ls[k].n, pattern: chunk.join(''), name: nameScheme(chunk) });
    }
    verseOut.push({ verse: v, pattern: letters.join(''), blocks });
  }
  return { lines, verses: verseOut };
}

function nameScheme(chunk) {
  if (chunk.length < 4) return '';
  // 문자 정규화 (첫 등장 순서대로 A,B,C)
  const map = new Map(); let n = 0;
  const norm = chunk.map(c => (c === 'X' ? 'X' : (map.has(c) ? map.get(c) : (map.set(c, String.fromCharCode(65 + n++)), map.get(c))))).join('');
  if (SCHEME_NAMES[norm]) return SCHEME_NAMES[norm];
  if (/^AAB?B?$/.test(norm.replace(/X/g, ''))) return '';
  if (norm === 'XXXX') return '끝라임 없음';
  return '자유형';
}
