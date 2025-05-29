// replykaro-backend/server.js

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5050;

// 1) Serve static privacy page
app.use(express.static("public"));

// 2) Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

// 3) Configure multer for in-memory uploads
const upload = multer({ storage: multer.memoryStorage() });

// POST /generate-reply → { reply, score }
app.post("/generate-reply", async (req, res) => {
  const { message, tone, goal } = req.body;

  try {
    // a) Draft the email reply
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
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const reply = draftResp.data.choices[0].message.content.trim();
    console.log("📝 Reply:", reply);

    // b) Evaluate success likelihood in strict JSON
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
            content: `Reply:\n${reply}\n\nGoal: ${goal}`,
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

    const rawEval = evalResp.data.choices[0].message.content.trim();
    console.log("🔍 Raw eval JSON:", rawEval);

    // c) Parse JSON safely
    let score = 0;
    try {
      const parsed = JSON.parse(rawEval);
      if (
        typeof parsed.score === "number" &&
        parsed.score >= 0 &&
        parsed.score <= 100
      ) {
        score = Math.round(parsed.score);
      } else {
        console.warn("❗ Score out of range:", parsed);
      }
    } catch (e) {
      console.warn("❗ Failed to parse JSON:", e.message);
    }
    console.log("✅ Parsed score:", score);

    return res.json({ reply, score });
  } catch (err) {
    console.error("❌ /generate-reply error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Failed to generate reply or score." });
  }
});

// POST /transcribe-audio → { transcript }
app.post("/transcribe-audio", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No audio uploaded." });
  try {
    const form = new FormData();
    form.append("file", req.file.buffer, { filename: req.file.originalname });
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

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Listening on http://localhost:${PORT}`);
});
