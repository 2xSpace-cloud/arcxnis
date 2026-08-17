const path = require('path');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const fs = require('fs');
const https = require('https');
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.login(process.env.DISCORD_TOKEN);

// 1. Initialisation des variables d'environnement
require('dotenv').config({ path: path.join(__dirname, '../../MedievalKingdom/MedievalKingdom/.env') });

const mongoose = require('mongoose');

// CORRECTION : On refuse de bloquer les requêtes indéfiniment si MongoDB rame
mongoose.set('bufferCommands', false);

// Active les logs pour voir les requêtes Mongoose en direct dans Render
mongoose.set('debug', true);

if (mongoose.connection.readyState === 0) {
  console.log("🔄 Initialisation de la connexion à MongoDB Atlas...");
  
  mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000, // Abandonne après 5 secondes si la base de données ne répond pas
  })
  .then(() => console.log('✅ Connexion physique à MongoDB réussie !'))
  .catch(err => {
    console.error('❌ ERREUR CRITIQUE DE CONNEXION MONGOOSE:', err);
  });
}

// Écoute les erreurs de connexion à chaud
mongoose.connection.on('error', err => {
  console.error('❌ ERREUR DIRECTE MONGODB :', err);
});

mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose est bien connecté à la base de données !');
});

const app = express();
app.use((req, res, next) => {
  console.log(`[Requête reçue] ${req.method} ${req.url}`);
  next(); // Très important, cela permet de passer à la suite !
});

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
// Dans dashboard/server/index.js (Ligne ~65)
const BOT_TOKEN = process.env.DISCORD_TOKEN || '';
const GUILD_ID = process.env.GUILD_ID || '';

// (Ajustez le nom du fichier s'il s'appelle bot.js ou main.js)

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


// =========================================================================
// 🔓 ROUTES D'AUTHENTIFICATION OTP (À AJOUTER)
// =========================================================================

/**
 * Route 1 : Demande de génération et d'envoi du code OTP
 */
app.post('/auth/request-code', async (req, res) => {
  try {
    const { discordId } = req.body;
    
    if (!discordId) {
      return res.status(400).json({ error: "L'identifiant Discord est obligatoire." });
    }

    // 1. Vérification si le joueur existe dans votre base de données MongoDB
    const playerExists = await getPlayer(discordId);
    if (!playerExists) {
      return res.status(404).json({ error: "Ce compte Discord n'est pas enregistré dans le jeu Medieval Kingdom." });
    }

    // 2. Génération du code à 6 chiffres
    const code = generateCode();
    storeCode(discordId, code);
    
    console.log(`[OTP] Code généré pour ${discordId} : ${code}`);

    // NOTIFICATION IMPORTANTE : 
    // Ici, vous devrez intégrer l'envoi du message privé via votre bot Discord !
    // Exemple temporaire : simulation de succès ou log console.
    
    return res.json({ success: true, message: "Code généré avec succès." });

  } catch (error) {
    console.error("Erreur dans /auth/request-code :", error);
    return res.status(500).json({ error: "Une erreur interne est survenue sur le serveur." });
  }
});

/**
 * Route 2 : Vérification du code saisi par l'utilisateur
 */
app.post('/auth/verify-code', async (req, res) => {
  try {
    const { discordId, code } = req.body;

    if (!discordId || !code) {
      return res.status(400).json({ error: "L'ID Discord et le code sont obligatoires." });
    }

    // Validation du jeton OTP
    const verification = verifyCodeEntry(discordId, code);
    
    if (!verification.ok) {
      return res.status(400).json({ error: verification.error });
    }

    // Connexion réussie : Initialisation de la session utilisateur
    req.session.userId = discordId;
    
    return res.json({ success: true, redirectUrl: `/profil/${discordId}` });

  } catch (error) {
    console.error("Erreur dans /auth/verify-code :", error);
    return res.status(500).json({ error: "Une erreur interne est survenue." });
  }
});

/**
 * Route Optionnelle : Vérification de session (/api/me)
 * Évite les erreurs sur le front-end lors du chargement initial
 */
app.get('/api/me', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({ loggedIn: true, userId: req.session.userId });
  }
  return res.status(401).json({ loggedIn: false, error: "Non authentifié" });
});


// CORRECTION : Boucle de nettoyage complétée proprement
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of otpStore.entries()) {
    if (now > entry.expiresAt) {
      otpStore.delete(id);
    }
  }
}, 60000);

// AJOUT : Démarrage indispensable du serveur Express
app.listen(PORT, () => {
  console.log(`🚀 Le serveur du Dashboard écoute sur le port ${PORT}`);
});

// Libère proprement les ports en cas de signal de fermeture de Render
process.on('SIGTERM', () => {
  console.log('⚠️ Signal SIGTERM reçu. Fermeture propre du serveur...');
  process.exit(0);
});
