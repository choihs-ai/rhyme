// 라임 스캐너 — 앱 전체 연결
import { analyzePronunciation, loadEnglishData } from './pronounce.js';
import { analyzeRhymes, describeGroups, DEFAULT_OPTIONS, setLexicon, lexiconFromKo } from './rhyme.js';
import { renderHighlight, renderScore, renderStructure, renderRecommend, syllableSheet, groupInfoHtml, drawImage, drawScoreCard, buildTextSummary, buildExport, esc } from './render.js';
import { encodeShare, decodeShare, shareCodeFromHash, appBaseUrl } from './share.js';
import { setDictionaries, recommend, dictionaryCounts } from './recommend.js';

export const VERSION = 'v1.3.1';

const SAMPLE = `너의 money 내 머니 다 같은 소리
밤새 달려 갈망한 날 봐 이제 팔자
flow 위로 올라 so 높이 날아
문제없어 끝없어 계속 걸어`;

// 처음 방문했을 때 보여 주는 예시 (직접 쓴 가사)
const DEMO = `[Verse 1]
새벽 세 시 반 불 꺼진 내 방
펜을 쥔 채 써 내려가 내 사상
남들은 말해 꿈은 그냥 환상
But I don't care 난 끝까지 가 전장
가진 건 없어도 쌓아 올린 내 가치
money talks 근데 난 말로 증명해 같이
어제의 나와 오늘의 나 사이
그 차이를 만든 건 쉼 없는 grind 매일`;

const $ = s => document.querySelector(s);
const LS = {
  get(k, d) { try { const v = localStorage.getItem('rhyme.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('rhyme.' + k, JSON.stringify(v)); } catch (e) { /* 저장 불가(사파리 개인정보 보호 모드 등) */ } },
};

const state = {
  options: { ...DEFAULT_OPTIONS, ...LS.get('options', {}) },
  overrides: new Map(Object.entries(LS.get('overrides', {}))),
  theme: document.documentElement.dataset.theme || 'dark',
  themePref: LS.get('theme', 'dark'),
  showPron: LS.get('showPron', false),
  showNums: LS.get('showNums', 'auto'),
  debug: LS.get('debug', true),
  exclude: new Set(LS.get('exclude', [])),
  pron: null, rhyme: null, focus: -1, tab: 'hl',
  rec: { lang: 'all', coda: false, last: null },
  demo: false, sharedText: null, lastText: '',
};

let dictReady = null;

// ───────────────────────── 시작 ─────────────────────────
function init() {
  $('#ver').textContent = VERSION;
  const ta = $('#lyrics');
  ta.value = LS.get('draft', '');
  updateCount();
  applyOptionsToUi();
  bindEvents();
  dictReady = loadDictionaries();
  registerSW();
  const lastVer = LS.get('lastVersion', null);
  if (lastVer && lastVer !== VERSION) setTimeout(() => toast(`${VERSION}(으)로 업데이트되었습니다`), 600);
  LS.set('lastVersion', VERSION);
  const code = shareCodeFromHash();
  if (code) loadShared(code);
  else if (ta.value.trim()) dictReady.then(() => analyze({ quiet: true }));
  else showDemo();
}

// ───────────────────────── 예시 · 공유 링크 ─────────────────────────
function showNotice(html) { const n = $('#notice'); n.innerHTML = html; n.hidden = false; }
function hideNotice() { const n = $('#notice'); n.hidden = true; n.innerHTML = ''; }

function showDemo() {
  $('#lyrics').value = DEMO;
  updateCount();
  state.demo = true;
  dictReady.then(() => analyze({ quiet: true, demo: true }));
}

async function loadShared(code) {
  try {
    const { text, options } = await decodeShare(code);
    if (options) Object.assign(state.options, options);
    applyOptionsToUi();
    $('#lyrics').value = text;
    updateCount();
    state.sharedText = text;
    state.demo = false;
    await dictReady;
    await analyze({ quiet: true });
  } catch (e) {
    console.error(e);
    toast('공유 링크를 열지 못했습니다');
    clearShared();
    if (!$('#lyrics').value.trim()) showDemo();
  }
}

function clearShared() {
  state.sharedText = null;
  if (shareCodeFromHash()) history.replaceState(null, '', location.pathname + location.search);
}

// 예시·공유 가사를 비우고 내 가사를 넣을 준비
function startMine() {
  const ta = $('#lyrics');
  ta.value = '';
  updateCount();
  state.demo = false;
  clearShared();
  hideNotice();
  collapseInput(false);
  $('.input-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  ta.focus({ preventScroll: true });
}

async function loadDictionaries() {
  const status = $('#dict-status');
  try {
    const [en, ko] = await Promise.all([
      fetch('data/en-words.json').then(r => { if (!r.ok) throw new Error('en ' + r.status); return r.json(); }),
      fetch('data/ko-words.json').then(r => { if (!r.ok) throw new Error('ko ' + r.status); return r.json(); }),
    ]);
    loadEnglishData(en);
    setDictionaries(ko, en);
    setLexicon(lexiconFromKo(ko));
    const c = dictionaryCounts();
    status.textContent = `사전 한국어 ${ko.count.toLocaleString()} · 영어 ${en.count.toLocaleString()}(랩 ${en.rapCount.toLocaleString()})`;
    if (state.debug) console.info(`[라임 스캐너 ${VERSION}] 사전 로드: 한국어 ${ko.count}, 영어 발음 ${en.count}, 추천 색인 ${c.ko}+${c.en}`);
  } catch (e) {
    console.error(e);
    status.textContent = '사전을 불러오지 못했습니다 — 영어는 규칙 기반으로 변환합니다';
  }
}

// ───────────────────────── 분석 ─────────────────────────
async function analyze({ quiet = false, edited = false, demo = false } = {}) {
  const text = $('#lyrics').value;
  if (!text.trim()) { if (!quiet) toast('가사를 붙여 넣어 주세요'); return; }
  // 예시·공유 가사가 아닌 새 가사를 분석하면 안내를 내린다
  if (!demo) state.demo = false;
  if (state.sharedText !== null && text !== state.sharedText) clearShared();
  const btn = $('#btn-analyze');
  btn.disabled = true; btn.textContent = '분석 중…';
  await dictReady;
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  try {
    const t0 = performance.now();
    if (state.debug) console.groupCollapsed(`[라임 스캐너] 발음 변환 단계별 출력 (${text.split('\n').length}줄)`);
    const pron = analyzePronunciation(text, { overrides: state.overrides, debug: state.debug });
    if (state.debug) console.groupEnd();
    const rhyme = analyzeRhymes(pron, { ...state.options, exclude: state.exclude });
    const ms = performance.now() - t0;
    if (state.debug) {
      console.groupCollapsed(`[라임 스캐너] ⑤ 라임 그룹 ${rhyme.groups.length}개 · 점수 ${rhyme.scores.total} · ${ms.toFixed(0)}ms`);
      describeGroups(pron, rhyme).forEach(l => console.log(l));
      console.log('끝라임:', rhyme.scheme.verses.map(v => v.pattern).join(' / '));
      console.log('분석 결과 객체: window.__rhyme');
      console.groupEnd();
      window.__rhyme = { pron, rhyme };
    }
    const keepFocus = edited && state.focus >= 0 && state.focus < rhyme.groups.length;
    state.pron = pron; state.rhyme = rhyme; if (!keepFocus) state.focus = -1;
    state.lastText = text;
    const isShared = state.sharedText !== null && text === state.sharedText;
    if (!demo && !isShared) saveRecent(text, edited);
    renderAll();
    $('#export-bar').hidden = false;
    if (demo) showNotice(`<span>아래는 <b>예시 가사</b> 분석이에요.</span><button type="button" data-mine>내 가사 넣기</button>`);
    else if (isShared) showNotice(`<span><b>공유받은 가사</b>의 분석 결과예요.</span><button type="button" data-mine>내 가사 분석하기</button>`);
    else hideNotice();
    collapseInput(true);
    if (!quiet) {
      selectTab('hl');
      $('.tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (e) {
    console.error(e);
    toast('분석 중 오류가 났습니다: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '분석하기';
  }
}

// 분석 후 입력칸을 접어 결과에 화면을 내준다
function collapseInput(on) {
  const card = $('.input-card');
  $('#input-full').hidden = on;
  $('#input-collapsed').hidden = !on;
  card.classList.toggle('is-collapsed', on);
  if (on && state.pron) {
    const n = state.pron.lines.filter(l => !l.blank && !l.header && l.syl.length).length;
    $('#collapsed-info').textContent = `가사 ${n}줄 분석됨 · 점수 ${state.rhyme.scores.total}`;
  }
}

// 하이라이트 화면에서 한 줄을 바로 고친다
function startLineEdit(lineIdx) {
  selectTab('hl');
  const row = document.querySelector(`.lyr-line[data-line="${lineIdx}"]`);
  if (!row || row.querySelector('.line-edit')) return;
  const lines = $('#lyrics').value.split('\n');
  const tx = row.querySelector('.tx');
  const inp = document.createElement('input');
  inp.className = 'line-edit';
  inp.value = lines[lineIdx] ?? '';
  inp.setAttribute('aria-label', '줄 고치기 (Enter 저장, Esc 취소)');
  inp.autocapitalize = 'off'; inp.spellcheck = false; inp.enterKeyHint = 'done';
  tx.replaceWith(inp);
  inp.focus();
  inp.setSelectionRange(inp.value.length, inp.value.length);
  let done = false;
  const finish = save => {
    if (done) return; done = true;
    if (!save || inp.value === lines[lineIdx]) { renderHighlight($('#panel-hl'), state); return; }
    lines[lineIdx] = inp.value.replace(/\n/g, ' ');
    $('#lyrics').value = lines.join('\n');
    updateCount();
    LS.set('draft', $('#lyrics').value);
    analyze({ quiet: true, edited: true }).then(() => {
      const r = document.querySelector(`.lyr-line[data-line="${lineIdx}"]`);
      if (r) { r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash'); }
    });
  };
  inp.addEventListener('keydown', e => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
  });
  inp.addEventListener('blur', () => finish(true));
}

function excludeKeys(keys, msg) {
  keys.forEach(k => state.exclude.add(k));
  LS.set('exclude', [...state.exclude].slice(-500));
  closeSheet();
  analyze({ quiet: true, edited: true }).then(() => toast(msg));
}

function renderAll() {
  if (!state.rhyme) return;
  renderHighlight($('#panel-hl'), state);
  renderScore($('#panel-score'), state);
  renderStructure($('#panel-struct'), state);
}

// ───────────────────────── 이벤트 ─────────────────────────
function bindEvents() {
  const ta = $('#lyrics');
  let draftT = 0;
  ta.addEventListener('input', () => { updateCount(); clearTimeout(draftT); draftT = setTimeout(() => LS.set('draft', ta.value), 400); });
  $('#btn-analyze').addEventListener('click', () => analyze());
  ta.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') analyze(); });
  $('#btn-sample').addEventListener('click', () => { ta.value = SAMPLE; updateCount(); LS.set('draft', SAMPLE); analyze(); });
  $('#btn-clear').addEventListener('click', () => { ta.value = ''; updateCount(); LS.set('draft', ''); ta.focus(); });
  // 예시 가사가 들어 있을 때 입력칸을 누르면 비워서 바로 붙여 넣을 수 있게
  ta.addEventListener('focus', () => { if (state.demo && ta.value === DEMO) { ta.value = ''; updateCount(); } });
  $('#notice').addEventListener('click', e => { if (e.target.closest('[data-mine]')) startMine(); });
  window.addEventListener('hashchange', () => { const c = shareCodeFromHash(); if (c) loadShared(c); });

  // 옵션
  $('#opt-vowel').addEventListener('change', e => setOption('vowelOnly', e.target.checked));
  $('#opt-minlen').addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    setOption('minLen', +b.dataset.v);
  });
  let sensT = 0;
  $('#opt-sens').addEventListener('input', e => {
    $('#opt-sens-out').textContent = e.target.value;
    clearTimeout(sensT); sensT = setTimeout(() => setOption('sensitivity', +e.target.value), 250);
  });

  // 탭
  const tabs = [...document.querySelectorAll('.tabs [role=tab]')];
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t.id.replace('tab-', '')));
    t.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      n.focus(); selectTab(n.id.replace('tab-', ''));
    });
  });

  // 하이라이트
  $('#btn-edit').addEventListener('click', () => {
    collapseInput(false);
    $('.input-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#lyrics').focus({ preventScroll: true });
  });
  $('#panel-hl').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]');
    if (ed) { startLineEdit(+ed.dataset.edit); return; }
    if (e.target.id === 'excl-undo') {
      state.rhyme.excludedKeys.forEach(k => state.exclude.delete(k));
      LS.set('exclude', [...state.exclude]);
      analyze({ quiet: true, edited: true }).then(() => toast('뺀 라임을 되돌렸습니다'));
      return;
    }
    if (e.target.closest('.line-edit')) return;
    const chip = e.target.closest('.chip[data-g]');
    if (chip) { setFocus(+chip.dataset.g === state.focus ? -1 : +chip.dataset.g); return; }
    const s = e.target.closest('[data-s]');
    if (s && state.pron) openSyllable(+s.dataset.s);
  });
  $('#panel-hl').addEventListener('change', e => {
    if (e.target.id === 'hl-pron') { state.showPron = e.target.checked; LS.set('showPron', state.showPron); renderHighlight($('#panel-hl'), state); }
  });
  // 점수 → 줄로 이동
  $('#panel-score').addEventListener('click', e => {
    const el = e.target.closest('[data-line]'); if (!el) return;
    gotoLine(+el.dataset.line);
  });
  // 구조도 → 그룹
  $('#panel-struct').addEventListener('click', e => {
    const g = e.target.closest('[data-g]'); if (!g) return;
    openSheet(`라임 그룹 #${+g.dataset.g + 1}`, groupInfoHtml(state, +g.dataset.g));
  });

  // 추천
  $('#rec-form').addEventListener('submit', e => { e.preventDefault(); runRecommend(); $('#rec-input').blur(); });
  $('#rec-lang').addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    state.rec.lang = b.dataset.v;
    setSeg($('#rec-lang'), b.dataset.v);
    if (state.rec.last) runRecommend();
  });
  $('#rec-coda').addEventListener('change', e => { state.rec.coda = e.target.checked; if (state.rec.last) runRecommend(); });
  $('#rec-out').addEventListener('click', e => {
    const more = e.target.closest('[data-more]');
    if (more) { more.previousElementSibling.classList.add('open'); more.remove(); return; }
    const w = e.target.closest('.word'); if (!w) return;
    copyText(w.dataset.word).then(ok => toast(ok ? `“${w.dataset.word}” 복사됨` : w.dataset.word));
  });

  // 내보내기
  $('#btn-share').addEventListener('click', shareLink);
  $('#btn-card').addEventListener('click', exportCard);
  $('#btn-image').addEventListener('click', exportImage);
  $('#btn-copy').addEventListener('click', async () => {
    if (!state.rhyme) return;
    const ok = await copyText(buildTextSummary(state, VERSION));
    toast(ok ? '분석 결과를 텍스트로 복사했습니다' : '복사하지 못했습니다');
  });
  $('#btn-json').addEventListener('click', exportJson);

  // 시트
  $('#btn-recent').addEventListener('click', openRecent);
  $('#btn-settings').addEventListener('click', openSettings);
  $('#sheet').addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { closeSheet(); return; }
    const f = e.target.closest('[data-focus]');
    if (f) { closeSheet(); selectTab('hl'); setFocus(+f.dataset.focus); $('#lyrics-view')?.scrollIntoView({ behavior: 'smooth' }); return; }
    const el = e.target.closest('[data-editline]');
    if (el) { closeSheet(); setTimeout(() => startLineEdit(+el.dataset.editline), 50); return; }
    const rw = e.target.closest('[data-recword]');
    if (rw) { closeSheet(); selectTab('rec'); $('#rec-input').value = rw.dataset.recword; runRecommend(); return; }
    const ex = e.target.closest('[data-excl]');
    if (ex) { excludeKeys([ex.dataset.excl], '그 구간을 라임에서 뺐습니다 (하이라이트 위쪽에서 되돌리기)'); return; }
    const eg = e.target.closest('[data-exclgroup]');
    if (eg) { excludeKeys(state.rhyme.groups[+eg.dataset.exclgroup].members.map(m => m.key), '그룹을 해제했습니다 (하이라이트 위쪽에서 되돌리기)'); return; }
    if (e.target.id === 'ov-save') return saveOverride();
    if (e.target.id === 'ov-del') return deleteOverride($('#ov-input').dataset.word);
  });
  $('#sheet').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'ov-input') saveOverride(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
}

function setOption(k, v) {
  state.options[k] = v;
  LS.set('options', state.options);
  applyOptionsToUi();
  if (state.rhyme) analyze({ quiet: true });
}
function applyOptionsToUi() {
  $('#opt-vowel').checked = !!state.options.vowelOnly;
  setSeg($('#opt-minlen'), String(state.options.minLen));
  $('#opt-sens').value = state.options.sensitivity;
  $('#opt-sens-out').textContent = state.options.sensitivity;
}
function setSeg(el, v) { el.querySelectorAll('button[data-v]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === v))); }
function updateCount() {
  const v = $('#lyrics').value;
  const lines = v.split('\n').filter(l => l.trim()).length;
  $('#char-count').textContent = `${lines}줄 · ${v.replace(/\s/g, '').length}자`;
}

function selectTab(id) {
  state.tab = id;
  document.querySelectorAll('.tabs [role=tab]').forEach(t => {
    const on = t.id === 'tab-' + id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll('.panel').forEach(p => { p.hidden = p.id !== 'panel-' + id; });
}

function setFocus(g) {
  state.focus = g;
  renderHighlight($('#panel-hl'), state);
}

function gotoLine(lineIdx) {
  selectTab('hl');
  const el = document.querySelector(`.lyr-line[data-line="${lineIdx}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}

function openSyllable(i) {
  const { title, html } = syllableSheet(state, i);
  openSheet(title, html);
}

// ───────────────────────── 발음 수정 ─────────────────────────
function saveOverride() {
  const inp = $('#ov-input');
  const word = inp.dataset.word;
  const val = inp.value.trim().replace(/\s+/g, '');
  if (!val) { deleteOverride(word); return; }
  if (!/^[가-힣']+$/.test(val)) { toast('한글로만 적어 주세요 (예: 머니)'); return; }
  state.overrides.set(word, val);
  LS.set('overrides', Object.fromEntries(state.overrides));
  closeSheet();
  toast(`“${word}” 발음을 [${val}]로 저장했습니다`);
  analyze({ quiet: true });
}
function deleteOverride(word) {
  state.overrides.delete(word);
  LS.set('overrides', Object.fromEntries(state.overrides));
  closeSheet();
  toast(`“${word}” 발음 수정을 취소했습니다`);
  if (state.rhyme) analyze({ quiet: true });
}

// ───────────────────────── 추천 ─────────────────────────
async function runRecommend() {
  const q = $('#rec-input').value.trim();
  if (!q) { toast('단어를 입력하세요'); return; }
  await dictReady;
  state.rec.last = q;
  const t0 = performance.now();
  const res = recommend(q, { lang: state.rec.lang, coda: state.rec.coda, overrides: state.overrides });
  if (state.debug && res && !res.error) console.info(`[추천] ${q} → [${res.pron}] ${res.pattern} · ${res.groups.reduce((a, g) => a + g.items.length, 0)}개 · ${(performance.now() - t0).toFixed(0)}ms`);
  renderRecommend($('#rec-out'), res);
}

// ───────────────────────── 최근 분석 ─────────────────────────
function saveRecent(text, replaceLatest = false) {
  let list = LS.get('recent', []);
  if (replaceLatest && list.length) list.shift(); // 줄 고치기는 같은 가사의 새 버전으로 덮어쓴다
  list = list.filter(r => r.text !== text);
  const first = text.split('\n').map(s => s.trim()).find(s => s && !/^[\[(]/.test(s)) || text.trim().slice(0, 30);
  list.unshift({ ts: Date.now(), title: first.slice(0, 40), lines: text.split('\n').filter(l => l.trim()).length, text, score: state.rhyme ? state.rhyme.scores.total : null });
  LS.set('recent', list.slice(0, 10));
}
function openRecent() {
  const list = LS.get('recent', []);
  let h = '';
  if (!list.length) h = '<div class="empty">아직 분석한 가사가 없습니다.</div>';
  else {
    h = '<ul class="list" id="recent-list">';
    list.forEach((r, i) => {
      const d = new Date(r.ts);
      h += `<li><button class="link grow" type="button" data-load="${i}" style="text-align:left;color:inherit"><div class="t1">${esc(r.title)}</div><small>${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} · ${r.lines}줄${r.score !== null && r.score !== undefined ? ` · ${r.score}점` : ''}</small></button><button class="icon-btn" type="button" data-del="${i}" aria-label="삭제"><svg><use href="#i-close"/></svg></button></li>`;
    });
    h += '</ul><p class="note">최근 10개까지 이 기기에만 저장됩니다.</p><button class="ghost danger-text" type="button" id="recent-clear">모두 지우기</button>';
  }
  openSheet('최근 분석한 가사', h, body => {
    body.addEventListener('click', e => {
      const ld = e.target.closest('[data-load]');
      if (ld) {
        const r = LS.get('recent', [])[+ld.dataset.load];
        if (r) { $('#lyrics').value = r.text; updateCount(); LS.set('draft', r.text); closeSheet(); analyze(); }
        return;
      }
      const del = e.target.closest('[data-del]');
      if (del) { const l = LS.get('recent', []); l.splice(+del.dataset.del, 1); LS.set('recent', l); openRecent(); return; }
      if (e.target.id === 'recent-clear') { LS.set('recent', []); openRecent(); }
    });
  });
}

// ───────────────────────── 설정 ─────────────────────────
function openSettings() {
  const ov = [...state.overrides];
  const seg = (name, cur, opts) => `<div class="seg small" data-set="${name}">${opts.map(([v, l]) => `<button type="button" role="radio" data-v="${v}" aria-checked="${v === cur}">${l}</button>`).join('')}</div>`;
  let h = `<div class="opt-row"><span class="opt-label">화면 테마</span>${seg('theme', state.themePref, [['dark', '다크'], ['light', '라이트'], ['system', '시스템']])}</div>`;
  h += `<div class="opt-row"><span class="opt-label">그룹 번호 표시</span>${seg('nums', state.showNums, [['auto', '자동'], ['on', '항상'], ['off', '끄기']])}</div>`;
  h += `<p class="note">색은 8가지이고, 9번째 그룹부터는 같은 색에 이중 밑줄·점선 밑줄과 그룹 번호로 구분합니다(‘자동’ = 그룹이 9개 이상일 때 번호 표시).</p>`;
  h += `<div class="opt-row"><label class="switch"><input type="checkbox" id="set-debug"${state.debug ? ' checked' : ''}><span class="track"></span><span>콘솔에 발음 변환 단계 출력 (디버그)</span></label></div>`;
  h += `<h3>내가 수정한 발음 (${ov.length})</h3>`;
  if (!ov.length) h += '<p class="note">하이라이트 화면에서 단어를 누르면 발음을 고칠 수 있습니다.</p>';
  else h += '<ul class="list">' + ov.map(([w, p]) => `<li><span class="grow"><b>${esc(w)}</b> → [${esc(p)}]</span><button class="icon-btn" type="button" data-ovdel="${esc(w)}" aria-label="삭제"><svg><use href="#i-close"/></svg></button></li>`).join('') + '</ul>';
  h += `<h3>앱 정보</h3><dl class="kv"><dt>버전</dt><dd>${VERSION}</dd><dt>사전</dt><dd>${esc($('#dict-status').textContent)}</dd><dt>오프라인</dt><dd id="set-sw">${esc($('#sw-status').textContent || '확인 중')}</dd></dl>`;
  h += '<div class="edit-row"><button class="ghost" type="button" id="set-update">업데이트 확인</button><button class="ghost" type="button" id="set-reset">캐시 지우고 새로고침</button></div>';
  h += '<p class="note">홈 화면에 추가: 사파리 공유 버튼 → ‘홈 화면에 추가’. 한 번 열어 두면 오프라인에서도 실행됩니다.</p>';
  openSheet('설정', h, body => {
    body.addEventListener('click', async e => {
      const b = e.target.closest('[data-set] button[data-v]');
      if (b) {
        const which = b.parentElement.dataset.set, v = b.dataset.v;
        setSeg(b.parentElement, v);
        if (which === 'theme') { state.themePref = v; LS.set('theme', v); applyTheme(); }
        if (which === 'nums') { state.showNums = v; LS.set('showNums', v); if (state.rhyme) renderHighlight($('#panel-hl'), state); }
        return;
      }
      const od = e.target.closest('[data-ovdel]');
      if (od) { state.overrides.delete(od.dataset.ovdel); LS.set('overrides', Object.fromEntries(state.overrides)); openSettings(); if (state.rhyme) analyze({ quiet: true }); return; }
      if (e.target.id === 'set-update') {
        const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        if (reg) { await reg.update(); toast('업데이트를 확인했습니다. 새 버전이 있으면 자동으로 적용됩니다.'); } else toast('서비스 워커가 없습니다');
      }
      if (e.target.id === 'set-reset') {
        if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
        const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        if (reg) await reg.unregister();
        location.reload();
      }
    });
    body.addEventListener('change', e => { if (e.target.id === 'set-debug') { state.debug = e.target.checked; LS.set('debug', state.debug); } });
  });
}
function applyTheme() {
  let t = state.themePref;
  if (t === 'system') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  state.theme = t;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]').setAttribute('content', t === 'light' ? '#f4f3ef' : '#141413');
  renderAll();
}
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (state.themePref === 'system') applyTheme(); });

// ───────────────────────── 시트 / 토스트 ─────────────────────────
let lastFocus = null;
function openSheet(title, html, onMount) {
  const sheet = $('#sheet');
  lastFocus = document.activeElement;
  $('#sheet-title').textContent = title;
  const body = $('#sheet-body');
  const fresh = body.cloneNode(false); // 이전 리스너 제거
  body.replaceWith(fresh);
  fresh.innerHTML = html;
  sheet.hidden = false;
  document.body.style.overflow = 'hidden';
  if (onMount) onMount(fresh);
  sheet.querySelector('.sheet-head .icon-btn').focus({ preventScroll: true });
}
function closeSheet() {
  $('#sheet').hidden = true;
  document.body.style.overflow = '';
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}
let toastT = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2600);
}

// ───────────────────────── 내보내기 ─────────────────────────
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) { /* 무시 */ }
    ta.remove();
    return ok;
  }
}
async function shareOrDownload(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancel'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
const stamp = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`; };
async function exportImage() {
  if (!state.rhyme) return;
  const canvas = drawImage(state, VERSION);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  if (!blob) { toast('이미지를 만들지 못했습니다'); return; }
  const r = await shareOrDownload(blob, `rhyme-${stamp()}.png`, '라임 스캐너 분석');
  if (r === 'downloaded') toast('이미지를 저장했습니다');
}
async function shareLink() {
  if (!state.rhyme) return;
  const btn = $('#btn-share');
  btn.disabled = true;
  try {
    const code = await encodeShare({ text: state.lastText, options: state.options });
    const url = `${appBaseUrl()}#s=${code}`;
    const sc = state.rhyme.scores;
    if (navigator.share) {
      try { await navigator.share({ title: '라임 스캐너', text: `내 가사 라임 점수 ${sc.total}점 (${sc.grade})`, url }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const ok = await copyText(url);
    toast(ok ? '결과 링크를 복사했습니다. 받은 사람도 같은 결과를 볼 수 있어요' : '링크를 복사하지 못했습니다');
  } catch (e) {
    console.error(e);
    toast('링크를 만들지 못했습니다');
  } finally { btn.disabled = false; }
}
async function exportCard() {
  if (!state.rhyme) return;
  const canvas = drawScoreCard(state);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  if (!blob) { toast('카드를 만들지 못했습니다'); return; }
  const r = await shareOrDownload(blob, `rhyme-score-${stamp()}.png`, '라임 스캐너 점수');
  if (r === 'downloaded') toast('점수 카드를 저장했습니다');
}
async function exportJson() {
  if (!state.rhyme) return;
  const data = buildExport(state, VERSION);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const r = await shareOrDownload(blob, `rhyme-${stamp()}.json`, '라임 스캐너 JSON');
  if (r === 'downloaded') toast('JSON 파일을 저장했습니다');
}

// ───────────────────────── 오프라인 (서비스 워커) ─────────────────────────
function registerSW() {
  const st = $('#sw-status');
  if (!('serviceWorker' in navigator)) { st.textContent = '· 오프라인 미지원 브라우저'; return; }
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload(); // 새 버전 적용
  });
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.type === 'cached') st.textContent = '· 오프라인 사용 가능';
  });
  window.addEventListener('load', () => {
    dictReady.finally(() => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        if (navigator.serviceWorker.controller) st.textContent = '· 오프라인 사용 가능';
        else st.textContent = '· 오프라인 준비 중…';
        reg.update().catch(() => {});
        navigator.serviceWorker.ready.then(() => { st.textContent = '· 오프라인 사용 가능'; });
      }).catch(err => { console.warn('SW 등록 실패', err); st.textContent = '· 오프라인 캐시 실패'; });
    });
  });
}

init();
