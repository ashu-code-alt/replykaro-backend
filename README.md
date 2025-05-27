# ReplyKaro Backend

A secure Node.js + Express API backend for the ReplyKaro Chrome Extension. It uses OpenAI’s GPT-4 to generate tone-aware, emotionally intelligent email replies.

---

## 🚀 How It Works

POST `/generate-reply` with:
```json
{
  "message": "I need to cancel tomorrow",
  "tone": "calm",
  "goal": "delay"
}
