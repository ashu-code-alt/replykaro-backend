// replykaro-backend/server.js

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5050;

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

// Configure multer for in-memory uploads
const upload = multer({ storage: multer.memoryStorage() });

// POST /generate-reply
app.post("/generate-reply", async (req, res) => {
  const { message, tone, goal } = req.body;

  try {
    // 1) Generate the email draft
    const draftResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `
You are ReplyKaro, a friendly, human-like email assistant.
Write a response as a real person in the specified tone and goal.
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

    const reply = draftResponse.data.choices[0].message.content.trim();
    console.log("📝 Generated reply:", reply);

    // 2) Evaluate success likelihood in strict JSON
    const evalResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `
You are an expert evaluator.
On a scale from 0 to 100, rate how likely the following email reply will achieve the user's goal.
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

    const rawEval = evalResponse.data.choices[0].message.content.trim();
    console.log("🔍 Raw evaluation JSON:", rawEval);

    // 3) Parse JSON safely
    let score = 0;
    try {
      const parsed = JSON.parse(rawEval);
      if (
        typeof parsed.score === "number" &&
        !isNaN(parsed.score) &&
        parsed.score >= 0 &&
        parsed.score <= 100
      ) {
        score = Math.round(parsed.score);
      } else {
        console.warn("❗ Score out of range in parsed JSON:", parsed);
      }
    } catch (parseError) {
      console.warn("❗ Failed to parse evaluation JSON:", parseError.message);
    }
    console.log("✅ Parsed score:", score);

    // 4) Return reply and score
    return res.json({ reply, score });
  } catch (err) {
    console.error(
      "❌ Error in /generate-reply:",
      err.response?.data || err.message
    );
    return res.status(500).json({ error: "Failed to generate reply or score." });
  }
});

// POST /transcribe-audio
app.post("/transcribe-audio", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file uploaded." });
  }

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
      "❌ Error in /transcribe-audio:",
      err.response?.data || err.message
    );
    return res.status(500).json({ error: "Failed to transcribe audio." });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Listening on http://localhost:${PORT}`);
});
