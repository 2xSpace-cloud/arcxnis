const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Charger les variables d'environnement au démarrage
// Remplacez : require("dotenv").config();
// Par cette ligne sécurisée (vers la ligne 6 de votre fichier de bot) :
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "config.js") }); 


const config = require("./config.js");

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates, // Ajout pour le vocal
  ],
});

// Initialize commands collection
client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
    console.log(`✅ Loaded command: ${command.data.name}`);
  } else {
    console.log(
      `⚠️ Command at ${filePath} is missing required "data" or "execute" property.`,
    );
  }
}

// Load events
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  console.log(`✅ Loaded event: ${event.name}`);
}

// Restaurer les fonctionnalités au démarrage (Ajout de async)
client.once("ready", async () => {
  // Migrer les anciennes données de quêtes
  try {
    const dbUtils = require("./utils/database.js");
    if (dbUtils && typeof dbUtils.migrateQuestData === "function") {
      const result = dbUtils.migrateQuestData();
      if (result && (result.migratedCount > 0 || result.abandonedCount > 0)) {
        console.log(
          `📜 Migration des quêtes: ${result.migratedCount} migrées, ${result.abandonedCount} abandonnées`,
        );
      }
    }
  } catch (error) {
    console.error("Erreur lors de la migration des quêtes:", error);
  }

  // Restaurer les timeouts des giveaways actifs
  try {
    const { restoreGiveawayTimeouts } = require("./commands/giveaway.js");
    restoreGiveawayTimeouts(client);
    console.log("🎉 Giveaways restaurés au démarrage");
  } catch (error) {
    console.error("Erreur lors de la restauration des giveaways:", error);
  }

  // Restaurer le suivi vocal (Ajout de await car loadPlayers/getAllPlayers est maintenant async)
  try {
    const { restoreVoiceTracking } = require("./events/voiceStateUpdate.js");
    await restoreVoiceTracking(client);
    console.log("🎤 Suivi vocal restauré au démarrage");
  } catch (error) {
    console.error("Erreur lors de la restauration du suivi vocal:", error);
  }
});

// Error handling
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

// Login to Discord
client.login(config.token);

// Tout à la fin du fichier principal de votre BOT Discord
module.exports = { client };

