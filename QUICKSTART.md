# Quick Start Guide

## Step 1: Start Database

```bash
docker compose up -d
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Configure Environment

Copy `.env.example` to `.env` and add your API tokens:
- Clash of Clans API token from https://developer.clashofclans.com
- Discord bot token from https://discord.com/developers/applications

## Step 4: Setup Database

```bash
npm run prisma:generate
npm run prisma:migrate
```

## Step 5: Start the Application

Terminal 1 - Web App:
```bash
npm run dev
```

Terminal 2 - Discord Bot:
```bash
npm run bot:dev
```

## Step 6: Connect Your Clan

1. Open http://localhost:3000
2. Click "Connect Your Clan"
3. Enter your clan tag
4. Wait for data collection to begin

Done! 🎉
