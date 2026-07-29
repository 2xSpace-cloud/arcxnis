const fs = require("fs");
const path = require("path");

// Chemin vers le fichier de base de données des joueurs
const PLAYERS_FILE = path.join(__dirname, "../database/players.json");

/**
 * Charge les données des joueurs depuis le fichier JSON
 */
function loadPlayers() {
  try {
    if (!fs.existsSync(PLAYERS_FILE)) {
      // Créer le fichier s'il n'existe pas
      savePlayersData({});
      return {};
    }

    const data = fs.readFileSync(PLAYERS_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Erreur lors du chargement des données des joueurs:", error);
    return {};
  }
}

/**
 * Sauvegarde les données des joueurs dans le fichier JSON
 */
function savePlayersData(players) {
  try {
    // Créer le dossier database s'il n'existe pas
    const dbDir = path.dirname(PLAYERS_FILE);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const tempFile = PLAYERS_FILE + ".tmp";

    // Créer une sauvegarde automatique si le fichier principal existe et contient des données
    if (fs.existsSync(PLAYERS_FILE)) {
      const currentData = fs.readFileSync(PLAYERS_FILE, "utf8");
      const currentPlayers = JSON.parse(currentData);
      if (Object.keys(currentPlayers).length > 0) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupDir = '/tmp/medieval_backups';
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const backupPath = path.join(backupDir, `auto_backup_players_${timestamp}.json`);
        fs.writeFileSync(backupPath, currentData);
        console.log(`Sauvegarde automatique créée: ${backupPath}`);
      }
    }

    // Écriture directe (renameSync nécessite un répertoire accessible en écriture)
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2));
  } catch (error) {
    console.error(
      "Erreur lors de la sauvegarde des données des joueurs:",
      error,
    );
  }
}

/**
 * Récupère un joueur par son ID Discord
 */
function getPlayer(userId) {
  const players = loadPlayers();
  return players[userId] || null;
}

/**
 * Met à jour ou crée un joueur
 */
function updatePlayer(userId, playerData) {
  const players = loadPlayers();

  // Mettre à jour la timestamp de dernière activité
  playerData.lastActive = new Date().toISOString();

  // Fusionner avec l'existant pour éviter d'écraser des champs non fournis
  const existing = players[userId] || {};
  const merged = { ...existing, ...playerData };

  players[userId] = merged;
  savePlayersData(players);

  console.log(`Joueur ${merged.name || userId} (${userId}) mis à jour`);
}

/**
 * Supprime un joueur de la base de données
 */
function deletePlayer(userId) {
  const players = loadPlayers();

  if (players[userId]) {
    const playerName = players[userId].name;
    delete players[userId];
    savePlayersData(players);
    console.log(`Joueur ${playerName} (${userId}) supprimé`);
    return true;
  }

  return false;
}

/**
 * Récupère tous les joueurs
 */
function getAllPlayers() {
  const players = loadPlayers();
  return Object.values(players).filter((player) => player.active !== false);
}

/**
 * Récupère les joueurs par faction
 */
function getPlayersByFaction(factionName) {
  const players = loadPlayers();
  return Object.values(players).filter(
    (player) => player.faction === factionName,
  );
}

/**
 * Récupère les joueurs par classe
 */
function getPlayersByClass(className) {
  const players = loadPlayers();
  return Object.values(players).filter((player) => player.class === className);
}

/**
 * Recherche un joueur par nom (recherche partielle, insensible à la casse)
 */
function findPlayerByName(name) {
  const players = loadPlayers();
  const searchName = name.toLowerCase();

  return Object.values(players).find((player) =>
    player.name.toLowerCase().includes(searchName),
  );
}

/**
 * Récupère les statistiques générales de la base de données
 */
function getDatabaseStats() {
  const players = Object.values(loadPlayers());

  if (players.length === 0) {
    return {
      totalPlayers: 0,
      averageLevel: 0,
      totalGold: 0,
      activePlayers: 0,
    };
  }

  const totalLevel = players.reduce((sum, player) => sum + player.level, 0);
  const totalGold = players.reduce((sum, player) => sum + player.gold, 0);

  // Joueurs actifs dans les dernières 24 heures
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const activePlayers = players.filter(
    (player) => new Date(player.lastActive) > yesterday,
  ).length;

  // Statistiques par classe
  const classCounts = {};
  players.forEach((player) => {
    classCounts[player.class] = (classCounts[player.class] || 0) + 1;
  });

  // Statistiques par faction
  const factionCounts = {};
  players.forEach((player) => {
    if (player.faction) {
      factionCounts[player.faction] = (factionCounts[player.faction] || 0) + 1;
    }
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

/**
 * Nettoie les joueurs inactifs (non utilisé depuis X jours)
 */
function cleanupInactivePlayers(daysInactive = 30) {
  const players = loadPlayers();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

  let deletedCount = 0;

  for (const [userId, player] of Object.entries(players)) {
    const lastActive = new Date(player.lastActive);
    if (lastActive < cutoffDate) {
      delete players[userId];
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    savePlayersData(players);
    console.log(
      `Nettoyage terminé: ${deletedCount} joueurs inactifs supprimés`,
    );
  }

  return deletedCount;
}

/**
 * Exporte les données des joueurs pour sauvegarde
 */
function exportPlayerData() {
  const players = loadPlayers();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const exportPath = path.join(
    __dirname,
    `../database/backup_players_${timestamp}.json`,
  );

  try {
    fs.writeFileSync(exportPath, JSON.stringify(players, null, 2));
    console.log(`Données exportées vers: ${exportPath}`);
    return exportPath;
  } catch (error) {
    console.error("Erreur lors de l'export:", error);
    return null;
  }
}

/**
 * Importe les données des joueurs depuis un fichier de sauvegarde
 */
function importPlayerData(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("Fichier de sauvegarde introuvable");
    }

    const data = fs.readFileSync(filePath, "utf8");
    const players = JSON.parse(data);

    // Valider la structure des données
    if (typeof players !== "object") {
      throw new Error("Format de données invalide");
    }

    savePlayersData(players);
    console.log(`Données importées depuis: ${filePath}`);
    return Object.keys(players).length;
  } catch (error) {
    console.error("Erreur lors de l'import:", error);
    return -1;
  }
}

/**
 * Corrige l'expérience des joueurs pour respecter la formule linéaire
 */
function fixPlayerExperience() {
  const players = loadPlayers();
  let fixedCount = 0;

  for (const [userId, player] of Object.entries(players)) {
    if (player.experience >= 0) {
      // Calculer le niveau correct basé sur l'expérience totale
      // Le système fonctionne comme suit :
      // - Niveau 1 nécessite 100 XP pour passer au niveau 2
      // - Niveau 2 nécessite 200 XP pour passer au niveau 3
      // - Niveau 3 nécessite 300 XP pour passer au niveau 4, etc.

      let totalExpUsed = 0;
      let currentLevel = 1;
      let totalExpAvailable = player.experience;

      // Calculer le niveau en additionnant l'XP nécessaire pour chaque niveau
      while (totalExpUsed + currentLevel * 100 <= totalExpAvailable) {
        totalExpUsed += currentLevel * 100;
        currentLevel++;
      }

      const remainingExp = totalExpAvailable - totalExpUsed;

      // Vérifier si une correction est nécessaire
      if (currentLevel !== player.level || remainingExp !== player.experience) {
        console.log(
          `Correction du joueur ${player.name}: Niveau ${player.level} -> ${currentLevel}, XP ${player.experience} -> ${remainingExp} (XP total: ${totalExpAvailable})`,
        );

        // Ajuster les stats si le niveau a augmenté
        const oldLevel = player.level;
        if (currentLevel > oldLevel) {
          const levelDiff = currentLevel - oldLevel;
          player.maxHealth += levelDiff * 10;
          player.maxMana += levelDiff * 5;
          player.stats.attack += levelDiff;
          player.stats.defense += levelDiff;
          player.stats.magicAttack += levelDiff;
          player.stats.magicDefense += levelDiff;
        }

        player.level = currentLevel;
        player.experience = remainingExp;
        fixedCount++;
      }
    }
  }

  if (fixedCount > 0) {
    savePlayersData(players);
    console.log(`${fixedCount} joueurs corrigés pour l'expérience`);
  }

  return fixedCount;
}

/**
 * Réinitialise complètement la base de données
 */
function resetDatabase() {
  try {
    savePlayersData({});
    console.log("Base de données réinitialisée");
    return true;
  } catch (error) {
    console.error("Erreur lors de la réinitialisation:", error);
    return false;
  }
}

/**
 * Migre les anciennes données de quêtes vers la nouvelle structure
 * Corrige les joueurs avec des quêtes actives invalides du ancien système
 */
function migrateQuestData() {
  const players = loadPlayers();
  let migratedCount = 0;
  let abandonedCount = 0;

  for (const [userId, player] of Object.entries(players)) {
    // Vérifier si le joueur a une quête active
    if (player.quests && player.quests.active) {
      const quest = player.quests.active;

      // Vérifier si c'est une ancienne quête sans les champs requis
      // Une quête valide doit avoir un startTime
      if (!quest.startTime) {
        console.log(
          `⚠️ Quête ancienne structure détectée pour ${player.name}: abandonnée automatiquement`,
        );
        player.quests.active = null;
        abandonedCount++;
        continue;
      }

      // Vérifier si startTime est valide
      try {
        const startTime = new Date(quest.startTime);
        if (isNaN(startTime.getTime())) {
          console.log(
            `⚠️ Quête avec startTime invalide pour ${player.name}: abandonnée automatiquement`,
          );
          player.quests.active = null;
          abandonedCount++;
          continue;
        }
      } catch (e) {
        console.log(
          `⚠️ Erreur lors de la validation du startTime pour ${player.name}: quête abandonnée`,
        );
        player.quests.active = null;
        abandonedCount++;
        continue;
      }

      // Ajouter le champ progress s'il manque
      if (!quest.hasOwnProperty("progress")) {
        quest.progress = 0;
        migratedCount++;
      }
    }

    // S'assurer que la structure des quêtes est correcte
    if (!player.quests) {
      player.quests = {
        active: null,
        completed: [],
        completedToday: 0,
        lastQuestTime: null,
      };
    }
  }

  if (migratedCount > 0 || abandonedCount > 0) {
    savePlayersData(players);
    console.log(
      `✅ Migration des quêtes terminée: ${migratedCount} quêtes migrées, ${abandonedCount} quêtes abandonnées`,
    );
  }

  return { migratedCount, abandonedCount };
}

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
  getDatabaseStats,
  cleanupInactivePlayers,
  exportPlayerData,
  importPlayerData,
  fixPlayerExperience,
  migrateQuestData,
  resetDatabase,
};
