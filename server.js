// replykaro-backend/server.js

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5050;

// CORS & JSON parsing
app.use(cors());
app.use(express.json());

// In-memory file uploads  
const upload = multer({ storage: multer.memoryStorage() });

app.post("/generate-reply", async (req, res) => {
  console.log("✅ /generate-reply", req.body);
  const { message, tone, goal } = req.body;
  const prompt = `
You are ReplyKaro, an AI email assistant.
User message: "${message}"
Tone: ${tone}
Goal: ${goal}
Write a short, polite, emotionally intelligent reply.
  `;
  try {
    const apiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      { model: "gpt-4", messages:[{role:"user",content:prompt}], temperature:0.7 },
      { headers:{ Authorization:`Bearer ${process.env.OPENAI_API_KEY}` } }
    );
    res.json({ reply: apiRes.data.choices[0].message.content });
  } catch (err) {
    console.error("❌ /generate-reply error", err.response?.data||err.message);
    res.status(500).json({ error:"Failed to generate reply" });
  }
});

app.post("/transcribe-audio", upload.single("audio"), async (req, res) => {
  console.log("🎤 /transcribe-audio hit");
  if (!req.file) return res.status(400).json({ error:"No file uploaded" });

  try {
    const form = new FormData();
    form.append("file", req.file.buffer, { filename:req.file.originalname });
    form.append("model", "whisper-1");

    const whisperRes = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      form,
      { headers:{ ...form.getHeaders(), Authorization:`Bearer ${process.env.OPENAI_API_KEY}` } }
    );

    console.log("✅ Transcript:", whisperRes.data.text.slice(0,50));
    res.json({ transcript: whisperRes.data.text });
  } catch (err) {
    console.error("❌ /transcribe-audio error", err.response?.data||err.message);
    res.status(500).json({ error:"Failed to transcribe audio" });
  }
});

app.listen(PORT, () => console.log(`🚀 Listening on http://localhost:${PORT}`));
