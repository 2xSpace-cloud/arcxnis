const { getPlayer, updatePlayer } = require("../utils/database");

// Réglages du gain de gemmes
const GEMMES_PER_MESSAGE = 1; // 1 gemme par message
const GEMMES_COOLDOWN = 60; // 60 secondes entre deux gains

const cooldowns = new Map();

module.exports = {
  name: "messageCreate",
  async execute(message) {
    if (message.author.bot) return;
    const userId = message.author.id;
    const now = Date.now();
    if (
      cooldowns.has(userId) &&
      now - cooldowns.get(userId) < GEMMES_COOLDOWN * 1000
    )
      return;
    cooldowns.set(userId, now);
    const player = getPlayer(userId);
    if (!player) return;
    player.gemmes = (player.gemmes || 0) + GEMMES_PER_MESSAGE;
    updatePlayer(userId, player);
    // Optionnel : message de debug
    // message.channel.send(`<@${userId}> a gagné 1 gemme !`).then(m => setTimeout(() => m.delete(), 2000));
  },
};
