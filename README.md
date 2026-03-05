# Interview Analysis Master / 面试分析大师

An AI-powered interview analysis platform that transforms audio recordings or transcripts into structured analytical reports with dialogue chain analysis, interviewer focus mapping, and job-candidate fit assessment.

## Features

- Audio upload with automatic speech-to-text transcription (iFlytek ASR v2)
- Transcript upload support (.txt, .json, .srt, .vtt, .docx)
- AI-powered deep analysis (Alibaba Cloud Dashscope / Qwen)
- Role identification (interviewer vs. candidate)
- Question extraction and classification (preset / follow-up / clarification)
- Dialogue chain analysis with trigger logic annotation
- Interviewer focus heatmap
- Candidate performance summary
- Job description parsing and job-candidate fit analysis (when JD provided)
- Resume (CV) text extraction (PDF/DOCX)
- Real-time processing progress via SSE
- Dark/Light theme
- User authentication with invite codes
- Custom tags and interview type filtering
- Editable report titles

## Tech Stack

**Frontend:** React + TypeScript + Tailwind CSS + Vite

**Backend:** Express.js + TypeScript + SQLite (better-sqlite3)

**AI:** Alibaba Cloud Dashscope (qwen-plus) via OpenAI-compatible API

**ASR:** iFlytek Recording File Transcription v2 (speaker diarization)

## Prerequisites

- Node.js >= 18
- npm
- iFlytek ASR API credentials (for audio transcription)
- Alibaba Cloud Dashscope API key (for AI analysis)

## Installation

```bash
git clone https://github.com/Loong0x00/Interview_notes.git
cd Interview_notes/interview-analysis-report
npm install
```

## Configuration

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required: Alibaba Cloud Dashscope API key for AI analysis
DASHSCOPE_API_KEY=your_key_here

# Required for audio upload: iFlytek ASR credentials
XFYUN_APP_ID=your_app_id
XFYUN_API_KEY=your_api_key
XFYUN_API_SECRET=your_api_secret

# Required: JWT secret for authentication
# Generate with: openssl rand -hex 32
JWT_SECRET=your_random_secret
```

## Running

### Development

```bash
# Start both frontend dev server and backend
npm run dev:all

# Or start them separately:
npm run dev        # Frontend on port 3000
npm run server     # Backend on port 8000
```

### Production

```bash
# Build frontend
npm run build

# Start production server (serves both API and static files)
npm run server
```

The application will be available at `http://localhost:8000`.

## Default Invite Codes

New users need an invite code to register. The following codes are pre-seeded:

- `INVITE-ALPHA`
- `INVITE-BETA`
- `INVITE-GAMMA`
- `INVITE-DELTA`
- `INVITE-EPSILON`

## Project Structure

```
interview-analysis-report/
  server/              # Backend
    index.ts           # Express routes
    analyze.ts         # AI analysis prompts and logic
    transcribe.ts      # iFlytek ASR integration
    pipeline.ts        # Upload processing pipeline
    db.ts              # SQLite database schema and helpers
    auth.ts            # JWT authentication
    parseCV.ts         # CV text extraction (PDF/DOCX)
    convert.ts         # Markdown to JSON conversion
    lib/ai-client.ts   # Dashscope API client
  src/                 # Frontend
    App.tsx            # Main app with report list
    components/
      Report.tsx       # Report detail view
      UploadPage.tsx   # Upload page
      TranscriptChat.tsx # Transcript chat view
      LoginPage.tsx    # Login
      RegisterPage.tsx # Registration
    contexts/          # React contexts (Auth, Theme)
    types.ts           # TypeScript interfaces
```

## Usage

1. Register an account using an invite code
2. Click "Upload New Interview" on the home page
3. Choose audio file or transcript, optionally provide JD and CV
4. Wait for processing (transcription + AI analysis)
5. View the generated analysis report

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Authors

- [Loong0x00](https://github.com/Loong0x00)
- [AmandaWWW](https://github.com/AmandaWWW)
