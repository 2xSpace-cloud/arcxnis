const { SlashCommandBuilder } = require("discord.js");
const { getPlayer, updatePlayer } = require("../utils/database.js");
const { createEmbed } = require("../utils/embeds.js");
const { factions } = require("../systems/gameData.js");
const fs = require("fs");
const path = require("path");

// Charger les quêtes de guilde
const guildQuestsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../database/guildQuests.json"), "utf8")
);

// Charger la base d'items
const itemsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../database/items.json"), "utf8")
);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queteguilde")
    .setDescription("Quêtes spéciales de votre guilde/faction")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("liste")
        .setDescription("Voir les quêtes disponibles pour votre guilde")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("accepter")
        .setDescription("Accepter une quête de guilde")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID de la quête à accepter")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("terminer")
        .setDescription("Terminer votre quête de guilde active")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("abandonner")
        .setDescription("Abandonner votre quête de guilde active")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("active")
        .setDescription("Voir votre quête de guilde active")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
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

    if (!player.faction) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "🏛️ Aucune faction",
            "Vous devez rejoindre une faction avec `/faction rejoindre` pour accéder aux quêtes de guilde."
          ),
        ],
        ephemeral: true,
      });
    }

    // Initialiser le système de quêtes de guilde si nécessaire
    if (!player.guildQuests) {
      player.guildQuests = {
        active: null,
        completed: [],
        completedToday: 0,
        lastQuestTime: null,
      };
    }

    switch (subcommand) {
      case "liste":
        await this.showGuildQuests(interaction, player);
        break;
      case "accepter":
        await this.acceptGuildQuest(interaction, player);
        break;
      case "terminer":
        await this.completeGuildQuest(interaction, player);
        break;
      case "abandonner":
        await this.abandonGuildQuest(interaction, player);
        break;
      case "active":
        await this.showActiveGuildQuest(interaction, player);
        break;
    }
  },

  async showGuildQuests(interaction, player) {
    const factionQuests = guildQuestsData[player.faction] || [];
    const factionData = factions[player.faction];

    if (factionQuests.length === 0) {
      return await interaction.reply({
        embeds: [
          createEmbed("info", "Aucune quête disponible pour votre faction."),
        ],
        ephemeral: true,
      });
    }

    const embed = createEmbed(
      "info",
      `${factionData.emoji} Quêtes de ${factionData.name}`
    ).setDescription(
      `**Quêtes exclusives de votre guilde**\n\n` +
        `Ces quêtes sont réservées aux membres de ${factionData.name} et offrent des récompenses spéciales.\n\n`
    );

    // Grouper par difficulté
    const questsByDifficulty = {
      facile: [],
      moyen: [],
      difficile: [],
    };

    factionQuests.forEach((quest) => {
      if (player.level >= quest.requirements.minLevel) {
        questsByDifficulty[quest.difficulty].push(quest);
      }
    });

    // Afficher les quêtes faciles
    if (questsByDifficulty.facile.length > 0) {
      const questList = questsByDifficulty.facile
        .map(
          (q) =>
            `**${q.title}** (Niv. ${q.requirements.minLevel}+)\n` +
            `ID: \`${q.id}\` • ⏱️ ${q.duration} min\n` +
            `${q.description}\n` +
            `💰 ${q.rewards.gold} or • ✨ ${q.rewards.experience} XP • 🏆 ${q.rewards.reputation} réputation`
        )
        .join("\n\n");
      embed.addFields({
        name: "🟢 Quêtes Faciles",
        value: questList,
        inline: false,
      });
    }

    // Afficher les quêtes moyennes
    if (questsByDifficulty.moyen.length > 0) {
      const questList = questsByDifficulty.moyen
        .map(
          (q) =>
            `**${q.title}** (Niv. ${q.requirements.minLevel}+)\n` +
            `ID: \`${q.id}\` • ⏱️ ${q.duration} min\n` +
            `${q.description}\n` +
            `💰 ${q.rewards.gold} or • ✨ ${q.rewards.experience} XP • 🏆 ${q.rewards.reputation} réputation`
        )
        .join("\n\n");
      embed.addFields({
        name: "🟡 Quêtes Moyennes",
        value: questList,
        inline: false,
      });
    }

    // Afficher les quêtes difficiles
    if (questsByDifficulty.difficile.length > 0) {
      const questList = questsByDifficulty.difficile
        .map(
          (q) =>
            `**${q.title}** (Niv. ${q.requirements.minLevel}+)\n` +
            `ID: \`${q.id}\` • ⏱️ ${q.duration} min\n` +
            `${q.description}\n` +
            `💰 ${q.rewards.gold} or • ✨ ${q.rewards.experience} XP • 🏆 ${q.rewards.reputation} réputation`
        )
        .join("\n\n");
      embed.addFields({
        name: "🔴 Quêtes Difficiles",
        value: questList,
        inline: false,
      });
    }

    embed.setFooter({
      text: `Utilisez /queteguilde accepter id:<id> pour accepter une quête`,
    });

    await interaction.reply({ embeds: [embed] });
  },

  async acceptGuildQuest(interaction, player) {
    const questId = interaction.options.getString("id");
    const factionQuests = guildQuestsData[player.faction] || [];
    const quest = factionQuests.find((q) => q.id === questId);

    if (!quest) {
      return await interaction.reply({
        embeds: [
          createEmbed("error", "Cette quête n'existe pas pour votre faction."),
        ],
        ephemeral: true,
      });
    }

    if (player.guildQuests.active) {
      return await interaction.reply({
        embeds: [
          createEmbed("error", "Vous avez déjà une quête de guilde active."),
        ],
        ephemeral: true,
      });
    }

    if (player.level < quest.requirements.minLevel) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            `Vous devez être niveau ${quest.requirements.minLevel} minimum pour cette quête.`
          ),
        ],
        ephemeral: true,
      });
    }

    // Vérifier le cooldown (30 minutes)
    if (player.guildQuests.lastQuestTime) {
      const lastQuest = new Date(player.guildQuests.lastQuestTime);
      const now = new Date();
      const cooldownMs = 30 * 60 * 1000;
      const timeSinceLastQuest = now - lastQuest;

      if (timeSinceLastQuest < cooldownMs) {
        const remainingTime = Math.ceil(
          (cooldownMs - timeSinceLastQuest) / 60000
        );
        return await interaction.reply({
          embeds: [
            createEmbed(
              "error",
              `Vous devez attendre encore ${remainingTime} minutes avant de pouvoir prendre une nouvelle quête de guilde.`
            ),
          ],
          ephemeral: true,
        });
      }
    }

    // Accepter la quête
    player.guildQuests.active = {
      ...quest,
      startTime: new Date().toISOString(),
      progress: 0,
    };
    updatePlayer(interaction.user.id, player);

    const difficultyEmoji = {
      facile: "🟢",
      moyen: "🟡",
      difficile: "🔴",
    };

    const embed = createEmbed(
      "success",
      `${factions[player.faction].emoji} Quête de guilde acceptée !`
    ).addFields(
      { name: "🎯 Titre", value: quest.title, inline: false },
      { name: "📖 Description", value: quest.description, inline: false },
      { name: "⏱️ Durée", value: `${quest.duration} minutes`, inline: true },
      {
        name: "📊 Difficulté",
        value: `${difficultyEmoji[quest.difficulty]} ${
          quest.difficulty.charAt(0).toUpperCase() + quest.difficulty.slice(1)
        }`,
        inline: true,
      },
      {
        name: "🎁 Récompenses",
        value: `💰 ${quest.rewards.gold} or\n✨ ${quest.rewards.experience} XP\n🏆 ${quest.rewards.reputation} réputation`,
        inline: false,
      }
    );

    await interaction.reply({ embeds: [embed] });
  },

  async showActiveGuildQuest(interaction, player) {
    if (!player.guildQuests.active) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "info",
            "Aucune quête de guilde active",
            "Utilisez `/queteguilde liste` pour voir les quêtes disponibles."
          ),
        ],
        ephemeral: true,
      });
    }

    const quest = player.guildQuests.active;
    const startTime = new Date(quest.startTime);
    const now = new Date();
    const elapsedMinutes = Math.floor((now - startTime) / 60000);
    const remainingMinutes = Math.max(0, quest.duration - elapsedMinutes);

    const embed = createEmbed(
      "info",
      `${factions[player.faction].emoji} Quête de guilde active`
    ).addFields(
      { name: "🎯 Titre", value: quest.title, inline: false },
      { name: "📖 Description", value: quest.description, inline: false },
      {
        name: "⏱️ Temps écoulé",
        value: `${elapsedMinutes}/${quest.duration} minutes`,
        inline: true,
      },
      {
        name: "⏳ Temps restant",
        value: `${remainingMinutes} minutes`,
        inline: true,
      }
    );

    if (elapsedMinutes >= quest.duration) {
      embed.addFields({
        name: "✅ Statut",
        value:
          "Quête terminée ! Utilisez `/queteguilde terminer` pour récupérer vos récompenses.",
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },

  async completeGuildQuest(interaction, player) {
    if (!player.guildQuests.active) {
      return await interaction.reply({
        embeds: [
          createEmbed("error", "Vous n'avez pas de quête de guilde active."),
        ],
        ephemeral: true,
      });
    }

    const quest = player.guildQuests.active;
    const startTime = new Date(quest.startTime);
    const now = new Date();
    const elapsedMinutes = Math.floor((now - startTime) / 60000);

    if (elapsedMinutes < quest.duration) {
      const remaining = quest.duration - elapsedMinutes;
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            `Votre quête n'est pas encore terminée ! Il reste ${remaining} minutes.`
          ),
        ],
        ephemeral: true,
      });
    }

    // Calculer les récompenses
    const experienceGained = quest.rewards.experience;
    const goldGained = quest.rewards.gold;
    const reputationGained = quest.rewards.reputation;

    // Appliquer les récompenses
    const oldLevel = player.level;
    player.experience += experienceGained;
    player.gold += goldGained;
    player.reputation += reputationGained;

    // Vérifier la montée de niveau
    let currentLevel = player.level;
    let totalExp = player.experience;
    while (totalExp >= currentLevel * 100) {
      totalExp -= currentLevel * 100;
      currentLevel++;
    }

    const levelUp = currentLevel > oldLevel;
    if (levelUp) {
      player.level = currentLevel;
      player.experience = totalExp;

      // Augmenter les stats
      const levelsGained = currentLevel - oldLevel;
      player.maxHealth += levelsGained * 10;
      player.maxMana += levelsGained * 5;
      player.health = player.maxHealth;
      player.mana = player.maxMana;
      player.stats.attack += levelsGained;
      player.stats.defense += levelsGained;
      player.stats.magicAttack += levelsGained;
      player.stats.magicDefense += levelsGained;
    }

    // Ajouter les items
    const itemsGained = [];
    if (quest.rewards.items && quest.rewards.items.length > 0) {
      quest.rewards.items.forEach((itemId) => {
        if (!player.inventory[itemId]) {
          player.inventory[itemId] = 0;
        }
        player.inventory[itemId]++;
        itemsGained.push(itemId);
      });
    }

    // Mettre à jour les statistiques
    player.guildQuests.completed.push({
      id: quest.id,
      title: quest.title,
      completedAt: now.toISOString(),
      rewards: quest.rewards,
    });
    player.guildQuests.completedToday++;
    player.guildQuests.lastQuestTime = now.toISOString();
    player.guildQuests.active = null;

    updatePlayer(interaction.user.id, player);

    const embed = createEmbed(
      "success",
      `🎉 Quête de guilde "${quest.title}" terminée !`
    ).addFields(
      {
        name: "✨ Expérience gagnée",
        value: `+${experienceGained} XP`,
        inline: true,
      },
      { name: "💰 Or gagné", value: `+${goldGained} or`, inline: true },
      {
        name: "🏆 Réputation gagnée",
        value: `+${reputationGained}`,
        inline: true,
      }
    );

    if (levelUp) {
      embed.addFields({
        name: "🌟 Niveau supérieur !",
        value: `Vous êtes maintenant niveau ${player.level} !`,
        inline: false,
      });
    }

    if (itemsGained.length > 0) {
      const itemNames = itemsGained.map(
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

  async abandonGuildQuest(interaction, player) {
    if (!player.guildQuests.active) {
      return await interaction.reply({
        embeds: [
          createEmbed("error", "Vous n'avez pas de quête de guilde active."),
        ],
        ephemeral: true,
      });
    }

    const questTitle = player.guildQuests.active.title;
    player.guildQuests.active = null;
    updatePlayer(interaction.user.id, player);

    const embed = createEmbed("info", "❌ Quête de guilde abandonnée")
      .setDescription(`Vous avez abandonné la quête "${questTitle}".`)
      .addFields({
        name: "ℹ️ Information",
        value:
          "Vous pouvez prendre une nouvelle quête de guilde immédiatement.",
        inline: false,
      });

    await interaction.reply({ embeds: [embed] });
  },
};
