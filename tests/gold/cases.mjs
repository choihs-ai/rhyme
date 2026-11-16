// 정답 세트 (gold set) — 직접 쓴 가사와, 사람이 듣기에 분명한 라임만 정답으로 적었다.
//
//   rhymes : 같은 라임 그룹으로 묶여야 하는 조각들. len 을 주면 그 음절 수 이상으로 잡혀야 한다.
//   not    : 같은 그룹으로 묶이면 안 되는 쌍 (오탐 확인)
//   repeat : '같은 말 반복'으로 표시되거나 아예 안 잡혀야 하는 조각
//   scheme : 끝라임 구조 (벌스가 여러 개면 / 로 구분)
//   none   : 라임이 하나도 없어야 하는 글 (산문 대조군)
//
// 조각 표기: "줄번호:글자"  (같은 줄에 여러 번 나오면 "줄번호:글자#2" 처럼 몇 번째인지)
// 판단이 갈리는 약한 라임(했다/갔다 같은 어미 반복 등)은 정답에 넣지 않았다.
export const CASES = [
  // ───────── 끝라임 (각운) ─────────
  { id: 'end-aaaa', cat: '끝라임', text: `오늘도 난 펜을 잡아
내일을 향해 달려가
밤새 써 내려간 가사
한숨 섞인 내 박자`,
    rhymes: [{ w: ['1:잡아', '3:가사', '4:박자'], len: 2 }], scheme: 'AAAA' },
  { id: 'end-aabb', cat: '끝라임', text: `어두운 밤 홀로 걷는 거리
머릿속엔 온통 네 목소리
멈춰 있던 시간이 다시 흘러
잊고 있던 기억이 나를 불러`,
    rhymes: [{ w: ['1:거리', '2:소리'] }, { w: ['3:흘러', '4:불러'] }], not: [['1:거리', '3:흘러']], scheme: 'AABB' },
  { id: 'end-abab', cat: '끝라임', text: `텅 빈 방 안에 켜진 불
벽에 걸린 낡은 시계
식탁 위에 놓인 찬물
혼자 남은 나의 세계`,
    rhymes: [{ w: ['1:불', '3:물'] }, { w: ['2:시계', '4:세계'] }], not: [['1:불', '2:시계']], scheme: 'ABAB' },
  { id: 'end-abba', cat: '끝라임', text: `눈을 감으면 떠오르는 얼굴
지워 보려 해도 선명한 기억
돌아갈 수 없는 그때의 추억
창밖은 어느새 하얀 겨울`,
    rhymes: [{ w: ['1:얼굴', '4:겨울'] }, { w: ['2:기억', '3:추억'] }], scheme: 'ABBA' },
  { id: 'end-coda-class', cat: '끝라임', text: `새벽 세 시 불 꺼진 방
펜 하나 쥐고 지새운 밤
아직도 멀기만 한 정상
그래도 포기 못 해 난`,
    rhymes: [{ w: ['1:방', '2:밤', '3:상', '4:난'] }], scheme: 'AAAA' },
  { id: 'end-number', cat: '끝라임', text: `난 언제나 1등
꺼지지 않는 신호등`,
    rhymes: [{ w: ['1:등', '2:등'] }], scheme: 'AA' },
  { id: 'end-none', cat: '끝라임', text: `창문을 열어 두었지
바람이 불어온다
멀리서 들리는 기적 소리뿐
나는 아직 깨어 있어`,
    scheme: 'XXXX' },

  // ───────── 모음 라임 (받침이 달라도 모음 배열이 같음) ─────────
  { id: 'vowel-4syl', cat: '모음 라임', text: `불 꺼진 방 안에서
끝없는 밤 앞에서`,
    rhymes: [{ w: ['1:방 안에서', '2:밤 앞에서'], len: 3 }], scheme: 'AA' },
  { id: 'vowel-nasal', cat: '모음 라임', text: `스쳐 가는 바람
잊지 못할 사랑`,
    rhymes: [{ w: ['1:바람', '2:사랑'], len: 2 }], scheme: 'AA' },
  { id: 'vowel-coda-none', cat: '모음 라임', text: `저 높은 하늘
바라보는 나를`,
    rhymes: [{ w: ['1:하늘', '2:나를'], len: 2 }], scheme: 'AA' },
  { id: 'vowel-coda-diff', cat: '모음 라임', text: `지키지 못한 약속
매일 밤 꾸는 악몽`,
    rhymes: [{ w: ['1:약속', '2:악몽'], len: 2 }], scheme: 'AA' },
  { id: 'vowel-glide', cat: '모음 라임', text: `고개 들어 나를 봐
이제 앞만 보고 가`,
    rhymes: [{ w: ['1:봐', '2:가'] }], scheme: 'AA' },
  { id: 'vowel-glide-multi', cat: '모음 라임', text: `머릿속에 남은 사상
눈앞에서 사라진 환상`,
    rhymes: [{ w: ['1:사상', '2:환상'], len: 2 }], scheme: 'AA' },
  { id: 'vowel-ae-e', cat: '모음 라임', text: `돌아보면 다 내 탓인데
이제 와서 뭘 어쩌겠대`,
    rhymes: [{ w: ['1:데', '2:대'] }], scheme: 'AA' },

  // ───────── 다음절 라임 ─────────
  { id: 'multi-3a', cat: '다음절', text: `쫓기듯 달려 숨이 차도 도망가
불을 끄러 달려가는 소방차`,
    rhymes: [{ w: ['1:도망가', '2:소방차'], len: 3 }], scheme: 'AA' },
  { id: 'multi-3b', cat: '다음절', text: `길을 밝혀 주는 건 낡은 가로등
아직 못다 한 말 꼭 하고픈`,
    rhymes: [{ w: ['1:가로등', '2:하고픈'], len: 3 }], scheme: 'AA' },
  { id: 'multi-5', cat: '다음절', text: `포기는 없어 이 순간에도
버려야 할 건 미숙한 태도`,
    rhymes: [{ w: ['1:순간에도', '2:숙한 태도'], len: 4 }], scheme: 'AA' },
  { id: 'multi-inline', cat: '다음절', text: `어차피 저 자리 내 거라고 믿어`,
    rhymes: [{ w: ['1:어차피', '1:저 자리'], len: 3 }] },
  { id: 'multi-2x3', cat: '다음절', text: `거짓말은 이제 그만
어디 가든 나는 나야
더딘 날도 결국 지나`,
    rhymes: [{ w: ['1:거짓말', '2:어디 가', '3:더딘 날'], len: 3 }] },
  { id: 'multi-test-lyric', cat: '다음절', text: `너의 money 내 머니 다 같은 소리
밤새 달려 갈망한 날 봐 이제 팔자
flow 위로 올라 so 높이 날아
문제없어 끝없어 계속 걸어`,
    rhymes: [{ w: ['1:너의', '1:money', '1:머니'], len: 2 }, { w: ['2:갈망', '2:날 봐', '2:팔자'], len: 2 }, { w: ['3:flow', '3:로', '3:so'] }, { w: ['4:없어#2', '4:걸어'], len: 2 }],
    repeat: ['4:없어#2'], not: [['1:머니', '2:팔자']] },

  // ───────── 내부 라임 ─────────
  { id: 'inner-noun', cat: '내부 라임', text: `바람이 분다 사람이 운다`,
    rhymes: [{ w: ['1:바람', '1:사람'], len: 2 }, { w: ['1:분', '1:운'] }] },
  { id: 'inner-ending', cat: '내부 라임', text: `시간은 가고 나는 남고 기억은 닳고`,
    rhymes: [{ w: ['1:가고', '1:남고', '1:닳고'], len: 2 }] },
  { id: 'inner-mid', cat: '내부 라임', text: `내 손목 위 시계는 돌고
깊은 골목 끝에서 난 놀고`,
    rhymes: [{ w: ['1:손목', '2:골목'], len: 2 }, { w: ['1:돌고', '2:놀고'], len: 2 }] },
  { id: 'inner-chain', cat: '내부 라임', text: `방 안 가득 찬 한숨 난 다시 잔을 들어`,
    rhymes: [{ w: ['1:방', '1:찬', '1:난'] }] },

  // ───────── 한영 교차 라임 ─────────
  { id: 'cross-fly', cat: '한영 교차', text: `오늘 밤도 난 fly
끝이 없는 저 하늘 사이`,
    rhymes: [{ w: ['1:fly', '2:사이'], len: 2 }], scheme: 'AA' },
  { id: 'cross-fire', cat: '한영 교차', text: `매일 밤 불타는 fire
닳아 버린 내 타이어`,
    rhymes: [{ w: ['1:fire', '2:타이어'], len: 3 }], scheme: 'AA' },
  { id: 'cross-power', cat: '한영 교차', text: `I got the 돈 and the power
이제는 전부 다 나눠`,
    rhymes: [{ w: ['1:power', '2:나눠'], len: 2 }], scheme: 'AA' },
  { id: 'cross-energy', cat: '한영 교차', text: `끝없이 넘치는 energy
이 무대는 원래 네 거지`,
    rhymes: [{ w: ['1:energy', '2:네 거지'], len: 3 }], scheme: 'AA' },
  { id: 'cross-check', cat: '한영 교차', text: `밤새워 써 내려간 내 책
무대 위에서 mic check`,
    rhymes: [{ w: ['1:책', '2:check'] }], scheme: 'AA' },
  { id: 'cross-show-go', cat: '한영 교차', text: `막이 오르면 시작되는 show
누가 뭐래도 난 앞으로 go
뒤돌아보지 않아 절대로`,
    rhymes: [{ w: ['1:show', '2:go', '3:로'] }], scheme: 'AAA' },
  { id: 'cross-particle', cat: '한영 교차', text: `내 swag은 달라
네 가슴은 말라`,
    rhymes: [{ w: ['1:달라', '2:말라'], len: 2 }], scheme: 'AA' },
  { id: 'cross-way', cat: '한영 교차', text: `I'm on my way
멈추지 않아 매일`,
    rhymes: [{ w: ['1:way', '2:매일'], len: 2 }], scheme: 'AA' },

  // ───────── 영어끼리 ─────────
  { id: 'en-ind', cat: '영어', text: `Every day I grind
Money on my mind
Never fall behind`,
    rhymes: [{ w: ['1:grind', '2:mind', '3:behind'] }], scheme: 'AAA' },
  { id: 'en-eel', cat: '영어', text: `I keep it real
You know how I feel
Sign another deal`,
    rhymes: [{ w: ['1:real', '2:feel', '3:deal'] }], scheme: 'AAA' },
  { id: 'en-ight', cat: '영어', text: `Shining in the night
Reaching for the light
Never stop the fight`,
    rhymes: [{ w: ['1:night', '2:light', '3:fight'] }], scheme: 'AAA' },
  { id: 'en-ove', cat: '영어', text: `All I need is love
Stars are up above`,
    rhymes: [{ w: ['1:love', '2:above'] }], scheme: 'AA' },
  { id: 'en-oo', cat: '영어', text: `This one is for you
Everything I say is true
Nothing left to do`,
    rhymes: [{ w: ['1:you', '2:true', '3:do'] }], scheme: 'AAA' },
  { id: 'en-eet', cat: '영어', text: `Running through the street
Moving to the beat
Never feel the heat`,
    rhymes: [{ w: ['1:street', '2:beat', '3:heat'] }], scheme: 'AAA' },
  { id: 'en-multi', cat: '영어', text: `Call me a money maker
Certified heart breaker
Born to be a risk taker`,
    rhymes: [{ w: ['1:maker', '2:breaker', '3:taker'], len: 2 }], scheme: 'AAA' },
  { id: 'en-ation', cat: '영어', text: `This is a celebration
For the whole generation
In any situation`,
    rhymes: [{ w: ['1:celebration', '2:generation', '3:situation'], len: 2 }], scheme: 'AAA' },
  { id: 'en-inner', cat: '영어', text: `Stack the cash then dash I never crash`,
    rhymes: [{ w: ['1:cash', '1:dash', '1:crash'] }] },
  { id: 'en-old', cat: '영어', text: `Heart is cold
Chain is gold
Never fold`,
    rhymes: [{ w: ['1:cold', '2:gold', '3:fold'] }], scheme: 'AAA' },
  { id: 'en-er', cat: '영어', text: `We go higher
Hearts on fire
My desire`,
    rhymes: [{ w: ['1:higher', '2:fire', '3:desire'], len: 2 }], scheme: 'AAA' },
  { id: 'en-ame', cat: '영어', text: `I play the game
They know my name
Never the same`,
    rhymes: [{ w: ['1:game', '2:name', '3:same'] }], scheme: 'AAA' },

  // ───────── 발음 규칙이 있어야 잡히는 라임 ─────────
  { id: 'pron-palatal', cat: '발음 규칙', text: `우리 함께 걸어 같이
잊지 마 너의 가치`,
    rhymes: [{ w: ['1:같이', '2:가치'], len: 2 }], scheme: 'AA' },
  { id: 'pron-nasal', cat: '발음 규칙', text: `식어 버린 국물
참아 왔던 눈물`,
    rhymes: [{ w: ['1:국물', '2:눈물'], len: 2 }], scheme: 'AA' },
  { id: 'pron-aspirate', cat: '발음 규칙', text: `마음의 문이 닫혀
넘어져서 또 다쳐`,
    rhymes: [{ w: ['1:닫혀', '2:다쳐'], len: 2 }], scheme: 'AA' },
  { id: 'pron-liaison', cat: '발음 규칙', text: `이 노래가 나는 좋아
잡은 손을 이제 놓아`,
    rhymes: [{ w: ['1:좋아', '2:놓아'], len: 2 }], scheme: 'AA' },
  { id: 'pron-h', cat: '발음 규칙', text: `난 멈추지 않아
저 하늘 위로 날아`,
    rhymes: [{ w: ['1:않아', '2:날아'], len: 2 }], scheme: 'AA' },
  { id: 'pron-ui', cat: '발음 규칙', text: `이건 전부 너의
주머니 속 머니`,
    rhymes: [{ w: ['1:너의', '2:머니#2'], len: 2 }], scheme: 'AA' },

  // ───────── 반복·오탐 (잡으면 안 되는 것) ─────────
  { id: 'neg-prose', cat: '오탐 방지', none: true, text: `오늘 아침에 회사에 가는 길에 비가 많이 내렸다
버스를 기다리면서 우산을 챙기지 않은 것을 후회했다
점심으로는 동료들과 근처 식당에서 김치찌개를 먹었다
오후 회의는 예상보다 길어져서 저녁 늦게 끝났다
집에 돌아와서 강아지와 산책을 하고 일찍 잠자리에 들었다
내일은 주말이라서 친구들을 만나 영화를 보기로 했다` },
  { id: 'neg-news', cat: '오탐 방지', none: true, text: `기상청은 이번 주말 전국에 비가 내릴 것으로 예보했습니다
특히 남부 지방에는 강한 바람이 불 것으로 보입니다
시민들은 외출할 때 우산을 준비해야 합니다
다음 주부터는 기온이 크게 떨어질 전망입니다` },
  { id: 'neg-manual', cat: '오탐 방지', none: true, text: `먼저 전원 버튼을 3초 동안 누릅니다
화면이 켜지면 언어를 선택합니다
와이파이에 연결한 뒤 계정으로 로그인합니다
설정이 끝나면 홈 화면이 나타납니다` },
  { id: 'neg-dialogue', cat: '오탐 방지', none: true, text: `오늘 저녁에 뭐 먹을지 아직 못 정했어
냉장고에 계란이랑 두부가 조금 남았더라
그러면 간단하게 찌개나 끓여 먹자
장 보러 가기에는 시간이 너무 늦었네` },
  { id: 'neg-recipe', cat: '오탐 방지', none: true, text: `냄비에 물을 붓고 센 불에서 끓입니다
물이 끓으면 면과 스프를 넣습니다
삼 분 뒤에 불을 끄고 그릇에 옮겨 담습니다
기호에 따라 파와 달걀을 올려도 좋습니다` },
  { id: 'neg-english', cat: '오탐 방지', none: true, text: `I went to the store to buy some milk
The weather was cold so I wore a jacket
My friend called me about the meeting tomorrow
We decided to have lunch near the office` },
  { id: 'neg-ending', cat: '오탐 방지', text: `어제는 학교에 갔다
집에 와서 밥을 먹는다
밤에는 일기를 썼다`,
    not: [['1:갔다', '2:먹는다'], ['2:먹는다', '3:썼다'], ['1:갔다', '3:썼다']], scheme: 'XXX' },
  { id: 'neg-particle', cat: '오탐 방지', text: `나는 학교를 좋아하고
너는 회사를 싫어하지`,
    not: [['1:학교를', '2:회사를'], ['1:나는', '2:너는']] },
  { id: 'neg-repeat-word', cat: '오탐 방지', text: `yeah 난 달려 yeah
끝까지 달려 yeah`,
    repeat: ['1:yeah#2', '2:yeah', '2:달려'] },
  { id: 'neg-repeat-line', cat: '오탐 방지', text: `돈을 벌어 돈을 벌어
매일 밤 난 돈을 벌어`,
    repeat: ['1:돈을 벌어#2', '2:돈을 벌어'] },
  { id: 'neg-same-word-prefix', cat: '오탐 방지', text: `새벽 세 시 불 꺼진 내 방
펜을 쥔 채 써 내려가 내 사상`,
    rhymes: [{ w: ['1:방', '2:상'] }], not: [['1:내 방', '2:내 사']] },
  { id: 'neg-hook-header', cat: '오탐 방지', text: `[Hook]
끝까지 가 보는 거야
[Verse 2]
아직은 멀었다는 거야`,
    repeat: ['2:거야'] },

  // ───────── 여러 줄 종합 ─────────
  { id: 'mix-verse', cat: '종합', text: `새벽 세 시 반 불 꺼진 내 방
펜을 쥔 채 써 내려가 내 사상
남들은 말해 꿈은 그냥 환상
But I don't care 난 끝까지 가 전장
가진 건 없어도 쌓아 올린 내 가치
money talks 근데 난 말로 증명해 같이
어제의 나와 오늘의 나 사이
그 차이를 만든 건 쉼 없는 grind 매일`,
    rhymes: [{ w: ['1:방', '2:상', '3:상', '4:장'] }, { w: ['5:내 가치', '6:해 같이'], len: 3 }, { w: ['5:가치', '7:사이'] }],
    scheme: 'AAAABBBB' },
  { id: 'mix-hook', cat: '종합', text: `They don't know 내가 걸어온 road
밑바닥부터 올라온 내 soul
모두가 no 라고 할 때 난 go
이제는 내가 만든 나만의 show`,
    rhymes: [{ w: ['1:road', '2:soul', '3:go', '4:show'] }], scheme: 'AAAA' },
  { id: 'mix-kr-en', cat: '종합', text: `통장에 찍힌 숫자는 zero
그래도 난 내 꿈의 hero
바닥에서 위로
누가 뭐라 해도 내 길로`,
    rhymes: [{ w: ['1:zero', '2:hero'], len: 2 }, { w: ['2:hero', '3:위로', '4:길로'] }], scheme: 'AAAA' },
];
