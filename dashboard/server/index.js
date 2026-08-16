const path = require('path');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const fs = require('fs');
const https = require('https');

// 1. Initialisation des variables d'environnement
require('dotenv').config({ path: path.join(__dirname, '../../MedievalKingdom/MedievalKingdom/.env') });

const app = express();
app.set('trust proxy', 1); // Permet aux cookies de session de fonctionner derrière le proxy Render


// 2. Définition du port réseau (Render utilise process.env.PORT)
const PORT = process.env.PORT || process.env.DASHBOARD_PORT || 5000;

// 3. Middlewares globaux
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'medieval-kingdom-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// 4. Configuration des fichiers statiques compilés par React
const clientBuildPath = path.join(__dirname, '../client/dist'); 
app.use(express.static(clientBuildPath));

// 5. configuration des données de jeu et base de données
const { classes, factions, monsters } = require('../../MedievalKingdom/MedievalKingdom/systems/gameData.js');
const { getPlayer, loadPlayers } = require('../../MedievalKingdom/MedievalKingdom/utils/database.js');

const BOT_TOKEN     = process.env.DISCORD_TOKEN || '';
const GUILD_ID      = process.env.GUILD_ID || '';

// ─── OTP store: { discordId -> { code, expiresAt, attempts } } ───────────────
const otpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS  = 5;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function storeCode(discordId, code) {
  otpStore.set(discordId, {
    code,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0
  });
}

function verifyCode(discordId, inputCode) {
  const entry = otpStore.get(discordId);
  if (!entry) return { ok: false, error: 'Aucun code en attente pour cet ID. Recommencez.' };
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(discordId);
    return { ok: false, error: 'Le code a expiré. Demandez-en un nouveau.' };
  }
  entry.attempts++;
  if (entry.attempts > MAX_ATTEMPTS) {
    otpStore.delete(discordId);
    return { ok: false, error: 'Trop de tentative(s). Demandez un nouveau code.' };
  }
  if (entry.code !== inputCode.trim()) {
    return { ok: false, error: `Code incorrect. ${MAX_ATTEMPTS - entry.attempts} tentative(s) restante(s).` };
  }
  otpStore.delete(discordId);
  return { ok: true };
}

// Cleanup expiations
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of otpStore.entries()) {
    if (now > entry.expiresAt) otpStore.delete(id);
  }
}, 10 * 60 * 1000);

// ─── Discord REST helpers ─────────────────────────────────────────────────────

function discordRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'discord.com',
      path: `/api/v10${endpoint}`,
      method,
      headers: {
        'Authorization': `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MedievalKingdomDashboard/1.0',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: null }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function isGuildMember(userId) {
  if (!BOT_TOKEN || !GUILD_ID) return false;
  try {
    const res = await discordRequest('GET', `/guilds/${GUILD_ID}/members/${userId}`);
    return res.status === 200;
  } catch { return false; }
}

async function sendDM(userId, message) {
  const dmRes = await discordRequest('POST', '/users/@me/channels', { recipient_id: userId });
  if (dmRes.status !== 200) throw new Error(`Impossible d'ouvrir le DM`);
  const channelId = dmRes.body.id;

  const msgRes = await discordRequest('POST', `/channels/${channelId}/messages`, { content: message });
  if (msgRes.status !== 200) throw new Error(`Impossible d'envoyer le message`);
  return true;
}

function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  return res.status(401).json({ error: 'Non authentifié' });
}

// ─── Auth routes ──────────────────────────────────────────────────────────────

// 1. Demande de code
app.post('/auth/request-code', async (req, res) => {
  const { discordId } = req.body;
  if (!discordId || !/^\d{15,20}$/.test(discordId.trim())) {
    return res.status(400).json({ error: 'ID Discord invalide.' });
  }

  const id = discordId.trim();
  const isMember = await isGuildMember(id);
  if (!isMember) {
    return res.status(403).json({ error: 'Cet ID Discord n\'est pas membre du serveur.' });
  }

  const targetPlayer = await getPlayer(id);
  if (!targetPlayer) {
    return res.status(404).json({ error: 'Aucun personnage trouvé pour cet ID.' });
  }

  const code = generateCode();
  try {
    await sendDM(id, [
      `🏰 **Medieval Kingdom — Connexion au tableau de bord**`,
      `Votre code de connexion est : ## \`${code}\``,
      `⏱️ Expire dans 5 minutes.`
    ].join('\n'));
  } catch (err) {
    return res.status(500).json({ error: 'Impossible d\'envoyer le DM.' });
  }

  storeCode(id, code);
  res.json({ success: true });
});

// 2. CORRECTIF AJOUTÉ : Route de vérification du code (Indispensable pour l'étape "Se Connecter")
app.post('/auth/verify-code', async (req, res) => {
  const { discordId, code } = req.body;

  if (!discordId || !code) {
    return res.status(400).json({ error: 'Identifiant ou code manquant.' });
  }

  const id = discordId.trim();
  const result = verifyCode(id, code);

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  // Récupérer le joueur pour injecter la session utilisateur
  const player = await getPlayer(id);
  req.session.user = {
    id: player.id,
    name: player.name,
    class: player.class
  };

  res.json({ success: true, user: req.session.user });
});

// 3. Déconnexion
app.post('/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ─── API endpoints protégés ───────────────────────────────────────────────────

app.get("/profil/:id", async (req, res) => {
  const player = await getPlayer(req.params.id); 
  res.json(player);
});

// 7. Démarrage du serveur Express
app.listen(PORT, () => {
    console.log(`Le serveur Express tourne sur le port ${PORT}`);
});
