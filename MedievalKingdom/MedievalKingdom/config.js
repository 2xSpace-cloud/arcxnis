// Vérifier les variables d'environnement requises
if (!process.env.DISCORD_TOKEN) {
  console.error(
    "❌ ERREUR: DISCORD_TOKEN manquant dans les variables d'environnement",
  );
  console.error("Créez un fichier .env basé sur .env.example");
  process.exit(1);
}

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID || "",
  guildId: process.env.GUILD_ID || null, // Leave null for global commands

  // Game configuration
  game: {
    maxLevel: 50,
    baseHealth: 100,
    baseMana: 50,
    // ANCIEN SYSTÈME SUPPRIMÉ: questCooldown: 30, // Remplacé par limite de 10 quêtes/jour
    dailyQuestLimit: 10, // Maximum de 10 quêtes par jour
    combatTimeout: 300000, // 5 minutes in milliseconds

    // Experience and gold rewards
    questBaseReward: {
      experience: 25,
      gold: 10,
    },

    combatBaseReward: {
      experience: 15,
      gold: 5,
    },
  },

  // Bot settings
  embedColor: "#FFD700", // Gold color for embeds
  errorColor: "#FF0000", // Red color for errors
  successColor: "#00FF00", // Green color for success
};
