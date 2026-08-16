const path = require('path');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const fs = require('fs');
const https = require('https');

// 1. Initialisation des variables d'environnement
require('dotenv').config({ path: path.join(__dirname, '../../MedievalKingdom/MedievalKingdom/.env') });

const mongoose = require('mongoose');
if (mongoose.connection.readyState === 0) {
  mongoose.connect(process.env.MONGO_URI).catch(err => console.error('Erreur de connexion initiale Mongoose:', err));
}
// Force Mongoose à afficher toutes les requêtes de base de données dans la console Render
mongoose.set('debug', true); 

// Écoute les erreurs de connexion à chaud
mongoose.connection.on('error', err => {
  console.error('❌ ERREUR DIRECTE MONGODB :', err);
});

mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose est bien connecté à la base de données !');
});

const app = express();
app.set('trust proxy', 1);

// 2. Définition du port réseau
const PORT = process.env.PORT || process.env.DASHBOARD_PORT || 5000;

// 3. Middlewares globaux
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const isProd = process.env.NODE_ENV === 'production';
app.use(session({
  secret: process.env.SESSION_SECRET || 'medieval-kingdom-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: isProd, httpOnly: true, sameSite: isProd ? 'none' : 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// 4. CONFIGURATION SÉCURISÉE DU FRONT-END
const clientBuildPath = path.join(__dirname, '../client/dist');

// On n'active l'envoi des fichiers statiques que si le dossier compilé existe réellement
if (fs.existsSync(clientBuildPath) && fs.existsSync(path.join(clientBuildPath, 'index.html'))) {
  app.use(express.static(clientBuildPath));
  app.get('/', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  // Si React est introuvable, on génère une interface HTML propre pour la connexion
  app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Medieval Kingdom - Connexion de secours</title>
  <style>
    body { background-color: #1a1a1a; color: #f3f3f3; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
    .card { background: #2a2a2a; padding: 30px; border-radius: 10px; border: 2px solid #ffd700; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.5); width: 350px; }
    h1 { color: #ffd700; margin-bottom: 20px; font-size: 24px; }
    input { width: 100%; padding: 10px; margin: 10px 0; border-radius: 5px; border: 1px solid #555; background: #333; color: #fff; box-sizing: border-box; text-align: center; font-size: 16px; }
    button { background: linear-gradient(135deg, #ffd700, #b8860b); color: #000; border: none; padding: 12px; width: 100%; border-radius: 5px; font-weight: bold; cursor: pointer; font-size: 16px; }
    button:hover { transform: scale(1.02); }
    .error { color: #ff4d4d; margin-top: 15px; display: none; font-size: 14px; }
    .success { color: #4dff4d; margin-top: 15px; display: none; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🏰 MEDIEVAL KINGDOM</h1>
    <p>Entrez votre ID Discord pour recevoir votre code d'accès :</p>
    <input type="text" id="discordId" placeholder="Ex: 885871979612241930">
    <button onclick="requestCode()">Demander un code</button>

    <div id="otpSection" style="display:none; margin-top: 20px; border-top: 1px solid #444; padding-top: 20px;">
      <p>Entrez le code reçu par DM :</p>
      <input type="text" id="otpCode" placeholder="Code à 6 chiffres">
      <button onclick="verifyCode()">Se connecter</button>
    </div>

    <div id="errorMsg" class="error"></div>
    <div id="successMsg" class="success"></div>
  </div>

  <script>
    async function requestCode() {
      const id = document.getElementById('discordId').value;
      const errorDiv = document.getElementById('errorMsg');
      const successDiv = document.getElementById('successMsg');
      errorDiv.style.display = 'none';
      successDiv.style.display = 'none';

      try {
        const res = await fetch('/auth/request-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ discordId: id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur serveur');

        successDiv.innerText = 'Code envoyé par DM ! Checkez vos messages privés.';
        successDiv.style.display = 'block';
        document.getElementById('otpSection').style.display = 'block';
      } catch(e) {
        errorDiv.innerText = e.message;
        errorDiv.style.display = 'block';
      }
    }

    async function verifyCode() {
      const id = document.getElementById('discordId').value;
      const code = document.getElementById('otpCode').value;
      const errorDiv = document.getElementById('errorMsg');
      errorDiv.style.display = 'none';

      try {
        const res = await fetch('/auth/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ discordId: id, code: code })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Code invalide');

        // Redirection vers le profil si connecté
        window.location.href = '/profil/' + id;
      } catch(e) {
        errorDiv.innerText = e.message;
        errorDiv.style.display = 'block';
      }
    }
  </script>
</body>
</html>`);
  });
}

// 5. Configuration des données de jeu et base de données
const { classes, factions, monsters } = require('../../MedievalKingdom/MedievalKingdom/systems/gameData.js');
const { getPlayer, loadPlayers, getAllPlayers, getDatabaseStats } = require('../../MedievalKingdom/MedievalKingdom/utils/database.js');

const BOT_TOKEN = process.env.DISCORD_TOKEN || '';
const GUILD_ID = process.env.GUILD_ID || '';

// ─── OTP store: { discordId -> { code, expiresAt, attempts } } ───────────────
const otpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

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

function verifyCodeEntry(discordId, inputCode) {
  const entry = otpStore.get(discordId);
  if (!entry) return { ok: false, error: "Aucun code en attente pour cet ID. Recommencez." };
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(discordId);
    return { ok: false, error: "Le code a expiré. Demandez-en un nouveau." };
  }
  entry.attempts++;
  if (entry.attempts > MAX_ATTEMPTS) {
    otpStore.delete(discordId);
    return { ok: false, error: "Trop de tentative(s). Demandez un nouveau code." };
  }
  if (entry.code !== String(inputCode).trim()) {
    return { ok: false, error: `Code incorrect. ${MAX_ATTEMPTS - entry.attempts} tentative(s) restante(s).` };
  }
  otpStore.delete(discordId);
  return { ok: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of otpStore.entries()) {
    if (now > entry.expiresAt) otpStore.delete(id);
  }
}, 10 * 60 * 1000);

// ─── Discord REST helpers ─────────────────────────────────────────────────────

function discordRequest(method, endpoint, body = null, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'discord.com',
      path: `/api/v10${endpoint}`,
      method,
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MedievalKingdomDashboard/1.0',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
        catch (e) { resolve({ status: res.statusCode, body: null }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Discord request timeout'));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function isGuildMember(userId) {
  if (!BOT_TOKEN || !GUILD_ID) return false;
  try {
    const res = await discordRequest('GET', `/guilds/${GUILD_ID}/members/${userId}`);
    return res.status === 200;
  } catch (err) {
    console.error('isGuildMember error', err);
    return false;
  }
}

async function sendDM(userId, message) {
  // create DM channel
  const dmRes = await discordRequest('POST', '/users/@me/channels', { recipient_id: userId });
  if (!(dmRes.status === 200 || dmRes.status === 201) || !dmRes.body || !dmRes.body.id) {
    throw new Error('Impossible d\'ouvrir le DM');
  }
  const channelId = dmRes.body.id;

  const msgRes = await discordRequest('POST', `/channels/${channelId}/messages`, { content: message });
  if (!(msgRes.status === 200 || msgRes.status === 201)) throw new Error('Impossible d\'envoyer le message');
  return true;
}

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'Non authentifié' });
}

// ─── Auth routes ─────────────────────────────────────────────────────────────

app.post('/auth/request-code', async (req, res) => {
  try {
    const { discordId } = req.body || {};
    if (!discordId || !/^\d{15,20}$/.test(String(discordId).trim())) {
      return res.status(400).json({ error: 'ID Discord invalide.' });
    }

    const id = String(discordId).trim();
    const isMember = await isGuildMember(id);
    if (!isMember) {
      return res.status(403).json({ error: "Cet ID Discord n'est pas membre du serveur." });
    }

    const targetPlayer = await getPlayer(id);
    if (!targetPlayer) {
      return res.status(404).json({ error: 'Aucun personnage trouvé pour cet ID.' });
    }

    const code = generateCode();
    storeCode(id, code);

    // Envoi du code en DM
    try {
      await sendDM(id, `Votre code de connexion Medieval Kingdom : ${code} (valable ${Math.floor(OTP_EXPIRY_MS / 60000)} min)`);
      return res.json({ ok: true, message: 'Code envoyé' });
    } catch (err) {
      console.error('sendDM error', err);
      // supprimer le code si on n'a pas pu envoyer le DM
      otpStore.delete(id);
      return res.status(500).json({ error: "Impossible d'envoyer le DM. Vérifiez le bot ou l'ID." });
    }
  } catch (err) {
    console.error('/auth/request-code', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

app.post('/auth/verify-code', async (req, res) => {
  try {
    const { discordId, code } = req.body || {};
    if (!discordId || !code) return res.status(400).json({ error: 'Paramètres manquants.' });

    const result = verifyCodeEntry(String(discordId).trim(), String(code).trim());
    if (!result.ok) return res.status(400).json({ error: result.error });

    // Récupérer le joueur pour attacher la session
    const player = await getPlayer(String(discordId).trim());
    if (!player) return res.status(404).json({ error: 'Aucun personnage trouvé pour cet ID.' });

    // Stocker les infos essentielles en session
    req.session.user = { discordId: String(discordId).trim(), playerId: player._id };
    return res.json({ ok: true });
  } catch (err) {
    console.error('/auth/verify-code', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// Exemple de route protégée
app.get('/profil/:discordId', requireAuth, async (req, res) => {
  const { discordId } = req.params;
  try {
    const player = await getPlayer(discordId);
    if (!player) return res.status(404).send('Profil introuvable');
    return res.json({ player });
  } catch (err) {
    console.error('/profil', err);
    return res.status(500).send('Erreur interne');
  }
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Dashboard server listening on port ${PORT}`);
});
