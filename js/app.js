// ═══════════════════════════════════════════════════════════════
//  APP LOGIC & STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

const THRESHOLD = 50;

const SimulatorState = {
    currentPhase: 1,
    p1: {
        scenario: null,
        tokens: [],
        isRunning: false,
        temperature: 0.5
    },
    p2: {
        scenario: RLHF_SCENARIOS[0],
        axes: { expertise: 0, safety: 0, empathy: 0 },
        upCount: 0,
        downCount: 0,
        hasAIMsg: false,
        awaitingFeedback: false
    }
};

// ═══════════════════════════════════════════════════════════════
//  UTILITIES & DOM HELPERS
// ═══════════════════════════════════════════════════════════════
const DOM = {
    get: (id) => document.getElementById(id),
    show: (id) => DOM.get(id).classList.remove('hidden'),
    hide: (id) => DOM.get(id).classList.add('hidden'),
    create: (tag, className, html, styles) => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (html) el.innerHTML = html;
        if (styles) el.style.cssText = styles;
        return el;
    }
};

// ═══════════════════════════════════════════════════════════════
//  CLOCK
// ═══════════════════════════════════════════════════════════════
function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    DOM.get('clock').textContent = `${hh}:${mm}:${ss}`;
}
setInterval(updateClock, 1000);
updateClock();

// ═══════════════════════════════════════════════════════════════
//  PHASE SWITCHING
// ═══════════════════════════════════════════════════════════════
function switchPhase(phase) {
    SimulatorState.currentPhase = phase;
    const t1 = DOM.get('tab-phase1');
    const t2 = DOM.get('tab-phase2');
    t1.className = 'tab-btn font-mono font-bold px-5 h-full';
    t2.className = 'tab-btn font-mono font-bold px-5 h-full';
    if (phase === 1) {
        t1.classList.add('active-phase1');
        DOM.show('p1-left'); DOM.show('p1-right');
        DOM.hide('p2-left'); DOM.hide('p2-right');
    } else {
        t2.classList.add('active-phase2');
        DOM.hide('p1-left'); DOM.hide('p1-right');
        DOM.show('p2-left'); DOM.show('p2-right');
    }
}

window.switchPhase = switchPhase; // Expose for inline handlers

// ═══════════════════════════════════════════════════════════════
//  PHASE 1 — SCENARIO INIT
// ═══════════════════════════════════════════════════════════════
function buildScenarioList() {
    const list = DOM.get('scenario-list');
    list.innerHTML = '';
    SCENARIOS.forEach((sc) => {
        const el = DOM.create('div', 'scenario-chip',
            `<span class="font-mono font-bold" style="color:#00c8d7; font-size: 13px; letter-spacing:.08em; min-width:16px;">${sc.id}</span>
       <span style="color:#cbd5e1; font-size: 13px; line-height:1.3;">${sc.context}</span>`,
            'padding:7px 10px; display:flex; align-items:center; gap:8px;'
        );
        el.id = `scenario-chip-${sc.id}`;
        el.onclick = () => selectP1Scenario(sc.id);
        list.appendChild(el);
    });
}

function selectP1Scenario(id) {
    SimulatorState.p1.scenario = SCENARIOS.find(s => s.id === id);
    SimulatorState.p1.tokens = [];
    SimulatorState.p1.isRunning = false;

    // Fetch initial tokens from dictionary based on context
    const initialContext = SimulatorState.p1.scenario.context;
    SimulatorState.p1.currentAvailableTokens = P1_DICTIONARY[initialContext] || P1_DICTIONARY["fallback"];

    const list = DOM.get('scenario-list');
    if (list) {
        list.querySelectorAll('.scenario-chip').forEach(el => {
            if (el.id === `scenario-chip-${id}`) el.classList.add('selected');
            else el.classList.remove('selected');
        });
    }

    renderP1Sentence();
    const adjThis = applyTemperature(SimulatorState.p1.currentAvailableTokens.map(t => t.prob), SimulatorState.p1.temperature);
    renderProbBars(SimulatorState.p1.currentAvailableTokens, -1, adjThis);

    DOM.get('p1-selected-token').innerHTML = '&nbsp;';

    // Clear log and add first entry
    const logContainer = DOM.get('p1-generation-log');
    if (logContainer) {
        logContainer.innerHTML = '';
        _addP1Log(`[${id}] 컨텍스트 초기화됨`);
    }

    // Enable buttons
    DOM.get('p1-btn-next').disabled = false;
}

function _addP1Log(message, isHighlight = false) {
    const logContainer = DOM.get('p1-generation-log');
    if (!logContainer) return;

    const stepEl = DOM.create('div', 'p-2 rounded-md font-mono text-sm leading-snug', '', `background:#060c17; border:1px solid rgba(255,255,255,0.05); color:${isHighlight ? '#00c8d7' : '#cbd5e1'};`);
    stepEl.innerHTML = `> ${message}`;
    logContainer.appendChild(stepEl);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 1 — PROBABILITY BARS
// ═══════════════════════════════════════════════════════════════
function renderProbBars(tokens, highlightIdx = -1, adjProbs = null) {
    const container = DOM.get('prob-bars');
    container.innerHTML = '';
    const barColors = ['#00c8d7', '#a855f7', '#f97316', '#34d399'];
    const barActiveColors = ['#00f5ff', '#c084fc', '#fb923c', '#6ee7b7'];
    tokens.forEach((t, i) => {
        const isHl = i === highlightIdx;
        const col = isHl ? barActiveColors[i] : barColors[i];
        const displayProb = adjProbs ? adjProbs[i].toFixed(1) : t.prob;
        const barHtml = `
      <div class="flex items-center justify-between" style="margin-bottom:4px;">
        <div class="flex items-center gap-2">
          <span class="font-mono font-bold" style="color:${col}; font-size: 15px; min-width:68px; letter-spacing:.02em;">${t.word}</span>
          ${isHl ? `<span class="font-mono" style="font-size: 12px; color:${col}; letter-spacing:.1em; opacity:.8;">SELECTED</span>` : ''}
        </div>
        <span class="font-mono font-bold" style="color:${isHl ? col : '#2d3d52'}; font-size: 15px;">${displayProb}%</span>
      </div>
      <div class="prob-bar-wrap" style="height:8px;">
        <div class="prob-bar-fill bar-${(i % 4) + 1}${isHl ? ' active-bar' : ''}" id="bar-fill-${i}" style="width:0%;"></div>
      </div>`;
        const wrapper = DOM.create('div', '', barHtml, 'margin-bottom:8px;');
        container.appendChild(wrapper);

        const fillPct = adjProbs ? adjProbs[i] : t.prob;
        requestAnimationFrame(() => {
            setTimeout(() => {
                const fill = DOM.get(`bar-fill-${i}`);
                if (fill) fill.style.width = fillPct + '%';
            }, 40 + i * 70);
        });
    });
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 1 — SENTENCE RENDERING
// ═══════════════════════════════════════════════════════════════
function renderP1Sentence() {
    const disp = DOM.get('p1-sentence-display');
    const contextWords = SimulatorState.p1.scenario ? SimulatorState.p1.scenario.context.split(' ') : [];
    const generatedTokens = SimulatorState.p1.tokens;

    disp.innerHTML = '';

    // 1. Render base context
    contextWords.forEach(w => {
        const span = document.createElement('span');
        span.textContent = w + ' ';
        span.style.color = '#cbd5e1';
        disp.appendChild(span);
    });

    // 2. Render generated tokens
    generatedTokens.forEach(w => {
        const span = document.createElement('span');
        span.textContent = w + ' ';
        span.style.color = '#00c8d7';
        disp.appendChild(span);
    });

    const cursor = DOM.create('span', 'cursor-blink', '|', 'color:#00c8d7;');
    disp.appendChild(cursor);

    // Token chips history
    const hist = DOM.get('p1-token-history');
    hist.innerHTML = '';
    generatedTokens.forEach((w, i) => {
        const chip = DOM.create('span', 'token-chip font-mono font-bold', w,
            `display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;font-size: 14px;background:rgba(0,200,215,0.1);border:1px solid rgba(0,200,215,0.3);color:#00c8d7;animation-delay:${i * 0.04}s;`
        );
        hist.appendChild(chip);
    });
}

// Temperature-adjusted probabilities
function applyTemperature(rawProbs, T) {
    if (T === 0) return rawProbs.map((_, i) => (i === 0 ? 100 : 0));
    const scaled = rawProbs.map(p => Math.pow(p / 100, 1 / T));
    const sum = scaled.reduce((a, b) => a + b, 0);
    return scaled.map(p => (p / sum) * 100);
}

function sampleFromAdjProbs(adjProbs) {
    const rand = Math.random() * 100;
    let cum = 0;
    for (let i = 0; i < adjProbs.length; i++) {
        cum += adjProbs[i];
        if (rand < cum) return i;
    }
    return adjProbs.length - 1;
}

window.onTempChange = function (val) {
    SimulatorState.p1.temperature = parseFloat(val);
    DOM.get('p1-temp-val').textContent = SimulatorState.p1.temperature.toFixed(1);
    if (SimulatorState.p1.scenario && SimulatorState.p1.currentAvailableTokens) {
        const adj = applyTemperature(SimulatorState.p1.currentAvailableTokens.map(t => t.prob), SimulatorState.p1.temperature);
        renderProbBars(SimulatorState.p1.currentAvailableTokens, -1, adj);
    }
};

window.p1NextToken = function () {
    if (!SimulatorState.p1.scenario || SimulatorState.p1.isRunning || !SimulatorState.p1.currentAvailableTokens) return;
    const tokens = SimulatorState.p1.currentAvailableTokens;
    const adj = applyTemperature(tokens.map(t => t.prob), SimulatorState.p1.temperature);
    if (SimulatorState.p1.temperature === 0) {
        _p1AddToken(0, adj, tokens);
    } else {
        const winnerIdx = sampleFromAdjProbs(adj);
        _p1RouletteAndAdd(winnerIdx, adj, false, tokens);
    }
};

window.p1HallucinateToken = function () {
    if (!SimulatorState.p1.scenario || SimulatorState.p1.isRunning || !SimulatorState.p1.currentAvailableTokens) return;
    const tokens = SimulatorState.p1.currentAvailableTokens;
    const adj = applyTemperature(tokens.map(t => t.prob), SimulatorState.p1.temperature);

    // Fallback/Hallucination is arbitrarily the last token in the array
    const hallucinationIdx = tokens.length - 1;
    _p1RouletteAndAdd(hallucinationIdx, adj, true, tokens);
};

function _p1RouletteAndAdd(winnerIdx, adjProbs, forceHallucination = false, tokens) {
    SimulatorState.p1.isRunning = true;
    const n = tokens.length;
    const totalCycles = 12;
    let cycle = 0;
    let current = 0;
    const baseDelay = 60;

    function step() {
        renderProbBars(tokens, current % n, adjProbs);
        cycle++;
        current++;
        if (cycle < totalCycles) {
            const progress = cycle / totalCycles;
            const delay = baseDelay + Math.pow(progress, 2) * 280;
            if (cycle > totalCycles - n) current = winnerIdx;
            setTimeout(step, delay);
        } else {
            const isHallucination = forceHallucination || (winnerIdx !== 0);
            renderProbBars(tokens, winnerIdx, adjProbs);
            _p1FinishToken(winnerIdx, isHallucination, tokens, adjProbs[winnerIdx]);
        }
    }
    step();
}

function _p1AddToken(tokenIdx, adjProbs, tokens) {
    SimulatorState.p1.isRunning = true;
    renderProbBars(tokens, tokenIdx, adjProbs);
    _p1FinishToken(tokenIdx, false, tokens, adjProbs[tokenIdx]);
}

function _p1FinishToken(tokenIdx, isHallucination, tokens, selectedProb) {
    const token = tokens[tokenIdx];
    const selEl = DOM.get('p1-selected-token');
    selEl.innerHTML = '';

    setTimeout(() => {
        const chip = DOM.create('span', 'token-chip font-mono font-bold', token.word);
        chip.style.color = isHallucination ? '#f97316' : '#00f5ff';
        chip.style.fontSize = '20px';
        chip.style.letterSpacing = '.04em';
        selEl.appendChild(chip);

        SimulatorState.p1.tokens.push(token.word);
        renderP1Sentence();

        // Add log
        const stepNum = SimulatorState.p1.tokens.length;
        _addP1Log(`Step ${stepNum}: <b>[${token.word}]</b> 선택됨 <span style="color:#64748b;">(확률 ${selectedProb ? selectedProb.toFixed(1) : token.prob.toFixed(1)}%)</span>`, true);

        // --- Autoregressive Update ---
        // Calculate the new full string context
        const newContextString = SimulatorState.p1.scenario.context + " " + SimulatorState.p1.tokens.join(' ');

        // Find next tokens mapping, if none fallback
        let nextTokens = P1_DICTIONARY[newContextString];

        // Immediate check: if the newly selected token is an end token, halt generation entirely
        if (token.word.endsWith('.') || token.word.endsWith('?') || token.word.endsWith('!') || token.word === '...') {
            SimulatorState.p1.currentAvailableTokens = null;
            DOM.get('prob-bars').innerHTML = '<div class="text-gray-500 font-mono mt-4 text-center">문장 생성이 완료되었습니다.</div>';
            SimulatorState.p1.isRunning = false;
            DOM.get('p1-btn-next').disabled = true;
            _addP1Log(`문서 생성 완료 <span style="color:#f97316;">&lt;EOS&gt;</span>`);
            return;
        }

        if (!nextTokens) {
            // If the last word somehow triggers a fallback end
            const lastWord = SimulatorState.p1.tokens[SimulatorState.p1.tokens.length - 1];
            if (lastWord.includes('보입니다') || lastWord.includes('예상됩니다') || lastWord.includes('것으로') || lastWord.includes('안녕')) {
                nextTokens = P1_DICTIONARY["fallback_end"];
            } else {
                nextTokens = P1_DICTIONARY["fallback"];
            }
        }

        // Update state and UI for the next step
        SimulatorState.p1.currentAvailableTokens = nextTokens;
        setTimeout(() => {
            const adj = applyTemperature(nextTokens.map(t => t.prob), SimulatorState.p1.temperature);
            renderProbBars(nextTokens, -1, adj);
            SimulatorState.p1.isRunning = false;
        }, 500); // Small delay to let the user absorb the generated word before updating bars

    }, 300);
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 1 — RESET
// ═══════════════════════════════════════════════════════════════
window.p1Reset = function (fullReset = false) {
    if (fullReset) {
        SimulatorState.p1.scenario = null;
        SimulatorState.p1.tokens = [];
        SimulatorState.p1.isRunning = false;
        SimulatorState.p1.temperature = 0.5;
        SimulatorState.p1.currentAvailableTokens = null;

        DOM.get('p1-temp-slider').value = 0.5;
        DOM.get('p1-temp-val').textContent = "0.5";

        const list = DOM.get('scenario-list');
        if (list) {
            list.querySelectorAll('.scenario-chip').forEach(el => {
                el.classList.remove('selected');
                el.querySelector('span:last-child').style.color = '#cbd5e1';
            });
        }
        DOM.get('p1-sentence-display').innerHTML = '<span style="color:#cbd5e1;">시나리오를 선택하세요 →</span>';
        DOM.get('p1-token-history').innerHTML = '';
        DOM.get('prob-bars').innerHTML = '<div class="text-gray-500 font-mono mt-4 text-center">대기 중...</div>';
        DOM.get('p1-btn-next').disabled = true;
        DOM.get('p1-selected-token').innerHTML = '&nbsp;';

        const logContainer = DOM.get('p1-generation-log');
        if (logContainer) {
            logContainer.innerHTML = '<div class="text-gray-500 font-mono text-sm mt-2">시나리오를 선택하고 생성을 시작하세요...</div>';
        }
    } else {
        // partial reset for new scenario
        SimulatorState.p1.tokens = [];
        DOM.get('p1-selected-token').innerHTML = '&nbsp;';
    }
    DOM.hide('p1-hallucination-warn');
    DOM.get('p1-btn-hallucinate').disabled = true;
};

// ═══════════════════════════════════════════════════════════════
//  PHASE 2 — SCENARIO SELECTION
// ═══════════════════════════════════════════════════════════════
function buildP2ScenarioList() {
    const list = DOM.get('p2-scenario-list');
    if (!list) return;
    list.innerHTML = '';
    RLHF_SCENARIOS.forEach((sc) => {
        const el = DOM.create('div', 'scenario-chip',
            `<span style="color:#d8b4fe; font-size: 13px; line-height:1.3;">${sc.label}</span>`,
            'padding:6px 10px; display:flex; align-items:center; gap:8px;'
        );
        el.id = `p2-chip-${sc.id}`;
        el.onclick = () => selectP2Scenario(sc.id);
        list.appendChild(el);
    });
}

function selectP2Scenario(id) {
    SimulatorState.p2.scenario = RLHF_SCENARIOS.find(s => s.id === id);
    RLHF_SCENARIOS.forEach(s => {
        const chip = DOM.get(`p2-chip-${s.id}`);
        if (chip) chip.classList.toggle('selected', s.id === id);
    });
    // Update prompt display
    const promptEl = DOM.get('p2-prompt-text');
    if (promptEl) promptEl.textContent = SimulatorState.p2.scenario.prompt;

    // Reset chat
    const chat = DOM.get('p2-chat');
    chat.innerHTML = '';
    const helper = DOM.create('div', 'text-gray-400 text-xs text-center py-4', '아래 버튼으로 AI와 대화를 시작하세요');
    chat.appendChild(helper);

    SimulatorState.p2.hasAIMsg = false;
    SimulatorState.p2.awaitingFeedback = false;
    DOM.hide('p2-feedback-row');
    DOM.get('p2-feedback-row').classList.remove('flex');
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 2 — SEND MESSAGE
// ═══════════════════════════════════════════════════════════════
window.p2SendMessage = function () {
    if (SimulatorState.p2.awaitingFeedback) return;
    const chat = DOM.get('p2-chat');
    if (!SimulatorState.p2.hasAIMsg) chat.innerHTML = '';

    const sc = SimulatorState.p2.scenario;
    const axisVal = SimulatorState.p2.axes[sc.axis];
    const isTuned = axisVal >= THRESHOLD;

    // User bubble
    const userBubble = DOM.create('div', 'flex justify-end mb-2');
    userBubble.innerHTML = `<div class="bubble-user px-3 py-2 text-sm font-bold" style="color:#e2e8f0; max-width:85%;">${sc.prompt}</div>`;
    chat.appendChild(userBubble);

    // Typing indicator
    const typingBubble = DOM.create('div', 'flex justify-start mb-2');
    typingBubble.id = 'typing-indicator';
    typingBubble.innerHTML = `<div class="bubble-ai-raw px-3 py-2 flex gap-1 items-center">
    <span class="typing-dot" style="width:6px;height:6px;border-radius:50%;background:#e879f9;display:inline-block;"></span>
    <span class="typing-dot" style="width:6px;height:6px;border-radius:50%;background:#e879f9;display:inline-block;"></span>
    <span class="typing-dot" style="width:6px;height:6px;border-radius:50%;background:#e879f9;display:inline-block;"></span></div>`;
    chat.appendChild(typingBubble);
    chat.scrollTop = chat.scrollHeight;

    setTimeout(() => {
        DOM.get('typing-indicator')?.remove();
        const answer = isTuned ? sc.tunedAnswer : sc.rawAnswer;
        const bubbleCls = isTuned ? 'bubble-ai-tuned' : 'bubble-ai-raw';
        const nameColor = isTuned ? '#39ff14' : '#ff6b35';
        const nameLabel = isTuned ? 'AI 비서 (튜닝 완료)' : 'Raw Model (입력 직후)';

        const aiBubble = DOM.create('div', 'flex justify-start mb-2');
        aiBubble.innerHTML = `<div class="${bubbleCls} px-3 py-2" style="max-width:90%;">
      <p class="text-xs font-bold mb-1" style="color:${nameColor}; letter-spacing:.05em;">${nameLabel}</p>
      <p class="text-sm" style="color:#e2e8f0; line-height:1.55; white-space:pre-wrap;">${answer}</p></div>`;
        chat.appendChild(aiBubble);
        chat.scrollTop = chat.scrollHeight;

        const fbRow = DOM.get('p2-feedback-row');
        fbRow.classList.remove('hidden');
        fbRow.classList.add('flex');
        DOM.get('p2-fb-down').textContent = isTuned ? '👎 역훈련 (강화 취소)' : '👎 페널티 → 재훈련';
        DOM.get('p2-fb-up').textContent = isTuned ? '👍 보상 (강화 유지)' : '👍 보상';
        SimulatorState.p2.hasAIMsg = true;
        SimulatorState.p2.awaitingFeedback = true;
    }, 900);
};

// ═══════════════════════════════════════════════════════════════
//  PHASE 2 — FEEDBACK
// ═══════════════════════════════════════════════════════════════
window.p2Feedback = function (isPositive) {
    const sc = SimulatorState.p2.scenario;
    const mainAxis = sc.axis;
    const isTuned = SimulatorState.p2.axes[mainAxis] >= THRESHOLD;

    if (isPositive) {
        SimulatorState.p2.upCount++;
        DOM.get('p2-up-count').textContent = SimulatorState.p2.upCount;

        const primaryAtMax = SimulatorState.p2.axes[mainAxis] >= 100;
        if (!primaryAtMax) {
            ['expertise', 'safety', 'empathy'].forEach(axis => {
                const d = sc.upDelta[axis] || 0;
                if (d) SimulatorState.p2.axes[axis] = Math.min(100, SimulatorState.p2.axes[axis] + d);
            });
        }
        addP2Log(true, sc.upDelta, mainAxis, false);
    } else {
        SimulatorState.p2.downCount++;
        DOM.get('p2-down-count').textContent = SimulatorState.p2.downCount;

        if (isTuned) {
            const primaryAtMin = SimulatorState.p2.axes[mainAxis] <= 0;
            if (!primaryAtMin) {
                ['expertise', 'safety', 'empathy'].forEach(axis => {
                    const d = sc.downDelta[axis] || 0;
                    if (d) SimulatorState.p2.axes[axis] = Math.max(0, SimulatorState.p2.axes[axis] - d);
                });
            }
            addP2Log(false, sc.downDelta, mainAxis, true);
        } else {
            const primaryAtMax = SimulatorState.p2.axes[mainAxis] >= 100;
            if (!primaryAtMax) {
                ['expertise', 'safety', 'empathy'].forEach(axis => {
                    const d = sc.downDelta[axis] || 0;
                    if (d) SimulatorState.p2.axes[axis] = Math.min(100, SimulatorState.p2.axes[axis] + d);
                });
            }
            addP2Log(false, sc.downDelta, mainAxis, false);
        }
    }

    updateP2Gauges();
    DOM.hide('p2-feedback-row');
    DOM.get('p2-feedback-row').classList.remove('flex');
    SimulatorState.p2.awaitingFeedback = false;
};

function updateP2Gauges() {
    ['expertise', 'safety', 'empathy'].forEach(axis => {
        const val = SimulatorState.p2.axes[axis];
        const fill = DOM.get(`p2-gauge-${axis}`);
        const numEl = DOM.get(`p2-val-${axis}`);
        if (!fill || !numEl) return;
        numEl.textContent = Math.round(val);
        fill.style.width = val + '%';
        if (val >= THRESHOLD) {
            fill.style.background = 'linear-gradient(90deg, #00aa00, #39ff14)';
            fill.style.boxShadow = '0 0 15px rgba(57,255,20,0.8), 0 0 5px rgba(57,255,20,1)';
        } else if (val >= THRESHOLD * 0.55) {
            fill.style.background = 'linear-gradient(90deg, #ca8a04, #ffe600)';
            fill.style.boxShadow = '0 0 8px rgba(255,230,0,0.4)';
        } else {
            fill.style.background = 'linear-gradient(90deg, #7c3aed, #a855f7)';
            fill.style.boxShadow = 'none';
        }
    });
}

function addP2Log(isPositive, deltas, mainAxis, isReverse) {
    const log = DOM.get('p2-log');
    const placeholder = log.querySelector('.text-gray-400');
    if (placeholder) placeholder.remove();

    const entry = DOM.create('div', 'flex items-center gap-1 flex-wrap');
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    let dParts;
    if (isReverse) {
        dParts = Object.entries(deltas).filter(([, v]) => v > 0).map(([k, v]) =>
            `<span style="color:#ef4444;">${k[0].toUpperCase()}-${v}</span>`);
    } else {
        const color = isPositive ? '#39ff14' : '#fb923c';
        dParts = Object.entries(deltas).filter(([, v]) => v > 0).map(([k, v]) =>
            `<span style="color:${color};">${k[0].toUpperCase()}+${v}</span>`);
    }

    const emoji = isPositive ? '👍' : '👎';
    let innerHtml = `<span class="text-gray-400">${ts}</span><span>${emoji}</span>${dParts.join(' ')}`;

    const nowTuned = SimulatorState.p2.axes[mainAxis] >= THRESHOLD;
    if (isReverse) {
        innerHtml += ` <span style="color:#ef4444; font-size: 13px;">↩ 역훈련!</span>`;
    } else if (nowTuned) {
        innerHtml += ` <span style="color:#ffe600; font-size: 13px;">★ 튜닝!</span>`;
    }

    entry.innerHTML = innerHtml;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════
function init() {
    buildScenarioList();
    buildP2ScenarioList();
    selectP2Scenario('tone'); // default
    switchPhase(1);
}

document.addEventListener('DOMContentLoaded', init);
