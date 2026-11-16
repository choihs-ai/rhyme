// 2단계: 후보 쌍을 라임 그룹으로 묶고, 같은 말 반복을 표시하고, 우연한 일치를 걸러낸다.
import { canonVowel } from './similarity.js';
import { isLexical } from './endings.js';

/**
 * @returns {Array<Array<{a:number, L:number, end:number, repeat:boolean}>>} 살아남은 그룹들 (각각 멤버 목록, 가사 순서)
 *   한 음절은 한 그룹에만 속한다. 멤버 길이는 달라도 된다: 끝(닻)을 맞춰 비교한다.
 *   "go higher / on fire"(4음절)에 "desire"(3음절)가 꼬리로 합류하는 식.
 */
export function formGroups(ctx, cands) {
  const { pron, P, S, U, pairV, pairC, qual, endsWord, segKey, nearSame, anchorOf, aligned, compareTails } = ctx;
  const owner = new Int32Array(S.length).fill(-1);       // 음절 → 그것을 차지한 멤버 id
  const members = [];                                     // {id, a, L, end, g, repeat}
  const groups = [];                                      // {id, members:[멤버 id], alive}

  const isFree = (a, L) => { for (let t = 0; t < L; t++) if (owner[a + t] >= 0) return false; return true; };
  const addMember = (g, a, L) => {
    const id = members.length;
    members.push({ id, a, L, end: a + L - 1, g: g.id, repeat: false });
    for (let t = 0; t < L; t++) owner[a + t] = id;
    g.members.push(id);
  };
  const freeMember = m => { for (let t = 0; t < m.L; t++) if (owner[m.a + t] === m.id) owner[m.a + t] = -1; };
  const representative = g => members[g.members[0]];

  // 구간이 기존 멤버와 같은 닻에서 끝나고 그보다 길지 않으면 그 멤버.
  // 멤버보다 짧은 꼬리로 붙는 것(shortOk)은 줄 끝 라임끼리이거나, 같은 줄에서 같은 어미가 붙은 나란한 꼴(가고/남고/닳고)일 때만
  // 허용한다 (줄 중간의 짧은 일치가 긴 그룹에 딸려 들어오지 않게).
  const memberWithTail = (a, L, shortOk) => {
    const anchor = anchorOf(a, L);
    const mid = owner[anchor];
    if (mid < 0) return null;
    const m = members[mid];
    if (anchorOf(m.a, m.L) !== anchor || m.a > a) return null;
    if (m.a === a) return m;
    return shortOk && a + L - 1 <= m.end ? m : null;   // 짧은 꼬리는 멤버 안에 온전히 들어 있어야 한다
  };
  // 새 멤버가 그룹의 기존 멤버와 충분히 가까운 줄에 있는가
  const isNear = (g, a, L, n) => {
    const W = n === 1 ? Math.max(P.W(1), U[a + L - 1].le ? P.W1end : 0) : P.W(n);
    return g.members.some(mid => Math.abs(U[members[mid].a].n - U[a].n) <= W);
  };
  // 새 멤버가 그룹 대표와 소리가 맞는가
  const fits = (g, a, L) => {
    const rep = representative(g);
    // 단어 끝에서 끝나지 않는 멤버(갈망|한)는 끝라임 그룹에만 합류
    // 단, 단어 첫머리에서 시작하는 멤버(조이|보이가)는 단어 끝이 맞는 멤버가 2개 이상인 그룹에 붙을 수 있다
    if (L > 1 && !endsWord(a, L) && !U[a + L - 1].le) {
      const endAligned = g.members.filter(mid => endsWord(members[mid].a, members[mid].L)).length;
      if (!(U[a].ws && U[a].word === U[a + L - 1].word && endAligned >= 2) && g.members.filter(mid => U[members[mid].end].le).length < 2) return false;
    }
    const m = compareTails(rep.a, rep.L, a, L);
    if (!m) return false;
    const bothEnd = U[rep.end].le && U[a + L - 1].le;
    if (m.eff === 1) {
      // 줄 안의 한 음절 멤버는 받침이 닮았거나 같은 어미가 붙은 나란한 꼴이어야 한다
      return m.minv >= 0.9 && (bothEnd ? !(m.par > 0 && m.c < 0.6) : m.c >= 0.6 || m.par > 0);
    }
    return qual(m, bothEnd) >= P.T - 0.05;
  };
  const canonKey = (a, L) => { let k = ''; for (let t = 0; t < L; t++) k += canonVowel(U[a + t].vj); return k; };

  // 후보 한 쌍 처리: 두 그룹을 합치거나, 한쪽을 기존 그룹에 넣거나, 새 그룹을 만든다
  function place(c, allowCreate) {
    const shortOk = c.isEnd || (c.d === 0 && c.par > 0);
    const ma = memberWithTail(c.a, c.L, shortOk), mb = memberWithTail(c.b, c.L, shortOk);
    const ga = ma ? groups[ma.g] : null;
    const gb = mb ? groups[mb.g] : null;
    if (ga && gb) {
      if (ga !== gb && ga.alive && gb.alive) {
        // 대표끼리 모음 배열이 (같은 소리 그룹 기준으로) 똑같을 때만 합친다. 비슷한 소리로 줄줄이 이어 붙지 않게.
        const ra = representative(ga), rb = representative(gb);
        const [sa, sb, L] = aligned(ra.a, ra.L, rb.a, rb.L);
        if (canonKey(sa, L) === canonKey(sb, L)) {
          for (const mid of gb.members) { members[mid].g = ga.id; ga.members.push(mid); }
          gb.members = []; gb.alive = false;
        }
      }
      return;
    }
    if (ga && isFree(c.b, c.L)) { if (ga.alive && fits(ga, c.b, c.L) && isNear(ga, c.b, c.L, c.n)) addMember(ga, c.b, c.L); return; }
    if (gb && isFree(c.a, c.L)) { if (gb.alive && fits(gb, c.a, c.L) && isNear(gb, c.a, c.L, c.n)) addMember(gb, c.a, c.L); return; }
    if (allowCreate && c.seed && !ga && !gb && isFree(c.a, c.L) && isFree(c.b, c.L)) {
      const g = { id: groups.length, members: [], alive: true };
      groups.push(g);
      addMember(g, c.a, c.L);
      addMember(g, c.b, c.L);
    }
  }
  // 반복이 아닌 쌍으로 그룹을 만들고(점수 높은 순), 같은 말 반복은 기존 그룹에만 붙인다
  for (const c of cands) if (!c.repeat) place(c, true);
  for (let pass = 0; pass < 2; pass++) for (const c of cands) if (c.repeat) place(c, false);

  // ── 반복 표시 ──
  // 반복 판정 키: 1음절은 같은 단어일 때만(사상/환상의 '상'은 라임), 2음절 이상은 같은 글자열
  const repeatKey = m => (m.L === 1 ? pron.words[U[m.a].word].text + '#' + S[m.a].wi : segKey(m.a, m.L));
  const nearSameTails = (f, m) => { const [sa, sb, L] = aligned(f.a, f.L, m.a, m.L); return L > 1 && nearSame(sa, sb, L); };
  function markRepeats(g) {
    const seen = new Set();
    const originals = [];
    // 같은 말이 여러 번 나오면 줄 끝에 놓인 것을 원본으로, 나머지를 반복으로 본다
    const order = [...g.members].sort((x, y) => U[members[y].end].le - U[members[x].end].le || members[x].a - members[y].a);
    for (const mid of order) {
      const m = members[mid];
      const k = repeatKey(m);
      if (seen.has(k) || originals.some(f => nearSameTails(f, m))) m.repeat = true;
      else originals.push(m);
      seen.add(k);
    }
    // 1음절 그룹이 전부 같은 글자일 때: 사전에 실린 낱말이 끼어 있으면(기억/추억, 시계/세계) 서로 다른 단어끼리의 라임,
    // 하나도 없으면(원투훅/이건훅/너는훅) 같은 말을 붙여 쓴 반복으로 본다.
    const ms = g.members.map(mid => members[mid]);
    if (ms.length && ms.every(m => m.L === 1 && S[m.a].lang === 'ko' && S[m.a].orth === S[ms[0].a].orth)) {
      const anyLexical = ms.some(m => isLexical(pron.words[U[m.a].word]));
      const words = new Set();
      ms.forEach((m, k) => {
        const text = pron.words[U[m.a].word].text;
        m.repeat = anyLexical ? words.has(text) : k > 0;
        words.add(text);
      });
    }
  }

  // ── 검증 ──
  // 대표 멤버와의 평균 품질
  const quality = list => {
    if (list.length < 2) return 0;
    const rep = list[0];
    let sum = 0;
    for (let k = 1; k < list.length; k++) { const m = compareTails(rep.a, rep.L, list[k].a, list[k].L); sum += m ? qual(m, U[rep.end].le && U[list[k].end].le) : 0; }
    return sum / (list.length - 1);
  };
  // 우연한 모음 일치를 걸러낸다. 남길 멤버 id 집합을 돌려주고, 그룹을 버릴 때는 null.
  //   남는 경우: 줄 끝 라임 / 3음절 이상 / 가까이 몰린 3개 이상 / 단어 끝이 맞는 가까운 2개
  function validate(g) {
    const M = g.members.map(mid => members[mid]);
    const real = M.filter(m => !m.repeat);
    if (real.length < 2) return null;
    // 그룹의 근거 음절 수 = 멤버 쌍 사이에서 실제로 근거가 된 음절 수의 최댓값 (조사가 섞인 버스/것을 은 1)
    let n = 0;
    for (let i = 0; i < real.length; i++) for (let j = i + 1; j < real.length; j++) {
      const m = compareTails(real[i].a, real[i].L, real[j].a, real[j].L);
      if (m && m.eff > n) n = m.eff;
    }
    const atLineEnd = m => U[m.end].le;
    const atWordEnd = m => endsWord(m.a, m.L);
    const lineOf = m => U[m.a].n;
    const all = new Set(g.members);
    const ends = real.filter(atLineEnd);
    if (n <= 1) {
      if (ends.length >= 2 || real.length >= 3) return all;
      // 한 줄 안의 두 개: 같은 어미가 붙고 어간 끝의 모음·받침이 모두 같은 닫힌 음절일 때만 (분다/운다).
      // 받침 없는 한 음절이나 어미 없는 낱말끼리(삼/담)는 우연이 너무 많다.
      const [x, y] = real;
      const stem = m => { for (let i = m.end; i >= m.a; i--) if (!U[i].gram) return U[i]; return null; };
      const sx = stem(x), sy = stem(y);
      const inflected = m => m.L > 1 && U[m.end].gram;
      return sx && sy && lineOf(x) === lineOf(y) && inflected(x) && inflected(y) && sx.c && pairC(sx, sy) === 1 && pairV(sx, sy) >= 0.9 ? all : null;
    }
    if (ends.length >= 2) return all;
    if (n >= 3 && quality(real) >= 0.85 && real.some(m => U[m.a].ws)) return all;
    // 가까이(1줄 이내) 이웃이 있는 멤버만 남긴다
    const near1 = real.filter(m => real.some(o => o !== m && Math.abs(lineOf(o) - lineOf(m)) <= 1));
    const withTheirRepeats = list => {
      const ids = new Set(list.map(m => m.id));
      M.filter(m => m.repeat && list.some(o => Math.abs(lineOf(o) - lineOf(m)) <= 1 && o.L === m.L && segKey(o.a, o.L) === segKey(m.a, m.L))).forEach(m => ids.add(m.id));
      return ids;
    };
    if (near1.length >= 3 && near1.filter(atWordEnd).length >= 2 && quality(near1) >= 0.85) return withTheirRepeats(near1);
    // 2개짜리: 둘 다 단어 끝에서 끝나고, 같은/이웃 줄(줄 끝이 끼면 2줄까지)
    const pairOk = (x, y) => {
      const d = Math.abs(lineOf(x) - lineOf(y));
      return atWordEnd(x) && atWordEnd(y) && (d <= 1 || (d <= 2 && (atLineEnd(x) || atLineEnd(y)))) && quality([x, y]) >= 0.87;
    };
    for (let i = 0; i < real.length; i++) for (let j = i + 1; j < real.length; j++) {
      if (pairOk(real[i], real[j])) {
        const list = real.filter(m => m === real[i] || m === real[j] || (pairOk(m, real[i]) || pairOk(m, real[j])));
        return withTheirRepeats(list);
      }
    }
    return null;
  }

  for (const g of groups) {
    if (!g.alive) continue;
    g.members.sort((x, y) => members[x].a - members[y].a);
    markRepeats(g);
    const kept = validate(g);
    for (const mid of g.members) if (!kept || !kept.has(mid)) freeMember(members[mid]);
    g.members = kept ? g.members.filter(mid => kept.has(mid)) : [];
    if (!kept) g.alive = false;
  }

  return groups
    .filter(g => g.alive && g.members.length)
    .map(g => g.members.map(mid => members[mid]))
    .sort((x, y) => x[0].a - y[0].a);   // 가사에 처음 나오는 순서
}
