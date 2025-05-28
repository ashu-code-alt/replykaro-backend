// replykaro-backend/server.js

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5050;

// Middleware
app.use(cors());
app.use(express.json());

// Multer setup for uploads
const upload = multer({ dest: "uploads/" });

/**
 * POST /generate-reply
 * Body: { message, tone, goal }
 * Returns: { reply }
 */
app.post("/generate-reply", async (req, res) => {
  const { message, tone, goal } = req.body;
  console.log("✅ /generate-reply hit:", req.body);

  const prompt = `
You are an AI email assistant called ReplyKaro.
Your job is to help the user write a tone-aware, purpose-driven email.

User message: "${message}"
Tone: ${tone}
Goal: ${goal}

Write a complete, natural, polite reply with emotional intelligence.
  `;

  try {
    const apiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const reply = apiRes.data.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error("❌ OpenAI /generate-reply error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate reply." });
  }
});

/**
 * POST /transcribe-audio
 * Form-Data: audio file under field name "audio"
 * Returns: { transcript }
 */
app.post("/transcribe-audio", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file uploaded." });
  }

  const audioPath = req.file.path;
  try {
    // Build FormData for Whisper
    const formData = new FormData();
    formData.append("file", fs.createReadStream(audioPath));
    formData.append("model", "whisper-1");

    // Call OpenAI Whisper API
    const whisperRes = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    // Clean up temp file
    fs.unlinkSync(audioPath);

    // Return transcript
    res.json({ transcript: whisperRes.data.text });
  } catch (error) {
    console.error("❌ Whisper transcription error:", error.response?.data || error.message);
    // Ensure file is removed even on error
    try { fs.unlinkSync(audioPath); } catch {}
    res.status(500).json({ error: "Failed to transcribe audio." });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ReplyKaro backend listening on http://localhost:${PORT}`);
});
