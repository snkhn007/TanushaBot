// routes/chat.js — BrainForge Chat API
// =============================================================

const express = require("express");
const router  = express.Router();
const Groq    = require("groq-sdk");
const Chat    = require("../models/Chat");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// =============================================================
// SYSTEM PROMPT — BrainForge Academic AI
// =============================================================
const SYSTEM_PROMPT = `
You are BrainForge — a rigorous, knowledgeable, and encouraging AI academic companion built for serious learners.

YOUR ROLE:
- Help students deeply understand concepts through clear explanations, analogies, and examples
- Break down complex topics step-by-step across all academic levels
- Assist with homework understanding, exam preparation, essay structure, and research
- Generate quiz questions and provide detailed feedback when asked
- Suggest evidence-based study techniques (spaced repetition, active recall, Feynman technique, etc.)
- Support subjects: Mathematics, Physics, Chemistry, Biology, History, Literature, Economics, Computer Science, and more

YOUR PERSONALITY:
- Intellectually engaging, precise, and encouraging
- Celebrate correct reasoning; gently guide when something is wrong
- Use clear language; never condescend or oversimplify
- Use analogies to make abstract ideas concrete
- Occasionally use ✦ or → for structure; keep formatting clean

STRICT RULES:
- ONLY answer questions related to education, academics, learning, and study skills
- If asked about non-educational topics, redirect warmly:
  "BrainForge focuses on academic topics — let's get back to learning!"
- Never complete assignments FOR students — guide their thinking instead
- Always foster critical thinking and intellectual curiosity

FORMAT GUIDELINES:
- Use numbered steps for multi-part explanations
- Use code blocks for programming content
- Keep answers focused; expand detail when a topic clearly warrants it
- For quiz generation requests, return ONLY valid JSON as instructed
`;

// =============================================================
// POST /api/chat
// =============================================================
router.post("/", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ error: "Message is required." });
    }
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "Session ID is required." });
    }

    // Quiz generation sessions don't need persistent storage
    const isQuizSession = sessionId.startsWith("quiz_gen_");

    let historyMessages = [];

    if (!isQuizSession) {
      let chat = await Chat.findOne({ sessionId });
      if (!chat) {
        chat = new Chat({ sessionId, messages: [] });
      }

      const openAIMessages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...chat.messages.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: message.trim() },
      ];

      const completion = await groq.chat.completions.create({
        model:       "llama-3.3-70b-versatile",
        messages:    openAIMessages,
        temperature: 0.6,
        top_p:       0.9,
        max_tokens:  800,
      });

      const assistantReply = completion.choices[0].message.content;

      chat.messages.push({ role: "user",      content: message.trim() });
      chat.messages.push({ role: "assistant", content: assistantReply });
      await chat.save();

      return res.json({ reply: assistantReply, sessionId });
    }

    // --- Quiz generation path (no history saved) ---
    const completion = await groq.chat.completions.create({
      model:       "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: message.trim() },
      ],
      temperature: 0.7,
      top_p:       0.95,
      max_tokens:  2000,  // more tokens for multi-question JSON
    });

    const assistantReply = completion.choices[0].message.content;
    return res.json({ reply: assistantReply, sessionId });

  } catch (error) {
    console.error("❌ Chat route error:", error.message);
    if (error.status === 401) return res.status(401).json({ error: "Invalid API key." });
    if (error.status === 429) return res.status(429).json({ error: "Rate limit reached. Please wait." });
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// =============================================================
// GET /api/chat/history/:sessionId
// =============================================================
router.get("/history/:sessionId", async (req, res) => {
  try {
    const chat = await Chat.findOne({ sessionId: req.params.sessionId });
    if (!chat) return res.json({ messages: [] });
    res.json({ messages: chat.messages });
  } catch (error) {
    console.error("❌ History error:", error.message);
    res.status(500).json({ error: "Could not fetch history." });
  }
});

// =============================================================
// DELETE /api/chat/clear/:sessionId
// =============================================================
router.delete("/clear/:sessionId", async (req, res) => {
  try {
    await Chat.findOneAndDelete({ sessionId: req.params.sessionId });
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Clear error:", error.message);
    res.status(500).json({ error: "Could not clear chat." });
  }
});

module.exports = router;
