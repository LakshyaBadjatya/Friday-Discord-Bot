# Friday Discord Bot

Friday is an AI-powered Discord Server Architect bot designed to let administrators completely create, modify, organize, and manage Discord servers using natural-language chat commands.

## Features
- **AI Command Interpreter:** Convert natural language into structured action plans (create channels, categories, roles).
- **Server Builder:** Create/edit/delete categories, text/voice/forum/announcement channels.
- **Permission System:** Secure authorization allowing only Allowed Users, Allowed Roles, Server Owner, or Administrators to execute AI management commands.
- **AI Control Room:** Setup wizard to configure an AI Control Channel, meaning the bot only listens in the designated channel.
- **Audit Logging:** Every action is logged using Firebase Firestore.
- **Undo System:** Revert accidental or unwanted AI changes seamlessly.

## Tech Stack
- **Language:** TypeScript (Node.js >= 20)
- **Discord Library:** `discord.js` v14
- **Database:** Firebase Firestore
- **AI Integration:** Multi-agent pipeline (Planner → Reviewer → Optimizer → Executor → Verifier) powered by NVIDIA NIM (LLaMA 3.1).

## Getting Started

### Prerequisites
- Node.js v20+
- Discord Bot Token & Client ID
- Firebase Project configured
- NVIDIA NIM API Key (or OpenAI API Key as fallback)

### Installation
1. Clone the repository:
```bash
git clone https://github.com/LakshyaBadjatya/Friday-Discord-Bot.git
cd Friday-Discord-Bot
```

2. Install dependencies:
```bash
npm install
```

3. Setup environment variables:
Copy `.env.example` to `.env` and fill in the missing details:
```bash
cp .env.example .env
```

### Running the Bot
For local development with hot reload:
```bash
npm run dev
```

To build for production:
```bash
npm run build
npm start
```

## Deployment
This project includes a `render.yaml` for easy deployment to Render.
