# ClashLens 🏰

Advanced analytics and insights for your Clash of Clans clan. Track performance, analyze player progression, and get insights delivered straight to Discord.

## Features

- ⚡ **Real-time Analytics**: Automatic data collection with configurable snapshot frequency
- 📊 **Beautiful Dashboards**: Trophy trends, TH distribution, and performance metrics
- 🎯 **IRJ Scoring**: Custom player reliability scoring (0-100) based on activity, trophies, donations, and war participation
- 🔔 **Discord Integration**: Slash commands and daily notifications
- 📈 **Historical Tracking**: View progression over time with interactive charts
- ⚔️ **War Analytics**: Track war performance and results (when war log is public)

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS
- **UI Components**: shadcn/ui with custom premium theme
- **Charts**: Recharts
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Discord**: Discord.js v14
- **Data Collection**: node-cron for automated snapshots
- **API**: Clash of Clans Official API

## Prerequisites

- Node.js 20+ and npm
- Docker and Docker Compose (for PostgreSQL)
- Clash of Clans API token from https://developer.clashofclans.com
- Discord bot token and application ID from https://discord.com/developers/applications

## Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd ClashLens
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.local .env
```

Required environment variables:

```env
# Database
DATABASE_URL="postgresql://clashlens:clashlens@localhost:5432/clashlens?schema=public"

# Clash of Clans API - Get your token from https://developer.clashofclans.com
COC_API_TOKEN="your_coc_api_token_here"
COC_API_BASE_URL="https://api.clashofclans.com/v1"

# Discord Bot - Create at https://discord.com/developers/applications
DISCORD_TOKEN="your_discord_bot_token_here"
DISCORD_CLIENT_ID="your_discord_application_id_here"

# CRON Security - Generate a random secret
CRON_SECRET="clashLens2024SuperSecretKey123!@#"

# App Configuration
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SNAPSHOT_FREQUENCY_MINUTES="60"

NODE_ENV="development"
```

4. **Start PostgreSQL with Docker Compose**

```bash
docker compose up -d
```

5. **Run database migrations**

```bash
npm run prisma:generate
npm run prisma:migrate
```

6. **Start the Next.js development server**

```bash
npm run dev
```

The web app will be available at http://localhost:3000

7. **Start the Discord bot (in a separate terminal)**

```bash
npm run bot:dev
```

## Discord Bot Setup

1. **Create a Discord Application**
   - Go to https://discord.com/developers/applications
   - Click "New Application" and give it a name
   - Go to the "Bot" tab and click "Add Bot"
   - Copy the bot token and add it to your `.env` file as `DISCORD_TOKEN`
   - Enable necessary intents (Server Members Intent, Message Content Intent)

2. **Get Application ID**
   - In the "General Information" tab, copy the Application ID
   - Add it to your `.env` file as `DISCORD_CLIENT_ID`

3. **Invite the bot to your server**
   - Go to the "OAuth2" → "URL Generator" tab
   - Select scopes: `bot`, `applications.commands`
   - Select bot permissions: `Send Messages`, `Embed Links`, `Read Messages/View Channels`
   - Copy the generated URL and open it to invite the bot

4. **Available Commands**
   - `/clash connect clan_tag:<tag>` - Link your Discord server to a clan
   - `/clash summary period:<7d|30d>` - Get clan performance summary
   - `/clash dashboard` - Get web dashboard link
   - `/clash player tag:<tag>` - Get player stats and IRJ score

## Usage

### Connecting a Clan

1. Navigate to http://localhost:3000
2. Click "Connect Your Clan"
3. Enter your clan tag (e.g., `#ABC123`)
4. Click "Connect Clan"
5. Wait for validation and data collection to begin

### Viewing Dashboard

Once connected, navigate to:
- **Dashboard**: `/dashboard/<clan-tag>` - KPIs, charts, top progressions
- **Members**: `/members/<clan-tag>` - Searchable table with IRJ scores
- **Wars**: `/wars/<clan-tag>` - War history and results
- **Player Detail**: `/player/<player-tag>` - Individual player analytics
- **Settings**: `/settings` - Configure snapshot frequency and manual sync

### CRON Jobs

The application runs automated jobs:
- **Snapshots**: Collect clan and player data (configurable frequency, default 60 min)
- **Wars**: Collect war data every 2 hours
- **Daily Notifications**: Send Discord summaries at 9:00 AM (configurable)

You can trigger manual snapshots:
- Via Settings page → "Run Sync Now" button
- Via API: `POST /api/cron/snapshot` with `Authorization: Bearer <CRON_SECRET>` header

## Development

### Project Structure

```
ClashLens/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   ├── dashboard/         # Dashboard pages
│   │   ├── members/           # Members pages
│   │   ├── wars/              # Wars pages
│   │   ├── player/            # Player detail pages
│   │   ├── settings/          # Settings page
│   │   └── connect/           # Clan connection page
│   ├── bot/                   # Discord bot
│   │   ├── index.ts           # Bot entry point
│   │   └── notifications.ts   # Daily notifications
│   ├── components/            # React components
│   │   ├── layout/            # Layout components
│   │   ├── charts/            # Chart components
│   │   └── ui/                # shadcn/ui components
│   └── lib/                   # Utilities and libraries
│       ├── coc/               # CoC API client
│       ├── jobs/              # CRON jobs
│       ├── utils/             # Utility functions
│       └── db.ts              # Prisma client
├── docker-compose.yml         # PostgreSQL container
├── package.json
└── README.md
```

### IRJ Score Explanation

IRJ (Individual Reliability & Journey) is a custom score (0-100) that measures player activity:

- **Presence (40%)**: Consistency in appearing in snapshots
- **Trophy Progress (30%)**: Trophy gain/loss over 7 days
- **Donations (15%)**: Contribution to clan donations
- **War Participation (15%)**: Attacks used vs available in wars

Higher scores indicate more active and reliable players.

## Troubleshooting

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker compose ps

# Restart database
docker compose restart db

# View logs
docker compose logs db
```

### Discord Bot Not Responding

- Verify `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` are correct
- Check bot has proper permissions in Discord server
- Ensure bot is running with `npm run bot:dev`
- Check bot logs for errors

### No Data Showing

- Wait a few minutes for initial snapshot collection
- Trigger manual sync in Settings page
- Check API health: http://localhost:3000/api/health
- Verify CoC API token is valid

### War Data Not Available

Some clans have private war logs. The app gracefully handles this:
- Public war logs will show full history
- Private war logs will display a message explaining the limitation

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Use a managed PostgreSQL database
3. Set up proper CRON scheduling (e.g., Vercel Cron, external service)
4. Secure CRON endpoints with strong `CRON_SECRET`
5. Configure proper domain in `NEXT_PUBLIC_APP_URL`
6. Run Discord bot as a separate process/container

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.

---

Built with ❤️ for the Clash of Clans community
