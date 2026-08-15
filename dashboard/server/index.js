const path = require('path');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const fs = require('fs');
const https = require('https');

// Initialisation des variables d'environnement
require('dotenv').config({ path: path.join(__dirname, '../../MedievalKingdom/MedievalKingdom/.env') });

const app = express();

// RENDER UTILISE PORT (10000), ON S'ASSURE QU'IL PREND LE BON
const PORT = process.env.PORT || process.env.DASHBOARD_PORT || 5000;

// CONFIGURATION DES DOSSIERS STATIQUES ET DE L'ACCUEIL (PLANS ABSOLUS)
const clientPath = path.join(process.cwd(), 'dashboard', 'client');
app.use(express.static(clientPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
});

// REST DU CODE DE BASE (Configuration Middleware)
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'medieval-kingdom-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// CONFIGURATION DES CHEMINS DE LA BASE DE DONNÉES
const DB_PATH = path.join(__dirname, '../../MedievalKingdom/MedievalKingdom/database');
const ITEMS_PATH  = path.join(DB_PATH, 'items.json');
const QUESTS_PATH = path.join(DB_PATH, 'quests.json');
const PLAYERS_PATH = path.join(DB_PATH, 'players.json');

const { classes, factions, monsters } = require('../../MedievalKingdom/MedievalKingdom/systems/gameData.js');

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
    return { ok: false, error: 'Trop de tentatives. Demandez un nouveau code.' };
  }
  if (entry.code !== inputCode.trim()) {
    return { ok: false, error: `Code incorrect. ${MAX_ATTEMPTS - entry.attempts} tentative(s) restante(s).` };
  }
  otpStore.delete(discordId);
  return { ok: true };
}

// Cleanup expired codes every 10 minutes
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

async function getGuildMember(userId) {
  if (!BOT_TOKEN || !GUILD_ID) return null;
  try {
    const res = await discordRequest('GET', `/guilds/${GUILD_ID}/members/${userId}`);
    return res.status === 200 ? res.body : null;
  } catch { return null; }
}

async function sendDM(userId, message) {
  const dmRes = await discordRequest('POST', '/users/@me/channels', { recipient_id: userId });
  if (dmRes.status !== 200) throw new Error(`Impossible d'ouvrir le DM (status ${dmRes.status})`);
  const channelId = dmRes.body.id;

  const msgRes = await discordRequest('POST', `/channels/${channelId}/messages`, { content: message });
  if (msgRes.status !== 200) throw new Error(`Impossible d'envoyer le message (status ${msgRes.status})`);
  return true;
}

function buildAvatarUrl(userId, avatarHash, size = 128) {
  if (!avatarHash) return null;
  const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=${size}`;
}

function buildMemberAvatarUrl(guildId, userId, avatarHash, size = 128) {
  if (!avatarHash) return null;
  const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${avatarHash}.${ext}?size=${size}`;
}

function defaultAvatarUrl(userId) {
  try {
    const index = (BigInt(userId) >> 22n) % 6n;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch { return 'https://cdn.discordapp.com/embed/avatars/0.png'; }
}

function loadJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function loadPlayers() {
  return loadJSON(PLAYERS_PATH) || {};
}

function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  return res.status(401).json({ error: 'Non authentifié' });
}

// ─── Auth routes ──────────────────────────────────────────────────────────────

app.post('/auth/request-code', async (req, res) => {
  const { discordId } = req.body;

  if (!discordId || !/^\d{15,20}$/.test(discordId.trim())) {
    return res.status(400).json({ error: 'ID Discord invalide. Il doit contenir uniquement des chiffres (15-20 caractères).' });
  }

  const id = discordId.trim();

  const existing = otpStore.get(id);
  if (existing && Date.now() < existing.expiresAt - (OTP_EXPIRY_MS - 10000)) {
    const remaining = Math.ceil((existing.expiresAt - Date.now()) / 1000);
    return res.status(429).json({ error: `Un code a déjà été envoyé. Attendez ${remaining}s ou vérifiez vos DMs.` });
  }

  const isMember = await isGuildMember(id);
  if (!isMember) {
    return res.status(403).json({ error: 'Cet ID Discord n\'est pas membre du serveur Medieval Kingdom.' });
  }

  const players = loadPlayers();
  if (!players[id]) {
    return res.status(404).json({ error: 'Aucun personnage trouvé pour cet ID. Créez-en un avec le bot Discord d\'abord.' });
  }

  const code = generateCode();
  try {
    await sendDM(id, [
      `🏰 **Medieval Kingdom — Connexion au tableau de bord**`,
      ``,
      `Votre code de connexion est :`,
      `## \`${code}\``,
      ``,
      `⏱️ Ce code expire dans **5 minutes** et n'est valable qu'une seule fois.`,
      `🚫 Si vous n'avez pas demandé ce code, ignorez ce message.`
    ].join('\n'));
  } catch (err) {
    console.error('DM error:', err.message);
    return res.status(500).json({ error: 'Impossible d\'envoyer le DM. Vérifiez que vos messages privés sont ouverts sur le serveur.' });
  }

  storeCode(id, code);
  console.log(`Code envoyé à ${id} (joueur: ${players[id].name})`);
  res.json({ success: true });
});

// ÉCOUTE SUR LE PORT DE RENDER
app.listen(PORT, () => {
    console.log(`Le serveur Express tourne sur le port ${PORT}`);
});
