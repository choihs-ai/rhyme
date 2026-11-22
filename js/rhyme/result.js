// 3단계: 그룹을 화면·내보내기에서 쓰기 좋은 결과 객체로 정리한다.
import { compose } from '../pron/hangul.js';

/**
 * @param groups formGroups() 결과
 * @returns {{groups, sylGroup, sylMember, sylRepeat, sylColor, sylExt}}
 *   groups[i] = { id, len, vowels, pattern, rime, tags, members: [{ key, start, len, units, repeat, line, ln, text, pron, src, lineEnd }] }
 *   sylGroup[음절] = 그룹 id (-1 = 라임 아님),  sylColor = 표시용(삽입모음까지 넓힘),  sylExt = 넓혀서 칠한 음절
 */
export function buildResult(ctx, groups) {
  const { pron, S, U, aligned, spanKey } = ctx;
  // 원문에서 차지하는 범위. 이중모음의 뒷소리(I = 아+이 의 '이')는 원문 글자가 없어서, 거기서 시작하면
  // 앞 단어와의 사이 공백이 딸려 온다. 글자가 있는 첫 음절부터 잡는다.
  const srcSpan = (a, b) => { while (a < b && S[a].src[1] === S[a].src[0]) a++; return [S[a].src[0], S[b].src[1]]; };
  const outGroups = groups.map((ms, id) => {
    // 대표 = 가장 긴 멤버 (같으면 먼저 나온 것)
    const rep = ms.reduce((best, m) => (m.L > best.L ? m : best), ms[0]);
    const vowels = [], rime = [];
    for (let t = 0; t < rep.L; t++) { vowels.push(U[rep.a + t].vj); rime.push(compose('ㅇ', U[rep.a + t].vj, U[rep.a + t].c)); }
    const sameCodas = ms.every(m => { const [sa, sb, L] = aligned(m.a, m.L, rep.a, rep.L); for (let t = 0; t < L; t++) if (U[sa + t].c !== U[sb + t].c) return false; return true; });
    const langs = new Set();
    ms.forEach(m => { for (let t = 0; t < m.L; t++) langs.add(U[m.a + t].lang === 'en' ? 'en' : 'ko'); });
    const lineEnds = ms.filter(m => U[m.end].le).length;
    const sharesLine = new Set(ms.map(m => U[m.a].n)).size < ms.length;
    const tags = [];
    if (lineEnds >= 2) tags.push('end');                                   // 끝라임
    if (rep.L >= 2) tags.push('multi');                                    // 다음절
    if (sharesLine || ms.some(m => !U[m.end].le)) tags.push('internal');   // 내부 라임
    if (!sameCodas) tags.push('vowel');                                    // 모음 라임 (받침은 다름)
    if (langs.size > 1) tags.push('cross');                                // 한영 교차
    return {
      id, len: rep.L, vowels, pattern: vowels.join('-'), rime: rime.join(''), tags,
      members: ms.map(m => ({
        key: spanKey(m.a, m.L),
        start: m.a, len: m.L, units: Array.from({ length: m.L }, (_, t) => m.a + t), repeat: m.repeat, line: S[m.a].line, ln: S[m.a].ln,
        text: pron.text.slice(...srcSpan(m.a, m.end)),
        pron: Array.from({ length: m.L }, (_, t) => S[m.a + t].ch).join(''),
        src: srcSpan(m.a, m.end),
        lineEnd: U[m.end].le,
      })),
    };
  });

  const sylGroup = new Int32Array(S.length).fill(-1);
  const sylRepeat = new Uint8Array(S.length);
  const sylMember = new Int32Array(S.length).fill(-1);
  outGroups.forEach(g => g.members.forEach((m, mi) => m.units.forEach(u => { sylGroup[u] = g.id; sylMember[u] = mi; if (m.repeat) sylRepeat[u] = 1; })));

  // 화면 표시용: 같은 단어 안에서 이어지는 삽입모음 음절까지 색을 넓힌다 (flow 의 '플', best 의 '스트').
  // 영어·숫자는 글자와 음절이 딱 맞지 않아서, 단어 일부만 라임이어도 단어 전체를 보여 준다 (bugatti 의 'ti' 가 아니라 bugatti).
  const sylColor = Int32Array.from(sylGroup);
  const sylExt = new Uint8Array(S.length);
  const spread = (from, to) => S[to].word === S[from].word && sylColor[to] < 0 && (S[to].ep || S[from].lang === 'en' || S[from].lang === 'num');
  outGroups.forEach(g => g.members.forEach((m, mi) => {
    let a = m.units[0], b = m.units[m.units.length - 1];
    while (a - 1 >= 0 && spread(a, a - 1)) { a--; sylColor[a] = g.id; sylExt[a] = 1; sylMember[a] = mi; }
    while (b + 1 < S.length && spread(b, b + 1)) { b++; sylColor[b] = g.id; sylExt[b] = 1; sylMember[b] = mi; }
    m.src = srcSpan(a, b);
    m.text = pron.text.slice(m.src[0], m.src[1]);
    m.pron = S.slice(a, b + 1).map(x => x.ch).join('');
  }));

  return { groups: outGroups, sylGroup, sylMember, sylRepeat, sylColor, sylExt };
}
