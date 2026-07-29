const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../MedievalKingdom/MedievalKingdom/.env') });

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 5000;

const DB_PATH = path.join(__dirname, '../../MedievalKingdom/MedievalKingdom/database');
const ITEMS_PATH  = path.join(DB_PATH, 'items.json');
const QUESTS_PATH = path.join(DB_PATH, 'quests.json');
const PLAYERS_PATH = path.join(DB_PATH, 'players.json');

const { classes, factions, monsters } = require('../../MedievalKingdom/MedievalKingdom/systems/gameData.js');

const BOT_TOKEN     = process.env.DISCORD_TOKEN || '';
const GUILD_ID      = process.env.GUILD_ID || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'medieval-kingdom-secret-2024';

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
  // 1. Open DM channel
  const dmRes = await discordRequest('POST', '/users/@me/channels', { recipient_id: userId });
  if (dmRes.status !== 200) throw new Error(`Impossible d'ouvrir le DM (status ${dmRes.status})`);
  const channelId = dmRes.body.id;

  // 2. Send message
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

// ─── Data helpers ─────────────────────────────────────────────────────────────

function loadJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function loadPlayers() {
  return loadJSON(PLAYERS_PATH) || {};
}

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  return res.status(401).json({ error: 'Non authentifié' });
}

// ─── Auth routes ──────────────────────────────────────────────────────────────

// Step 1 — User submits their Discord ID, bot sends OTP
app.post('/auth/request-code', async (req, res) => {
  const { discordId } = req.body;

  if (!discordId || !/^\d{15,20}$/.test(discordId.trim())) {
    return res.status(400).json({ error: 'ID Discord invalide. Il doit contenir uniquement des chiffres (15-20 caractères).' });
  }

  const id = discordId.trim();

  // Rate-limit: don't spam codes
  const existing = otpStore.get(id);
  if (existing && Date.now() < existing.expiresAt - (OTP_EXPIRY_MS - 10000)) {
    const remaining = Math.ceil((existing.expiresAt - Date.now()) / 1000);
    return res.status(429).json({ error: `Un code a déjà été envoyé. Attendez ${remaining}s ou vérifiez vos DMs.` });
  }

  // Check guild membership
  const isMember = await isGuildMember(id);
  if (!isMember) {
    return res.status(403).json({ error: 'Cet ID Discord n\'est pas membre du serveur Medieval Kingdom.' });
  }

  // Check player exists
  const players = loadPlayers();
  if (!players[id]) {
    return res.status(404).json({ error: 'Aucun personnage trouvé pour cet ID. Créez-en un avec le bot Discord d\'abord.' });
  }

  // Generate and send code
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
  res.json({ success: true, message: 'Code envoyé ! Vérifiez vos messages privés Discord.' });
});

// Step 2 — User submits OTP code
app.post('/auth/verify-code', async (req, res) => {
  const { discordId, code } = req.body;

  if (!discordId || !code) {
    return res.status(400).json({ error: 'ID Discord et code requis.' });
  }

  const result = verifyCode(discordId.trim(), code.trim());
  if (!result.ok) {
    return res.status(401).json({ error: result.error });
  }

  // Build session user with real Discord data
  try {
    const member = await getGuildMember(discordId.trim());
    const discordUser = member?.user || {};
    let avatarUrl = buildAvatarUrl(discordUser.id || discordId, discordUser.avatar, 128)
                  || defaultAvatarUrl(discordId);
    if (member?.avatar) {
      avatarUrl = buildMemberAvatarUrl(GUILD_ID, discordId, member.avatar, 128);
    }

    const players = loadPlayers();
    const player = players[discordId.trim()];

    req.session.user = {
      id: discordId.trim(),
      username: discordUser.username || player?.name || discordId,
      displayName: member?.nick || discordUser.global_name || discordUser.username || player?.name || discordId,
      avatarUrl,
    };

    res.json({ success: true, user: req.session.user });
  } catch (err) {
    console.error('Session build error:', err);
    res.status(500).json({ error: 'Erreur interne. Réessayez.' });
  }
});

// Demo login (first player)
app.post('/auth/demo', (req, res) => {
  const players = loadPlayers();
  const firstId = Object.keys(players)[0];
  if (!firstId) return res.status(404).json({ error: 'Aucun joueur trouvé' });
  const player = players[firstId];
  req.session.user = { id: player.id, username: player.name, displayName: player.name, avatarUrl: null, demo: true };
  res.json({ success: true, user: req.session.user });
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// ─── API routes ───────────────────────────────────────────────────────────────

app.get('/api/me', (req, res) => {
  const user = req.session?.user || null;
  res.json({ user });
});

app.get('/api/player', requireAuth, (req, res) => {
  const user = req.session.user;
  const players = loadPlayers();
  const player = players[user.id];
  if (!player) return res.json({ player: null, isNew: true });

  const classData   = classes[player.class] || null;
  const factionData = player.faction ? factions[player.faction] || null : null;
  const itemsData   = loadJSON(ITEMS_PATH) || { items: {} };

  const inventoryDetails = {};
  if (player.inventory) {
    for (const [itemId, qty] of Object.entries(player.inventory)) {
      const itemInfo = itemsData.items[itemId] || { name: itemId, description: '', rarity: 'common', value: 0 };
      inventoryDetails[itemId] = { ...itemInfo, quantity: qty };
    }
  }

  res.json({
    player: {
      ...player,
      classData,
      factionData,
      inventoryDetails,
      discordAvatarUrl: user.avatarUrl || null,
      discordDisplayName: user.displayName || player.name
    }
  });
});

app.get('/api/leaderboard', async (req, res) => {
  const players = loadPlayers();
  const list = Object.values(players)
    .filter(p => p && p.name)
    .map(p => ({
      id: p.id, name: p.name, class: p.class,
      level: p.level || 1, experience: p.experience || 0, gold: p.gold || 0,
      reputation: p.reputation || 0, combatWins: p.combat?.wins || 0,
      combatLosses: p.combat?.losses || 0,
      questsCompleted: p.quests?.completed?.length || 0,
      avatarUrl: null, discordNick: null
    }))
    .sort((a, b) => (b.level - a.level) || (b.experience - a.experience));

  if (BOT_TOKEN && GUILD_ID) {
    await Promise.all(list.map(async (p) => {
      try {
        const member = await getGuildMember(p.id);
        if (member) {
          const u = member.user || {};
          p.avatarUrl = member.avatar
            ? buildMemberAvatarUrl(GUILD_ID, p.id, member.avatar, 64)
            : (u.avatar ? buildAvatarUrl(p.id, u.avatar, 64) : defaultAvatarUrl(p.id));
          p.discordNick = member.nick || u.global_name || u.username || null;
        }
      } catch { /* silent */ }
    }));
  }

  res.json({ leaderboard: list });
});

app.get('/api/gamedata', (req, res) => {
  const questsData = loadJSON(QUESTS_PATH) || { templates: [] };
  const itemsData  = loadJSON(ITEMS_PATH) || { items: {} };
  res.json({
    classes, factions, monsters,
    quests: questsData.templates || [],
    itemCount: Object.keys(itemsData.items || {}).length
  });
});

app.get('/api/stats', (req, res) => {
  const players = loadPlayers();
  const list = Object.values(players).filter(p => p && p.name);
  const totalGold   = list.reduce((s, p) => s + (p.gold || 0), 0);
  const totalWins   = list.reduce((s, p) => s + (p.combat?.wins || 0), 0);
  const totalQuests = list.reduce((s, p) => s + (p.quests?.completed?.length || 0), 0);
  const classCounts = {};
  list.forEach(p => { classCounts[p.class] = (classCounts[p.class] || 0) + 1; });
  res.json({ totalPlayers: list.length, totalGold, totalWins, totalQuests, classCounts });
});

// ─── Combat system ───────────────────────────────────────────────────────────

const combatSessions = new Map(); // playerId -> session

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

function generateMonster(playerLevel, monsterKey) {
  const monsterTemplates = Object.entries(monsters);
  let template;
  if (monsterKey && monsters[monsterKey]) {
    template = [monsterKey, monsters[monsterKey]];
  } else {
    const eligible = monsterTemplates.filter(([, m]) =>
      playerLevel >= m.levelRange[0] && playerLevel <= m.levelRange[1] + 2
    );
    const pool = eligible.length > 0 ? eligible : monsterTemplates;
    template = pool[Math.floor(Math.random() * pool.length)];
  }
  const [key, m] = template;
  const mult = 1 + (playerLevel - 1) * 0.1;
  return {
    key,
    name: m.name,
    emoji: m.emoji,
    maxHp: Math.floor(m.baseHealth * mult),
    hp: Math.floor(m.baseHealth * mult),
    stats: {
      attack: Math.floor(m.stats.attack * mult),
      defense: Math.floor(m.stats.defense * mult),
      magicAttack: Math.floor(m.stats.magicAttack * mult),
      magicDefense: Math.floor(m.stats.magicDefense * mult),
      speed: m.stats.speed,
    },
    abilities: m.abilities,
    loot: m.loot,
    levelRange: m.levelRange,
  };
}

function calcPhysicalDmg(atk, def) {
  const base = atk * rand(0.8, 1.2) - Math.floor(def / 2);
  const crit = Math.random() < 0.05;
  return { dmg: Math.max(1, Math.floor(crit ? base * 1.5 : base)), crit };
}
function calcMagicDmg(matk, mdef) {
  const base = matk * 1.5 * rand(0.8, 1.2) - Math.floor(mdef / 3);
  const crit = Math.random() < 0.05;
  return { dmg: Math.max(1, Math.floor(crit ? base * 1.5 : base)), crit };
}
function dodgeCheck(speed) { return Math.random() < Math.min(0.4, speed * 0.01); }

function monsterAI(session) {
  const { monster, player } = session;
  const roll = Math.random();
  // Monster uses magic if it has magicAttack, otherwise physical
  const usesMagic = monster.stats.magicAttack > 4 && roll < 0.35;
  if (usesMagic) {
    if (player.defending) {
      player.defending = false;
      return { type: 'blocked', msg: `${monster.emoji} ${monster.name} lance un sort… mais votre bouclier absorbe tout !`, dmg: 0 };
    }
    const { dmg, crit } = calcMagicDmg(monster.stats.magicAttack, player.stats.magicDefense);
    player.hp = Math.max(0, player.hp - dmg);
    return { type: 'magic', msg: `${monster.emoji} ${monster.name} lance un sort${crit ? ' critique' : ''} — ${dmg} dégâts magiques !`, dmg, crit };
  } else {
    if (dodgeCheck(player.stats.speed)) {
      return { type: 'dodge', msg: `${monster.emoji} ${monster.name} attaque, mais vous esquivez !`, dmg: 0 };
    }
    if (player.defending) {
      player.defending = false;
      return { type: 'blocked', msg: `${monster.emoji} ${monster.name} attaque… votre défense tient !`, dmg: 0 };
    }
    const { dmg, crit } = calcPhysicalDmg(monster.stats.attack, player.stats.defense);
    player.hp = Math.max(0, player.hp - dmg);
    return { type: 'attack', msg: `${monster.emoji} ${monster.name} vous frappe${crit ? ' (CRITIQUE)' : ''} — ${dmg} dégâts !`, dmg, crit };
  }
}

function buildCombatSession(playerData, playerLevel, classData, monster) {
  const levelBonus = (playerLevel - 1);
  const maxHp = playerData.maxHealth || ((classData?.baseHealth || 100) + levelBonus * 10);
  const maxMana = playerData.maxMana || ((classData?.baseMana || 50) + levelBonus * 5);
  return {
    player: {
      name: playerData.name,
      class: playerData.class,
      level: playerLevel,
      hp: maxHp,
      maxHp,
      mana: maxMana,
      maxMana,
      stats: playerData.stats || classData?.baseStats || { attack:10, defense:8, magicAttack:8, magicDefense:6, speed:10 },
      defending: false,
      defenseUsed: 0,
    },
    monster,
    turn: 1,
    maxTurns: 20,
    log: [{ type: 'system', msg: `⚔️ Combat engagé contre ${monster.emoji} ${monster.name} !` }],
    status: 'active',
    rewards: null,
  };
}

// Start / restart combat
app.post('/api/combat/start', requireAuth, (req, res) => {
  const { monsterKey } = req.body;
  const userId = req.session.user.id;
  const players = loadPlayers();
  const playerData = players[userId];
  if (!playerData) return res.status(404).json({ error: 'Personnage introuvable.' });

  const classData = classes[playerData.class] || null;
  const monster = generateMonster(playerData.level || 1, monsterKey || null);
  const session = buildCombatSession(playerData, playerData.level || 1, classData, monster);
  combatSessions.set(userId, session);
  res.json({ session });
});

// Get current session
app.get('/api/combat/state', requireAuth, (req, res) => {
  const session = combatSessions.get(req.session.user.id);
  if (!session) return res.json({ session: null });
  res.json({ session });
});

// Process player action
app.post('/api/combat/action', requireAuth, (req, res) => {
  const { action } = req.body; // 'attack' | 'spell' | 'defend' | 'item'
  const userId = req.session.user.id;
  const session = combatSessions.get(userId);
  if (!session || session.status !== 'active') return res.status(400).json({ error: 'Pas de combat actif.' });

  const { player, monster } = session;
  const newLog = [];

  // ── Player action ──
  if (action === 'attack') {
    if (dodgeCheck(monster.stats.speed)) {
      newLog.push({ type: 'miss', msg: `Votre attaque rate — ${monster.emoji} ${monster.name} esquive !` });
    } else {
      const { dmg, crit } = calcPhysicalDmg(player.stats.attack, monster.stats.defense);
      monster.hp = Math.max(0, monster.hp - dmg);
      newLog.push({ type: 'player-attack', msg: `⚔️ Vous frappez${crit ? ' (CRITIQUE !)' : ''} — ${dmg} dégâts physiques !`, dmg, crit });
    }
  } else if (action === 'spell') {
    if (player.mana < 10) {
      return res.status(400).json({ error: 'Pas assez de mana (10 requis).' });
    }
    player.mana -= 10;
    if (dodgeCheck(monster.stats.speed)) {
      newLog.push({ type: 'miss', msg: `Votre sort rate — ${monster.emoji} ${monster.name} esquive !` });
    } else {
      const { dmg, crit } = calcMagicDmg(player.stats.magicAttack, monster.stats.magicDefense);
      monster.hp = Math.max(0, monster.hp - dmg);
      const statusRoll = Math.random();
      let statusMsg = '';
      if (statusRoll < 0.08) { statusMsg = ' 🔥 Brûlure !'; monster.hp = Math.max(0, monster.hp - 3); }
      else if (statusRoll < 0.14) { statusMsg = ' ❄️ Gel !'; }
      newLog.push({ type: 'player-spell', msg: `🔮 Sort${crit ? ' critique !' : ''} — ${dmg} dégâts magiques !${statusMsg}`, dmg, crit });
    }
  } else if (action === 'defend') {
    if (player.defenseUsed >= 3) {
      return res.status(400).json({ error: 'Défense utilisée 3 fois maximum par combat.' });
    }
    player.defending = true;
    player.defenseUsed++;
    newLog.push({ type: 'player-defend', msg: `🛡️ Vous vous mettez en position défensive. Prochaine attaque bloquée !` });
  } else if (action === 'item') {
    const healAmt = Math.floor(player.maxHp * 0.25);
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
    player.mana = Math.min(player.maxMana, player.mana + 15);
    newLog.push({ type: 'player-item', msg: `🧪 Vous buvez une potion — +${healAmt} PV, +15 mana !`, heal: healAmt });
  }

  // ── Check monster death ──
  if (monster.hp <= 0) {
    const goldReward = randInt(monster.loot.gold[0], monster.loot.gold[1]);
    const xpReward   = randInt(monster.loot.experience[0], monster.loot.experience[1]);
    session.rewards = { gold: goldReward, xp: xpReward };
    session.status = 'victory';
    newLog.push({ type: 'system', msg: `🏆 Victoire ! ${monster.emoji} ${monster.name} est vaincu !` });
    newLog.push({ type: 'reward', msg: `💰 +${goldReward} or  |  ✨ +${xpReward} expérience` });

    // Save to players.json
    const players = loadPlayers();
    const pd = players[userId];
    if (pd) {
      pd.gold = (pd.gold || 0) + goldReward;
      pd.experience = (pd.experience || 0) + xpReward;
      if (!pd.combat) pd.combat = { wins: 0, losses: 0 };
      pd.combat.wins = (pd.combat.wins || 0) + 1;
      // ── Progression de quête active ──────────────────────────────────
      if (pd.quests && pd.quests.active) {
        const quest = pd.quests.active;
        const defeatedMonsterKey = session?.monster?.key || null;
        if (quest.objectiveProgress) {
          for (const obj of quest.objectiveProgress) {
            if (obj.current >= obj.required) continue;
            let matches = false;
            if (obj.type === 'kill_monster') {
              matches = defeatedMonsterKey && obj.monsterKey === defeatedMonsterKey;
            } else if (obj.type === 'win_pve') {
              matches = true;
            } else if (obj.type === 'win_combats') {
              matches = true;
            }
            if (matches) obj.current = Math.min(obj.current + 1, obj.required);
          }
        }
      }
      // ─────────────────────────────────────────────────────────────────
      // Level up check (100 * level XP per level)
      let leveled = false;
      while (pd.experience >= pd.level * 100) {
        pd.experience -= pd.level * 100;
        pd.level = (pd.level || 1) + 1;
        pd.maxHealth = (pd.maxHealth || 100) + 10;
        pd.maxMana   = (pd.maxMana || 50) + 5;
        leveled = true;
      }
      if (leveled) newLog.push({ type: 'levelup', msg: `🌟 Niveau ${pd.level} atteint !` });
      try { fs.writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2)); } catch {}
    }
    session.log.push(...newLog);
    return res.json({ session });
  }

  // ── Monster turn ──
  const monsterResult = monsterAI(session);
  newLog.push({ type: monsterResult.type, msg: monsterResult.msg, dmg: monsterResult.dmg });

  // ── Check player death ──
  if (player.hp <= 0) {
    session.status = 'defeat';
    newLog.push({ type: 'system', msg: `💀 Vous avez été vaincu par ${monster.emoji} ${monster.name}...` });
    const players = loadPlayers();
    const pd = players[userId];
    if (pd) {
      if (!pd.combat) pd.combat = { wins: 0, losses: 0 };
      pd.combat.losses = (pd.combat.losses || 0) + 1;
      try { fs.writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2)); } catch {}
    }
  }

  // ── Turn limit ──
  session.turn++;
  if (session.status === 'active' && session.turn > session.maxTurns) {
    if (player.hp > monster.hp) {
      const goldReward = randInt(monster.loot.gold[0], monster.loot.gold[1]);
      const xpReward   = Math.floor(randInt(monster.loot.experience[0], monster.loot.experience[1]) * 0.5);
      session.rewards = { gold: goldReward, xp: xpReward };
      session.status = 'victory';
      newLog.push({ type: 'system', msg: `⏱️ Limite de tours atteinte — vous avez plus de PV, victoire !` });
    } else {
      session.status = 'defeat';
      newLog.push({ type: 'system', msg: `⏱️ Limite de tours atteinte — vous êtes épuisé, défaite.` });
    }
  }

  session.log.push(...newLog);
  res.json({ session });
});

// Flee combat
app.delete('/api/combat/flee', requireAuth, (req, res) => {
  const session = combatSessions.get(req.session.user.id);
  if (session) {
    session.status = 'fled';
    session.log.push({ type: 'system', msg: '🏃 Vous fuyez le combat !' });
  }
  res.json({ success: true });
});

// ─── Shop system ─────────────────────────────────────────────────────────────

const DAILY_SHOP_PATH = path.join(DB_PATH, 'dailyShop.json');
const { getDailyShop } = require('../../MedievalKingdom/MedievalKingdom/utils/dailyShop.js');

app.get('/api/shop', requireAuth, (req, res) => {
  try {
    const shop = getDailyShop();
    res.json({ shop });
  } catch (err) {
    console.error('Shop error:', err);
    res.status(500).json({ error: 'Impossible de charger la boutique.' });
  }
});

app.post('/api/shop/buy', requireAuth, (req, res) => {
  const { itemId } = req.body;
  if (!itemId) return res.status(400).json({ error: 'Item requis.' });

  const shop = getDailyShop();
  const item = shop.items.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: 'Cet item n\'est pas disponible aujourd\'hui.' });

  const players = loadPlayers();
  const userId = req.session.user.id;
  const player = players[userId];
  if (!player) return res.status(404).json({ error: 'Personnage introuvable.' });

  const gems = player.gemmes || 0;
  if (gems < item.price) {
    return res.status(400).json({ error: `Gemmes insuffisantes. Vous avez ${gems} 💎, il faut ${item.price} 💎.` });
  }

  player.gemmes = gems - item.price;

  // Handle special items
  if (item.id === 'coffre_tresor') {
    const bonus = Math.floor(Math.random() * 151) + 50; // 50–200 gems
    player.gemmes += bonus;
    try { fs.writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2)); } catch {}
    return res.json({ success: true, message: `Coffre ouvert ! Vous avez trouvé ${bonus} 💎 !`, player: { gemmes: player.gemmes } });
  }
  if (item.id === 'pack_potions') {
    if (!player.inventory || typeof player.inventory !== 'object') player.inventory = {};
    player.inventory['potion_soin'] = (player.inventory['potion_soin'] || 0) + 3;
    player.inventory['potion_mana'] = (player.inventory['potion_mana'] || 0) + 2;
    try { fs.writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2)); } catch {}
    return res.json({ success: true, message: 'Pack acheté ! +3 potions de soin, +2 potions de mana ajoutées à l\'inventaire.', player: { gemmes: player.gemmes } });
  }

  // Handle by type
  if (item.type === 'titre') {
    if (!player.titres) player.titres = [];
    if (!player.titres.includes(item.id)) player.titres.push(item.id);
  } else if (item.type === 'familier') {
    if (!player.familiers) player.familiers = [];
    if (!player.familiers.includes(item.id)) player.familiers.push(item.id);
  } else {
    // objet / arme / armure
    if (!player.inventory || typeof player.inventory !== 'object') player.inventory = {};
    if (Array.isArray(player.inventory)) {
      const inv = {};
      player.inventory.forEach(id => { inv[id] = (inv[id] || 0) + 1; });
      player.inventory = inv;
    }
    player.inventory[item.id] = (player.inventory[item.id] || 0) + 1;
  }

  try { fs.writeFileSync(PLAYERS_PATH, JSON.stringify(players, null, 2)); } catch {}
  res.json({ success: true, message: `${item.name} acheté avec succès !`, player: { gemmes: player.gemmes } });
});

// ─── Serve React build ────────────────────────────────────────────────────────

const clientBuild = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏰 Medieval Kingdom Dashboard running on port ${PORT}`);
  console.log(`Guild check: ${BOT_TOKEN && GUILD_ID ? `enabled (guild ${GUILD_ID})` : 'disabled'}`);
  console.log(`OTP auth: enabled`);
});
