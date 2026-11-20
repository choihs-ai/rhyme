// 라임 스캐너 — 결과 화면 (하이라이트·점수·구조도·추천)
// 분석 결과를 받아 HTML 문자열로 그린다. 이벤트 연결은 app.js 가 한다.
import { PALETTE, TAG_LABEL, groupStyle, underlineWidth, mapLineChars, esc, pct } from './ui/highlight.js';

const styleAttr = (g, theme, len) => { const s = groupStyle(g, theme); return `--c:${s.c};--bg-c:${s.bg}${len ? `;--u:${underlineWidth(len)}px` : ''}`; };

// ───────────────────────── ① 하이라이트 ─────────────────────────
export function renderHighlight(el, st) {
  const { pron, rhyme, theme } = st;
  const groups = rhyme.groups;
  const showNums = st.showNums === 'on' || (st.showNums !== 'off' && groups.length > PALETTE.dark.length);
  const sc = rhyme.scores;
  let h = `<div class="hl-summary">라임 그룹 <b>${groups.length}</b>개 · 라임 밀도 <b>${pct(sc.density)}</b> · 점수 <b>${sc.total}</b>/100. 색깔 칩이나 가사를 누르면 해당 라임만 강조하고 발음을 보여줍니다.</div>`;
  h += legendHtml(st);
  h += `<div class="hl-tools"><label class="switch small"><input type="checkbox" id="hl-pron"${st.showPron ? ' checked' : ''}><span class="track"></span><span>발음 표기 보기</span></label><span class="muted">밑줄 두께 = 라임 길이 · 빗금 = 같은 말 반복 · <b>줄 번호를 누르면 그 줄을 바로 고칩니다</b></span></div>`;
  if (rhyme.excludedKeys && rhyme.excludedKeys.length) h += `<div class="undo-row">‘라임 아님’으로 뺀 구간 ${rhyme.excludedKeys.length}개 · <button type="button" class="link" id="excl-undo">모두 되돌리기</button></div>`;
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
    h += `<div class="lyr-line" data-line="${line.idx}"><button type="button" class="ln" data-edit="${line.idx}" aria-label="${line.n + 1}줄 고치기">${line.n + 1}</button><span class="tx">${lineHtml(line, st, showNums)}${st.showPron ? pronHtml(line, st) : ''}</span>${schHtml}</div>`;
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
  const text = line.text, n = text.length;
  const map = mapLineChars(line, text, pron, rhyme);
  // 같은 음절에 속한 글자끼리 묶어 누를 수 있는 조각으로 만든다
  const syllableSpans = (a, b) => {
    let o = '', k = a;
    while (k < b) {
      const s = map.syl[k];
      let j = k + 1; while (j < b && map.syl[j] === s) j++;
      o += s >= 0 ? `<span class="s" data-s="${s}">${esc(text.slice(k, j))}</span>` : esc(text.slice(k, j));
      k = j;
    }
    return o;
  };
  let out = '', k = 0;
  while (k < n) {
    const g = map.group[k], mi = map.member[k];
    let j = k + 1; while (j < n && map.group[j] === g && map.member[j] === mi) j++;
    if (g >= 0) {
      const mem = rhyme.groups[g].members[mi];
      const sty = groupStyle(g, theme);
      const cls = 'm' + (sty.tier ? ` t${sty.tier}` : '') + (mem.repeat ? ' rep' : '') + (st.focus === g ? ' on' : '');
      out += `<span class="${cls}" data-g="${g}" data-m="${mi}" style="${styleAttr(g, theme, mem.len)}">${syllableSpans(k, j)}${showNums ? `<sup class="gn">${g + 1}</sup>` : ''}</span>`;
    } else out += syllableSpans(k, j);
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
  let h = '';
  if (g >= 0) h += groupInfoHtml(st, g, rhyme.sylMember[sylIdx]) + '<h3>이 단어</h3>';
  h += wordInfoHtml(st, w);
  h += `<div class="sheet-actions"><button class="ghost" type="button" data-editline="${s.line}">이 줄 바로 고치기</button><button class="ghost" type="button" data-recword="${esc(w.text)}">이 단어로 라임 찾기</button></div>`;
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
    h += `<li${mi === memberIdx ? ` style="background:${s.bg}"` : ''}><span class="mln">${m.ln + 1}줄</span><span><span class="swatch" style="--c:${s.c}"></span> ${esc(m.text)}${m.repeat ? ' <span class="tag">반복</span>' : ''}${m.lineEnd ? ' <span class="tag">줄 끝</span>' : ''}</span><span class="mp">[${esc(m.pron)}]</span><button type="button" class="mx" data-excl="${esc(m.key)}" aria-label="${esc(m.text)} 라임에서 빼기">빼기</button></li>`;
  });
  h += '</ul>';
  h += `<div class="sheet-actions"><button class="ghost" type="button" data-focus="${gid}">이 그룹만 강조</button><button class="ghost danger-text" type="button" data-exclgroup="${gid}">라임 아님 (그룹 해제)</button></div>`;
  h += '<p class="note">‘빼기’는 그 구간만 라임에서 제외하고 나머지로 다시 묶습니다. 점수·구조도·JSON에도 반영되고, 이 기기에 저장됩니다.</p>';
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
      h += `<button type="button" class="word${it.lang === 'en' ? ' en' : ''}${it.cat ? ' nm' : ''}${it.score >= 0.97 ? ' hi' : ''}${k >= SHOW ? ' extra' : ''}" data-word="${esc(it.w)}" title="${it.cat ? esc(it.cat) + ' · ' : ''}유사도 ${Math.round(it.score * 100)}%">${esc(it.w)}${it.lang === 'en' ? ` <span class="pr">${esc(it.pron)}</span>` : ''}<small>${Math.round(it.score * 100)}</small></button>`;
    });
    h += '</div>';
    if (g.items.length > SHOW) h += `<button type="button" class="link more-btn" data-more>${g.items.length - SHOW}개 더 보기</button>`;
    h += '</div>';
  }
  h += '<p class="note">숫자 = 유사도(%). 단어 끝 음절들이 입력의 모음 패턴과 맞는 정도이며, 같은 유사도에서는 자주 쓰는 단어가 먼저 나옵니다. 점선 테두리 = 영어, 옅은 바탕 = 이름·브랜드. 단어를 누르면 복사됩니다.</p>';
  el.innerHTML = h;
}
