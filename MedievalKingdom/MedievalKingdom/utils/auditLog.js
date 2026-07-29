const fs = require("fs");
const path = require("path");

// Chemin vers le fichier de logs d'audit
const AUDIT_LOG_FILE = path.join(__dirname, "../logs/audit.log");
const AUDIT_JSON_FILE = path.join(__dirname, "../logs/audit.json");

/**
 * Types d'événements à logger
 */
const AuditEventType = {
  GOLD_CHANGE: "GOLD_CHANGE",
  EXPERIENCE_CHANGE: "EXPERIENCE_CHANGE",
  LEVEL_CHANGE: "LEVEL_CHANGE",
  ADMIN_GIVE: "ADMIN_GIVE",
  ADMIN_REMOVE: "ADMIN_REMOVE",
  ADMIN_SET: "ADMIN_SET",
  ADMIN_RESET: "ADMIN_RESET",
  QUEST_REWARD: "QUEST_REWARD",
  GUILD_QUEST_REWARD: "GUILD_QUEST_REWARD",
  SPECIAL_QUEST_REWARD: "SPECIAL_QUEST_REWARD",
  SHOP_PURCHASE: "SHOP_PURCHASE",
  COMBAT_REWARD: "COMBAT_REWARD",
  COMBAT_LOSS: "COMBAT_LOSS",
  PLAYER_DELETED: "PLAYER_DELETED",
  PLAYER_CREATED: "PLAYER_CREATED",
};

/**
 * Initialise le système de logs
 */
function initAuditLog() {
  try {
    const logsDir = path.dirname(AUDIT_LOG_FILE);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Créer les fichiers s'ils n'existent pas
    if (!fs.existsSync(AUDIT_LOG_FILE)) {
      fs.writeFileSync(AUDIT_LOG_FILE, "");
    }
    if (!fs.existsSync(AUDIT_JSON_FILE)) {
      fs.writeFileSync(AUDIT_JSON_FILE, JSON.stringify([], null, 2));
    }
  } catch (error) {
    console.error("Erreur lors de l'initialisation des logs d'audit:", error);
  }
}

/**
 * Enregistre un événement dans les logs d'audit
 * @param {Object} event - L'événement à logger
 * @param {string} event.type - Type d'événement (AuditEventType)
 * @param {string} event.userId - ID Discord du joueur concerné
 * @param {string} event.playerName - Nom du joueur
 * @param {string} event.action - Description de l'action
 * @param {Object} event.changes - Changements effectués (before/after)
 * @param {string} event.adminId - ID de l'admin (si applicable)
 * @param {string} event.adminName - Nom de l'admin (si applicable)
 * @param {string} event.source - Source de la modification (commande, système, etc.)
 */
function logAuditEvent(event) {
  try {
    initAuditLog();

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      ...event,
    };

    // Log en format texte lisible
    const textLog = formatTextLog(logEntry);
    fs.appendFileSync(AUDIT_LOG_FILE, textLog + "\n");

    // Log en format JSON pour analyse
    const jsonLogs = loadJsonLogs();
    jsonLogs.push(logEntry);

    // Garder seulement les 10000 derniers événements pour éviter un fichier trop gros
    if (jsonLogs.length > 10000) {
      const archived = jsonLogs.splice(0, jsonLogs.length - 10000);
      archiveOldLogs(archived);
    }

    fs.writeFileSync(AUDIT_JSON_FILE, JSON.stringify(jsonLogs, null, 2));

    console.log(
      `[AUDIT] ${event.type} - ${event.playerName} (${event.userId})`
    );
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du log d'audit:", error);
  }
}

/**
 * Formate un log en texte lisible
 */
function formatTextLog(entry) {
  const {
    timestamp,
    type,
    userId,
    playerName,
    action,
    changes,
    adminId,
    adminName,
    source,
  } = entry;

  let log = `[${timestamp}] ${type}`;
  log += ` | Joueur: ${playerName} (${userId})`;

  if (adminId) {
    log += ` | Admin: ${adminName} (${adminId})`;
  }

  if (source) {
    log += ` | Source: ${source}`;
  }

  log += ` | Action: ${action}`;

  if (changes) {
    log += ` | Changements: ${JSON.stringify(changes)}`;
  }

  return log;
}

/**
 * Charge les logs JSON
 */
function loadJsonLogs() {
  try {
    if (!fs.existsSync(AUDIT_JSON_FILE)) {
      return [];
    }
    const data = fs.readFileSync(AUDIT_JSON_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Erreur lors du chargement des logs JSON:", error);
    return [];
  }
}

/**
 * Archive les anciens logs
 */
function archiveOldLogs(logs) {
  try {
    const logsDir = path.dirname(AUDIT_LOG_FILE);
    const archiveDir = path.join(logsDir, "archives");

    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const archiveFile = path.join(
      archiveDir,
      `audit_archive_${timestamp}.json`
    );

    fs.writeFileSync(archiveFile, JSON.stringify(logs, null, 2));
    console.log(`Logs archivés: ${archiveFile}`);
  } catch (error) {
    console.error("Erreur lors de l'archivage des logs:", error);
  }
}

/**
 * Log un changement d'or
 */
function logGoldChange(
  userId,
  playerName,
  oldValue,
  newValue,
  source,
  adminId = null,
  adminName = null
) {
  const change = newValue - oldValue;
  logAuditEvent({
    type: AuditEventType.GOLD_CHANGE,
    userId,
    playerName,
    action: change >= 0 ? `+${change} or` : `${change} or`,
    changes: {
      before: oldValue,
      after: newValue,
      delta: change,
    },
    source,
    adminId,
    adminName,
  });
}

/**
 * Log un changement d'expérience
 */
function logExperienceChange(
  userId,
  playerName,
  oldValue,
  newValue,
  source,
  adminId = null,
  adminName = null
) {
  const change = newValue - oldValue;
  logAuditEvent({
    type: AuditEventType.EXPERIENCE_CHANGE,
    userId,
    playerName,
    action: change >= 0 ? `+${change} XP` : `${change} XP`,
    changes: {
      before: oldValue,
      after: newValue,
      delta: change,
    },
    source,
    adminId,
    adminName,
  });
}

/**
 * Log un changement de niveau
 */
function logLevelChange(userId, playerName, oldLevel, newLevel, source) {
  logAuditEvent({
    type: AuditEventType.LEVEL_CHANGE,
    userId,
    playerName,
    action: `Niveau ${oldLevel} → ${newLevel}`,
    changes: {
      before: oldLevel,
      after: newLevel,
      delta: newLevel - oldLevel,
    },
    source,
  });
}

/**
 * Log une action admin
 */
function logAdminAction(
  type,
  userId,
  playerName,
  adminId,
  adminName,
  action,
  changes
) {
  logAuditEvent({
    type,
    userId,
    playerName,
    action,
    changes,
    adminId,
    adminName,
    source: "Admin Command",
  });
}

/**
 * Log une suppression de joueur
 */
function logPlayerDeletion(
  userId,
  playerName,
  playerData,
  adminId = null,
  adminName = null
) {
  logAuditEvent({
    type: AuditEventType.PLAYER_DELETED,
    userId,
    playerName,
    action: "Joueur supprimé",
    changes: {
      finalData: {
        level: playerData.level,
        experience: playerData.experience,
        gold: playerData.gold,
        gemmes: playerData.gemmes,
      },
    },
    adminId,
    adminName,
    source: adminId ? "Admin Command" : "System",
  });
}

/**
 * Log une création de joueur
 */
function logPlayerCreation(userId, playerName, playerClass) {
  logAuditEvent({
    type: AuditEventType.PLAYER_CREATED,
    userId,
    playerName,
    action: `Nouveau personnage créé (${playerClass})`,
    changes: {
      class: playerClass,
      initialGold: 100,
      initialLevel: 1,
    },
    source: "Character Creation",
  });
}

/**
 * Récupère l'historique d'un joueur
 */
function getPlayerHistory(userId, limit = 50) {
  try {
    const logs = loadJsonLogs();
    return logs
      .filter((log) => log.userId === userId)
      .slice(-limit)
      .reverse();
  } catch (error) {
    console.error("Erreur lors de la récupération de l'historique:", error);
    return [];
  }
}

/**
 * Récupère les logs par type
 */
function getLogsByType(type, limit = 100) {
  try {
    const logs = loadJsonLogs();
    return logs
      .filter((log) => log.type === type)
      .slice(-limit)
      .reverse();
  } catch (error) {
    console.error("Erreur lors de la récupération des logs par type:", error);
    return [];
  }
}

/**
 * Récupère les logs dans une période
 */
function getLogsByDateRange(startDate, endDate) {
  try {
    const logs = loadJsonLogs();
    const start = new Date(startDate);
    const end = new Date(endDate);

    return logs.filter((log) => {
      const logDate = new Date(log.timestamp);
      return logDate >= start && logDate <= end;
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des logs par date:", error);
    return [];
  }
}

module.exports = {
  AuditEventType,
  logAuditEvent,
  logGoldChange,
  logExperienceChange,
  logLevelChange,
  logAdminAction,
  logPlayerDeletion,
  logPlayerCreation,
  getPlayerHistory,
  getLogsByType,
  getLogsByDateRange,
  initAuditLog,
};
