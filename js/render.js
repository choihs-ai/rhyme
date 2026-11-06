// 라임 스캐너 — 화면 그리기 (하이라이트·점수·구조도·추천·이미지)
import { decompose } from './pronounce.js';

// 그룹 색: 검증된 8색 (dataviz 기준 팔레트, 다크/라이트 각각). 9번째부터는 같은 색을 밑줄 모양(이중선·점선)과
// 그룹 번호로 구분한다 — 색만으로 구분하지 않도록.
export const PALETTE = {
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
};
const TAG_LABEL = { end: '끝라임', multi: '다음절', internal: '내부 라임', vowel: '모음 라임', cross: '한·영 교차' };

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export { esc };
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export function groupStyle(id, theme) {
  const pal = PALETTE[theme === 'light' ? 'light' : 'dark'];
  const c = pal[id % pal.length];
  const [r, g, b] = hexRgb(c);
  return { c, bg: `rgba(${r},${g},${b},${theme === 'light' ? 0.24 : 0.3})`, tier: Math.floor(id / pal.length) % 3 };
}
const underline = L => (L <= 1 ? 2 : L === 2 ? 3 : L === 3 ? 4 : L <= 5 ? 5 : 6);
const pct = x => `${(x * 100).toFixed(1)}%`;
const styleAttr = (g, theme, len) => { const s = groupStyle(g, theme); return `--c:${s.c};--bg-c:${s.bg}${len ? `;--u:${underline(len)}px` : ''}`; };

// ───────────────────────── ① 하이라이트 ─────────────────────────
export function renderHighlight(el, st) {
  const { pron, rhyme, theme } = st;
  const groups = rhyme.groups;
  const showNums = st.showNums === 'on' || (st.showNums !== 'off' && groups.length > PALETTE.dark.length);
  const sc = rhyme.scores;
  let h = `<div class="hl-summary">라임 그룹 <b>${groups.length}</b>개 · 라임 밀도 <b>${pct(sc.density)}</b> · 점수 <b>${sc.total}</b>/100. 색깔 칩이나 가사를 누르면 해당 라임만 강조하고 발음을 보여줍니다.</div>`;
  h += legendHtml(st);
  h += `<div class="hl-tools"><label class="switch small"><input type="checkbox" id="hl-pron"${st.showPron ? ' checked' : ''}><span class="track"></span><span>발음 표기 보기</span></label><span class="muted">밑줄 두께 = 라임 길이 · 빗금 = 같은 말 반복</span></div>`;
  h += `<div class="lyrics${st.focus >= 0 ? ' focusing' : ''}" id="lyrics-view">`;
  const schemeByLine = new Map(rhyme.scheme.lines.map(l => [l.line, l]));
  for (const line of pron.lines) {
    if (line.blank) { h += '<div class="gap"></div>'; continue; }
    if (line.header) { h += `<div class="sec">${esc(line.text.trim())}</div>`; continue; }
    if (!line.syl.length) { h += `<div class="lyr-line"><span class="ln"></span><span class="tx">${esc(line.text)}</span><span></span></div>`; continue; }
    const sch = schemeByLine.get(line.idx);
    let schHtml = '<span class="sch"></span>';
    if (sch) {
      const on = sch.letter !== 'X' && sch.group >= 0;
      schHtml = `<span class="sch${on ? ' on' : ''}" style="${on ? styleAttr(sch.group, theme) : ''}" title="끝라임 ${sch.letter}">${sch.letter === 'X' ? '·' : sch.letter}</span>`;
    }
    h += `<div class="lyr-line" data-line="${line.idx}"><span class="ln">${line.n + 1}</span><span class="tx">${lineHtml(line, st, showNums)}${st.showPron ? pronHtml(line, st) : ''}</span>${schHtml}</div>`;
  }
  h += '</div>';
  el.innerHTML = h;
}

function legendHtml(st) {
  const { rhyme, theme } = st;
  if (!rhyme.groups.length) return '<div class="empty">찾은 라임이 없습니다. 옵션에서 민감도를 올려 보세요.</div>';
  let h = '<div class="legend" id="legend">';
  for (const g of rhyme.groups) {
    const s = groupStyle(g.id, theme);
    const n = g.members.filter(m => !m.repeat).length;
    h += `<button type="button" class="chip" data-g="${g.id}" aria-pressed="${st.focus === g.id}" style="--c:${s.c};--bg-c:${s.bg}"><span class="dot">${g.id + 1}</span><b>${esc(g.pattern)}</b> ${g.len}음절 ×${n}</button>`;
  }
  if (st.focus >= 0) h += '<button type="button" class="chip clear" data-g="-1">전체 보기</button>';
  return h + '</div>';
}

function lineHtml(line, st, showNums) {
  const { pron, rhyme, theme } = st;
  const S = pron.syllables;
  const text = line.text, base = line.start, n = text.length;
  const charSyl = new Int32Array(n).fill(-1);
  for (const i of line.syl) for (let k = S[i].src[0]; k < S[i].src[1]; k++) charSyl[k - base] = i;
  const key = new Int32Array(n).fill(-1);
  for (let k = 0; k < n; k++) { const i = charSyl[k]; if (i >= 0 && rhyme.sylColor[i] >= 0) key[k] = rhyme.sylColor[i] * 10000 + rhyme.sylMember[i]; }
  // 멤버 안의 띄어쓰기도 같은 색으로 잇는다 (날 봐)
  for (let k = 0; k < n; k++) {
    if (charSyl[k] >= 0) continue;
    let l = k - 1; while (l >= 0 && charSyl[l] < 0) l--;
    let r = k + 1; while (r < n && charSyl[r] < 0) r++;
    if (l >= 0 && r < n && key[l] >= 0 && key[l] === key[r]) key[k] = key[l];
  }
  const sylRun = (a, b) => {
    let o = '', k = a;
    while (k < b) {
      const s = charSyl[k];
      let j = k + 1; while (j < b && charSyl[j] === s) j++;
      o += s >= 0 ? `<span class="s" data-s="${s}">${esc(text.slice(k, j))}</span>` : esc(text.slice(k, j));
      k = j;
    }
    return o;
  };
  let out = '', k = 0;
  while (k < n) {
    const kk = key[k];
    let j = k + 1; while (j < n && key[j] === kk) j++;
    if (kk >= 0) {
      const g = Math.floor(kk / 10000), mi = kk % 10000;
      const grp = rhyme.groups[g], mem = grp.members[mi];
      const sty = groupStyle(g, theme);
      const cls = 'm' + (sty.tier ? ` t${sty.tier}` : '') + (mem.repeat ? ' rep' : '') + (st.focus === g ? ' on' : '');
      out += `<span class="${cls}" data-g="${g}" data-m="${mi}" style="${styleAttr(g, theme, grp.len)}">${sylRun(k, j)}${showNums ? `<sup class="gn">${g + 1}</sup>` : ''}</span>`;
    } else out += sylRun(k, j);
    k = j;
  }
  return out;
}

function pronHtml(line, st) {
  const { pron, rhyme, theme } = st;
  const S = pron.syllables;
  let o = '<span class="pl">', prevW = -1;
  for (const i of line.syl) {
    const s = S[i];
    if (prevW >= 0 && s.word !== prevW) o += ' ';
    prevW = s.word;
    const g = rhyme.sylColor[i];
    o += `<span class="${g >= 0 ? 'g' : ''}${s.ep ? ' ep' : ''}"${g >= 0 ? ` style="${styleAttr(g, theme)}"` : ''}>${esc(s.ch)}</span>`;
  }
  return o + '</span>';
}

// 음절을 눌렀을 때: 단어 발음 + (라임이면) 그룹 정보
export function syllableSheet(st, sylIdx) {
  const { pron, rhyme, theme } = st;
  const s = pron.syllables[sylIdx];
  const w = pron.words[s.word];
  const g = rhyme.sylColor[sylIdx];
  let h = wordInfoHtml(st, w);
  if (g >= 0) h += groupInfoHtml(st, g, rhyme.sylMember[sylIdx]);
  return { title: g >= 0 ? `라임 그룹 #${g + 1} · ${rhyme.groups[g].pattern}` : `“${w.text}” 발음`, html: h };
}

export function wordInfoHtml(st, w) {
  const { pron, rhyme, theme } = st;
  const how = w.parts.map(p => p.how).filter(Boolean)[0];
  const HOW = { dict: '영어 사전', 'dict+': '영어 사전 + 접미사 규칙', rule: '규칙 기반 음차', letters: '알파벳 읽기', user: '내가 수정한 발음' };
  let h = `<dl class="kv"><dt>원문</dt><dd><b>${esc(w.text)}</b></dd>`;
  if (w.orth !== w.text) h += `<dt>표기</dt><dd>${esc(w.orth)}${how ? ` <span class="muted">(${HOW[how.replace('+', '')] || HOW[how] || how})</span>` : ''}</dd>`;
  h += `<dt>발음</dt><dd class="pron-big">[${esc(w.pron)}]</dd></dl>`;
  h += '<div class="syl-row">';
  w.syl.forEach(s => {
    const gg = rhyme.sylColor[s.i];
    h += `<div class="syl-box${s.ep ? ' ep' : ''}${gg >= 0 ? ' g' : ''}"${gg >= 0 ? ` style="${styleAttr(gg, theme)}"` : ''}><b>${esc(s.ch)}</b><small>${s.jung}${s.jong ? '+' + s.jong : ''}${s.ep ? ' 삽입' : ''}</small></div>`;
  });
  h += '</div>';
  h += `<h3>발음 직접 수정</h3><div class="edit-row"><input id="ov-input" data-word="${esc(w.text.toLowerCase())}" value="${esc(st.overrides.get(w.text.toLowerCase()) || w.orth)}" aria-label="발음 수정" autocapitalize="off" autocomplete="off"><button class="primary" type="button" id="ov-save">저장</button></div>`;
  h += `<p class="note">한글로 소리 나는 대로 적어 주세요 (예: money → 머니). 같은 단어는 모든 가사에 적용되고 이 기기에 저장됩니다.${st.overrides.has(w.text.toLowerCase()) ? ' <button class="link" type="button" id="ov-del">수정 취소</button>' : ''}</p>`;
  return h;
}

export function groupInfoHtml(st, gid, memberIdx = -1) {
  const { rhyme, theme } = st;
  const g = rhyme.groups[gid];
  const s = groupStyle(gid, theme);
  let h = `<h3>라임 그룹 #${gid + 1}</h3><div class="tagrow">${g.tags.map(t => `<span class="tag">${TAG_LABEL[t]}</span>`).join('')}<span class="tag">${g.len}음절</span></div>`;
  h += `<dl class="kv"><dt>모음 패턴</dt><dd><b>${esc(g.pattern)}</b></dd><dt>운(받침 포함)</dt><dd>${esc(g.rime)}</dd></dl>`;
  h += '<ul class="member-list">';
  g.members.forEach((m, mi) => {
    h += `<li${mi === memberIdx ? ` style="background:${s.bg}"` : ''}><span class="mln">${m.ln + 1}줄</span><span><span class="swatch" style="--c:${s.c}"></span> ${esc(m.text)}${m.repeat ? ' <span class="tag">반복</span>' : ''}${m.lineEnd ? ' <span class="tag">줄 끝</span>' : ''}</span><span class="mp">[${esc(m.pron)}]</span></li>`;
  });
  h += '</ul>';
  h += `<button class="ghost" type="button" data-focus="${gid}">이 그룹만 강조</button>`;
  return h;
}

// ───────────────────────── ② 점수 ─────────────────────────
export function renderScore(el, st) {
  const { pron, rhyme, theme } = st;
  const sc = rhyme.scores;
  let h = `<div class="card hero-card" style="padding:0"><div class="hero"><span class="num">${sc.total}</span><span class="of">/ 100</span><span class="grade" aria-label="등급">${sc.grade}</span></div>`;
  h += `<div class="hero-sub">라임 밀도 ${pct(sc.density)} · 그룹 ${rhyme.groups.length}개 · 다음절 ${sc.multiCount}개 · ${rhyme.content.length}줄</div></div>`;
  const stats = [
    [pct(sc.density), '라임 밀도'], [`${sc.rhymeUnits}/${sc.totalUnits}`, '라임 음절/전체'], [sc.multiCount, '다음절 라임'],
    [sc.avgLen ? sc.avgLen.toFixed(2) : '–', '다음절 평균 길이'], [rhyme.groups.length, '라임 그룹'], [sc.repeatUnits, '반복 음절(제외)'],
  ];
  h += `<div class="stats">${stats.map(([v, k]) => `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('')}</div>`;

  h += '<div class="sect-title">종합 점수 산출 근거 <small>항목별 점수 / 만점</small></div><ul class="parts">';
  for (const p of sc.parts) {
    h += `<li><div class="row"><span>${p.label}</span><b>${p.value} / ${p.max}</b></div><div class="meter" role="img" aria-label="${p.label} ${p.value}/${p.max}"><i style="width:${(p.value / p.max) * 100}%"></i></div><div class="basis">${esc(p.basis)}</div></li>`;
  }
  h += '</ul>';

  h += '<div class="sect-title">가장 긴 라임 TOP 5</div>';
  if (!sc.top5.length) h += '<p class="note">찾은 라임이 없습니다.</p>';
  else {
    h += '<ol class="top5">';
    for (const t of sc.top5) {
      const s = groupStyle(t.id, theme);
      h += `<li><span class="len">${t.len}음절</span><span class="swatch" style="--c:${s.c}"></span><span>${t.texts.map(esc).join(' / ')}</span><span class="pat">#${t.id + 1} ${esc(t.pattern)}</span></li>`;
    }
    h += '</ol>';
  }

  // 벌스별
  const verseNames = verseLabels(pron);
  if (sc.perVerse.length > 1) {
    h += '<div class="sect-title">벌스별 라임 밀도</div><div class="bars">';
    for (const v of sc.perVerse) {
      h += `<span class="bl">${esc(verseNames.get(v.verse) || `${v.verse + 1}절`)}</span><span class="bt" title="${pct(v.density)}"><i style="width:${v.density * 100}%"></i></span><span class="bv">${pct(v.density)}</span>`;
    }
    h += '</div>';
  }
  h += '<div class="sect-title">줄별 라임 밀도 <small>줄을 누르면 하이라이트로 이동</small></div><div class="bars">';
  for (const l of sc.perLine) {
    const line = pron.lines[l.line];
    h += `<span class="bl" data-line="${l.line}" title="${esc(line.text.trim())}">${l.n + 1}. ${esc(line.text.trim().slice(0, 10))}</span><span class="bt" data-line="${l.line}" title="${l.rhyme}/${l.units} 음절"><i style="width:${l.density * 100}%"></i></span><span class="bv">${Math.round(l.density * 100)}%</span>`;
  }
  h += '</div>';
  el.innerHTML = h;
}

function verseLabels(pron) {
  const m = new Map();
  let lastHeader = null;
  for (const l of pron.lines) {
    if (l.header) { lastHeader = l.text.trim().replace(/^[\[(（【]\s*|\s*[\])）】]\s*:?$/g, ''); continue; }
    if (l.blank || !l.syl.length) continue;
    if (!m.has(l.verse)) m.set(l.verse, lastHeader || `${m.size + 1}절`);
    lastHeader = null;
  }
  return m;
}

// ───────────────────────── ③ 구조도 ─────────────────────────
export function renderStructure(el, st) {
  const { pron, rhyme, theme } = st;
  const names = verseLabels(pron);
  let h = '';
  for (const v of rhyme.scheme.verses) {
    const lines = rhyme.scheme.lines.filter(l => l.verse === v.verse);
    const color = l => (l.letter !== 'X' && l.group >= 0 ? groupStyle(l.group, theme).c : '');
    h += `<div class="scheme-card"><h3>${esc(names.get(v.verse) || `${v.verse + 1}절`)} · 끝라임 패턴</h3>`;
    h += `<div class="scheme-big">${lines.map(l => (l.letter === 'X' ? '<span class="x">X</span>' : `<span style="color:${color(l) || 'inherit'}">${l.letter}</span>`)).join('')}</div>`;
    h += `<div class="blocks">${v.blocks.map(b => `<span class="block"><b>${b.pattern}</b>${esc(b.name || '')}</span>`).join('')}</div>`;
    h += '<ul class="end-list">';
    for (const l of lines) {
      const line = pron.lines[l.line];
      const S = pron.syllables;
      const w = pron.words[S[l.end].word];
      h += `<li><span class="muted">${l.n + 1}줄</span><span class="el" style="color:${color(l) || 'var(--text-muted)'}">${l.letter}</span><span class="ew">…${esc(w.text)} <span class="muted">[${esc(w.pron)}]</span></span></li>`;
    }
    h += '</ul></div>';
  }
  h += '<div class="sect-title">줄 번호 × 라임 그룹 매트릭스 <small>칸을 누르면 그룹 정보</small></div>';
  h += `<div class="matrix-wrap">${matrixSvg(st)}</div>`;
  h += '<p class="note">색칸 = 그 줄에 해당 라임 그룹이 있음 · 굵은 테두리 = 줄 끝(끝라임) · 숫자 = 한 줄 안에서 반복된 횟수. X = 끝라임 없음.</p>';
  el.innerHTML = h;
}

function matrixSvg(st) {
  const { pron, rhyme, theme } = st;
  const G = rhyme.groups, R = rhyme.content;
  if (!G.length) return '<div class="empty">라임 그룹이 없습니다.</div>';
  const cell = 20, gap = 2, left = 54, top = 30;
  const W = left + G.length * (cell + gap) + 4, H = top + R.length * (cell + gap) + 4;
  const rowOf = new Map(R.map((l, i) => [l.idx, i]));
  const schemeOf = new Map(rhyme.scheme.lines.map(l => [l.line, l.letter]));
  const ink = theme === 'light' ? '#0b0b0b' : '#f0efec';
  const muted = theme === 'light' ? '#77766f' : '#8d8c84';
  const track = theme === 'light' ? '#efeee9' : '#1f1f1d';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="줄 번호와 라임 그룹 매트릭스">`;
  // 열 머리
  G.forEach((g, ci) => {
    const x = left + ci * (cell + gap) + cell / 2;
    const c = groupStyle(g.id, theme).c;
    s += `<circle cx="${x}" cy="12" r="9" fill="${c}"/><text x="${x}" y="15.5" font-size="9" font-weight="800" fill="#fff" text-anchor="middle">${g.id + 1}</text>`;
  });
  // 행 머리 + 바탕
  R.forEach((l, ri) => {
    const y = top + ri * (cell + gap);
    const letter = schemeOf.get(l.idx) || '';
    s += `<text x="4" y="${y + 14}" font-size="11" fill="${muted}">${l.n + 1}</text><text x="${left - 8}" y="${y + 14}" font-size="11" font-weight="800" fill="${letter === 'X' ? muted : ink}" text-anchor="end">${letter}</text>`;
    s += `<rect x="${left}" y="${y}" width="${G.length * (cell + gap) - gap}" height="${cell}" rx="3" fill="${track}"/>`;
  });
  // 칸
  G.forEach((g, ci) => {
    const c = groupStyle(g.id, theme).c;
    const byRow = new Map();
    g.members.forEach(m => {
      const ri = rowOf.get(m.line);
      if (ri === undefined) return;
      const e = byRow.get(ri) || { n: 0, end: false, texts: [] };
      e.n++; e.end = e.end || m.lineEnd; e.texts.push(m.text);
      byRow.set(ri, e);
    });
    for (const [ri, e] of byRow) {
      const x = left + ci * (cell + gap), y = top + ri * (cell + gap);
      s += `<g data-g="${g.id}" style="cursor:pointer"><title>${R[ri].n + 1}줄 · #${g.id + 1} ${esc(g.pattern)} · ${esc(e.texts.join(' / '))}</title>`;
      s += `<rect x="${x + 1}" y="${y + 1}" width="${cell - 2}" height="${cell - 2}" rx="4" fill="${c}"${e.end ? ` stroke="${ink}" stroke-width="2"` : ''}/>`;
      if (e.n > 1) s += `<text x="${x + cell / 2}" y="${y + 14}" font-size="10" font-weight="800" fill="#fff" text-anchor="middle">${e.n}</text>`;
      s += '</g>';
    }
  });
  return s + '</svg>';
}

// ───────────────────────── ④ 추천 ─────────────────────────
export function renderRecommend(el, res) {
  if (!res) { el.innerHTML = '<div class="empty">입력한 단어와 모음 패턴이 맞는 한국어·영어 단어를 음절 수별로 보여줍니다.</div>'; return; }
  if (res.error) { el.innerHTML = `<div class="empty">${esc(res.error)}</div>`; return; }
  let h = `<div class="rec-head"><b>${esc(res.query)}</b> → [${esc(res.pron)}] · 모음 패턴 <code>${esc(res.pattern)}</code> · 운 <code>${esc(res.rime)}</code></div>`;
  if (!res.groups.length) h += '<div class="empty">맞는 단어를 찾지 못했습니다. 더 짧게 입력하거나 ‘받침까지’를 꺼 보세요.</div>';
  for (const g of res.groups) {
    const SHOW = 24;
    h += `<div class="rec-group"><h4>${g.len}음절 · ${g.items.length}${g.more ? '+' : ''}개</h4><div class="words">`;
    g.items.forEach((it, k) => {
      h += `<button type="button" class="word${it.lang === 'en' ? ' en' : ''}${it.score >= 0.97 ? ' hi' : ''}${k >= SHOW ? ' extra' : ''}" data-word="${esc(it.w)}" title="유사도 ${Math.round(it.score * 100)}%">${esc(it.w)}${it.lang === 'en' ? ` <span class="pr">${esc(it.pron)}</span>` : ''}<small>${Math.round(it.score * 100)}</small></button>`;
    });
    h += '</div>';
    if (g.items.length > SHOW) h += `<button type="button" class="link more-btn" data-more>${g.items.length - SHOW}개 더 보기</button>`;
    h += '</div>';
  }
  h += '<p class="note">숫자 = 유사도(%). 단어 끝 음절들이 입력의 모음 패턴과 맞는 정도이며, 같은 유사도에서는 자주 쓰는 단어가 먼저 나옵니다. 점선 테두리 = 영어. 단어를 누르면 복사됩니다.</p>';
  el.innerHTML = h;
}

// ───────────────────────── 이미지 저장 ─────────────────────────
const FONT = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
export function drawImage(st, version) {
  const { pron, rhyme, theme } = st;
  const light = theme === 'light';
  const C = light
    ? { bg: '#fcfcfb', ink: '#0b0b0b', sub: '#52514e', muted: '#77766f', line: '#dddcd5' }
    : { bg: '#141413', ink: '#f0efec', sub: '#c3c2b7', muted: '#8d8c84', line: '#2f2f2c' };
  const W = 1080, P = 64, GUT = 56;
  let FS = 40, LH = 70;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const S = pron.syllables;
  const layout = (fs, lh) => {
    ctx.font = `500 ${fs}px ${FONT}`;
    const maxW = W - P * 2 - GUT - 40;
    const rows = [];
    for (const line of pron.lines) {
      if (line.blank) { rows.push({ t: 'gap' }); continue; }
      if (line.header) { rows.push({ t: 'sec', text: line.text.trim() }); continue; }
      const text = line.text.replace(/\s+$/, '');
      const chars = [];
      const charSyl = new Int32Array(text.length).fill(-1);
      for (const i of line.syl) for (let k = S[i].src[0]; k < S[i].src[1]; k++) if (k - line.start < text.length) charSyl[k - line.start] = i;
      for (let k = 0; k < text.length; k++) {
        const i = charSyl[k];
        chars.push({ ch: text[k], w: ctx.measureText(text[k]).width, g: i >= 0 ? rhyme.sylColor[i] : -1, m: i >= 0 ? rhyme.sylMember[i] : -1 });
      }
      // 멤버 안 띄어쓰기 잇기
      chars.forEach((c, k) => {
        if (charSyl[k] >= 0) return;
        let l = k - 1; while (l >= 0 && charSyl[l] < 0) l--;
        let r = k + 1; while (r < chars.length && charSyl[r] < 0) r++;
        if (l >= 0 && r < chars.length && chars[l].g >= 0 && chars[l].g === chars[r].g && chars[l].m === chars[r].m) { c.g = chars[l].g; c.m = chars[l].m; }
      });
      // 줄 바꿈 (공백 기준)
      let start = 0, x = 0, lastSpace = -1, first = true;
      for (let k = 0; k < chars.length; k++) {
        if (chars[k].ch === ' ') lastSpace = k;
        x += chars[k].w;
        if (x > maxW && k > start) {
          const cut = lastSpace > start ? lastSpace + 1 : k;
          rows.push({ t: 'line', chars: chars.slice(start, cut), ln: first ? line.n + 1 : null, line });
          first = false; start = cut; lastSpace = -1;
          x = chars.slice(start, k + 1).reduce((a, c) => a + c.w, 0);
        }
      }
      rows.push({ t: 'line', chars: chars.slice(start), ln: first ? line.n + 1 : null, line, last: true });
    }
    const legendN = Math.min(rhyme.groups.length, 8);
    const h = 250 + rows.reduce((a, r) => a + (r.t === 'line' ? lh : r.t === 'sec' ? lh * 0.75 : lh * 0.4), 0) + 60 + legendN * 48 + 110;
    return { rows, h };
  };
  let L = layout(FS, LH);
  while (L.h > 14000 && FS > 20) { FS -= 4; LH = Math.round(FS * 1.75); L = layout(FS, LH); }
  canvas.width = W; canvas.height = Math.ceil(L.h);
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, canvas.height);
  // 머리
  const sc = rhyme.scores;
  ctx.fillStyle = C.ink; ctx.font = `800 52px ${FONT}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText('라임 스캐너', P, P + 48);
  ctx.font = `600 28px ${FONT}`;
  const suffix = ` / 100 · ${sc.grade}`;
  const sw = ctx.measureText(suffix).width;
  ctx.fillStyle = C.sub; ctx.textAlign = 'right';
  ctx.fillText(suffix, W - P, P + 52);
  ctx.font = `800 64px ${FONT}`; ctx.fillStyle = C.ink;
  ctx.fillText(`${sc.total}`, W - P - sw - 6, P + 52);
  ctx.textAlign = 'left';
  ctx.font = `400 28px ${FONT}`; ctx.fillStyle = C.sub;
  const schemeTxt = rhyme.scheme.verses.map(v => v.pattern).join(' / ');
  ctx.fillText(`라임 밀도 ${pct(sc.density)} · 그룹 ${rhyme.groups.length}개 · 다음절 ${sc.multiCount}개`, P, P + 112);
  ctx.fillStyle = C.muted;
  ctx.fillText(`끝라임 ${schemeTxt.length > 46 ? schemeTxt.slice(0, 46) + '…' : schemeTxt}`, P, P + 154);
  ctx.fillStyle = C.line; ctx.fillRect(P, P + 186, W - P * 2, 2);
  // 본문
  let y = 250 + 20;
  const schemeOf = new Map(rhyme.scheme.lines.map(l => [l.line, l]));
  for (const r of L.rows) {
    if (r.t === 'gap') { y += LH * 0.4; continue; }
    if (r.t === 'sec') { ctx.font = `700 ${Math.round(FS * 0.6)}px ${FONT}`; ctx.fillStyle = C.muted; ctx.fillText(r.text, P + GUT, y + LH * 0.45); y += LH * 0.75; continue; }
    const base = y + LH * 0.62;
    if (r.ln) { ctx.font = `500 ${Math.round(FS * 0.5)}px ${FONT}`; ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.fillText(String(r.ln), P + GUT - 16, base); ctx.textAlign = 'left'; }
    if (r.last) {
      const sl = schemeOf.get(r.line.idx);
      if (sl) { ctx.font = `800 ${Math.round(FS * 0.55)}px ${FONT}`; ctx.fillStyle = sl.letter !== 'X' && sl.group >= 0 ? groupStyle(sl.group, theme).c : C.muted; ctx.textAlign = 'right'; ctx.fillText(sl.letter === 'X' ? '·' : sl.letter, W - P + 10, base); ctx.textAlign = 'left'; }
    }
    ctx.font = `500 ${FS}px ${FONT}`;
    // 배경·밑줄
    let x = P + GUT, k = 0;
    while (k < r.chars.length) {
      const c0 = r.chars[k];
      let j = k, w = 0;
      while (j < r.chars.length && r.chars[j].g === c0.g && r.chars[j].m === c0.m) { w += r.chars[j].w; j++; }
      if (c0.g >= 0) {
        const grp = rhyme.groups[c0.g], mem = grp.members[c0.m];
        const s = groupStyle(c0.g, theme);
        ctx.fillStyle = s.bg;
        roundRect(ctx, x - 2, base - FS * 0.98, w + 4, FS * 1.32, 8); ctx.fill();
        ctx.fillStyle = s.c;
        const u = underline(grp.len) * 1.6;
        if (mem.repeat || s.tier === 2) { for (let dx = 0; dx < w; dx += 14) ctx.fillRect(x + dx, base + FS * 0.3, Math.min(8, w - dx), u); }
        else if (s.tier === 1) { ctx.fillRect(x, base + FS * 0.26, w, u * 0.6); ctx.fillRect(x, base + FS * 0.26 + u, w, u * 0.6); }
        else ctx.fillRect(x, base + FS * 0.3, w, u);
      }
      x += w; k = j;
    }
    x = P + GUT; ctx.fillStyle = C.ink;
    for (const c of r.chars) { ctx.fillText(c.ch, x, base); x += c.w; }
    y += LH;
  }
  // 범례
  y += 30;
  ctx.fillStyle = C.line; ctx.fillRect(P, y, W - P * 2, 2); y += 46;
  ctx.font = `500 26px ${FONT}`;
  rhyme.groups.slice(0, 8).forEach(g => {
    const s = groupStyle(g.id, theme);
    ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(P + 14, y - 9, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `800 15px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(String(g.id + 1), P + 14, y - 3); ctx.textAlign = 'left';
    ctx.font = `500 26px ${FONT}`; ctx.fillStyle = C.sub;
    let t = `${g.pattern} (${g.len}음절)  ${g.members.filter(m => !m.repeat).map(m => m.text).join(' / ')}`;
    while (ctx.measureText(t).width > W - P * 2 - 44 && t.length > 4) t = t.slice(0, -2);
    if (t.length < `${g.pattern}`.length + 10 || ctx.measureText(t).width > W - P * 2 - 44) t += '…';
    ctx.fillText(t, P + 40, y);
    y += 48;
  });
  ctx.font = `400 22px ${FONT}`; ctx.fillStyle = C.muted;
  ctx.fillText(`라임 스캐너 ${version} · choihs-ai.github.io/rhyme`, P, canvas.height - P + 10);
  return canvas;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ───────────────────────── 텍스트 / JSON 내보내기 ─────────────────────────
export function buildTextSummary(st, version) {
  const { pron, rhyme } = st;
  const sc = rhyme.scores;
  const TAG = TAG_LABEL;
  const out = [];
  out.push(`[라임 스캐너 ${version}] 점수 ${sc.total}/100 (${sc.grade}) · 라임 밀도 ${pct(sc.density)} · 다음절 ${sc.multiCount}개(평균 ${sc.avgLen.toFixed(2)}음절)`);
  out.push(`끝라임 구조: ${rhyme.scheme.verses.map(v => v.blocks.map(b => b.pattern + (b.name ? `(${b.name})` : '')).join(' ')).join(' / ')}`);
  out.push('');
  out.push('라임 그룹');
  for (const g of rhyme.groups) {
    out.push(`#${g.id + 1} [${g.pattern}] ${g.len}음절 ${g.tags.map(t => TAG[t]).join('·')}: ${g.members.map(m => m.text + (m.repeat ? '(반복)' : '')).join(' / ')}`);
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
      members: g.members.map(m => ({ syllables: m.units, start: m.src[0], end: m.src[1], text: m.text, pron: m.pron, line: m.ln, lineEnd: m.lineEnd, repeat: m.repeat })),
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
