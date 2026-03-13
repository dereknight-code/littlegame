let PROPERTIES = [];
let questionLoader = null;
let currentQuestion = null;

const state = {
  index: 0,
  selected: new Set(),
  correct: 0,
  total: 0,
  streak: 0,
  startTime: Date.now(),
  answered: false
};

const els = {
  scoreMeta: document.getElementById("scoreMeta"),
  progressBar: document.getElementById("progressBar"),
  question: document.getElementById("questionText"),
  tags: document.getElementById("questionTags"),
  choices: document.getElementById("choiceList"),
  modal: document.getElementById("modal"),
  modalCard: document.getElementById("modalCard"),
  modalContent: document.getElementById("modalContent"),
  modalClose: document.getElementById("modalClose"),
  btnClear: document.getElementById("btnClear"),
  btnSubmit: document.getElementById("btnSubmit"),
  statCorrect: document.getElementById("statCorrect"),
  statWrong: document.getElementById("statWrong")
};

function propertyById(id) {
  return PROPERTIES.find(p => p.id === id);
}

function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function saveStats() {
  localStorage.setItem("mathGameStats", JSON.stringify({
    correct: state.correct,
    total: state.total,
    streak: state.streak
  }));
}

function updateStatsUI() {
  els.statCorrect.textContent = state.correct;
  els.statWrong.textContent = Math.max(0, state.total - state.correct);
}

function renderQuestion() {
  const q = currentQuestion;
  const progressText = `第 ${state.index + 1} 題 / ${questionLoader.total} 題`;
  els.scoreMeta.textContent = progressText;
  const pct = ((state.index + 1) / questionLoader.total) * 100;
  els.progressBar.style.width = `${pct}%`;
  els.question.innerHTML = q.stem;
  els.tags.innerHTML = "";
  q.tags.forEach(tag => {
    const span = document.createElement("span");
    span.textContent = `#${tag}`;
    els.tags.appendChild(span);
  });

  state.selected.clear();
  state.answered = false;
  hideModal();

  const choiceIds = shuffle(q.choices);
  els.choices.innerHTML = "";
  choiceIds.forEach((id, idx) => {
    const prop = propertyById(id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice";
    btn.dataset.id = id;
    btn.innerHTML = prop ? prop.label : id;
    btn.style.animationDelay = `${idx * 40}ms`;
    btn.classList.add("reveal");
    btn.addEventListener("click", () => toggleChoice(btn));
    els.choices.appendChild(btn);
  });

  if (window.MathJax && window.MathJax.typeset) {
    window.MathJax.typeset();
  }
}

function toggleChoice(btn) {
  if (state.answered) return;
  const id = btn.dataset.id;
  if (state.selected.has(id)) {
    state.selected.delete(id);
    btn.classList.remove("selected");
  } else {
    state.selected.add(id);
    btn.classList.add("selected");
  }
}

function clearSelection() {
  if (state.answered) return;
  state.selected.clear();
  els.choices.querySelectorAll(".choice").forEach(btn => btn.classList.remove("selected"));
}

async function submitAnswer() {
  if (state.answered) {
    await nextQuestion();
    return;
  }
  const q = currentQuestion;
  const selected = Array.from(state.selected).sort();
  const answers = q.answers.slice().sort();
  const correct = selected.length === answers.length && selected.every((v, i) => v === answers[i]);

  state.answered = true;
  state.total += 1;
  if (correct) {
    state.correct += 1;
    state.streak += 1;
  } else {
    state.streak = 0;
  }
  saveStats();
  updateStatsUI();

  const neededLabels = answers.map(id => propertyById(id)?.label || id).join("、");
  const pickedLabels = selected.length
    ? selected.map(id => propertyById(id)?.label || id).join("、")
    : "未選擇";

  const resultClass = correct ? "ok" : "bad";
  showModal(resultClass, `
    <div class="result-title ${resultClass}">
      ${correct ? "Got It!" : "Not Yet"}
    </div>
    <div class="result-badge ${resultClass}">
      <span class="dot"></span>
      ${correct ? "答對" : "答錯"}
    </div>
    你選擇：${pickedLabels}<br />
    正確需要：${neededLabels}<br />
    解析：${q.explain}
  `);

  if (window.MathJax && window.MathJax.typeset) {
    window.MathJax.typeset();
  }

  els.btnSubmit.textContent = state.index === questionLoader.total - 1 ? "完成" : "下一題";
}

async function nextQuestion() {
  if (!state.answered) return;
  if (state.index < questionLoader.total - 1) {
    state.index += 1;
    els.btnSubmit.textContent = "送出作答";
    currentQuestion = await questionLoader.next();
    renderQuestion();
  } else {
    showModal("", `
      <strong>本輪完成</strong><br />
      正確率：${state.correct} / ${state.total}
    `);
    els.btnSubmit.disabled = true;
    els.btnClear.disabled = true;
  }
}

function showModal(styleClass, html) {
  els.modalContent.innerHTML = html;
  els.modalCard.classList.remove("ok", "bad");
  if (styleClass) {
    els.modalCard.classList.add(styleClass);
  }
  els.modal.classList.add("show");
  fitResultTitle();
  if (window.MathJax && window.MathJax.typeset) {
    window.MathJax.typeset();
  }
}

function hideModal() {
  els.modal.classList.remove("show");
}

function fitResultTitle() {
  const title = els.modalContent.querySelector(".result-title");
  if (!title) return;
  const cardWidth = els.modalCard.clientWidth;
  if (!cardWidth) return;
  const targetWidth = cardWidth * 0.7;
  const text = title.textContent.trim();
  if (!text) return;

  const style = window.getComputedStyle(title);
  const fontFamily = style.fontFamily || "sans-serif";
  const fontWeight = style.fontWeight || "700";
  const letterSpacing = parseFloat(style.letterSpacing) || 0;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  let low = 24;
  let high = 64;
  let best = 36;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    ctx.font = `${fontWeight} ${mid}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    const width = metrics.width + Math.max(0, text.length - 1) * letterSpacing;
    if (width <= targetWidth) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  title.style.fontSize = `${best}px`;
}

async function advanceFromModal() {
  hideModal();
  if (state.answered && state.index < questionLoader.total - 1) {
    await nextQuestion();
  }
}

els.btnClear.addEventListener("click", clearSelection);
els.btnSubmit.addEventListener("click", submitAnswer);
els.modalClose.addEventListener("click", advanceFromModal);
els.modal.addEventListener("click", advanceFromModal);
els.modalCard.addEventListener("click", (event) => event.stopPropagation());

async function init() {
  localStorage.removeItem("mathGameStats");
  state.correct = 0;
  state.total = 0;
  state.streak = 0;
  updateStatsUI();
  try {
    const indexData = await loadIndex();
    PROPERTIES = indexData.properties;
    questionLoader = createQuestionLoader(indexData);
    if (!questionLoader.total) {
      throw new Error("題庫為空");
    }
    currentQuestion = await questionLoader.next();
    renderQuestion();
  } catch (err) {
    els.question.textContent = "題庫載入失敗，請檢查 index.json";
    els.choices.innerHTML = "";
    els.btnSubmit.disabled = true;
    els.btnClear.disabled = true;
  }
}

init();
