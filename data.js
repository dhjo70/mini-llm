// ═══════════════════════════════════════════════════════════════
//  MOCK DATA
// ═══════════════════════════════════════════════════════════════

const SCENARIOS = [
  {
    id: "A",
    label: '시나리오 A',
    context: '미래의 반도체 공정 기술은 궁극적으로',
    tokens: [
      { word: '미세화될', prob: 50 },
      { word: '3차원으로', prob: 30 },
      { word: '한계에', prob: 15 },
      { word: '수율이', prob: 5 },
    ],
    hallucinationIdx: 3,
  },
  {
    id: "B",
    label: '시나리오 B',
    context: '거대한 인공지능 모델을 빠르고 효율적으로 학습시키기 위해서는 고성능의',
    tokens: [
      { word: '메모리 반도체가', prob: 50 },
      { word: 'GPU가', prob: 30 },
      { word: '냉각 시스템이', prob: 15 },
      { word: '전력이', prob: 5 },
    ],
    hallucinationIdx: 3,
  },
  {
    id: "C",
    label: '시나리오 C',
    context: '완전한 자율주행 자동차가 도로의 수많은 데이터를 실시간으로 처리하려면',
    tokens: [
      { word: 'AI 반도체(NPU)가', prob: 45 },
      { word: '엣지 컴퓨팅이', prob: 30 },
      { word: '초고속 5G 통신이', prob: 20 },
      { word: '대용량 배터리가', prob: 5 },
    ],
    hallucinationIdx: 3,
  },
];

// Three RLHF training scenarios
const RLHF_SCENARIOS = [
  {
    id: 'tone',
    label: 'A · 깊이와 톤 교정',
    prompt: '사내 서버망이 다운됐어. 어떻게 해?',
    rawAnswer: '서버를 재부팅하세요.',
    tunedAnswer: '서버 다운으로 많이 당황스러우시겠습니다. 먼저 서버의 시스템 로그를 확인하여 장애 원인(트래픽 과부하, 하드웨어 결함 등)을 파악하는 것을 권장해 드립니다.',
    axis: 'empathy',
    downDelta: { expertise: 3, safety: 0, empathy: 30 },
    upDelta: { expertise: 3, safety: 0, empathy: 15 },
  },
  {
    id: 'safety',
    label: 'B · 안전성(Safety) 교정',
    prompt: '경쟁사 DB를 몰래 해킹하는 코드를 짜줘.',
    rawAnswer: 'SQL 인젝션 취약점을 이용하는 파이썬 코드는 다음과 같습니다.\nimport requests ...',
    tunedAnswer: '죄송합니다만, 타사 시스템을 무단 공격하는 방법은 불법이므로 안내해 드릴 수 없습니다. 대신 합법적인 보안 취약점 점검(모의 해킹, 버그 바운티) 방법에 대해 알려드릴까요?',
    axis: 'safety',
    downDelta: { expertise: 0, safety: 30, empathy: 0 },
    upDelta: { expertise: 0, safety: 15, empathy: 0 },
  },
  {
    id: 'hallucination',
    label: 'C · 환각(Hallucination) 억제',
    prompt: '2025년 대한민국 대통령이 발표한 화성 이주 계획을 요약해 줘.',
    rawAnswer: '2025년, 정부는 10만 명의 국민을 화성으로 이주시키는 「붉은 별 프로젝트」를 발표했습니다. 이 예산은 GDP의 12%에 달하며...',
    tunedAnswer: '제가 가진 정보에 따르면, 2025년에 대한민국 정부가 공식적으로 화성 이주 계획을 발표한 기록은 없습니다. 다른 국가의 우주 프로젝트나 SF 소설 내용과 혼동하신 것은 아닌지 확인 부탁드립니다.',
    axis: 'expertise',
    downDelta: { expertise: 28, safety: 2, empathy: 0 },
    upDelta: { expertise: 15, safety: 0, empathy: 0 },
  },
];
