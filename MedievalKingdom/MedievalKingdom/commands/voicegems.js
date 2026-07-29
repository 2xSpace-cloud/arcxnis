const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getPlayer } = require("../utils/database.js");
const { createEmbed } = require("../utils/embeds.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gemmesvocales")
    .setDescription("Voir votre progression de gemmes vocales"),

  async execute(interaction) {
    const userId = interaction.user.id;
    const player = getPlayer(userId);

    if (!player) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez d'abord créer un personnage avec `/personnage creer`."
          ),
        ],
        ephemeral: true,
      });
    }

    // Initialiser voiceGemmes si nécessaire
    if (!player.voiceGemmes) {
      player.voiceGemmes = {
        dailyGemmes: 0,
        lastReset: new Date().toISOString(),
        joinTime: null,
      };
    }

    // Vérifier si c'est un nouveau jour
    const now = new Date();
    const lastReset = new Date(player.voiceGemmes.lastReset);
    if (now.toDateString() !== lastReset.toDateString()) {
      player.voiceGemmes.dailyGemmes = 0;
      player.voiceGemmes.lastReset = now.toISOString();
    }

    const MAX_GEMMES_PER_DAY = 50;
    const dailyGemmes = player.voiceGemmes.dailyGemmes || 0;
    const remainingGemmes = MAX_GEMMES_PER_DAY - dailyGemmes;
    const totalGemmes = player.gemmes || 0;
    const isInVoice = player.voiceGemmes.joinTime !== null;

    // Calculer le temps en vocal aujourd'hui
    const minutesInVoice = dailyGemmes; // 1 gemme = 1 minute
    const hoursInVoice = Math.floor(minutesInVoice / 60);
    const remainingMinutes = minutesInVoice % 60;

    // Créer la barre de progression
    const progressBarLength = 20;
    const filledBars = Math.floor(
      (dailyGemmes / MAX_GEMMES_PER_DAY) * progressBarLength
    );
    const emptyBars = progressBarLength - filledBars;
    const progressBar = "█".repeat(filledBars) + "░".repeat(emptyBars);

    const embed = new EmbedBuilder()
      .setColor(isInVoice ? "#00ff00" : "#0099ff")
      .setTitle("💎 Gemmes Vocales")
      .setDescription(
        isInVoice
          ? "🎤 **Vous êtes actuellement en vocal !**\nVous gagnez 1 gemme par minute (vérification toutes les 5 minutes)"
          : "🔇 **Vous n'êtes pas en vocal**\nRejoignez un salon vocal pour gagner des gemmes !"
      )
      .addFields(
        {
          name: "📊 Progression Quotidienne",
          value: `${progressBar}\n**${dailyGemmes}/${MAX_GEMMES_PER_DAY}** gemmes (${Math.floor(
            (dailyGemmes / MAX_GEMMES_PER_DAY) * 100
          )}%)`,
          inline: false,
        },
        {
          name: "⏰ Temps en Vocal Aujourd'hui",
          value:
            hoursInVoice > 0
              ? `${hoursInVoice}h ${remainingMinutes}min`
              : `${remainingMinutes}min`,
          inline: true,
        },
        {
          name: "💰 Gemmes Restantes Aujourd'hui",
          value: `${remainingGemmes} gemmes`,
          inline: true,
        },
        {
          name: "💎 Total de Gemmes",
          value: `${totalGemmes} gemmes`,
          inline: true,
        }
      )
      .setFooter({
        text:
          remainingGemmes === 0
            ? "Limite quotidienne atteinte ! Revenez demain."
            : "Restez en vocal pour gagner plus de gemmes !",
      })
      .setTimestamp();

    // Ajouter des informations supplémentaires
    if (remainingGemmes > 0) {
      const minutesNeeded = remainingGemmes;
      const hoursNeeded = Math.floor(minutesNeeded / 60);
      const minsNeeded = minutesNeeded % 60;

      let timeText = "";
      if (hoursNeeded > 0) {
        timeText = `${hoursNeeded}h ${minsNeeded}min`;
      } else {
        timeText = `${minsNeeded}min`;
      }

      embed.addFields({
        name: "⏳ Temps Restant pour Atteindre la Limite",
        value: timeText,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
