const { Events, REST, Routes } = require("discord.js");
const config = require("../config.js");
const fs = require("fs");
const path = require("path");
const { loadPlayers, updatePlayer } = require("../utils/database.js");
const { initFactionRoles } = require("../utils/roleManager.js");

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log("🏰 Connexion au royaume réussie !");
    console.log(`👑 Connecté en tant que ${client.user.tag}`);
    console.log(`🏛️ Présent sur ${client.guilds.cache.size} serveurs`);

    // Définir le statut du bot
    await setActivityStatus(client);

    // Enregistrer les commandes slash
    await registerSlashCommands(client);

    // Initialiser les rôles de faction (créer si absents)
    const guild = client.guilds.cache.get(config.guildId);
    if (guild) {
      await initFactionRoles(guild);
    }

    // Démarrer les tâches périodiques
    startPeriodicTasks(client);

    console.log("🎉 Bot Discord du Royaume Médiéval opérationnel !");
    console.log("📋 Commandes disponibles:");
    console.log("   /personnage - Gestion des personnages");
    console.log("   /faction - Gestion des factions");
    console.log("   /inventaire - Gestion de l'inventaire");
    console.log("   /quete - Système de quêtes");
    console.log("   /combat - Système de combat");
    console.log("   /classement - Classements des joueurs");

    // Reconciliation: marquer inactifs les joueurs qui ont quitté pendant que le bot était hors-ligne
    await reconcilePlayersOnStartup(client);
  },
};

/**
 * Vérifie tous les joueurs enregistrés et marque inactifs ceux
 * qui ne sont présents sur aucun des serveurs où le bot est connecté.
 */
async function reconcilePlayersOnStartup(client) {
  try {
    console.log(
      "🔎 Vérification des joueurs présents sur les serveurs (reconciliation)...",
    );
    const players = loadPlayers();

    for (const [id, player] of Object.entries(players)) {
      // Ignorer les joueurs déjà explicitement marqués inactifs
      if (player.active === false) continue;

      let found = false;
      for (const guild of client.guilds.cache.values()) {
        const member = await guild.members.fetch(id).catch(() => null);
        if (member) {
          found = true;
          break;
        }
      }

      if (!found) {
        // Marquer le joueur comme inactif et nettoyer le joinTime vocal
        player.active = false;
        if (player.voiceGemmes && player.voiceGemmes.joinTime) {
          player.voiceGemmes.joinTime = null;
        }
        updatePlayer(id, player);
        console.log(
          `🔕 Joueur ${player.name || id} marqué inactif (absent des serveurs du bot)`,
        );
      }
    }

    console.log("✅ Reconciliation terminée");
  } catch (error) {
    console.error(
      "❌ Erreur lors de la reconciliation des joueurs au démarrage:",
      error,
    );
  }
}

/**
 * Définit le statut d'activité du bot
 */
async function setActivityStatus(client) {
  try {
    // Compter le nombre de joueurs enregistrés
    const { getDatabaseStats } = require("../utils/database.js");
    const stats = getDatabaseStats();

    const activities = [
      { name: "🏰 au royaume médiéval", type: 0 }, // Playing
      { name: "⚔️ les combats épiques", type: 3 }, // Watching
      { name: `👑 ${stats.totalPlayers} aventuriers`, type: 3 }, // Watching
      { name: "📜 les quêtes du royaume", type: 2 }, // Listening
      { name: "🏛️ les intrigues de factions", type: 0 }, // Playing
    ];

    // Choisir une activité aléatoire
    const activity = activities[Math.floor(Math.random() * activities.length)];

    await client.user.setPresence({
      activities: [activity],
      status: "online",
    });

    console.log(`📱 Statut défini: ${activity.name}`);
  } catch (error) {
    console.error("❌ Erreur lors de la définition du statut:", error);
  }
}

/**
 * Enregistre les commandes slash
 */
async function registerSlashCommands(client) {
  try {
    console.log("🔄 Début de l'enregistrement des commandes slash...");

    // Charger toutes les commandes
    const commands = [];
    const commandsPath = path.join(__dirname, "../commands");
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);

      if ("data" in command && "execute" in command) {
        commands.push(command.data.toJSON());
      } else {
        console.log(
          `⚠️ La commande ${filePath} n'a pas les propriétés "data" ou "execute" requises.`,
        );
      }
    }

    const rest = new REST({ version: "10" }).setToken(config.token);

    if (config.guildId) {
      // Enregistrement des commandes pour un serveur spécifique (plus rapide pour les tests)
      console.log(
        `🔧 Enregistrement des commandes pour le serveur ${config.guildId}...`,
      );
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands },
      );
      console.log(
        `✅ ${commands.length} commandes enregistrées pour le serveur ${config.guildId}.`,
      );
    } else {
      // Enregistrement global des commandes (prend plus de temps à se propager)
      console.log("🌐 Enregistrement global des commandes...");
      await rest.put(Routes.applicationCommands(config.clientId), {
        body: commands,
      });
      console.log(`✅ ${commands.length} commandes enregistrées globalement.`);
    }
  } catch (error) {
    console.error("❌ Erreur lors de l'enregistrement des commandes:", error);
  }
}

/**
 * Démarre les tâches périodiques
 */
function startPeriodicTasks(client) {
  // Changer le statut toutes les 10 minutes
  setInterval(
    () => {
      setActivityStatus(client);
    },
    10 * 60 * 1000,
  );

  // Nettoyer la base de données toutes les 24 heures
  setInterval(
    () => {
      cleanupDatabase();
    },
    24 * 60 * 60 * 1000,
  );

  // Sauvegarder les données toutes les heures
  setInterval(
    () => {
      backupDatabase();
    },
    60 * 60 * 1000,
  );

  // Afficher les statistiques toutes les 6 heures
  setInterval(
    () => {
      logServerStats(client);
    },
    6 * 60 * 60 * 1000,
  );

  console.log("⏰ Tâches périodiques démarrées");
}

/**
 * Nettoie la base de données des joueurs inactifs
 */
function cleanupDatabase() {
  try {
    const { cleanupInactivePlayers } = require("../utils/database.js");
    const deletedCount = cleanupInactivePlayers(30); // 30 jours d'inactivité

    if (deletedCount > 0) {
      console.log(
        `🧹 Nettoyage automatique: ${deletedCount} joueurs inactifs supprimés`,
      );
    }
  } catch (error) {
    console.error("❌ Erreur lors du nettoyage de la base de données:", error);
  }
}

/**
 * Sauvegarde automatique de la base de données
 */
function backupDatabase() {
  try {
    const { exportPlayerData } = require("../utils/database.js");
    const backupPath = exportPlayerData();

    if (backupPath) {
      console.log(
        `💾 Sauvegarde automatique créée: ${path.basename(backupPath)}`,
      );

      // Garder seulement les 10 dernières sauvegardes
      cleanupOldBackups();
    }
  } catch (error) {
    console.error("❌ Erreur lors de la sauvegarde automatique:", error);
  }
}

/**
 * Supprime les anciennes sauvegardes
 */
function cleanupOldBackups() {
  try {
    const backupDir = path.join(__dirname, "../database");
    const files = fs
      .readdirSync(backupDir)
      .filter((file) => file.startsWith("backup_players_"))
      .map((file) => ({
        name: file,
        path: path.join(backupDir, file),
        time: fs.statSync(path.join(backupDir, file)).mtime,
      }))
      .sort((a, b) => b.time - a.time);

    // Garder les 10 plus récentes, supprimer les autres
    const filesToDelete = files.slice(10);

    filesToDelete.forEach((file) => {
      fs.unlinkSync(file.path);
      console.log(`🗑️ Ancienne sauvegarde supprimée: ${file.name}`);
    });
  } catch (error) {
    console.error("❌ Erreur lors du nettoyage des sauvegardes:", error);
  }
}

/**
 * Affiche les statistiques du serveur
 */
function logServerStats(client) {
  try {
    const { getDatabaseStats } = require("../utils/database.js");
    const stats = getDatabaseStats();

    console.log("📊 === STATISTIQUES DU ROYAUME ===");
    console.log(`👥 Joueurs totaux: ${stats.totalPlayers}`);
    console.log(`📈 Niveau moyen: ${stats.averageLevel}`);
    console.log(`🏃‍♂️ Joueurs actifs (24h): ${stats.activePlayers}`);
    console.log(`💰 Or total en circulation: ${stats.totalGold}`);
    console.log(`🏆 Niveau le plus élevé: ${stats.highestLevel}`);
    console.log(`💎 Joueur le plus riche: ${stats.richestPlayer} or`);
    console.log(`🏛️ Serveurs connectés: ${client.guilds.cache.size}`);
    console.log("=====================================");

    // Afficher les statistiques par classe
    if (Object.keys(stats.classCounts).length > 0) {
      console.log("⚔️ Répartition par classe:");
      for (const [className, count] of Object.entries(stats.classCounts)) {
        console.log(`   ${className}: ${count} joueurs`);
      }
    }

    // Afficher les statistiques par faction
    if (Object.keys(stats.factionCounts).length > 0) {
      console.log("🏛️ Répartition par faction:");
      for (const [factionName, count] of Object.entries(stats.factionCounts)) {
        console.log(`   ${factionName}: ${count} membres`);
      }
    }
  } catch (error) {
    console.error("❌ Erreur lors de l'affichage des statistiques:", error);
  }
}
