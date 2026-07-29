const { PermissionFlagsBits } = require("discord.js");

/**
 * Vérifie si le bot a les permissions nécessaires pour gérer les rôles
 * @param {Guild} guild - Le serveur Discord
 * @returns {Object} - Objet contenant les informations sur les permissions
 */
function checkBotPermissions(guild) {
  try {
    const botMember = guild.members.me;
    if (!botMember) {
      return {
        hasPermissions: false,
        missingPermissions: ["Bot non trouvé dans le serveur"],
        canManageRoles: false,
      };
    }

    const requiredPermissions = [
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ];

    const missingPermissions = [];
    let canManageRoles = true;

    // Vérifier les permissions générales
    for (const permission of requiredPermissions) {
      if (!botMember.permissions.has(permission)) {
        switch (permission) {
          case PermissionFlagsBits.ManageRoles:
            missingPermissions.push("Gérer les rôles");
            canManageRoles = false;
            break;
          case PermissionFlagsBits.ViewChannel:
            missingPermissions.push("Voir les salons");
            break;
          case PermissionFlagsBits.SendMessages:
            missingPermissions.push("Envoyer des messages");
            break;
        }
      }
    }

    return {
      hasPermissions: missingPermissions.length === 0,
      missingPermissions,
      canManageRoles,
      botHighestRole: botMember.roles.highest,
      botPosition: botMember.roles.highest.position,
    };
  } catch (error) {
    console.error(
      "Erreur lors de la vérification des permissions du bot:",
      error
    );
    return {
      hasPermissions: false,
      missingPermissions: ["Erreur lors de la vérification"],
      canManageRoles: false,
    };
  }
}

/**
 * Vérifie si le bot peut gérer un rôle spécifique
 * @param {Guild} guild - Le serveur Discord
 * @param {string} roleId - L'ID du rôle à vérifier
 * @returns {Object} - Informations sur la capacité à gérer le rôle
 */
function canManageRole(guild, roleId) {
  try {
    const botMember = guild.members.me;
    const role = guild.roles.cache.get(roleId);

    if (!botMember) {
      return {
        canManage: false,
        reason: "Bot non trouvé dans le serveur",
      };
    }

    if (!role) {
      return {
        canManage: false,
        reason: "Rôle non trouvé",
      };
    }

    // Vérifier la permission générale
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return {
        canManage: false,
        reason: 'Permission "Gérer les rôles" manquante',
      };
    }

    // Vérifier la hiérarchie des rôles
    const botHighestRole = botMember.roles.highest;
    if (role.position >= botHighestRole.position) {
      return {
        canManage: false,
        reason: `Rôle trop élevé dans la hiérarchie (Position: ${role.position}, Bot: ${botHighestRole.position})`,
      };
    }

    // Vérifier si le rôle est gérable
    if (!role.editable) {
      return {
        canManage: false,
        reason: "Rôle non modifiable (rôle système ou @everyone)",
      };
    }

    return {
      canManage: true,
      reason: "Rôle gérable",
      rolePosition: role.position,
      botPosition: botHighestRole.position,
    };
  } catch (error) {
    console.error(`Erreur lors de la vérification du rôle ${roleId}:`, error);
    return {
      canManage: false,
      reason: `Erreur: ${error.message}`,
    };
  }
}

/**
 * Génère un rapport détaillé des permissions du bot pour les rôles de faction
 * @param {Guild} guild - Le serveur Discord
 * @param {Object} factionRoles - Objet contenant les IDs des rôles de faction
 * @returns {Object} - Rapport détaillé
 */
function generatePermissionReport(guild, factionRoles) {
  try {
    const generalPermissions = checkBotPermissions(guild);
    const roleChecks = {};

    // Vérifier chaque rôle de faction
    for (const [factionKey, roleId] of Object.entries(factionRoles)) {
      roleChecks[factionKey] = {
        roleId,
        ...canManageRole(guild, roleId),
      };
    }

    return {
      general: generalPermissions,
      roles: roleChecks,
      summary: {
        allRolesManageable: Object.values(roleChecks).every(
          (check) => check.canManage
        ),
        manageableCount: Object.values(roleChecks).filter(
          (check) => check.canManage
        ).length,
        totalRoles: Object.keys(roleChecks).length,
      },
    };
  } catch (error) {
    console.error(
      "Erreur lors de la génération du rapport de permissions:",
      error
    );
    return {
      general: {
        hasPermissions: false,
        missingPermissions: ["Erreur système"],
      },
      roles: {},
      summary: { allRolesManageable: false, manageableCount: 0, totalRoles: 0 },
    };
  }
}

module.exports = {
  checkBotPermissions,
  canManageRole,
  generatePermissionReport,
};
