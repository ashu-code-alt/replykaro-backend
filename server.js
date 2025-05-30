// replykaro-backend/server.js

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5050;

// 1) Health-check endpoint
app.get("/", (req, res) => {
  res.send("OK");
});

// 2) Serve static files (privacy policy)
app.use(express.static("public"));

// 3) Enable CORS & JSON parsing
app.use(cors());
app.use(express.json());

// 4) Multer setup for in-memory audio uploads
const upload = multer({ storage: multer.memoryStorage() });

// 5) POST /generate-reply → returns { reply, score }
// replykaro-backend/server.js
// … keep your imports, health-check, CORS, JSON, multer, /transcribe-audio, etc. above …

// POST /generate-reply → { replies: string[], scores: number[] }
app.post("/generate-reply", async (req, res) => {
  const { message, tone, goal, variants = 3 } = req.body;

  try {
    // 1) Generate N drafts in one API call
    const draftResp = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `
You are ReplyKaro, a friendly, human-like email assistant.
Write a real-person response in the specified tone and goal.
Do NOT mention you are an AI.
            `.trim(),
          },
          {
            role: "user",
            content: `Message: "${message}"\nTone: ${tone}\nGoal: ${goal}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 350,
        n: variants,                // <-- ask for multiple completions
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const replies = draftResp.data.choices.map(c => c.message.content.trim());
    console.log(`📝 Generated ${replies.length} drafts`);

    // 2) Evaluate each draft’s success likelihood
    const scorePromises = replies.map(async replyText => {
      const evalResp = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `
You are an expert evaluator.
On a scale from 0 to 100, rate how likely this reply will achieve the user's goal.
Respond with ONLY valid JSON in this exact format, no extra text:

{"score": <integer between 0 and 100>}
              `.trim(),
            },
            {
              role: "user",
              content: `Reply:\n${replyText}\n\nGoal: ${goal}`,
            },
          ],
          temperature: 0,
          max_tokens: 10,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      // parse their JSON
      try {
        const parsed = JSON.parse(evalResp.data.choices[0].message.content);
        return Number.isFinite(parsed.score) ? Math.round(parsed.score) : 0;
      } catch {
        return 0;
      }
    });

    const scores = await Promise.all(scorePromises);
    console.log("✅ Scores:", scores);

    return res.json({ replies, scores });
  } catch (err) {
    console.error("❌ /generate-reply error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Failed to generate drafts or scores." });
  }
});

// 6) POST /transcribe-audio → returns { transcript }
app.post("/transcribe-audio", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio uploaded." });
  }
  try {
    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename: req.file.originalname,
    });
    form.append("model", "whisper-1");

    const whisperRes = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const transcript = whisperRes.data.text;
    console.log("🎤 Transcript:", transcript);
    return res.json({ transcript });
  } catch (err) {
    console.error(
      "❌ /transcribe-audio error:",
      err.response?.data || err.message
    );
    return res.status(500).json({ error: "Failed to transcribe audio." });
  }
});

// 7) Start the server
app.listen(PORT, () => {
  console.log(`🚀 Listening on http://localhost:${PORT}`);
});
