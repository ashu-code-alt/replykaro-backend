// replykaro-backend/server.js

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5050;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// In-memory file uploads for Whisper
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /generate-reply
 * Body: { message, tone, goal }
 * Returns: { reply }
 */
app.post("/generate-reply", async (req, res) => {
  console.log("✅ /generate-reply hit with:", req.body);
  const { message, tone, goal } = req.body;

  // 1) System instructions
  const systemContent = `
You are ReplyKaro, a friendly, human-like email assistant.
Do NOT mention you are an AI or include any meta-AI disclaimers.
Always write as a real person in a conversational style.
Adapt to the specified tone and goal.
  `.trim();

  // 2) User message context
  const userContent = `
Here is the message and context:
• Message: "${message}"
• Tone: ${tone}
• Goal: ${goal}

Write a concise reply that sounds like it came from a real person.
  `.trim();

  try {
    const apiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent }
        ],
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const reply = apiRes.data.choices[0].message.content.trim();
    console.log("📝 Generated reply:", reply);
    res.json({ reply });
  } catch (err) {
    console.error("❌ /generate-reply error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to generate reply" });
  }
});

/**
 * POST /transcribe-audio
 * Form-Data: audio file in field "audio"
 * Returns: { transcript }
 */
app.post("/transcribe-audio", upload.single("audio"), async (req, res) => {
  console.log("🎤 /transcribe-audio hit");
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
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    console.log("✅ Transcript:", whisperRes.data.text.slice(0, 60), "…");
    res.json({ transcript: whisperRes.data.text });
  } catch (err) {
    console.error("❌ /transcribe-audio error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to transcribe audio." });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 ReplyKaro backend listening on http://localhost:${PORT}`);
});
