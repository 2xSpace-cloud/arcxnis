const mongoose = require("mongoose");

// Connexion à MongoDB Atlas (via la variable d'environnement sur Render)
if (mongoose.connection.readyState === 0) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Connecté à MongoDB Atlas avec succès !"))
    .catch(err => console.error("Erreur de connexion MongoDB :", err));
}

console.log("Tentative de connexion à MongoDB...");

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connecté avec succès à MongoDB !"))
  .catch(err => console.error("❌ Erreur de connexion MongoDB :", err));
// Force Mongoose à afficher toutes les requêtes de base de données dans la console Render
mongoose.set('debug', true); 

// Écoute les erreurs de connexion à chaud
mongoose.connection.on('error', err => {
  console.error('❌ ERREUR DIRECTE MONGODB :', err);
});

mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose est bien connecté à la base de données !');
});


// Schéma pour stocker l'intégralité de vos joueurs dans un seul document JSON (comme votre fichier actuel)
const DatabaseSchema = new mongoose.Schema({
  key: { type: String, default: "players_backup" },
  data: { type: Object, default: {} }
}, { timestamps: true });

const DatabaseModel = mongoose.model("Database", DatabaseSchema);

/**
 * Charge les données des joueurs depuis MongoDB Atlas
 */
async function loadPlayers() {
  try {
    let doc = await DatabaseModel.findOne({ key: "players_backup" });
    if (!doc) {
      // Si la base est vide, on initialise un objet vide
      doc = await DatabaseModel.create({ key: "players_backup", data: {} });
    }
    return doc.data || {};
  } catch (error) {
    console.error("Erreur lors du chargement des données depuis MongoDB:", error);
    return {};
  }
}

/**
 * Sauvegarde les données des joueurs dans MongoDB Atlas
 */
async function savePlayersData(players) {
  try {
    await DatabaseModel.updateOne(
      { key: "players_backup" },
      { $set: { data: players } },
      { upsert: true }
    );
    console.log("Données des joueurs sauvegardées sur MongoDB Atlas.");
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des données sur MongoDB:", error);
  }
}

/**
 * Récupère un joueur par son ID Discord
 */
async function getPlayer(userId) {
  const players = await loadPlayers();
  return players[userId] || null;
}

/**
 * Met à jour ou crée un joueur
 */
async function updatePlayer(userId, playerData) {
  const players = await loadPlayers();

  playerData.lastActive = new Date().toISOString();

  const existing = players[userId] || {};
  const merged = { ...existing, ...playerData };

  players[userId] = merged;
  await savePlayersData(players);

  console.log(`Joueur ${merged.name || userId} (${userId}) mis à jour`);
}

/**
 * Supprime un joueur de la base de données
 */
async function deletePlayer(userId) {
  const players = await loadPlayers();

  if (players[userId]) {
    const playerName = players[userId].name;
    delete players[userId];
    await savePlayersData(players);
    console.log(`Joueur ${playerName} (${userId}) supprimé`);
    return true;
  }

  return false;
}

/**
 * Récupère tous les joueurs
 */
async function getAllPlayers() {
  const players = await loadPlayers();
  return Object.values(players).filter((player) => player.active !== false);
}

/**
 * Récupère les joueurs par faction
 */
async function getPlayersByFaction(factionName) {
  const players = await loadPlayers();
  return Object.values(players).filter((player) => player.faction === factionName);
}

/**
 * Récupère les joueurs par classe
 */
async function getPlayersByClass(className) {
  const players = await loadPlayers();
  return Object.values(players).filter((player) => player.class === className);
}

/**
 * Recherche un joueur par nom
 */
async function findPlayerByName(name) {
  const players = await loadPlayers();
  const searchName = name.toLowerCase();

  return Object.values(players).find((player) =>
    player.name.toLowerCase().includes(searchName),
  );
}

/**
 * Récupère les statistiques générales de la base de données
 */
async function getDatabaseStats() {
  const players = Object.values(await loadPlayers());

  if (players.length === 0) {
    return { totalPlayers: 0, averageLevel: 0, totalGold: 0, activePlayers: 0 };
  }

  const totalLevel = players.reduce((sum, player) => sum + player.level, 0);
  const totalGold = players.reduce((sum, player) => sum + player.gold, 0);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const activePlayers = players.filter((player) => new Date(player.lastActive) > yesterday).length;

  const classCounts = {};
  players.forEach((player) => { classCounts[player.class] = (classCounts[player.class] || 0) + 1; });

  const factionCounts = {};
  players.forEach((player) => {
    if (player.faction) factionCounts[player.faction] = (factionCounts[player.faction] || 0) + 1;
  });

  return {
    totalPlayers: players.length,
    averageLevel: (totalLevel / players.length).toFixed(1),
    totalGold: totalGold,
    activePlayers: activePlayers,
    classCounts: classCounts,
    factionCounts: factionCounts,
    highestLevel: Math.max(...players.map((p) => p.level)),
    richestPlayer: Math.max(...players.map((p) => p.gold)),
  };
}

// Export des fonctions pour le reste de votre application Express
module.exports = {
  loadPlayers,
  savePlayersData,
  getPlayer,
  updatePlayer,
  deletePlayer,
  getAllPlayers,
  getPlayersByFaction,
  getPlayersByClass,
  findPlayerByName,
  getDatabaseStats
};
