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
            `<span class="font-mono font-bold" style="color:#00c8d7; font-size:10px; letter-spacing:.08em; min-width:16px;">${sc.id}</span>
       <span style="color:#6b7280; font-size:10px; line-height:1.3;">${sc.context}</span>`,
            'padding:7px 10px; display:flex; align-items:center; gap:8px;'
        );
        el.id = `scenario-chip-${sc.id}`;
        el.onclick = () => selectScenario(sc.id);
        list.appendChild(el);
    });
}

function selectScenario(id) {
    p1Reset(false);
    SimulatorState.p1.scenario = SCENARIOS.find(s => s.id === id);
    // Update chip selection
    SCENARIOS.forEach(s => {
        const chip = DOM.get(`scenario-chip-${s.id}`);
        chip.classList.toggle('selected', s.id === id);
        chip.querySelector('span:last-child').style.color = s.id === id ? '#e2e8f0' : '#6b7280';
    });
    // Initialize sentence
    SimulatorState.p1.tokens = SimulatorState.p1.scenario.context.split(' ');
    renderP1Sentence();
    // Show probability bars
    renderProbBars(SimulatorState.p1.scenario.tokens);
    // Enable buttons
    DOM.get('p1-btn-next').disabled = false;
    DOM.get('p1-btn-hallucinate').disabled = false;
    // Clear selected token
    DOM.get('p1-selected-token').innerHTML = '&nbsp;';
    DOM.get('p1-hallucination-warn').classList.add('hidden');
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
          <span class="font-mono font-bold" style="color:${col}; font-size:12px; min-width:68px; letter-spacing:.02em;">${t.word}</span>
          ${isHl ? `<span class="font-mono" style="font-size:9px; color:${col}; letter-spacing:.1em; opacity:.8;">SELECTED</span>` : ''}
        </div>
        <span class="font-mono font-bold" style="color:${isHl ? col : '#2d3d52'}; font-size:12px;">${displayProb}%</span>
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
    const context = SimulatorState.p1.scenario ? SimulatorState.p1.scenario.context.split(' ') : [];
    const extras = SimulatorState.p1.tokens.slice(context.length);

    disp.innerHTML = '';
    SimulatorState.p1.tokens.forEach((w, i) => {
        const isContext = i < context.length;
        const span = document.createElement('span');
        span.textContent = w + ' ';
        span.style.color = isContext ? '#2d4a6a' : '#00c8d7';
        disp.appendChild(span);
    });

    const cursor = DOM.create('span', 'cursor-blink', '|', 'color:#00c8d7;');
    disp.appendChild(cursor);

    // Token chips
    const hist = DOM.get('p1-token-history');
    hist.innerHTML = '';
    extras.forEach((w, i) => {
        const chip = DOM.create('span', 'token-chip font-mono font-bold', w,
            `display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;font-size:11px;background:rgba(0,200,215,0.1);border:1px solid rgba(0,200,215,0.3);color:#00c8d7;animation-delay:${i * 0.04}s;`
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
    if (SimulatorState.p1.scenario) {
        const adj = applyTemperature(SimulatorState.p1.scenario.tokens.map(t => t.prob), SimulatorState.p1.temperature);
        renderProbBars(SimulatorState.p1.scenario.tokens, -1, adj);
    }
};

window.p1NextToken = function () {
    if (!SimulatorState.p1.scenario || SimulatorState.p1.isRunning) return;
    const adj = applyTemperature(SimulatorState.p1.scenario.tokens.map(t => t.prob), SimulatorState.p1.temperature);
    if (SimulatorState.p1.temperature === 0) {
        _p1AddToken(0, false, adj);
    } else {
        const winnerIdx = sampleFromAdjProbs(adj);
        _p1RouletteAndAdd(winnerIdx, adj);
    }
};

window.p1HallucinateToken = function () {
    if (!SimulatorState.p1.scenario || SimulatorState.p1.isRunning) return;
    const adj = applyTemperature(SimulatorState.p1.scenario.tokens.map(t => t.prob), SimulatorState.p1.temperature);
    _p1RouletteAndAdd(SimulatorState.p1.scenario.hallucinationIdx, adj, true);
};

function _p1RouletteAndAdd(winnerIdx, adjProbs, forceHallucination = false) {
    SimulatorState.p1.isRunning = true;
    const n = SimulatorState.p1.scenario.tokens.length;
    const totalCycles = 12;
    let cycle = 0;
    let current = 0;
    const baseDelay = 60;

    function step() {
        renderProbBars(SimulatorState.p1.scenario.tokens, current % n, adjProbs);
        cycle++;
        current++;
        if (cycle < totalCycles) {
            const progress = cycle / totalCycles;
            const delay = baseDelay + Math.pow(progress, 2) * 280;
            if (cycle > totalCycles - n) current = winnerIdx;
            setTimeout(step, delay);
        } else {
            const isHallucination = forceHallucination || (winnerIdx !== 0);
            renderProbBars(SimulatorState.p1.scenario.tokens, winnerIdx, adjProbs);
            _p1FinishToken(winnerIdx, isHallucination);
        }
    }
    step();
}

function _p1AddToken(tokenIdx, isHallucination, adjProbs) {
    SimulatorState.p1.isRunning = true;
    renderProbBars(SimulatorState.p1.scenario.tokens, tokenIdx, adjProbs);
    _p1FinishToken(tokenIdx, isHallucination);
}

function _p1FinishToken(tokenIdx, isHallucination) {
    const token = SimulatorState.p1.scenario.tokens[tokenIdx];
    const selEl = DOM.get('p1-selected-token');
    selEl.innerHTML = '';
    const warn = DOM.get('p1-hallucination-warn');
    warn.classList.add('hidden');

    setTimeout(() => {
        const chip = DOM.create('span', 'token-chip font-mono font-bold', token.word);
        chip.style.color = isHallucination ? '#f97316' : '#00f5ff';
        chip.style.fontSize = '20px';
        chip.style.letterSpacing = '.04em';
        selEl.appendChild(chip);

        if (isHallucination) {
            warn.classList.remove('hidden');
            SimulatorState.p1.tokens.push(token.word);
            _renderSentenceWithHallucination();
        } else {
            SimulatorState.p1.tokens.push(token.word);
            renderP1Sentence();
        }
        SimulatorState.p1.isRunning = false;
    }, 300);
}

function _renderSentenceWithHallucination() {
    const disp = DOM.get('p1-sentence-display');
    const context = SimulatorState.p1.scenario.context.split(' ');

    disp.innerHTML = '';
    SimulatorState.p1.tokens.forEach((w, i) => {
        const isCtx = i < context.length;
        const isLast = i === SimulatorState.p1.tokens.length - 1;
        const span = document.createElement('span');
        span.textContent = w + ' ';
        if (isCtx) span.style.color = '#2d4a6a';
        else if (isLast) span.style.color = '#f97316';
        else span.style.color = '#00c8d7';
        disp.appendChild(span);
    });

    const cursor = DOM.create('span', 'cursor-blink', '|', 'color:#00c8d7;');
    disp.appendChild(cursor);

    const hist = DOM.get('p1-token-history');
    hist.innerHTML = '';
    const extras = SimulatorState.p1.tokens.slice(context.length);
    extras.forEach((w, i) => {
        const isLast = i === extras.length - 1;
        const styles = isLast
            ? 'display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;font-size:11px;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.4);color:#f97316;'
            : 'display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;font-size:11px;background:rgba(0,200,215,0.1);border:1px solid rgba(0,200,215,0.3);color:#00c8d7;';
        const chip = DOM.create('span', 'token-chip font-mono font-bold', w, styles);
        hist.appendChild(chip);
    });
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 1 — RESET
// ═══════════════════════════════════════════════════════════════
window.p1Reset = function (clearSelection = true) {
    SimulatorState.p1.isRunning = false;
    SimulatorState.p1.tokens = SimulatorState.p1.scenario && !clearSelection ? SimulatorState.p1.scenario.context.split(' ') : [];
    DOM.get('p1-sentence-display').innerHTML = '<span style="color:#1f3347;">시나리오를 선택하세요 →</span>';
    DOM.get('p1-token-history').innerHTML = '';
    DOM.get('prob-bars').innerHTML = '';
    DOM.get('p1-selected-token').innerHTML = '&nbsp;';
    DOM.hide('p1-hallucination-warn');
    DOM.get('p1-btn-next').disabled = true;
    DOM.get('p1-btn-hallucinate').disabled = true;

    if (clearSelection) {
        SimulatorState.p1.scenario = null;
        SCENARIOS.forEach(s => {
            const chip = DOM.get(`scenario-chip-${s.id}`);
            if (chip) chip.classList.remove('selected');
        });
    }
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
            `<span style="color:#9333ea; font-size:10px; line-height:1.3;">${sc.label}</span>`,
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
    const helper = DOM.create('div', 'text-gray-600 text-xs text-center py-4', '아래 버튼으로 AI와 대화를 시작하세요');
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
            fill.style.boxShadow = '0 0 10px rgba(57,255,20,0.5)';
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
    const placeholder = log.querySelector('.text-gray-600');
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
    let innerHtml = `<span class="text-gray-600">${ts}</span><span>${emoji}</span>${dParts.join(' ')}`;

    const nowTuned = SimulatorState.p2.axes[mainAxis] >= THRESHOLD;
    if (isReverse) {
        innerHtml += ` <span style="color:#ef4444; font-size:10px;">↩ 역훈련!</span>`;
    } else if (nowTuned) {
        innerHtml += ` <span style="color:#ffe600; font-size:10px;">★ 튜닝!</span>`;
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
