const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

app.post("/generate-reply", async (req, res) => {
  const { message, tone, goal } = req.body;
  console.log("✅ /generate-reply endpoint hit with:", req.body);

  const prompt = `
You are an AI email assistant called ReplyKaro.
Your job is to help the user write a tone-aware, purpose-driven email.

User message: "${message}"
Tone: ${tone}
Goal: ${goal}

Write a complete, natural, polite reply with emotional intelligence.
  `;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const reply = response.data.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    console.error("❌ OpenAI API error:", error.response?.data || error.message);
    res.status(500).json({ error: "Something went wrong while generating the reply." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 ReplyKaro backend is running on http://localhost:${PORT}`);
});
