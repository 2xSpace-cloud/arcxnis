const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getAllPlayers } = require("../utils/database.js");
const { createEmbed } = require("../utils/embeds.js");
const { classes, factions } = require("../systems/gameData.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("classement")
    .setDescription("Voir les classements des joueurs")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Type de classement")
        .setRequired(false)
        .addChoices(
          { name: "⭐ Niveau", value: "level" },
          { name: "💰 Richesse", value: "gold" },
          { name: "🏆 Réputation", value: "reputation" },
          { name: "⚔️ Victoires", value: "wins" },
          { name: "📜 Quêtes", value: "quests" }
        )
    ),

  async execute(interaction) {
    const sortType = interaction.options.getString("type") || "level";

    try {
      const players = getAllPlayers();

      if (players.length === 0) {
        return await interaction.reply({
          embeds: [
            createEmbed(
              "info",
              "📊 Classement vide",
              "Aucun joueur enregistré pour le moment."
            ),
          ],
          ephemeral: true,
        });
      }

      // Trier les joueurs selon le type de classement
      const sortedPlayers = this.sortPlayers(players, sortType);

      // Créer l'embed de classement
      const embed = this.createLeaderboardEmbed(sortedPlayers, sortType);

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Erreur dans la commande classement:", error);
      await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Une erreur est survenue lors de l'affichage du classement."
          ),
        ],
        ephemeral: true,
      });
    }
  },

  sortPlayers(players, sortType) {
    switch (sortType) {
      case "level":
        return players.sort((a, b) => {
          if (b.level !== a.level) return b.level - a.level;
          return b.experience - a.experience;
        });

      case "gold":
        return players.sort((a, b) => b.gold - a.gold);

      case "reputation":
        return players.sort((a, b) => b.reputation - a.reputation);

      case "wins":
        return players.sort((a, b) => b.combat.wins - a.combat.wins);

      case "quests":
        return players.sort(
          (a, b) => b.quests.completed.length - a.quests.completed.length
        );

      default:
        return players.sort((a, b) => b.level - a.level);
    }
  },

  createLeaderboardEmbed(players, sortType) {
    const title = this.getLeaderboardTitle(sortType);
    const totalPlayers = players.length;

    // Calculer le nombre de joueurs qui reçoivent un titre
    const titledPlayersCount = this.getTitledPlayersCount(totalPlayers);

    const embed = createEmbed("info", `🏆 ${title}`).setDescription(
      `Top 10 des meilleurs joueurs du royaume\n\n` +
        `👑 **${titledPlayersCount}** joueurs du top reçoivent un titre honorifique !`
    );

    // Prendre les 10 premiers joueurs
    const topPlayers = players.slice(0, 10);

    let leaderboard = "";
    topPlayers.forEach((player, index) => {
      const rank = this.getRankEmoji(index);
      const value = this.getPlayerValue(player, sortType);
      const classData = classes[player.class];
      const factionEmoji = player.faction
        ? factions[player.faction].emoji
        : "🏴";

      // Ajouter le titre si le joueur est dans le top
      const rankTitle = this.getRankTitle(index, totalPlayers);
      const titleDisplay = rankTitle ? ` ${rankTitle}` : "";

      leaderboard += `${rank} **${player.name}**${titleDisplay} ${factionEmoji}\n`;
      leaderboard += `${classData.emoji} ${classData.name} • Niv. ${player.level} • ${value}\n\n`;
    });

    if (leaderboard) {
      embed.addFields({
        name: "👥 Classement",
        value: leaderboard,
        inline: false,
      });
    }

    // Ajouter des statistiques générales
    this.addGeneralStats(embed, players);

    return embed;
  },

  /**
   * Calcule le nombre de joueurs qui reçoivent un titre selon le nombre total de joueurs
   * - 10 joueurs : top 3
   * - 50 joueurs : top 5
   * - 100 joueurs : top 10
   * - 1000+ joueurs : top 50
   */
  getTitledPlayersCount(totalPlayers) {
    if (totalPlayers >= 1000) return 50;
    if (totalPlayers >= 100) return 10;
    if (totalPlayers >= 50) return 5;
    if (totalPlayers >= 10) return 3;
    return Math.min(3, totalPlayers); // Au moins 3 ou moins si pas assez de joueurs
  },

  /**
   * Retourne le titre honorifique d'un joueur selon sa position et le nombre total de joueurs
   */
  getRankTitle(position, totalPlayers) {
    const titledCount = this.getTitledPlayersCount(totalPlayers);

    // Si le joueur n'est pas dans le top qui reçoit des titres
    if (position >= titledCount) {
      return null;
    }

    // Titres pour les 3 premiers (toujours présents si assez de joueurs)
    if (position === 0) return "👑 **Empereur du Royaume**";
    if (position === 1) return "⚜️ **Grand Duc**";
    if (position === 2) return "🎖️ **Comte Illustre**";

    // Titres supplémentaires pour top 5
    if (titledCount >= 5) {
      if (position === 3) return "🏅 **Baron Vénéré**";
      if (position === 4) return "🎗️ **Chevalier d'Élite**";
    }

    // Titres supplémentaires pour top 10
    if (titledCount >= 10) {
      if (position === 5) return "⭐ **Champion du Royaume**";
      if (position === 6) return "🌟 **Héros Légendaire**";
      if (position === 7) return "💫 **Maître Guerrier**";
      if (position === 8) return "✨ **Vétéran d'Honneur**";
      if (position === 9) return "🔰 **Gardien Émérite**";
    }

    // Titres supplémentaires pour top 50
    if (titledCount >= 50) {
      const tierTitles = [
        "🛡️ **Protecteur du Royaume**",
        "⚔️ **Lame Renommée**",
        "🏰 **Défenseur de la Couronne**",
        "🗡️ **Épée Royale**",
        "🎯 **Stratège Accompli**",
      ];

      // Positions 10-49 reçoivent des titres cycliques
      const tierIndex = Math.floor((position - 10) / 8);
      return tierTitles[tierIndex % tierTitles.length];
    }

    return null;
  },

  getLeaderboardTitle(sortType) {
    const titles = {
      level: "Classement par Niveau",
      gold: "Classement par Richesse",
      reputation: "Classement par Réputation",
      wins: "Classement par Victoires",
      quests: "Classement par Quêtes",
    };
    return titles[sortType] || "Classement Général";
  },

  getRankEmoji(index) {
    const emojis = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
    return emojis[index] || `${index + 1}️⃣`;
  },

  getPlayerValue(player, sortType) {
    switch (sortType) {
      case "level":
        return `${player.experience} XP`;
      case "gold":
        return `${player.gold} 💰`;
      case "reputation":
        return `${player.reputation} 🏆`;
      case "wins":
        const totalCombats = player.combat.wins + player.combat.losses;
        const winRate =
          totalCombats > 0
            ? ((player.combat.wins / totalCombats) * 100).toFixed(1)
            : 0;
        return `${player.combat.wins} victoires (${winRate}%)`;
      case "quests":
        return `${player.quests.completed.length} quêtes`;
      default:
        return "";
    }
  },

  addGeneralStats(embed, players) {
    const totalPlayers = players.length;
    const totalLevel = players.reduce((sum, p) => sum + p.level, 0);
    const averageLevel = (totalLevel / totalPlayers).toFixed(1);

    // Statistiques par classe
    const classCounts = {};
    players.forEach((player) => {
      classCounts[player.class] = (classCounts[player.class] || 0) + 1;
    });

    const mostPopularClass = Object.entries(classCounts).sort(
      ([, a], [, b]) => b - a
    )[0];

    // Statistiques par faction
    const factionCounts = {};
    players.forEach((player) => {
      if (player.faction) {
        factionCounts[player.faction] =
          (factionCounts[player.faction] || 0) + 1;
      }
    });

    embed.addFields(
      {
        name: "👥 Joueurs totaux",
        value: totalPlayers.toString(),
        inline: true,
      },
      { name: "📊 Niveau moyen", value: averageLevel, inline: true },
      {
        name: "⚔️ Classe populaire",
        value: mostPopularClass
          ? `${classes[mostPopularClass[0]].emoji} ${
              classes[mostPopularClass[0]].name
            }`
          : "Aucune",
        inline: true,
      }
    );

    if (Object.keys(factionCounts).length > 0) {
      const topFaction = Object.entries(factionCounts).sort(
        ([, a], [, b]) => b - a
      )[0];

      embed.addFields({
        name: "🏛️ Faction dominante",
        value: `${factions[topFaction[0]].emoji} ${
          factions[topFaction[0]].name
        } (${topFaction[1]} membres)`,
        inline: false,
      });
    }
  },
};
