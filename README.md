# 라임 스캐너

한국어와 영어가 섞인 랩 가사를 붙여 넣으면 **모든 종류의 라임**을 찾아
색깔 하이라이트 · 점수 · 구조도 · 추천 단어로 보여주는 웹앱입니다.
서버 없이 정적 파일만으로 동작하고, 아이폰 홈 화면에 추가하면 오프라인에서도 실행됩니다.

- 주소: https://choihs-ai.github.io/rhyme/
- 아이폰: 사파리로 열기 → 공유 버튼 → **홈 화면에 추가**. 한 번 열어 두면 비행기 모드에서도 실행됩니다.
- 화면 하단의 버전(`v1.3.0`)으로 업데이트가 반영됐는지 확인할 수 있습니다.

## 사용법

1. 가사를 붙여 넣고 **분석하기** (빈 줄 = 벌스 구분, `[Verse]`·`[Hook]` 같은 머리말 줄은 분석에서 제외)
2. 탭 4개
   - **하이라이트**: 라임 그룹마다 다른 색 배경, 밑줄 두께 = 라임 길이(음절 수), 빗금 = 같은 말 반복.
     **줄 번호를 누르면 그 줄을 바로 고치고** 자동으로 다시 분석합니다(분석 후 입력칸은 한 줄로 접힘, ‘가사 전체 수정’으로 펼침).
     잘못 잡힌 라임은 그룹 팝업에서 **빼기**(구간 하나) / **라임 아님**(그룹 전체)으로 제외 — 점수·구조도·JSON에 반영되고 기기에 저장, 하이라이트 위 ‘모두 되돌리기’로 복구.
     색 칩을 누르면 그 그룹만 강조, 가사를 누르면 발음 표기·모음 패턴 팝업과 **발음 직접 수정**.
     ‘발음 표기 보기’를 켜면 줄마다 실제 발음이 같이 나옵니다. 줄 오른쪽 글자는 끝라임 기호(A, B…).
   - **점수**: 100점 종합 점수와 항목별 산출 근거, 라임 밀도, 다음절 라임 수·평균 길이, 가장 긴 라임 TOP 5, 줄별·벌스별 밀도 막대.
   - **구조도**: 줄 끝 라임 패턴(AABB 커플릿 / ABAB 교차운 / ABBA 포옹운 …), 줄 번호 × 라임 그룹 매트릭스.
   - **추천**: 단어를 넣으면 모음 패턴이 맞는 한국어·영어 단어를 음절 수별, 유사도 순으로 보여줍니다(누르면 복사).
3. 하단 버튼: **이미지 저장**(하이라이트 결과 PNG) · **텍스트 복사** · **JSON 내보내기**
4. ⏱ 최근 분석한 가사 10개(기기에 저장) · ⚙ 설정(테마, 그룹 번호 표시, 디버그 출력, 내가 수정한 발음 목록, 캐시 초기화)

분석 옵션: **모음만 같아도 라임 인정**(끄면 받침도 같은 계열이어야 함) · **최소 라임 음절 수(1~4)** · **판정 민감도**(엄격 ↔ 느슨).

## 분석 방식

### 1. 발음 변환 — 모든 가사를 “음절 단위 발음 표기”로 통일 (`js/pronounce.js`)

| 단계 | 내용 | 예 |
|---|---|---|
| ① 토큰 분리 | 줄 → 단어 → 한글·영어·숫자·기호 조각 | `money가` = money(영) + 가(한) |
| ② 표기 변환 | 영어 음차, 숫자·기호 읽기 | money→머니, flow→플로우, 24→이십사, 24살→스물네살, &→앤, BTS→비티에스 |
| ③ 음운 규칙 | 표준 발음법 적용 (단어 안, 영어 음차 포함) | 옷이→오시, 국물→궁물, 신라→실라, 같이→가치, 없어→업써, 끝없어→끄덥써, 너의→너이 |
| ④ 음절 배열 | 음절마다 초성·모음·받침·원문 위치 | 머(ㅓ) 니(ㅣ) |

- **한국어 규칙**: 연음, 겹받침, 7대표음(ㄱㄴㄷㄹㅁㅂㅇ), 비음화, 유음화, 경음화, 격음화(ㅎ), 구개음화,
  받침 뒤 실질형태소 연음(끝없어, 맛없다), ‘의’ 발음, ㅈ·ㅉ·ㅊ 뒤 반모음 탈락(져→저), ㅖ→ㅔ.
- **영어**: 랩 영어 예외 사전 1,075개(직접 작성, 예: swag→스웩, everything→에브리띵, gonna→거너) +
  CMU 발음 사전 기반 상위 빈도 20,000단어를 음소(ARPAbet) → 한글 규칙으로 변환.
  사전에 없는 단어는 접미사 분해(flexin → flex + in), 규칙 기반 글자→발음 변환으로 처리.
  축약형(`gonna`, `wanna`, `'cause`, `runnin'`, `I'm` …), 대문자 약어(MC→엠씨) 지원.
- 영어 음차에서 끼워 넣은 모음(flow의 ‘플’, best의 ‘스트’)은 **삽입모음**으로 표시하고 라임 판정에서 약하게 다룹니다.
  영어 `ow` 이중모음은 한 음절로 묶습니다(flow = 플 + 로우, soul = 소울 1음절).
- **발음 직접 수정**: 하이라이트에서 단어를 눌러 한글로 고치면 이 기기(localStorage)에 저장되어 모든 분석에 적용됩니다.
- **디버그**: 분석할 때마다 브라우저 콘솔에 ①~④ 단계와 ⑤ 라임 그룹이 출력됩니다(설정에서 끄기 가능). `window.__rhyme`에 결과 객체.

### 2. 라임 판정 (`js/rhyme.js`)

**모음 유사도**: 같음 1.0 · 같은 소리 그룹(ㅐ=ㅔ, ㅙ=ㅚ=ㅞ, ㅒ=ㅖ) 0.9 · 비슷한 소리(ㅓ↔ㅗ, ㅡ↔ㅜ, ㅣ↔ㅟ, 이중모음↔단모음 핵 ㅑ↔ㅏ 등) 0.6 · 그 외 0
**받침 유사도**: 같음 1.0 · 같은 계열(비음 ㄴㅁㅇ / 폐쇄음 ㄱㄷㅂ) 0.6 · 받침 유무 차이 0.3
**음절 점수** = 모음 × 0.75 + 받침 × 0.25

찾는 라임
1. **끝라임** — 줄 끝 1~4음절끼리 (3줄 거리까지: AABB·ABAB·ABBA)
2. **다음절(멀티) 라임** — 연속 2음절 이상 모음 패턴 반복을 가사 전체에서 (예: 날 봐 / 갈망 / 팔자)
3. **내부 라임** — 한 줄 안, 또는 줄 중간끼리
4. **모음 라임** — 받침은 다르고 모음 배열이 같은 경우(태그로 표시)
5. **한·영 교차 라임** — money ↔ 머니 ↔ 너의

규칙
- 같은 패턴은 하나의 **라임 그룹**으로 묶고, **긴 라임이 우선**(길이^1.2 × 유사도² × 단어·줄 끝 정렬 가중치 순으로 처리).
- **같은 말 반복**(같은 글자열, 1음절은 같은 단어)은 ‘반복’으로 빗금 표시하고 점수에서 제외합니다 (예: 문제없어 / 끝없어의 ‘없어’).
- 한국어 특성상 우연한 모음 일치가 많아서 다음을 걸러냅니다: 양쪽 끝이 모두 조사·어미인 음절은 약하게(어/아 어미는 제외),
  그룹은 ‘강한 쌍’(단어 끝이 맞고 가까운 줄, 또는 줄 끝끼리)으로만 새로 만들고, 끝라임이거나 3음절 이상이거나
  가까이 몰린 경우만 남깁니다. 라임을 의도하지 않은 일상 산문(`tests/fixtures/prose.txt`)은 라임 밀도 약 3%(16점, D)로 나옵니다 — 같은 기준으로 직접 쓴 랩 벌스(`tests/fixtures/verse1.txt`)는 34%(85점).
- 민감도를 올리면 허용 유사도가 낮아지고 탐색 거리가 늘어납니다.

### 3. 점수 (100점)

| 항목 | 만점 | 산식 |
|---|---|---|
| 라임 밀도 | 40 | 라임 참여 음절 ÷ 전체 음절 (45% 이상 만점) |
| 다음절 라임 | 25 | 다음절 음절 비율(25% 만점, 15점) + 평균 길이(3음절 만점, 10점) |
| 끝라임 | 15 | 끝라임이 맞는 줄의 비율 |
| 다양성 | 10 | 서로 다른 모음 패턴 수 (줄 수 × 0.6개 만점, 밀도 30% 미만이면 비례 감소) |
| 반복 회피 | 10 | 같은 말 반복 비율이 높을수록 감점 (밀도 30% 미만이면 비례 감소) |

등급: S 85+ · A 70+ · B 55+ · C 40+ · D

## JSON 내보내기 (가사 모션 엔진 연동용)

```jsonc
{
  "format": "rhyme-scanner/v1",
  "text": "원문 전체",
  "syllables": [ { "index": 2, "text": "머", "vowel": "ㅓ", "coda": "", "onset": "ㅁ", "epenthetic": false,
                   "lang": "en", "line": 0, "word": 1, "start": 3, "end": 5, "group": 0, "member": 1, "repeat": false } ],
  "groups":    [ { "id": 0, "length": 2, "pattern": "ㅓ-ㅣ", "rime": "어이", "tags": ["multi","internal","cross"], "color": "#3987e5",
                   "members": [ { "syllables": [2,3], "start": 3, "end": 8, "text": "money", "pron": "머니", "line": 0, "lineEnd": false, "repeat": false } ] } ],
  "lines": [...], "words": [...], "scheme": [...], "scores": {...}
}
```
`start`/`end`는 원문 문자 오프셋 `[start, end)`, `group`은 `groups[].id`(라임이 아니면 `null`).

## 폴더 구조

```
index.html            화면 구조
css/style.css         스타일 (모바일 우선, 다크 기본)
js/pronounce.js       발음 변환: 한글 분해, 음운 규칙, 숫자·기호, 영어 음차
js/rhyme.js           라임 판정·그룹화·끝라임 구조·점수
js/render.js          하이라이트·점수·구조도·추천 화면, 이미지·텍스트·JSON 내보내기
js/recommend.js       추천 단어 검색
js/app.js             전체 연결 (상태, 저장, 탭, 팝업, 서비스 워커 등록)
data/ko-words.json    한국어 38,566단어 — 실제 발음의 운(초성→ㅇ)으로 색인
data/en-words.json    영어 발음 20,000단어(랩 예외 사전 포함) + 추천 색인
manifest.json, sw.js  홈 화면 추가 + 오프라인 캐시
icons/                앱 아이콘
tools/                사전·아이콘 생성 스크립트 (앱 실행에는 불필요)
tests/                발음·라임·추천·버전·브라우저 테스트
```

빌드 도구 없이 순수 HTML/CSS/JS(ES 모듈)입니다. 푸시하면 바로 반영됩니다.
사전은 단어를 발음 패턴별로 묶은 압축 형식(키 하나에 단어 여러 개를 공백으로 연결)이라 두 파일 합쳐 약 1.2MB,
GitHub Pages의 gzip 전송 기준 약 0.5MB입니다. 처음 접속 때 한 번 받고 서비스 워커가 캐시합니다.

## 개발

```bash
node tests/pronounce.test.mjs   # 1단계: 발음 변환 (테스트 가사 단계별 출력 + 규칙 73개)
node tests/rhyme.test.mjs       # 2단계: 테스트 가사 라임 4그룹 + 반복 표시 확인
node tests/rhyme.test.mjs tests/fixtures/verse1.txt   # 임의 가사 분석
node tests/recommend.test.mjs 머니 flow               # 추천 검색
node tests/version.test.mjs     # app.js 와 sw.js 버전 일치 확인

# 브라우저 테스트 (Playwright, 아이폰 13 화면, 오프라인 재시작 포함)
(cd .. && python3 -m http.server 8765) &   # http://localhost:8765/rhyme/
node tests/e2e.cjs /tmp/rhyme-shots
```

**새 버전 배포**: `js/app.js`의 `VERSION`과 `sw.js`의 `VERSION`을 같이 올리고 푸시합니다(`node tests/version.test.mjs`로 확인).
서비스 워커가 새 캐시를 받아 자동으로 교체하고, 화면 하단 버전이 바뀝니다. 사전 파일을 바꿨다면 `sw.js`의 `DATA_VERSION`도 올립니다.

**사전 다시 만들기**
```bash
pip install kiwipiepy wordfreq cmudict
curl -O https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ko/ko_50k.txt
python3 -c "import wordfreq as w; d=w.get_frequency_dict('ko'); open('wf-ko.txt','w').writelines(f'{k}\t{int(v*1e8)}\n' for k,v in sorted(d.items(),key=lambda x:-x[1])[:80000]); open('wf-en.txt','w').writelines(x+'\n' for x in w.top_n_list('en',40000))"
python3 tools/build-ko-list.py ko_50k.txt wf-ko.txt > ko-list.tsv
node tools/build-data.mjs --cmu "$(python3 -c 'import cmudict,os;print(os.path.join(os.path.dirname(cmudict.__file__),"data","cmudict.dict"))')" --en-freq wf-en.txt --ko-list ko-list.tsv
```
랩 영어 예외 사전은 `tools/data-src/en-rap.txt`(형식: `단어 한글발음 [-]`)를 고치면 됩니다.

## GitHub Pages 설정

저장소 Settings → Pages → Source: **Deploy from a branch**, Branch: **main / (root)** → Save.
몇 분 뒤 https://choihs-ai.github.io/rhyme/ 에서 열립니다(`.nojekyll` 포함).

## 데이터 출처와 라이선스

- 한국어 단어: [FrequencyWords](https://github.com/hermitdave/FrequencyWords) ko_50k (OpenSubtitles 2018, CC BY-SA 4.0),
  [wordfreq](https://github.com/rspeer/wordfreq) 한국어 목록(CC BY-SA 4.0). 빌드 때 [Kiwi](https://github.com/bab2min/kiwipiepy) 형태소 분석으로 분류.
- 영어 발음: [CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict) (BSD 2-Clause), 빈도: wordfreq 영어 목록.
- `data/` 의 사전 파일은 위 CC BY-SA 4.0 데이터에서 파생되었으므로 CC BY-SA 4.0 으로 배포합니다.
