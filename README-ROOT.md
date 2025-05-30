# PersonalProject

This repo contains two subprojects:

1. **replykaro-backend** – Express.js + OpenAI backend (GPT + Whisper)  
2. **replykaro-extension** – Chrome extension UI

## Running

### Backend
\`\`\`bash
cd replykaro-backend
npm install
npm start
\`\`\`

### Extension
1. Open Chrome → \`chrome://extensions\` → Load unpacked → select \`replykaro-extension/\`  
2. Ensure backend is running at \`https://replykaro-backend.onrender.com\`  
3. Use the popup UI to draft emails.



# ReplyKaro AI PersonalProject

This folder contains two standalone projects:

## 1. Backend (`replykaro-backend`)
- **Endpoints**:
  - `GET  /`               → health check, returns `OK`
  - `POST /generate-reply` → `{ reply: string, score: number }`
  - `POST /transcribe-audio` → `{ transcript: string }`
- **Run Locally**:
  ```bash
  cd replykaro-backend
  npm install
  npm start
