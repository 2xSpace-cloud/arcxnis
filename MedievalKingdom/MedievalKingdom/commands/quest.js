const { SlashCommandBuilder } = require("discord.js");
const { getPlayer, updatePlayer } = require("../utils/database.js");
const { createEmbed } = require("../utils/embeds.js");
const {
  generateRandomQuest,
  completeQuest,
  isActiveQuestValid,
  initQuestObjectives,
  isQuestComplete,
} = require("../systems/questSystem.js");
const fs = require("fs");
const path = require("path");

// Charger la base d'items
const itemsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../database/items.json"), "utf8")
);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("quete")
    .setDescription("Gestion des quêtes")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("nouvelle")
        .setDescription("Obtenir une nouvelle quête")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("active").setDescription("Voir votre quête active")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("terminer")
        .setDescription("Terminer votre quête active")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("abandonner")
        .setDescription("Abandonner votre quête active")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("historique")
        .setDescription("Voir vos quêtes terminées")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "nouvelle":
          await this.getNewQuest(interaction);
          break;
        case "active":
          await this.showActiveQuest(interaction);
          break;
        case "terminer":
          await this.completeQuest(interaction);
          break;
        case "abandonner":
          await this.abandonQuest(interaction);
          break;
        case "historique":
          await this.showHistory(interaction);
          break;
      }
    } catch (error) {
      console.error("Erreur dans la commande quête:", error);
      await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Une erreur est survenue lors de l'exécution de la commande."
          ),
        ],
        ephemeral: true,
      });
    }
  },

  async getNewQuest(interaction) {
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

    if (player.quests.active) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous avez déjà une quête active ! Terminez-la ou abandonnez-la d'abord."
          ),
        ],
        ephemeral: true,
      });
    }

    // Vérifier la limite quotidienne de quêtes
    const now = new Date();
    const today = now.toDateString();
    const lastQuestDate = player.quests.lastQuestTime
      ? new Date(player.quests.lastQuestTime).toDateString()
      : null;

    if (lastQuestDate !== today) {
      player.quests.completedToday = 0;
    }

    const DAILY_QUEST_LIMIT = 10;
    if (player.quests.completedToday >= DAILY_QUEST_LIMIT) {
      const quetsRemaining = DAILY_QUEST_LIMIT - player.quests.completedToday;
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            `❌ Limite quotidienne atteinte !`,
            `Vous avez déjà complété **${player.quests.completedToday}/${DAILY_QUEST_LIMIT}** quêtes aujourd'hui.\n\n⏰ Revenez demain pour en faire d'autres !`
          ),
        ],
        ephemeral: true,
      });
    }

    // Générer une nouvelle quête
    const quest = generateRandomQuest(player);
    if (!quest) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Aucune quête disponible pour votre niveau et classe actuels."
          ),
        ],
        ephemeral: true,
      });
    }

    // Assigner la quête
    const activeQuest = {
      ...quest,
      startTime: new Date().toISOString(),
      progress: 0,
    };
    initQuestObjectives(activeQuest);
    player.quests.active = activeQuest;
    updatePlayer(userId, player);

    // Calculer les quêtes restantes
    const quetsRemaining =
      DAILY_QUEST_LIMIT - (player.quests.completedToday + 1);
    const progressBar = this.createProgressBar(
      player.quests.completedToday + 1,
      DAILY_QUEST_LIMIT
    );

    const embed = createEmbed(
      "success",
      `📜 Nouvelle quête obtenue !`
    ).addFields(
      { name: "🎯 Titre", value: quest.title, inline: false },
      { name: "📖 Description", value: quest.description, inline: false },
      {
        name: "⏱️ Durée estimée",
        value: `${quest.duration} minutes`,
        inline: true,
      },
      {
        name: "🎁 Récompenses",
        value: this.formatRewards(quest.rewards),
        inline: true,
      },
      {
        name: "📊 Quêtes du jour",
        value: `${progressBar}\n**${
          player.quests.completedToday + 1
        }/${DAILY_QUEST_LIMIT}** quêtes\n${quetsRemaining} restante(s)`,
        inline: false,
      }
    );

    await interaction.reply({ embeds: [embed] });
  },

  async showActiveQuest(interaction) {
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

    if (!player.quests.active) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "info",
            "Aucune quête active",
            "Utilisez `/quete nouvelle` pour obtenir une quête."
          ),
        ],
        ephemeral: true,
      });
    }

    // Vérifier que la quête est valide
    if (!isActiveQuestValid(player.quests.active)) {
      console.log(
        `🧹 Quête invalide détectée lors de l'affichage pour ${player.name}`
      );
      player.quests.active = null;
      updatePlayer(userId, player);
      return await interaction.reply({
        embeds: [
          createEmbed(
            "info",
            "Votre quête précédente n'était pas valide et a été supprimée. Vous pouvez en obtenir une nouvelle avec `/quete nouvelle`."
          ),
        ],
        ephemeral: true,
      });
    }

    const quest = player.quests.active;
    const complete = isQuestComplete(quest);

    const embed = createEmbed("info", `📜 Quête active : ${quest.title}`)
      .addFields({ name: "📖 Description", value: quest.description, inline: false });

    // Afficher les objectifs si disponibles
    if (quest.objectiveProgress && quest.objectiveProgress.length > 0) {
      const objLines = quest.objectiveProgress.map(obj => {
        const bar = this.createProgressBar(obj.current, obj.required);
        const done = obj.current >= obj.required ? " ✅" : "";
        return `${bar} **${obj.current}/${obj.required}**${done}\n${obj.description}`;
      });
      embed.addFields({
        name: "🎯 Objectifs",
        value: objLines.join("\n\n"),
        inline: false,
      });
    } else {
      // Ancienne logique (quêtes sans objectifs)
      const elapsedMinutes = Math.floor((Date.now() - new Date(quest.startTime)) / 60000);
      embed.addFields(
        { name: "⏱️ Temps écoulé", value: `${elapsedMinutes}/${quest.duration} min`, inline: true },
        { name: "📊 Progression", value: `${quest.progress || 0}%`, inline: true }
      );
    }

    embed.addFields({ name: "🎁 Récompenses", value: this.formatRewards(quest.rewards), inline: false });

    if (complete) {
      embed.addFields({
        name: "✅ Prête à être réclamée !",
        value: "Tous les objectifs sont accomplis ! Utilisez `/quete terminer` pour récupérer vos récompenses.",
        inline: false,
      });
    } else if (quest.objectiveProgress) {
      const totalDone = quest.objectiveProgress.reduce((s, o) => s + o.current, 0);
      const totalReq  = quest.objectiveProgress.reduce((s, o) => s + o.required, 0);
      embed.addFields({
        name: "⏳ En cours",
        value: `Progression totale : **${totalDone}/${totalReq}**\nContinuez à combattre pour avancer !`,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },

  async completeQuest(interaction) {
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

    if (!player.quests.active) {
      return await interaction.reply({
        embeds: [createEmbed("error", "Vous n'avez pas de quête active.")],
        ephemeral: true,
      });
    }

    // Vérifier que la quête est valide
    if (!isActiveQuestValid(player.quests.active)) {
      console.log(
        `🧹 Quête invalide détectée lors de la complétion pour ${player.name}`
      );
      player.quests.active = null;
      updatePlayer(userId, player);
      return await interaction.reply({
        embeds: [
          createEmbed(
            "info",
            "Votre quête précédente n'était pas valide et a été supprimée. Vous pouvez en obtenir une nouvelle avec `/quete nouvelle`."
          ),
        ],
        ephemeral: true,
      });
    }

    const quest = player.quests.active;
    const startTime = new Date(quest.startTime);
    const now = new Date();
    const elapsedMinutes = Math.floor((now - startTime) / 60000);

    if (!isQuestComplete(quest)) {
      // Message d'erreur adapté selon le type de quête
      let msg;
      if (quest.objectiveProgress && quest.objectiveProgress.length > 0) {
        const remaining = quest.objectiveProgress
          .filter(o => o.current < o.required)
          .map(o => `• ${o.description} (${o.current}/${o.required})`)
          .join("\n");
        msg = `Vos objectifs ne sont pas encore accomplis :\n${remaining}`;
      } else {
        const elapsedMinutes = Math.floor((Date.now() - new Date(quest.startTime)) / 60000);
        const remaining = quest.duration - elapsedMinutes;
        msg = `Votre quête n'est pas encore terminée ! Il reste ${remaining} minutes.`;
      }
      return await interaction.reply({
        embeds: [createEmbed("error", msg)],
        ephemeral: true,
      });
    }

    // Terminer la quête
    const result = completeQuest(player, quest);
    updatePlayer(userId, player);

    const embed = createEmbed(
      "success",
      `🎉 Quête "${quest.title}" terminée !`
    ).addFields(
      {
        name: "✨ Expérience gagnée",
        value: `+${result.experience} XP`,
        inline: true,
      },
      { name: "💰 Or gagné", value: `+${result.gold} or`, inline: true }
    );

    if (result.levelUp) {
      embed.addFields({
        name: "🌟 Niveau supérieur !",
        value: `Vous êtes maintenant niveau ${player.level} !`,
        inline: false,
      });
    }

    if (result.items && result.items.length > 0) {
      const itemNames = result.items.map(
        (itemId) => itemsData.items[itemId]?.name || itemId
      );
      embed.addFields({
        name: "🎁 Objets obtenus",
        value: itemNames.join(", "),
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },

  async abandonQuest(interaction) {
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

    if (!player.quests.active) {
      return await interaction.reply({
        embeds: [createEmbed("error", "Vous n'avez pas de quête active.")],
        ephemeral: true,
      });
    }

    const questTitle = player.quests.active.title;
    player.quests.active = null;
    updatePlayer(userId, player);

    const embed = createEmbed("info", "❌ Quête abandonnée")
      .setDescription(`Vous avez abandonné la quête "${questTitle}".`)
      .addFields({
        name: "ℹ️ Information",
        value: "Vous pouvez prendre une nouvelle quête immédiatement.",
        inline: false,
      });

    await interaction.reply({ embeds: [embed] });
  },

  async showHistory(interaction) {
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

    if (player.quests.completed.length === 0) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "info",
            "📜 Historique des quêtes",
            "Aucune quête terminée pour le moment."
          ),
        ],
        ephemeral: true,
      });
    }

    const embed = createEmbed(
      "info",
      `📜 Historique des quêtes de ${player.name}`
    ).addFields(
      {
        name: "📊 Statistiques",
        value: `${player.quests.completed.length} quêtes terminées`,
        inline: true,
      },
      {
        name: "🏆 Quêtes aujourd'hui",
        value: player.quests.completedToday.toString(),
        inline: true,
      }
    );

    // Afficher les 10 dernières quêtes terminées
    const recentQuests = player.quests.completed.slice(-10).reverse();
    if (recentQuests.length > 0) {
      const questList = recentQuests
        .map((quest, index) => {
          const date = new Date(quest.completedAt).toLocaleDateString();
          return `${index + 1}. **${quest.title}** (${date})`;
        })
        .join("\n");

      embed.addFields({
        name: "🗓️ Quêtes récentes",
        value: questList,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },

  createProgressBar(current, max) {
    const filledLength = Math.round((current / max) * 10);
    const emptyLength = 10 - filledLength;
    const filled = "🟩".repeat(filledLength);
    const empty = "⬜".repeat(emptyLength);
    return filled + empty;
  },

  formatRewards(rewards) {
    const parts = [];

    if (rewards.experience) {
      parts.push(`${rewards.experience} XP`);
    }

    if (rewards.gold) {
      parts.push(`${rewards.gold} or`);
    }

    if (rewards.items && rewards.items.length > 0) {
      const itemNames = rewards.items.map(
        (itemId) => itemsData.items[itemId]?.name || itemId
      );
      parts.push(`Objets: ${itemNames.join(", ")}`);
    }

    return parts.join("\n") || "Aucune récompense";
  },
};
