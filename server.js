// replykaro-backend/server.js
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5050;

// —— Middleware ——  
app.use(cors());
app.use(express.json());

// —— Health-check ——  
app.get("/", (req, res) => res.send("OK"));

// —— Multer for Whisper uploads ——  
const upload = multer({ storage: multer.memoryStorage() });

// —— Generate Reply(s) + Score(s) ——  
app.post("/generate-reply", async (req, res) => {
  const { message, tone, goal, variants } = req.body;
  // Ensure variants is an integer ≥ 1
  const n = Number.isInteger(variants) && variants > 1 ? variants : 1;

  try {
    // 1) Generate n drafts in one API call
    const genRes = await axios.post(
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
        n,               // ask for n variants
        max_tokens: 350, // adjust as needed
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const replies = genRes.data.choices.map((c) =>
      c.message.content.trim()
    );

    // 2) Evaluate each draft in turn
    const scores = [];
    for (const reply of replies) {
      try {
        const evalRes = await axios.post(
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

        const raw = evalRes.data.choices[0].message.content.trim();
        let score = 0;
        try {
          const parsed = JSON.parse(raw);
          if (
            typeof parsed.score === "number" &&
            !isNaN(parsed.score) &&
            parsed.score >= 0 &&
            parsed.score <= 100
          ) {
            score = Math.round(parsed.score);
          }
        } catch (parseErr) {
          console.warn("Eval JSON parse error:", parseErr);
        }
        scores.push(score);
      } catch (e) {
        console.error("Evaluation error:", e.response?.data || e.message);
        scores.push(0);
      }
    }

    // 3) Return both arrays
    return res.json({ replies, scores });
  } catch (err) {
    console.error("Generation error:", err.response?.data || err.message);
    return res
      .status(500)
      .json({ error: "Failed to generate reply(s) or score(s)." });
  }
});

// —— Whisper transcription ——  
app.post(
  "/transcribe-audio",
  upload.single("audio"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
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

      return res.json({ transcript: whisperRes.data.text });
    } catch (e) {
      console.error("Transcription error:", e.response?.data || e.message);
      return res.status(500).json({ error: "Failed to transcribe audio." });
    }
  }
);

// —— Start server ——  
app.listen(PORT, () =>
  console.log(`🚀 Listening on http://localhost:${PORT}`)
);
