"""한국어 단어 목록 생성 (빌드 도구 — 앱 실행에는 필요 없음)

입력: FrequencyWords ko_50k.txt (OpenSubtitles 2018 어절 빈도, CC-BY-SA-4.0)
      https://github.com/hermitdave/FrequencyWords
처리: Kiwi 형태소 분석기로 어절을 분류
      tier 1 = 단독 실질어(명사·부사·감탄사·대명사·관형사 등) + 어절에서 뽑은 명사 어간
      tier 2 = 활용형(동사·형용사 + 어미, 명사+하다 활용 등)  — 가사 줄 끝에 자주 오는 형태
      명사+조사 어절은 제외(추천 목록 잡음 감소)
출력: TSV (단어, 빈도, tier)

      (선택) wordfreq 한국어 목록(단어\t빈도)에서 단독 명사를 추가로 수집 — 위키·뉴스 어휘 보강
      https://github.com/rspeer/wordfreq  (데이터 CC-BY-SA-4.0)
사용: pip install kiwipiepy wordfreq
      python tools/build-ko-list.py ko_50k.txt [wf-ko.txt] > ko-list.tsv
"""
import sys, re, collections
from kiwipiepy import Kiwi

src = sys.argv[1]
kiwi = Kiwi()
HANGUL = re.compile(r'^[가-힣]+$')
# 고유명사(NNP)는 자막 속 외국 인명이 많아 제외하고, 자주 쓰는 지명만 허용
PLACE_OK = set('서울 한국 대한민국 부산 대구 인천 광주 대전 울산 제주 강남 홍대 이태원 압구정 신촌 명동 한강 경기 강원 미국 일본 중국 영국 프랑스 독일 러시아 뉴욕 런던 파리 도쿄 아시아 유럽 아프리카 지구 태양 하와이 할리우드 브루클린 서울시'.split())
CONTENT_SINGLE = {'NNG', 'NNB', 'NP', 'NR', 'MAG', 'MAJ', 'IC', 'MM', 'XR'}
VERBAL = {'VV', 'VA', 'VX', 'VCP', 'VCN', 'XSV', 'XSA', 'VV-I', 'VA-I', 'VV-R', 'VA-R', 'VX-I', 'VX-R', 'XSA-I', 'XSV-I'}
BAD_NOUN = re.compile(r'^(것|수|거|게|데|때|줄|중|번|분|년|월|일|시|개|명|등|씨|님|들|쪽|뿐|듯|척|채|만큼|대로|뭐|건|걸|애)$')

rows = []
for line in open(src, encoding='utf-8'):
    parts = line.split()
    if len(parts) != 2: continue
    w, f = parts[0], int(parts[1])
    if not HANGUL.match(w) or len(w) > 6: continue
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
            if (t.tag == 'NNG' or (t.tag == 'NNP' and t.form in PLACE_OK)) and 2 <= len(t.form) <= 5 and HANGUL.match(t.form) and t.form in w:
                nouns[t.form] += f
        if len(toks) == 1 and tags[0] in CONTENT_SINGLE and forms[0] == w:
            if tags[0] == 'NNB' or (len(w) == 1 and tags[0] not in ('NNG', 'NP', 'MAG', 'IC')): continue
            add(w, f, 1)
        elif any(t in VERBAL for t in tags) and tags[-1].startswith('E') and not any(t.startswith('J') for t in tags):
            if len(w) >= 2: add(w, f, 2)
        elif len(toks) == 1 and tags[0] == 'NNP' and w in PLACE_OK:
            add(w, f, 1)
        elif all(t == 'NNG' for t in tags) and len(w) >= 2:
            add(w, f, 1)  # 복합명사

for n, f in nouns.items():
    if BAD_NOUN.match(n): continue
    add(n, f // 2 + 1, 1)

# wordfreq 명사 보강
if len(sys.argv) > 2:
    wf = []
    for line in open(sys.argv[2], encoding='utf-8'):
        p = line.rstrip('\n').split('\t')
        if len(p) == 2 and HANGUL.match(p[0]) and 2 <= len(p[0]) <= 5 and p[0] not in words:
            wf.append((p[0], int(p[1])))
    for i in range(0, len(wf), B):
        chunk = wf[i:i + B]
        res = kiwi.tokenize([w for w, _ in chunk])
        for (w, f), toks in zip(chunk, res):
            if len(toks) == 1 and toks[0].tag == 'NNG' and toks[0].form == w and not BAD_NOUN.match(w):
                add(w, max(1, f // 40), 1)

out = sorted(words.items(), key=lambda kv: -kv[1][0])
for w, (f, tier) in out:
    print(f'{w}\t{f}\t{tier}')
print(f'# total {len(out)}  tier1 {sum(1 for _, v in out if v[1]==1)}  tier2 {sum(1 for _, v in out if v[1]==2)}', file=sys.stderr)
