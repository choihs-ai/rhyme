"""한국어 단어 목록 생성 (빌드 도구, 앱 실행에는 필요 없음)

입력
  ko_full.txt  FrequencyWords 의 OpenSubtitles 2018 한국어 어절 빈도 (CC-BY-SA-4.0)
               https://github.com/hermitdave/FrequencyWords
  wf-ko.txt    (선택) wordfreq 한국어 목록 "단어\\t빈도" (CC-BY-SA-4.0). 위키·뉴스 어휘 보강
               https://github.com/rspeer/wordfreq
  Kiwi 형태소 사전 (kiwipiepy_model, Apache-2.0). 자막에 없는 표준 명사·부사·감탄사 보강

처리
  자막 어절을 Kiwi 로 분류한다.
    tier 1 = 단독 실질어(명사·부사·감탄사·대명사·관형사 등) + 어절에서 뽑은 명사 어간
    tier 2 = 활용형(동사·형용사 + 어미, 명사+이다 활용 등). 가사 줄 끝에 자주 오는 형태
    명사+조사 어절은 뺀다 (추천 목록의 잡음)
  형태소 하나짜리 실질어는 Kiwi 사전(고유명사 제외)에 있는 낱말만 남긴다. 자막에서 들어온 미등록어는
  대부분 등장인물 이름(라일리, 티리온)이라 추천 목록을 어지럽힌다. 복합명사는 자막 빈도 5 이상이거나 사전에 있으면 남긴다.
  Kiwi 사전의 명사·부사·감탄사 중 자막에 없는 것은 Kiwi 가 매긴 낱말 점수가 --vocab-min 이상일 때만 넣는다.
  점수가 낮은 쪽은 대부분 사투리·옛말(텬지곳, 개왓주미)이다.

출력: TSV (단어, 빈도, tier). 빈도순. 자막에 없는 사전 낱말은 빈도 0 으로 맨 뒤에 붙는다.

사용: pip install kiwipiepy wordfreq
      python tools/build-ko-list.py ko_full.txt [wf-ko.txt] [--min-freq 3] [--vocab-min -16] > ko-list.tsv
"""
import sys, re, collections
from kiwipiepy import Kiwi

argv = sys.argv[1:]
def opt(name, default):
    if name in argv:
        i = argv.index(name)
        v = argv[i + 1]
        del argv[i:i + 2]
        return type(default)(v)
    return default
MIN_FREQ = opt('--min-freq', 3)
VOCAB_MIN = opt('--vocab-min', -16.0)
LOW_FREQ = 5
src = argv[0]
wf_src = argv[1] if len(argv) > 1 else None

kiwi = Kiwi()
HANGUL = re.compile(r'^[가-힣]+$')
# 고유명사(NNP)는 자막 속 외국 인명이 많아 제외하고, 자주 쓰는 지명만 허용
PLACE_OK = set('서울 한국 대한민국 부산 대구 인천 광주 대전 울산 제주 강남 홍대 이태원 압구정 신촌 명동 한강 경기 강원 미국 일본 중국 영국 프랑스 독일 러시아 뉴욕 런던 파리 도쿄 아시아 유럽 아프리카 지구 태양 하와이 할리우드 브루클린 서울시'.split())
CONTENT_SINGLE = {'NNG', 'NNB', 'NP', 'NR', 'MAG', 'MAJ', 'IC', 'MM', 'XR'}
VERBAL = {'VV', 'VA', 'VX', 'VCP', 'VCN', 'XSV', 'XSA', 'VV-I', 'VA-I', 'VV-R', 'VA-R', 'VX-I', 'VX-R', 'XSA-I', 'XSV-I'}
BAD_NOUN = re.compile(r'^(것|수|거|게|데|때|줄|중|번|분|년|월|일|시|개|명|등|씨|님|들|쪽|뿐|듯|척|채|만큼|대로|뭐|건|걸|애)$')
VOCAB_TAGS = {'NNG', 'MAG', 'IC'}

# Kiwi 형태소 사전: 번호로 하나씩 꺼낸다 (빈 번호가 길게 이어지면 끝)
vocab = {}
i = miss = 0
while miss < 2000:
    try:
        m = kiwi.morpheme(i)
    except Exception:
        miss += 1
        i += 1
        continue
    i += 1
    if m.form and m.tag in CONTENT_SINGLE and HANGUL.match(m.form):
        vocab.setdefault(m.form, m.tag)

rows = []
for line in open(src, encoding='utf-8'):
    parts = line.split()
    if len(parts) != 2: continue
    w, f = parts[0], int(parts[1])
    if f < MIN_FREQ or not HANGUL.match(w) or len(w) > 6: continue
    rows.append((w, f))

words = collections.OrderedDict()   # word -> [freq, tier]
nouns = collections.Counter()
def add(w, f, tier):
    if w in words:
        words[w][0] += f
        words[w][1] = min(words[w][1], tier)
    else:
        words[w] = [f, tier]

B = 2000
for i in range(0, len(rows), B):
    chunk = rows[i:i + B]
    res = kiwi.tokenize([w for w, _ in chunk])
    for (w, f), toks in zip(chunk, res):
        tags = [t.tag for t in toks]
        forms = [t.form for t in toks]
        # 어절 속 명사 어간 수집
        for t in toks:
            if ((t.tag == 'NNG' and t.form in vocab) or (t.tag == 'NNP' and t.form in PLACE_OK)) and 2 <= len(t.form) <= 5 and HANGUL.match(t.form) and t.form in w:
                nouns[t.form] += f
        if len(toks) == 1 and tags[0] in CONTENT_SINGLE and forms[0] == w:
            if tags[0] == 'NNB' or (len(w) == 1 and tags[0] not in ('NNG', 'NP', 'MAG', 'IC')): continue
            if w not in vocab: continue
            add(w, f, 1)
        elif any(t in VERBAL for t in tags) and tags[-1].startswith('E') and not any(t.startswith('J') for t in tags):
            if len(w) >= 2: add(w, f, 2)
        elif len(toks) == 1 and tags[0] == 'NNP' and w in PLACE_OK:
            add(w, f, 1)
        elif all(t == 'NNG' for t in tags) and len(w) >= 2:
            if f < LOW_FREQ and w not in vocab: continue
            add(w, f, 1)  # 복합명사

for n, f in nouns.items():
    if BAD_NOUN.match(n): continue
    add(n, f // 2 + 1, 1)

# wordfreq 명사 보강
if wf_src:
    wf = []
    for line in open(wf_src, encoding='utf-8'):
        p = line.rstrip('\n').split('\t')
        if len(p) == 2 and HANGUL.match(p[0]) and 2 <= len(p[0]) <= 5 and p[0] not in words:
            wf.append((p[0], int(p[1])))
    for i in range(0, len(wf), B):
        chunk = wf[i:i + B]
        res = kiwi.tokenize([w for w, _ in chunk])
        for (w, f), toks in zip(chunk, res):
            if len(toks) == 1 and toks[0].tag == 'NNG' and toks[0].form == w and w in vocab and not BAD_NOUN.match(w):
                add(w, max(1, f // 40), 1)

# Kiwi 사전 보강: 자막에 없는 표준 명사·부사·감탄사
extra = [w for w, t in vocab.items() if t in VOCAB_TAGS and 2 <= len(w) <= 5 and w not in words and not BAD_NOUN.match(w)]
added = 0
for i in range(0, len(extra), B):
    chunk = extra[i:i + B]
    for w, r in zip(chunk, kiwi.analyze(chunk, top_n=1)):
        toks = r[0][0]
        # 낱말 하나로 분석되고, 그 낱말 점수(로그 확률)가 기준 이상일 때만
        if len(toks) == 1 and toks[0].form == w and toks[0].tag == vocab[w] and toks[0].score >= VOCAB_MIN:
            add(w, 0, 1)
            added += 1

out = sorted(words.items(), key=lambda kv: -kv[1][0])
for w, (f, tier) in out:
    print(f'{w}\t{f}\t{tier}')
print(f'# total {len(out)}  tier1 {sum(1 for _, v in out if v[1]==1)}  tier2 {sum(1 for _, v in out if v[1]==2)}  (Kiwi 사전 보강 {added})', file=sys.stderr)
