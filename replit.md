# Medieval Kingdom — Web Dashboard

A full web dashboard for the Medieval Kingdom Discord bot. Built with Express + React.

## What it does

Players connect via Discord OAuth (or demo mode) to view their game character:

- **Accueil** — Kingdom-wide stats, character summary, class breakdown
- **Personnage** — Full character sheet: stats, abilities, equipment, faction
- **Inventaire** — All items with rarity filters and sorting
- **Quêtes** — Active quest, available quests, completed quest history
- **Classement** — Live leaderboard with podium and sortable columns

## Running the dashboard

The workflow `Start application` runs:

```
node dashboard/server/index.js
```

Server starts on port **5000** and serves the pre-built React frontend from `dashboard/client/dist/`.

## Discord OAuth setup (optional)

To enable real Discord login (instead of demo mode), add these to your environment:

- `DISCORD_CLIENT_ID` — your Discord application client ID
- `DISCORD_CLIENT_SECRET` — your Discord application client secret
- `SESSION_SECRET` — any random secret string

Create a Discord application at https://discord.com/developers/applications and add the redirect URI:
`https://<your-replit-domain>/auth/discord/callback`

## Rebuilding the frontend

If you change files in `dashboard/client/src/`:

```bash
cd dashboard/client && npm run build
```

Then restart the workflow.

## Project structure

```
dashboard/
  server/index.js       — Express server + API routes + Discord OAuth
  client/
    src/
      App.jsx           — Root app, auth context, sidebar layout
      pages/
        LoginPage.jsx
        OverviewPage.jsx
        CharacterPage.jsx
        InventoryPage.jsx
        QuestsPage.jsx
        LeaderboardPage.jsx
    dist/               — Built React app (served by Express)
MedievalKingdom/
  MedievalKingdom/
    database/           — JSON data files (players, items, quests, etc.)
    systems/gameData.js — Classes, factions, monsters
```

## User preferences

- Language: French (all game content is in French)
- Theme: Dark medieval gold aesthetic
