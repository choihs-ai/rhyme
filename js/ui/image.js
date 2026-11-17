// 결과를 이미지로 그린다 (canvas): 하이라이트 전체 이미지와 스토리용 점수 카드
import { groupStyle, underlineWidth, mapLineChars, pct } from './highlight.js';

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
  const layout = (fs, lh) => {
    ctx.font = `500 ${fs}px ${FONT}`;
    const maxW = W - P * 2 - GUT - 40;
    const rows = [];
    for (const line of pron.lines) {
      if (line.blank) { rows.push({ t: 'gap' }); continue; }
      if (line.header) { rows.push({ t: 'sec', text: line.text.trim() }); continue; }
      const text = line.text.replace(/\s+$/, '');
      const map = mapLineChars(line, text, pron, rhyme);
      const chars = [];
      for (let k = 0; k < text.length; k++) chars.push({ ch: text[k], w: ctx.measureText(text[k]).width, g: map.group[k], m: map.member[k] });
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
        const u = underlineWidth(mem.len) * 1.6;
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

// ───────────────────────── 점수 카드 (인스타 스토리 1080×1920) ─────────────────────────
export function drawScoreCard(st) {
  const { rhyme, theme } = st;
  const light = theme === 'light';
  const C = light
    ? { bg1: '#fcfcfb', bg2: '#ecebe5', ink: '#0b0b0b', sub: '#52514e', muted: '#77766f', track: '#dddcd5', card: 'rgba(0,0,0,0.04)' }
    : { bg1: '#1d1d1b', bg2: '#0b0b0a', ink: '#f0efec', sub: '#c3c2b7', muted: '#8d8c84', track: '#2f2f2c', card: 'rgba(255,255,255,0.04)' };
  const W = 1080, H = 1920, P = 96;
  const sc = rhyme.scores;
  const accent = groupStyle(0, theme).c;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.bg1); g.addColorStop(1, C.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  const fit = (text, max, font) => { ctx.font = font; let t = text; while (ctx.measureText(t).width > max && t.length > 2) t = t.slice(0, -2); return t === text ? t : t + '…'; };

  // 머리
  ctx.fillStyle = C.sub; ctx.font = `700 40px ${FONT}`;
  ctx.fillText('라임 스캐너', P, 160);
  ctx.fillStyle = C.muted; ctx.font = `500 34px ${FONT}`;
  ctx.fillText('내 가사 라임 점수', P, 216);

  // 큰 점수
  ctx.fillStyle = C.ink; ctx.font = `800 340px ${FONT}`;
  const numW = ctx.measureText(String(sc.total)).width;
  ctx.fillText(String(sc.total), P - 12, 560);
  ctx.fillStyle = C.muted; ctx.font = `600 64px ${FONT}`;
  ctx.fillText('/ 100', P + numW + 10, 560);
  // 등급 배지
  const bx = W - P - 170, by = 340;
  ctx.fillStyle = accent; roundRect(ctx, bx, by, 170, 170, 40); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `800 120px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(sc.grade, bx + 85, by + 128); ctx.textAlign = 'left';

  ctx.fillStyle = C.sub; ctx.font = `500 38px ${FONT}`;
  ctx.fillText(`라임 밀도 ${pct(sc.density)} · 다음절 라임 ${sc.multiCount}개 · ${rhyme.content.length}줄`, P, 650);

  // 항목 막대
  let y = 760;
  for (const p of sc.parts) {
    ctx.fillStyle = C.sub; ctx.font = `600 36px ${FONT}`;
    ctx.fillText(p.label, P, y);
    ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.font = `500 34px ${FONT}`;
    ctx.fillText(`${Math.round(p.value)} / ${p.max}`, W - P, y); ctx.textAlign = 'left';
    ctx.fillStyle = C.track; roundRect(ctx, P, y + 22, W - P * 2, 18, 9); ctx.fill();
    const w = Math.max(18, (W - P * 2) * Math.min(1, p.value / p.max));
    ctx.fillStyle = accent; roundRect(ctx, P, y + 22, w, 18, 9); ctx.fill();
    y += 100;
  }

  // 가장 긴 라임
  y += 40;
  ctx.fillStyle = C.ink; ctx.font = `800 44px ${FONT}`;
  ctx.fillText('가장 긴 라임', P, y);
  y += 28;
  const top = sc.top5.slice(0, 3);
  if (!top.length) { ctx.fillStyle = C.muted; ctx.font = `500 36px ${FONT}`; ctx.fillText('찾은 라임이 없습니다', P, y + 60); }
  for (const t of top) {
    const s = groupStyle(t.id, theme);
    ctx.fillStyle = C.card; roundRect(ctx, P, y, W - P * 2, 108, 24); ctx.fill();
    ctx.fillStyle = s.c; roundRect(ctx, P + 28, y + 30, 48, 48, 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `800 28px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(String(t.len), P + 52, y + 64); ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.fillText(fit(t.texts.join(' / '), W - P * 2 - 140, `600 38px ${FONT}`), P + 100, y + 68);
    y += 126;
  }

  // 꼬리 (라임 줄 세 개가 끝나는 1688 아래에 놓는다)
  ctx.fillStyle = C.sub; ctx.font = `600 38px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText('내 가사도 분석해 보기', W / 2, H - 150);
  ctx.fillStyle = accent; ctx.font = `700 42px ${FONT}`;
  ctx.fillText('choihs-ai.github.io/rhyme', W / 2, H - 90);
  ctx.textAlign = 'left';
  return canvas;
}
