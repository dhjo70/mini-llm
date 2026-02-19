# Mini-LLM 시뮬레이터

LLM(대규모 언어 모델)의 핵심 개념을 시각적으로 체험하는 **인터랙티브 교육용 웹 시뮬레이터**입니다.

## 실행 방법

별도 설치 없이 `index.html`을 브라우저에서 열면 바로 실행됩니다.

## 구성

### Phase 1 — 다음 토큰 예측 (Next Token Prediction)

LLM이 텍스트를 한 토큰씩 생성하는 원리를 체험합니다.

- **시나리오 3종**: 반도체 공정, AI 모델 학습, 자율주행
- **Temperature 슬라이더**: 낮을수록 결정적, 높을수록 창의적(무작위)
- **룰렛 애니메이션**: 확률 기반 토큰 선택 과정 시각화
- **할루시네이션 버튼**: 낮은 확률 토큰을 의도적으로 선택해 오류 발생 시연

### Phase 2 — RLHF 파인튜닝 (Reinforcement Learning from Human Feedback)

인간 피드백으로 모델이 개선되는 과정을 시연합니다.

- **시나리오 3종**: 공감도(Empathy), 안전성(Safety), 전문성(Expertise) 교정
- **3축 게이지**: 각 축이 50점을 넘으면 모델 응답이 튜닝된 버전으로 전환
- **업보트 / 다운보트**: 긍정 피드백은 강화, 부정 피드백은 역방향 학습

## 기술 스택

- HTML5 + Vanilla JavaScript (ES6+)
- [Tailwind CSS](https://tailwindcss.com/) v4 (CDN)
- [Google Fonts](https://fonts.google.com/) — Noto Sans KR, Rajdhani, JetBrains Mono
