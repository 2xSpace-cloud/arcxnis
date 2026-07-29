/**
 * Utilitaires de sécurité et validation des entrées
 */

/**
 * Valide un ID Discord (15+ chiffres)
 */
function validateDiscordId(id) {
  return typeof id === "string" && /^\d{15,}$/.test(id);
}

/**
 * Valide un ID d'item (format: nom_item)
 */
function validateItemId(id) {
  return typeof id === "string" && /^[a-z0-9_]{3,50}$/.test(id);
}

/**
 * Valide un ID de quête
 */
function validateQuestId(id) {
  return typeof id === "string" && /^quest_[a-z0-9_]{1,30}$/.test(id);
}

/**
 * Valide un ID de classe
 */
function validateClassName(name) {
  const validClasses = [
    "chevalier",
    "mage",
    "archer",
    "voleur",
    "pretre",
    "druide",
  ];
  return validClasses.includes(String(name).toLowerCase());
}

/**
 * Valide un ID de faction
 */
function validateFactionName(name) {
  const validFactions = [
    "ordre_royal",
    "voleurs_nuit",
    "culte_ancien",
    "nomades_desert",
  ];
  return validFactions.includes(String(name).toLowerCase());
}

/**
 * Nettoie une chaîne pour éviter les injections
 */
function sanitizeString(str, maxLength = 100) {
  if (typeof str !== "string") return "";
  return str
    .substring(0, maxLength)
    .replace(/[<>]/g, "") // Éviter les balises HTML/XML
    .trim();
}

/**
 * Valide une plage numérique
 */
function validateNumberRange(num, min = 0, max = Infinity) {
  const n = Number(num);
  return !isNaN(n) && n >= min && n <= max;
}

/**
 * Extrait et valide les paramètres d'un customId
 * @param {string} customId - ID custom du bouton/menu
 * @param {string} delimiter - Séparateur utilisé
 * @param {string[]} expectedParts - Parties attendues
 * @returns {object|null} - Objet avec les paramètres validés ou null
 */
function extractAndValidateCustomId(
  customId,
  delimiter = "_",
  expectedParts = [],
) {
  if (!customId || typeof customId !== "string") return null;

  const parts = customId.split(delimiter);
  if (parts.length !== expectedParts.length) return null;

  const result = {};
  for (let i = 0; i < expectedParts.length; i++) {
    result[expectedParts[i]] = parts[i];
  }

  return result;
}

/**
 * Valide et extrait l'ID utilisateur d'un customId de combat
 */
function extractUserId(customId) {
  if (!customId || typeof customId !== "string") return null;

  // Format: "combat_action_userId"
  const match = customId.match(/^([a-z_]+)_([a-z_]+)_(\d{15,})$/);
  if (!match) return null;

  const [, action, subAction, userId] = match;

  return {
    userId,
    action,
    subAction,
  };
}

/**
 * Valide les métadonnées de session de paiement
 */
function validatePaymentMetadata(metadata) {
  if (!metadata) return false;

  const { discordId, packId } = metadata;

  if (!validateDiscordId(discordId)) return false;
  if (!["pack1", "pack2", "pack3", "pack4"].includes(packId)) return false;

  return true;
}

module.exports = {
  validateDiscordId,
  validateItemId,
  validateQuestId,
  validateClassName,
  validateFactionName,
  sanitizeString,
  validateNumberRange,
  extractAndValidateCustomId,
  extractUserId,
  validatePaymentMetadata,
};
