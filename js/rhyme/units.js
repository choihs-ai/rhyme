// 라임 판정의 기본 단위와 비교 함수
// 발음 음절마다 판정에 필요한 정보(모음·받침·단어/줄 경계·조사 여부)를 붙이고,
// 음절 쌍·구간 쌍을 비교하는 함수들을 한 묶음(ctx)으로 만들어 뒤 단계에 넘긴다.
import { VOWEL_SIM, VOWEL_INDEX, codaSim, tailInfo, W_VOWEL, W_CODA } from './similarity.js';
import { markEndings, inLexicon } from './endings.js';

export function buildContext(pron, opt, P) {
  const S = pron.syllables;
  const content = pron.lines.filter(l => !l.blank && !l.header && l.syl.length);
  const lineRange = new Map(content.map(l => [l.idx, [l.syl[0], l.syl[l.syl.length - 1] + 1]]));
  const ending = markEndings(pron);

  // 뒤(앞)에 같은 단어의 '소리 없는 꼬리'만 남으면 단어 끝(시작)으로 본다.
  //   road=로+드(삽입모음) → '로'가 단어 끝,  거짓말은 → '말'이 어간 끝(조사 '은' 앞)
  const onlyAfter = (i, lim, same, skip) => { for (let k = i + 1; k < lim; k++) { if (!same(k)) return true; if (!skip(k)) return false; } return true; };
  const onlyBefore = (i, lim, same, skip) => { for (let k = i - 1; k >= lim; k--) { if (!same(k)) return true; if (!skip(k)) return false; } return true; };

  // U[i] = i번째 음절의 판정용 정보
  const U = S.map((s, i) => {
    const w = pron.words[s.word];
    const [la, lb] = lineRange.get(s.line);
    const sameWord = k => S[k].word === s.word;
    return {
      i, v: VOWEL_INDEX[s.jung], vj: s.jung, c: s.jong, o: s.cho, ep: s.ep, n: s.ln, verse: s.verse, line: s.line,
      ws: onlyBefore(i, la, sameWord, k => S[k].ep),                                  // 단어 첫머리
      we: onlyAfter(i, lb, sameWord, k => S[k].ep),                                   // 어절 끝
      stemEnd: !ending[i] && onlyAfter(i, lb, sameWord, k => S[k].ep || ending[k]),   // 조사·어미 바로 앞 (어간 끝)
      le: onlyAfter(i, lb, () => true, k => S[k].ep), ls: i === la,                   // 줄 끝 / 줄 처음
      gram: !!ending[i], rt: s.rt || null, en: tailInfo(s.rt),
      key: s.lang === 'ko' ? s.orth : `${w.text.toLowerCase()}#${s.wi}`, wkey: `${w.text.toLowerCase()}#${s.wi}`, lang: s.lang, word: s.word,
    };
  });

  // 반복 꼬리 앞도 줄 끝으로 본다: 가까운 줄과 같은 말로 끝나면(지금 간다 아이가 / 다 안다 아이가),
  // 듣는 사람은 그 말 바로 앞(간다 / 안다)에서 라임을 듣는다. 꼬리 자체는 반복으로 따로 잡힌다.
  const lastWords = content.map(l => {
    const ws = l.words.map(i => pron.words[i]).filter(w => w.syl.length);
    return { l, ws, tail: ws.length ? ws[ws.length - 1].text.toLowerCase() : '' };
  });
  lastWords.forEach((x, i) => {
    if (x.ws.length < 2 || !x.tail) return;
    const shared = lastWords.some((y, j) => j !== i && Math.abs(j - i) <= 3 && y.l.verse === x.l.verse && y.ws.length >= 2 && y.tail === x.tail);
    if (!shared) return;
    const before = x.ws[x.ws.length - 2].syl;
    for (let k = before.length - 1; k >= 0; k--) if (!before[k].ep) { U[before[k].i].le = true; U[before[k].i].refrainBefore = true; break; }
  });

  // 두 음절의 모음·받침 유사도 (영어 운 꼬리·삽입모음 반영)
  const pairV = (x, y) => {
    if (x.rt && x.rt === y.rt) return 1;            // 영어 단어끼리 운 꼬리가 같음 (real/feel)
    const v = VOWEL_SIM[x.v][y.v];
    if (x.ep !== y.ep) return v * 0.6;               // 삽입모음 ↔ 실제 모음은 약하게
    if (x.en && y.en) {
      if (x.en.cls !== y.en.cls) return v * 0.6;                                       // 영어끼리인데 영어 모음이 다름 (go/law)
      if (!(x.en.stressed && y.en.stressed) && x.en.fin !== y.en.fin) return v * 0.6;  // 강세 없는 끝 음절인데 끝소리가 다름 (jacket/office)
    }
    return x.ep ? v * 0.9 : v;
  };
  const pairC = (x, y) => (x.rt && x.rt === y.rt ? 1 : codaSim(x.c, y.c));

  // 두 구간 [a, a+L) 와 [b, b+L) 비교. 라임이 될 수 없으면 null.
  //   eff = 근거가 되는 음절 수. 양쪽이 모두 조사·어미인 자리는 소리는 맞아야 하지만 근거로 세지 않는다.
  //   par = 양쪽에 같은 조사·어미가 붙은 자리 수 (가고/남고 의 '고')
  //   vq  = '모음만 같아도 인정'일 때의 품질. 모음이 다 맞으면 받침 차이를 눈감아 준다 (약속/악몽)
  function compare(a, b, L) {
    // 줄 끝끼리가 아니면 한쪽만 조사·어미인 자리는 소리 비교에는 넣되 근거 음절로는 세지 않는다.
    //   너의/머니 의 '의/니' 는 맞는 소리지만, 버스/것을 처럼 그것만으로 2음절 라임이 되지는 않는다.
    const lineEnd = U[a + L - 1].le && U[b + L - 1].le;
    let vs = 0, cs = 0, os = 0, eff = 0, cnt = 0, par = 0, epA = true, epB = true, minv = 1, sameWord = 0, epPairs = 0;
    for (let k = 0; k < L; k++) {
      const x = U[a + k], y = U[b + k];
      const v = pairV(x, y);
      if (v < P.minV) return null;
      const c = pairC(x, y);
      if (!opt.vowelOnly && c < 0.6) return null;
      if (L > 1 && x.wkey === y.wkey) sameWord++;
      if (x.ep || y.ep) epPairs++;
      if (!x.ep) epA = false;
      if (!y.ep) epB = false;
      const weak = !lineEnd && (x.gram || y.gram);
      if ((x.gram && y.gram) || weak) {
        if (k === 0) return null;                    // 조사·어미에서 시작하는 구간은 없다
        if (x.gram && y.gram) { par++; continue; }
      }
      if (x.ep && y.ep) continue;                    // 삽입모음끼리는 자음군일 뿐 모음 근거가 아니다
      vs += v; cs += c; cnt++; if (x.o === y.o) os++;
      if (v < minv) minv = v;
      if (!weak) eff++;
    }
    if (epA || epB || !eff) return null;
    if (sameWord && sameWord < L) return null;    // 같은 단어가 섞인 구간 (내 방 / 내 사상)
    if (epPairs > (L === 2 ? 1 : Math.floor((L - 1) / 2))) return null; // 삽입모음 위주 일치 제외
    const sim = (vs * W_VOWEL + cs * W_CODA) / cnt, v = vs / cnt;
    return { sim, v, c: cs / cnt, o: os / cnt, minv, eff, par, vq: opt.vowelOnly ? Math.max(sim, v - 0.05) : sim };
  }
  // 판정 품질: 줄 끝끼리는 자리 자체가 강한 근거라 모음만 맞아도 인정하고, 줄 안쪽은 받침도 닮아야 한다
  const qual = (m, bothLineEnd) => (bothLineEnd ? m.vq : m.sim);
  // 구간이 단어 경계에서 끝나는가: 어절 끝이거나, 단어 첫머리에서 시작해 어간 끝에서 끝남 (갈망|한, 거짓말|은)
  const endsWord = (a, L) => U[a + L - 1].we || (U[a + L - 1].stemEnd && U[a].ws);
  // 단어 첫머리에서 시작해 단어 중간에서 끝나는 구간이 '합성어의 앞 낱말'로 볼 만한가.
  //   조이|보이가 ○ (뒤에 두 음절 이상 낱말 '보이'가 이어진다),  발자|국 × (뒤가 '국' 한 음절),  가사|엔 ×
  //   영어·숫자는 글자와 음절이 딱 맞지 않아서 단어 중간에서 끊지 않는다 (dia|mond, 20|24)
  const compoundHead = (a, L) => {
    const e = a + L - 1;
    if (endsWord(a, L)) return true;
    if (!U[a].ws || S[e].lang !== 'ko') return false;
    let rest = '';
    for (let k = e + 1; k < S.length && S[k].word === S[e].word && S[k].lang === 'ko'; k++) rest += S[k].orth;
    for (let n = rest.length; n >= 2; n--) if (inLexicon(rest.slice(0, n))) return true;
    return false;
  };
  const segKey = (a, L) => { let k = ''; for (let t = 0; t < L; t++) k += U[a + t].key + '|'; return k; };

  // 같은 말의 반복인가: 조사·어미를 뺀 글자의 60% 넘게 같으면 라임이 아니라 반복 (인조이라는게/인조이하는게).
  //   바람이/사람이 는 조사 '이'를 빼면 절반만 같으므로 라임.
  const nearSame = (a, b, L) => {
    // 두 구간이 단어 안 같은 자리에서 시작하면 단어 첫머리까지 넓혀서 본다 (인조이|라는게 / 인조이|하는게)
    if (S[a].wi === S[b].wi && S[a].wi > 0) { const back = S[a].wi; a -= back; b -= back; L += back; }
    let same = 0, n = 0, all = true;
    for (let t = 0; t < L; t++) {
      const eq = U[a + t].key === U[b + t].key;
      if (!eq) all = false;
      if (U[a + t].gram && U[b + t].gram) continue;
      n++; if (eq) same++;
    }
    if (all) return true;
    return n >= 2 && same / n > 0.6;
  };

  // 닻(anchor) = 구간에서 조사·어미를 뺀 마지막 음절. 멤버끼리는 닻을 맞춰 비교한다:
  //   거짓말|은 과 더딘 날|도 는 붙은 조사가 달라도 '말/날'에서 끝나는 같은 라임이다.
  const anchorOf = (a, L) => { for (let i = a + L - 1; i > a; i--) if (!U[i].gram) return i; return a; };
  // 두 구간을 맞춰 놓는다. 뒤에 붙은 조사·어미 수가 같으면 그대로 끝을 맞추고, 다르면 닻까지만 본다.
  const aligned = (a1, L1, a2, L2) => {
    const t1 = a1 + L1 - 1 - anchorOf(a1, L1), t2 = a2 + L2 - 1 - anchorOf(a2, L2);
    if (t1 !== t2) { L1 -= t1; L2 -= t2; }
    const L = Math.min(L1, L2);
    return [a1 + L1 - L, a2 + L2 - L, L];
  };
  // 길이가 다른 두 구간 비교: 끝을 맞춘 비교와 닻을 맞춘 비교 중 맞는 쪽 (너의↔머니 는 끝, 거짓말은↔더딘 날 은 닻)
  const compareTails = (a1, L1, a2, L2) => {
    const L = Math.min(L1, L2);
    const byEnd = compare(a1 + L1 - L, a2 + L2 - L, L);
    const [s1, s2, La] = aligned(a1, L1, a2, L2);
    const byAnchor = s1 + La === a1 + L1 && s2 + La === a2 + L2 ? null : compare(s1, s2, La);
    if (!byEnd || !byAnchor) return byEnd || byAnchor;
    return byAnchor.eff > byEnd.eff ? byAnchor : byEnd;
  };

  // 구간 식별 키: 줄 내용 + 줄 안 글자 위치. 사용자가 '라임 아님'으로 뺀 구간을 기억하는 데 쓴다 (그 줄을 고치면 자동으로 풀림)
  const spanKey = (a, L) => { const ln = pron.lines[S[a].line]; return `${ln.text.trim()}|${S[a].src[0] - ln.start}|${S[a + L - 1].src[1] - ln.start}`; };

  return { pron, opt, P, S, U, content, lineRange, ending, pairV, pairC, compare, qual, endsWord, compoundHead, segKey, nearSame, anchorOf, aligned, compareTails, spanKey };
}
