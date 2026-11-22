// 1단계: 라임 후보 쌍 수집
// 가까운 줄끼리 같은 길이의 구간을 모두 견주어, 라임일 수 있는 쌍과 그 우선순위(score)를 만든다.

/**
 * @returns {{cands: Array, excludedKeys: string[]}} cands 는 score 내림차순
 *   후보 = { a, b, L, n(근거 음절 수), d(줄 거리), par, sim, score, repeat, isEnd, alignEnd, alignStart, seed }
 */
export function collectCandidates(ctx) {
  const { pron, opt, P, U, content, lineRange, pairV, compare, qual, endsWord, compoundHead, nearSame, spanKey } = ctx;
  const EX = opt.exclude instanceof Set ? opt.exclude : new Set(opt.exclude || []);
  const exHit = new Set();
  const excluded = (a, L) => { if (!EX.size) return false; const k = spanKey(a, L); if (EX.has(k)) { exHit.add(k); return true; } return false; };

  const weakVowels = (a, b, L) => { let n = 0; for (let k = 0; k < L; k++) if (pairV(U[a + k], U[b + k]) < 0.85) n++; return n; };
  const cands = [];
  const maxW = Math.max(P.W(opt.maxLen), P.W1end);
  for (let li = 0; li < content.length; li++) {
    const A = content[li];
    const [a0, a1] = lineRange.get(A.idx);
    for (let lj = li; lj < content.length; lj++) {
      const B = content[lj];
      const d = B.n - A.n;
      if (d > maxW) break;
      const [b0, b1] = lineRange.get(B.idx);
      for (let a = a0; a < a1; a++) {
        if (U[a].ep) continue;                            // 라임은 실제 모음에서 시작
        for (let b = (li === lj ? a + 1 : b0); b < b1; b++) {
          if (U[b].ep) continue;
          // 같은 위치에서 시작하는 가장 긴 일치 길이
          let R = 0;
          const lim = Math.min(opt.maxLen, a1 - a, b1 - b, li === lj ? b - a : Infinity);
          while (R < lim && pairV(U[a + R], U[b + R]) >= P.minV) R++;
          const sameVerse = U[a].verse === U[b].verse;
          for (let L = Math.max(1, opt.minLen); L <= R; L++) {
            if (U[a + L - 1].ep || U[b + L - 1].ep) continue;   // 구간은 실제 모음에서 끝난다 (뒤따르는 삽입모음은 표시할 때만 붙인다)
            const m = compare(a, b, L);
            if (!m) continue;
            const c = judge(a, b, L, d, m, sameVerse);
            if (c && !excluded(a, L) && !excluded(b, L)) cands.push(c);
          }
        }
      }
    }
  }

  // 한 쌍이 후보가 될 수 있는지 판단하고 우선순위를 매긴다. 규칙은 근거 음절 수(n)에 따라 다르다.
  function judge(a, b, L, d, m, sameVerse) {
    const n = m.eff;
    if (n <= 3 && !sameVerse) return null;
    const ea = a + L - 1, eb = b + L - 1;
    const isEnd = U[ea].le && U[eb].le;
    const q = qual(m, isEnd);
    const alignEnd = endsWord(a, L) && endsWord(b, L);
    const alignStart = U[a].ws && U[b].ws;
    const fullA = U[a].ws && endsWord(a, L), fullB = U[b].ws && endsWord(b, L);
    if (n === 1) {
      if (m.minv < 0.9) return null;
      if (d > (isEnd ? P.W1end : P.W(1))) return null;
      // 같은 어미를 뗀 어간 한 음절만 근거일 때는 받침까지 닮아야 한다 (분다/운다 ○, 열립니다/예정입니다 ×)
      if (isEnd && m.par > 0 && m.c < 0.6) return null;
      // 줄 안의 1음절: 단어 끝끼리이고 받침이 닮았거나, 같은 어미가 붙은 나란한 꼴(가고/남고)
      if (!isEnd && !(alignEnd && (m.c >= 0.6 || m.par > 0))) return null;
      // 한국어끼리 받침 없는 음절(때/게/내, 밥은/뭇나 의 바/나)은 줄 안에서 너무 흔히 겹쳐서, 같은 어미가 붙은 꼴이 아니면 치지 않는다.
      //   영어가 끼면(flow / 위로 / so, money / 너의) 일부러 맞춘 소리라 그대로 둔다.
      if (!isEnd && !m.par && !U[ea].c && !U[eb].c && U[ea].lang === 'ko' && U[eb].lang === 'ko') return null;
    } else {
      if (d > P.W(n)) return null;
      // 줄 끝끼리가 아닌 다음절 라임에 '비슷한 모음'(ㅓ/ㅗ, ㅡ/ㅜ)은 세 음절에 하나까지만.
      //   줄 끝끼리는 길게 끌어 발음해서 비슷한 모음도 맞게 들린다 (하루를 또 보내 / 마음은 더 고돼 ○)
      //   줄 중간은 우연이 많다 (않는 모니터 / 바닥부터 기어 ×)
      if (n >= 3 && !isEnd && weakVowels(a, b, L) > Math.floor(n / 3)) return null;
      if (q < P.T + 0.02 * d) return null;          // 멀수록 더 닮아야 함
      if (n === 2 && !(alignEnd || isEnd || (alignStart && (fullA || fullB) && compoundHead(a, L) && compoundHead(b, L)))) return null;
      if (n >= 3 && !(alignEnd || isEnd)) return null;  // 3음절 이상은 단어/줄 끝에서 끝나야 함
    }
    // 반복: 1음절은 같은 단어일 때, 그 밖에는 글자가 거의 같을 때
    const repeat = L === 1 ? U[a].wkey === U[b].wkey && pron.words[U[a].word].text === pron.words[U[b].word].text : nearSame(a, b, L);
    const dist = n === 1 ? (d === 0 ? 1 : 0.85 - 0.1 * (d - 1)) : n === 2 ? (d <= 1 ? 1 : 1 - 0.15 * (d - 1)) : Math.max(0.6, 1 - 0.04 * d);
    // 길이 우선 + 품질(유사도², 단어·줄 끝 정렬) 반영. 어미까지 덮는 구간(운다)이 어간만(운)보다 조금 앞선다.
    const score = Math.pow(n, 1.2) * m.sim * m.sim * (1 + 0.25 * alignEnd + 0.2 * alignStart + 0.6 * isEnd + 0.1 * m.o) * dist * (1 + 0.03 * (L - n));

    // 그룹을 새로 만들 수 있는 '강한 씨앗' 쌍인가 (약한 쌍은 이미 있는 그룹에 합류만 할 수 있다)
    const trueEnds = U[ea].we && U[eb].we;
    // 조사가 서로 다른 낱말 쌍(사랑|을 / 자랑|이라며)은 어간 전체가 받침까지 거의 같고 이웃한 줄일 때만 씨앗
    const wholeStems = fullA && fullB && d <= 1 && m.sim >= 0.95;
    let seed;
    if (n === 1) seed = isEnd || d === 0;
    else if (isEnd) seed = true;
    else if (n === 2) seed = alignEnd && (wholeStems || (trueEnds && (d <= 1 || (d <= 2 && (U[ea].le || U[eb].le))))) && q >= 0.87;
    else seed = alignEnd && (trueEnds || wholeStems) && q >= 0.85 && (U[a].ws || U[b].ws);
    return { a, b, L, n, d, par: m.par, sim: m.sim, score, repeat, isEnd, alignEnd, alignStart, seed };
  }

  protectLineEnds(cands, U);
  cands.sort((x, y) => y.score - x.score || y.L - x.L);
  return { cands, excludedKeys: [...exHit] };
}

// 줄 끝 보호: 줄 끝끼리 이미 라임 상대가 있는 음절을, 줄 끝끼리가 아닌 후보(꺼진 방 / 멀기만, 다 안 / 마라)가
// 가로채지 못하게 상대 줄 수만큼 점수를 낮춘다. 듣는 사람에게는 줄 끝 라임이 가장 먼저 들리기 때문.
// 줄 끝 라임 구간에 든 음절은 모두 보호한다 (간다 / 안다 의 '간·안' 까지).
function protectLineEnds(cands, U) {
  const endPartners = new Map();
  for (const c of cands) {
    if (!c.isEnd || c.repeat) continue;
    for (const [me, other] of [[c.a, c.b], [c.b, c.a]]) {
      for (let k = 0; k < c.L; k++) {
        if (!endPartners.has(me + k)) endPartners.set(me + k, new Set());
        endPartners.get(me + k).add(U[other].n);
      }
    }
  }
  for (const c of cands) {
    if (c.isEnd) continue;
    let most = 0;
    for (const start of [c.a, c.b]) for (let k = 0; k < c.L; k++) { const p = endPartners.get(start + k); if (p && p.size > most) most = p.size; }
    if (most) c.score /= 1 + most;
  }
}
