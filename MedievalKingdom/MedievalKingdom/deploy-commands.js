const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");
const config = require("./config.js");

const commands = [];
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ("data" in command && "execute" in command) {
    commands.push(command.data.toJSON());
    console.log(`✅ Loaded command: ${command.data.name}`);
  } else {
    console.log(
      `⚠️ Command at ${filePath} is missing required "data" or "execute" property.`
    );
  }
}

const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
  try {
    console.log(
      `🔄 Started refreshing ${commands.length} application (/) commands.`
    );

    let data;

    if (config.guildId) {
      // Pour enregistrer les commandes sur un serveur spécifique (instantané)
      console.log(`📍 Deploying to guild: ${config.guildId}`);
      data = await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands }
      );
    } else {
      // Pour enregistrer les commandes globalement (prend 1h pour se propager)
      console.log(`🌍 Deploying globally (may take up to 1 hour to propagate)`);
      data = await rest.put(Routes.applicationCommands(config.clientId), {
        body: commands,
      });
    }

    console.log(
      `✅ Successfully reloaded ${data.length} application (/) commands.`
    );
    console.log("\n📋 Commands registered:");
    data.forEach((cmd) => console.log(`   - /${cmd.name}`));
  } catch (error) {
    console.error("❌ Error deploying commands:", error);
  }
})();
