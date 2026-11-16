// 검증용 세트 (held-out) — 엔진을 고친 뒤에, 결과를 보지 않고 새로 쓴 케이스.
// cases.mjs 는 실패를 보면서 엔진을 고친 '개발용'이라 수치가 후하다. 이 파일은 그 수정이
// 처음 보는 가사에도 통하는지 확인하는 용도다. 형식은 cases.mjs 와 같다.
export const HELDOUT = [
  { id: 'h-end-aabb', cat: '끝라임', text: `새벽 두 시 텅 빈 서울
창에 비친 낯선 거울
혼자 듣는 옛날 노래
발끝에 닿는 하얀 모래`,
    rhymes: [{ w: ['1:서울', '2:거울'], len: 2 }, { w: ['3:노래', '4:모래'], len: 2 }], not: [['1:서울', '3:노래']], scheme: 'AABB' },
  { id: 'h-end-abab', cat: '끝라임', text: `지친 하루 끝에 남은 마음
주머니 속 구겨진 약도
잠들면 찾아올 그 다음
아무도 모르는 내 각도`,
    rhymes: [{ w: ['1:마음', '3:다음'], len: 2 }, { w: ['2:약도', '4:각도'], len: 2 }], scheme: 'ABAB' },
  { id: 'h-vowel-3', cat: '모음 라임', text: `불 꺼진 새벽의 사무소
곁에는 이제 아무도`,
    rhymes: [{ w: ['1:사무소', '2:아무도'], len: 3 }], scheme: 'AA' },
  { id: 'h-multi-3', cat: '다음절', text: `불이 꺼지지 않는 편의점
난 아직도 꿈꾸네 여기서`,
    rhymes: [{ w: ['1:편의점', '2:여기서'], len: 3 }], scheme: 'AA' },
  { id: 'h-inner-stem', cat: '내부 라임', text: `도시의 소음 속에 모시는 내 꿈`,
    rhymes: [{ w: ['1:도시', '1:모시'], len: 2 }] },
  { id: 'h-inner-parallel', cat: '내부 라임', text: `난 밤마다 같은 꿈을 꾸고 눈을 뜨고 숨을 쉬고`,
    rhymes: [{ w: ['1:꿈', '1:눈', '1:숨'] }] },
  { id: 'h-inner-two-lines', cat: '내부 라임', text: `내 사랑을 전부 줬는데
넌 자랑이라며 웃었지`,
    rhymes: [{ w: ['1:사랑', '2:자랑'], len: 2 }] },
  { id: 'h-cross-sky', cat: '한영 교차', text: `고개를 들어 저 높은 sky
너와 나 그 좁은 사이`,
    rhymes: [{ w: ['1:sky', '2:사이'], len: 2 }], scheme: 'AA' },
  { id: 'h-cross-dream', cat: '한영 교차', text: `눈을 감고 그려 보는 dream
벽에 걸어 둔 낡은 그림`,
    rhymes: [{ w: ['1:dream', '2:그림'] }], scheme: 'AA' },
  { id: 'h-cross-story', cat: '한영 교차', text: `끝나지 않은 나의 story
귓가에 맴도는 네 목소리`,
    rhymes: [{ w: ['1:story', '2:소리'], len: 2 }], scheme: 'AA' },
  { id: 'h-cross-money', cat: '한영 교차', text: `돈이 다가 아니래도 결국 money
그 말을 해 준 건 우리 어머니`,
    rhymes: [{ w: ['1:money', '2:머니'], len: 2 }], scheme: 'AA' },
  { id: 'h-en-ay', cat: '영어', text: `Another day
Find my way
Got a lot to say`,
    rhymes: [{ w: ['1:day', '2:way', '3:say'] }], scheme: 'AAA' },
  { id: 'h-en-own', cat: '영어', text: `Sun goes down
Lights in the town
I take the crown`,
    rhymes: [{ w: ['1:down', '2:town', '3:crown'] }], scheme: 'AAA' },
  { id: 'h-en-art', cat: '영어', text: `Straight from the heart
Right from the start
We fall apart`,
    rhymes: [{ w: ['1:heart', '2:start', '3:apart'] }], scheme: 'AAA' },
  { id: 'h-en-un', cat: '영어', text: `I'm on the run
Chasing the sun
Now it's done`,
    rhymes: [{ w: ['1:run', '2:sun', '3:done'] }], scheme: 'AAA' },
  { id: 'h-en-inner', cat: '영어', text: `I rise and shine it's time to grind`,
    rhymes: [{ w: ['1:shine', '1:time', '1:grind'] }] },
  { id: 'h-pron-liaison', cat: '발음 규칙', text: `네 말이 전부 맞아
이제 우리 그만하자`,
    rhymes: [{ w: ['1:맞아', '2:하자'], len: 2 }], scheme: 'AA' },
  { id: 'h-pron-nasal', cat: '발음 규칙', text: `집에선 귀여운 막내
이러다 정말 다 망해`,
    rhymes: [{ w: ['1:막내', '2:망해'], len: 2 }], scheme: 'AA' },
  { id: 'h-pron-glide', cat: '발음 규칙', text: `가로수 그늘 아래 하루를 또 보내
바람은 차갑고 마음은 더 고돼`,
    rhymes: [{ w: ['1:보내', '2:고돼'], len: 2 }], scheme: 'AA' },
  { id: 'h-neg-repeat', cat: '오탐 방지', text: `난 다시 일어나
넘어져도 일어나`,
    repeat: ['2:일어나'] },
  { id: 'h-neg-endings', cat: '오탐 방지', text: `어제 산 책을 가방에 넣었고
오늘은 그 책을 친구에게 빌려줬다
내일은 도서관에 반납하러 간다`,
    not: [['1:넣었고', '2:줬다'], ['2:줬다', '3:간다']], scheme: 'XXX' },
  { id: 'h-neg-prose1', cat: '오탐 방지', none: true, text: `지난주에 새로 산 노트북이 생각보다 무거웠다
그래서 가방을 조금 더 큰 것으로 바꾸기로 했다
인터넷으로 주문하면 이틀 뒤에 도착한다고 한다
이번에는 어깨가 덜 아팠으면 좋겠다` },
  { id: 'h-neg-prose2', cat: '오탐 방지', none: true, text: `회의는 오전 열 시에 삼 층 회의실에서 열립니다
참석자는 자료를 미리 읽고 와 주시기 바랍니다
점심 식사는 회사에서 제공할 예정입니다
궁금한 점은 담당자에게 문의해 주세요` },
  { id: 'h-mix-ai', cat: '종합', text: `무대 위에 올라 켜지는 light
숨을 고르고 꽉 쥐는 mic
떨리던 어젯밤은 이제 bye
지금 이 순간 나는 so high`,
    rhymes: [{ w: ['1:light', '2:mic', '3:bye', '4:high'], len: 2 }], scheme: 'AAAA' },
];
