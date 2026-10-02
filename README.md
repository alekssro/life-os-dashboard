# Life OS Dashboard

A personal operations dashboard and life management system inspired by the case-study series by **Jerad Hill**. Built with open-source technologies, designed with clean typography suitable for **e-paper tablets** (Boox, Remarkable, Kindle Scribe) and modern screens, and containerized for single-command deployment via Docker Compose.

---

## Key Features

1. **Today Briefing & Attention Engine**
   - **Top 3 Daily Focus**: Star tasks from your master queue to focus your day.
   - **Attention / Slipping Engine**: Automatically surfaces quiet projects (no activity for 14+ days), neglected contacts needing follow-up, and overdue tasks.
   - **Daily Routines**: Morning, Afternoon, and Evening habits with gentle resilience and streak tracking (avoiding streak guilt/burnout).
   - **Up Next Schedule**: Daily calendar and upcoming appointment agenda.
   - **Resurfacing Widget**: Daily rotating quote, book highlight, or note.
   - **Inbox Triage ("Needs Review")**: Quick 5-action triage: `[OWN]`, `[READING]`, `[MEETING]`, `[BRAINSTORM]`, and `[CLEAR]`.

2. **Multi-Modal Quick Capture (`Cmd+J` / `Cmd+K`)**
   - Keyboard quick-capture modal with natural language input.
   - Web Audio voice recording memo right in the browser.
   - iOS Shortcut & Apple Watch complication integration via `/api/capture`.
   - Inbound Email Webhook at `/api/webhook/email` with automatic Gmail permalink generation.

3. **Hybrid AI Engine (Local Open Source + Cloud)**
   - **Local Ollama** (100% open source & private, running on your home server or local machine).
   - **Google Gemini** (Ultra-fast, low-latency natural language triage).
   - **Anthropic Claude** (Deep contextual entity extraction and project taxonomy routing).
   - **OpenAI & Whisper** (Audio speech-to-text and reasoning).
   - **Deterministic Offline Fallback**: Rule-based regex parser that functions with zero cloud dependencies or missing API keys.

4. **Multi-Theme Engine (E-Paper / E-Ink Tablet Optimized)**
   - **Warm Paper**: Warm cream paper aesthetic (`#FAF6F0`) with terracotta accents.
   - **E-Ink Tablet**: Pure high-contrast monochrome mode (`#000000` on `#FFFFFF`), zero blur, zero animations, crisp 1px borders for Boox, Remarkable Paper Pro, and Supernote.
   - **Daylight**: Crisp minimal slate & white for desktop and mobile daylight use.
   - **Midnight OLED**: Deep black for mobile night use.

5. **Integrated Modules**
   - **Tasks**: Full task management with domain filtering, recurring schedules (`↺ WEEKLY`, `↺ MONTHLY`), and due dates.
   - **Routines**: Morning, Afternoon, and Evening anchors.
   - **Projects**: Milestone deliverables, Monthly Retainers (hours logging & monthly budget), and Ongoing Areas.
   - **Content Pipeline**: Video and article kanban pipeline (Idea → Scripting → Recording → Editing → Published).
   - **People & CRM**: Lightweight relationship tracking, family details (spouse, kids, personal notes), and follow-up window tracking.
   - **Library & Quotes**: Highlights and daily resurfacing engine.
   - **Domains**: High-level life buckets (Work, Content, Home, Health, Finance).

---

## Architecture & Security

- **Frontend / Backend**: Next.js 14 App Router (React 18, Tailwind CSS, TypeScript).
- **Database**: PostgreSQL 16 Alpine via Prisma ORM.
- **Security by Default**:
  - Container runs as an unprivileged, non-root user (`USER nextjs`, UID 1001).
  - API endpoints protected with `API_SECRET_KEY` via `Authorization: Bearer <token>` or `x-api-key`.
  - In-memory rate limiting on public endpoints.
  - Hardened HTTP response headers (CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff).
  - Multi-stage Dockerfile that discards source code and build tools in the final runner stage.

---

## Quick Start with Docker Compose

### 1. Clone & Configure Environment

```bash
cp .env.example .env
```

Edit `.env` to configure your passwords, secret key, and AI provider:
```bash
POSTGRES_PASSWORD=your_secure_db_password
API_SECRET_KEY=your_generated_secret_token
AI_PROVIDER=auto
```

### 2. Launch Services

```bash
docker compose up -d
```

The database will be initialized, the schema pushed via Prisma, and starter seed data loaded automatically.

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## Quick Capture Integration

### iOS Shortcut / Apple Watch Setup

1. Open the **Shortcuts** app on iOS / macOS / watchOS.
2. Add the **"Dictate Text"** action.
3. Add the **"Get Contents of URL"** action:
   - **URL**: `https://your-domain.com/api/capture`
   - **Method**: `POST`
   - **Headers**:
     - `Content-Type`: `application/json`
     - `Authorization`: `Bearer YOUR_API_SECRET_KEY`
   - **Request Body**: JSON
     - `text`: `[Dictated Text]`

### cURL Test Command

```bash
curl -X POST http://localhost:3000/api/capture \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_SECRET_KEY" \
  -d '{"text": "Check oil Ford Ranger due Friday #Home"}'
```

---

## Local Development (Without Docker)

If you have a local PostgreSQL instance running:

```bash
# 1. Install dependencies
npm install

# 2. Push schema and seed database
npm run db:push
npm run db:seed

# 3. Start development server
npm run dev
```

---

## License

MIT License. Open-source technology designed for self-hosting and personal data ownership.
