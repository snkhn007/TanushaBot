// app.js — BrainForge Frontend Logic
// ============================================================

const API_BASE_URL = "http://localhost:5000";

// ============================================================
// SESSION
// ============================================================
function getOrCreateSessionId() {
  let sessionId = localStorage.getItem("brainforge_session");
  if (!sessionId) {
    sessionId = "bf_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
    localStorage.setItem("brainforge_session", sessionId);
  }
  return sessionId;
}

let SESSION_ID = getOrCreateSessionId();
let isWaiting = false;

// ============================================================
// DOM REFERENCES
// ============================================================
const messagesArea  = document.getElementById("messages-area");
const userInput     = document.getElementById("user-input");
const sendBtn       = document.getElementById("send-btn");
const charCount     = document.getElementById("char-count");
const welcomeScreen = document.getElementById("welcome-screen");

// ============================================================
// TAB SWITCHING
// ============================================================
function switchTab(tab, btn) {
  // Update nav buttons
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  // Update views
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + tab).classList.add("active");

  // Update top bar label
  const labels = { chat: ["Chat", "Academic Assistant"], quiz: ["Quiz Arena", "Test Your Knowledge"] };
  document.querySelector(".tb-label").textContent = labels[tab][0];
  document.querySelector(".tb-sub").textContent = labels[tab][1];
}

// ============================================================
// TOAST
// ============================================================
function showToast(message, bg = "#1a1510") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.style.background = bg;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ============================================================
// SCROLL
// ============================================================
function scrollToBottom() {
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

// ============================================================
// FORMAT MESSAGE
// ============================================================
function formatMessage(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/```(\w*)\n?([\s\S]*?)```/g, "<pre><code>$2</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)/gm, "• $1")
    .replace(/\n/g, "<br>");
}

// ============================================================
// WELCOME SCREEN
// ============================================================
function hideWelcome() {
  if (welcomeScreen && welcomeScreen.parentNode) {
    welcomeScreen.style.animation = "fadeUp 0.3s ease reverse forwards";
    setTimeout(() => welcomeScreen.remove(), 300);
  }
}

// ============================================================
// APPEND MESSAGE
// ============================================================
function appendMessage(role, text) {
  const row = document.createElement("div");
  row.className = `message-row ${role === "user" ? "user" : ""}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ${role === "user" ? "user-av" : "bot"}`;
  avatar.textContent = role === "user" ? "YOU" : "BF";

  const bubble = document.createElement("div");
  bubble.className = `bubble ${role === "user" ? "user-bubble" : "bot-bubble"}`;
  bubble.innerHTML = formatMessage(text);

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesArea.appendChild(row);
  scrollToBottom();
  return bubble;
}

// ============================================================
// TYPING INDICATOR
// ============================================================
function showTypingIndicator() {
  const row = document.createElement("div");
  row.className = "message-row";
  row.id = "typing-row";

  const avatar = document.createElement("div");
  avatar.className = "avatar bot";
  avatar.textContent = "BF";

  const bubble = document.createElement("div");
  bubble.className = "bubble bot-bubble";
  bubble.innerHTML = `
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;

  row.appendChild(avatar);
  row.appendChild(bubble);
  messagesArea.appendChild(row);
  scrollToBottom();
}

function removeTypingIndicator() {
  const el = document.getElementById("typing-row");
  if (el) el.remove();
}

// ============================================================
// TYPEWRITER EFFECT
// ============================================================
function typeText(bubble, text, speed = 8) {
  const chars = text.split("");
  let i = 0;
  bubble.innerHTML = '<span style="color:var(--amber);opacity:0.7">▍</span>';
  const interval = setInterval(() => {
    i++;
    bubble.innerHTML = formatMessage(chars.slice(0, i).join("")) +
      '<span style="color:var(--amber);opacity:0.7">▍</span>';
    scrollToBottom();
    if (i >= chars.length) {
      clearInterval(interval);
      bubble.innerHTML = formatMessage(text);
      scrollToBottom();
    }
  }, speed);
}

// ============================================================
// SEND MESSAGE
// ============================================================
async function sendMessage() {
  const message = userInput.value.trim();
  if (!message || isWaiting) return;
  if (message.length > 1000) {
    showToast("Message too long — keep it under 1000 characters.");
    return;
  }

  hideWelcome();
  appendMessage("user", message);

  userInput.value = "";
  userInput.style.height = "auto";
  charCount.textContent = "0/1000";

  isWaiting = true;
  sendBtn.disabled = true;
  userInput.disabled = true;
  showTypingIndicator();

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId: SESSION_ID }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    removeTypingIndicator();
    const botBubble = appendMessage("bot", "");
    typeText(botBubble, data.reply, 8);

  } catch (error) {
    removeTypingIndicator();
    if (error.message.includes("Failed to fetch")) {
      showToast("Cannot connect to server. Is the backend running?");
      appendMessage("bot", "⚠️ Can't reach the server right now. Make sure the backend is running.");
    } else {
      showToast(error.message);
      appendMessage("bot", "Something went wrong: " + error.message);
    }
  } finally {
    isWaiting = false;
    sendBtn.disabled = false;
    userInput.disabled = false;
    userInput.focus();
  }
}

// ============================================================
// NEW CHAT
// ============================================================
async function newChat() {
  if (isWaiting) return;
  try {
    await fetch(`${API_BASE_URL}/api/chat/clear/${SESSION_ID}`, { method: "DELETE" });
  } catch (e) {
    console.warn("Could not clear server history:", e.message);
  }
  SESSION_ID = "bf_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
  localStorage.setItem("brainforge_session", SESSION_ID);
  location.reload();
}

// ============================================================
// LOAD CHAT HISTORY
// ============================================================
async function loadChatHistory() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/history/${SESSION_ID}`);
    if (!response.ok) return;
    const data = await response.json();
    if (data.messages && data.messages.length > 0) {
      hideWelcome();
      data.messages.forEach((msg) => {
        if (msg.role === "system") return;
        appendMessage(msg.role === "user" ? "user" : "bot", msg.content);
      });
    }
  } catch (e) {
    console.warn("Could not load history:", e.message);
  }
}

// ============================================================
// SUGGESTION
// ============================================================
function useSuggestion(text) {
  // Switch to chat tab
  const chatBtn = document.querySelector(".nav-btn");
  switchTab("chat", chatBtn);
  userInput.value = text;
  userInput.focus();
  charCount.textContent = text.length + "/1000";
}

// ============================================================
// SIDEBAR TOGGLE
// ============================================================
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebar-overlay").classList.toggle("visible");
}

// ============================================================
// PDF DOWNLOAD
// ============================================================
function downloadChatPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("BrainForge — Chat Export", 20, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Exported: " + new Date().toLocaleString(), 20, 30);

  const rows = messagesArea.querySelectorAll(".message-row");
  let y = 44;

  rows.forEach((row) => {
    const isUser = row.classList.contains("user");
    const bubble = row.querySelector(".bubble");
    if (!bubble) return;

    const role = isUser ? "YOU" : "BRAINFORGE";
    const text = bubble.innerText || "";
    const lines = doc.splitTextToSize(text, 165);

    if (y + lines.length * 6 + 14 > 280) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(isUser ? 26 : 245, isUser ? 21 : 240, isUser ? 16 : 232);
    doc.roundedRect(14, y - 4, 182, lines.length * 6 + 10, 2, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(isUser ? 255 : 200, isUser ? 255 : 114, isUser ? 255 : 42);
    doc.text(role, 20, y + 2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(isUser ? 240 : 26, isUser ? 235 : 21, isUser ? 224 : 16);
    doc.text(lines, 20, y + 9);

    y += lines.length * 6 + 18;
  });

  doc.save("brainforge-chat.pdf");
}

// ============================================================
// LOGOUT (placeholder)
// ============================================================
function logout() {
  localStorage.removeItem("brainforge_session");
  location.reload();
}

// ============================================================
// INPUT EVENTS
// ============================================================
if (sendBtn) sendBtn.addEventListener("click", sendMessage);

if (userInput) {
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 140) + "px";
    const len = userInput.value.length;
    charCount.textContent = len + "/1000";
    charCount.style.color = len > 900 ? "#b53a2f" : "var(--ink-4)";
  });
}

// ============================================================
// ============================================================
// QUIZ ENGINE
// ============================================================
// ============================================================

let quizState = {
  questions: [],
  current: 0,
  score: 0,
  topic: "",
  difficulty: "medium",
  count: 5,
  format: "mcq",
  answers: [],   // { question, chosen, correct, isCorrect }
};

// ---- Start Quiz ----
async function startQuiz() {
  const topic = document.getElementById("quiz-topic").value.trim();
  if (!topic) {
    showToast("Please enter a topic to quiz on.");
    return;
  }

  quizState.topic      = topic;
  quizState.difficulty = document.getElementById("quiz-difficulty").value;
  quizState.count      = parseInt(document.getElementById("quiz-count").value);
  quizState.format     = document.querySelector('input[name="quiz-format"]:checked').value;
  quizState.questions  = [];
  quizState.current    = 0;
  quizState.score      = 0;
  quizState.answers    = [];

  // Show active panel
  document.getElementById("quiz-setup").style.display = "none";
  document.getElementById("quiz-results").style.display = "none";
  document.getElementById("quiz-active").style.display = "flex";
  document.getElementById("quiz-active").style.flexDirection = "column";
  document.getElementById("quiz-loading").style.display = "flex";
  document.getElementById("question-card").style.display = "none";

  // Update score
  document.getElementById("quiz-score").textContent = "0";

  // Generate all questions at once via AI
  await generateQuizQuestions();
}

// ---- Generate all questions via AI ----
async function generateQuizQuestions() {
  const formatInstructions = {
    mcq: "multiple choice questions (4 options each, labeled A, B, C, D)",
    truefalse: "true/false questions (options are exactly 'True' and 'False')",
    mixed: "a mix of multiple choice (4 options) and true/false questions",
  };

  const prompt = `Generate exactly ${quizState.count} ${formatInstructions[quizState.format]} about "${quizState.topic}" at ${quizState.difficulty} difficulty level.

Return ONLY a valid JSON array, no other text, no markdown, no explanation. Format:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": "Option A",
    "explanation": "Brief explanation of why this is correct."
  }
]

For true/false questions, options must be exactly ["True", "False"].
Make questions educational, accurate, and progressively challenging.`;

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: prompt,
        sessionId: "quiz_gen_" + Date.now(),
      }),
    });

    if (!response.ok) throw new Error("Failed to generate quiz");

    const data = await response.json();
    const raw = data.reply;

    // Parse JSON from response
    let parsed;
    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/```json|```/gi, "").trim();
      // Extract JSON array
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (!match) throw new Error("No JSON array found");
      parsed = JSON.parse(match[0]);
    } catch (parseErr) {
      console.error("Parse error:", parseErr, raw);
      showToast("Could not parse quiz. Try again.");
      resetQuiz();
      return;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      showToast("No questions received. Try again.");
      resetQuiz();
      return;
    }

    quizState.questions = parsed;
    document.getElementById("quiz-loading").style.display = "none";
    showQuestion(0);

  } catch (err) {
    console.error("Quiz generation error:", err);
    showToast("Failed to generate quiz. Check your connection.");
    resetQuiz();
  }
}

// ---- Show Question ----
function showQuestion(index) {
  const q = quizState.questions[index];
  if (!q) return;

  const total = quizState.questions.length;

  // Progress
  const pct = (index / total) * 100;
  document.getElementById("quiz-progress-fill").style.width = pct + "%";
  document.getElementById("quiz-progress-label").textContent = `Q ${index + 1} / ${total}`;

  // Question text
  document.getElementById("q-number").textContent = `Question ${index + 1}`;
  document.getElementById("q-text").textContent = q.question;

  // Options
  const optContainer = document.getElementById("q-options");
  optContainer.innerHTML = "";
  const letters = ["A", "B", "C", "D"];

  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "q-option";
    btn.innerHTML = `<span class="opt-letter">${letters[i] || (i + 1)}</span> ${opt}`;
    btn.addEventListener("click", () => handleAnswer(opt, q, btn));
    optContainer.appendChild(btn);
  });

  // Reset feedback & next
  const feedback = document.getElementById("q-feedback");
  feedback.style.display = "none";
  feedback.className = "q-feedback";
  feedback.textContent = "";

  const nextBtn = document.getElementById("next-btn");
  nextBtn.style.display = "none";
  nextBtn.textContent = index + 1 < total ? "Next →" : "See Results →";

  document.getElementById("question-card").style.display = "block";
}

// ---- Handle Answer ----
function handleAnswer(chosen, q, clickedBtn) {
  // Disable all options
  const allOptions = document.querySelectorAll(".q-option");
  allOptions.forEach(btn => btn.disabled = true);

  const isCorrect = chosen.trim().toLowerCase() === q.correct.trim().toLowerCase();

  if (isCorrect) {
    clickedBtn.classList.add("correct");
    quizState.score++;
    document.getElementById("quiz-score").textContent = quizState.score;
  } else {
    clickedBtn.classList.add("wrong");
    // Highlight correct answer
    allOptions.forEach(btn => {
      if (btn.textContent.trim().includes(q.correct.trim())) {
        btn.classList.add("revealed");
      }
    });
  }

  // Store answer
  quizState.answers.push({
    question: q.question,
    chosen,
    correct: q.correct,
    isCorrect,
    explanation: q.explanation || "",
  });

  // Show feedback
  const feedback = document.getElementById("q-feedback");
  feedback.style.display = "block";
  feedback.className = `q-feedback ${isCorrect ? "correct" : "wrong"}`;
  if (isCorrect) {
    feedback.innerHTML = `✓ Correct! ${q.explanation || ""}`;
  } else {
    feedback.innerHTML = `✗ The correct answer is: <strong>${q.correct}</strong>. ${q.explanation || ""}`;
  }

  // Show next button
  document.getElementById("next-btn").style.display = "block";
}

// ---- Next Question ----
function nextQuestion() {
  quizState.current++;
  if (quizState.current >= quizState.questions.length) {
    showResults();
  } else {
    showQuestion(quizState.current);
  }
}

// ---- Show Results ----
function showResults() {
  document.getElementById("quiz-active").style.display = "none";
  document.getElementById("quiz-results").style.display = "block";

  const score = quizState.score;
  const total = quizState.questions.length;
  const pct   = Math.round((score / total) * 100);

  document.getElementById("final-score").textContent = score;
  document.getElementById("final-total").textContent = total;

  // Emoji & message
  let icon, msg;
  if (pct === 100) { icon = "🏆"; msg = "Perfect score! Outstanding performance."; }
  else if (pct >= 80) { icon = "🎯"; msg = "Excellent work! You really know this topic."; }
  else if (pct >= 60) { icon = "📚"; msg = "Good effort! Review the ones you missed."; }
  else if (pct >= 40) { icon = "💡"; msg = "Keep studying — you're getting there!"; }
  else { icon = "📖"; msg = "This topic needs more review. Don't give up!"; }

  document.getElementById("results-icon").textContent = icon;
  document.getElementById("results-msg").textContent = msg;

  // Breakdown
  const breakdown = document.getElementById("results-breakdown");
  breakdown.innerHTML = "";
  quizState.answers.forEach((a, i) => {
    const item = document.createElement("div");
    item.className = `breakdown-item ${a.isCorrect ? "pass" : "fail"}`;
    item.innerHTML = `
      <span class="breakdown-icon">${a.isCorrect ? "✓" : "✗"}</span>
      <div><strong>Q${i + 1}:</strong> ${a.question}<br>
      <span style="opacity:0.8;font-size:12px">Your answer: ${a.chosen}${!a.isCorrect ? ` · Correct: ${a.correct}` : ""}</span></div>`;
    breakdown.appendChild(item);
  });

  // Progress bar to 100%
  document.getElementById("quiz-progress-fill").style.width = "100%";
  document.getElementById("quiz-progress-label").textContent = `${total} / ${total}`;
}

// ---- Retry same quiz ----
function retryQuiz() {
  quizState.current = 0;
  quizState.score   = 0;
  quizState.answers = [];

  document.getElementById("quiz-results").style.display = "none";
  document.getElementById("quiz-active").style.display = "flex";
  document.getElementById("quiz-active").style.flexDirection = "column";
  document.getElementById("quiz-loading").style.display = "none";
  document.getElementById("quiz-score").textContent = "0";

  // Shuffle questions
  quizState.questions = quizState.questions.sort(() => Math.random() - 0.5);
  showQuestion(0);
}

// ---- Reset to setup ----
function resetQuiz() {
  document.getElementById("quiz-results").style.display = "none";
  document.getElementById("quiz-active").style.display = "none";
  document.getElementById("quiz-setup").style.display = "block";
  document.getElementById("quiz-topic").value = "";
}

// ============================================================
// INIT
// ============================================================
window.addEventListener("load", () => {
  loadChatHistory();
  if (userInput) userInput.focus();
});
