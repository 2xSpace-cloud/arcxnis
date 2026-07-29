const { getPlayer, updatePlayer } = require("../utils/database");

module.exports = {
  name: "guildMemberRemove",
  async execute(member) {
    try {
      const player = getPlayer(member.id);
      if (player) {
        player.active = false;
        updatePlayer(member.id, player);
        console.log(
          `🔕 Joueur ${player.name || member.user.tag} (${member.id}) marqué inactif (a quitté le serveur)`,
        );
      }
    } catch (error) {
      console.error(
        `Erreur lors du traitement de guildMemberRemove pour ${member.id}:`,
        error,
      );
    }
  },
};
