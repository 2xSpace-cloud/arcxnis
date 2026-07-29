const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getPlayer, updatePlayer } = require("../utils/database.js");
const { createEmbed } = require("../utils/embeds.js");
const specialQuestsData = require("../database/specialQuests.json");
const fs = require("fs");
const path = require("path");

// Charger la base d'items
const itemsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../database/items.json"), "utf8")
);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("quetespeciale")
    .setDescription(
      "Quêtes spéciales du Réseau Souterrain (nécessite la Carte du Réseau)"
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("liste")
        .setDescription("Voir les quêtes spéciales disponibles")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("accepter")
        .setDescription("Accepter une quête spéciale")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID de la quête à accepter")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("active")
        .setDescription("Voir votre quête spéciale active")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("terminer")
        .setDescription("Terminer votre quête spéciale active")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("abandonner")
        .setDescription("Abandonner votre quête spéciale active")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "liste":
          await this.showQuestList(interaction);
          break;
        case "accepter":
          await this.acceptQuest(interaction);
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
      }
    } catch (error) {
      console.error("Erreur dans la commande quête spéciale:", error);
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

  async showQuestList(interaction) {
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

    // Vérifier si le joueur possède la Carte du Réseau Souterrain
    if (!player.inventory.carte_reseau || player.inventory.carte_reseau < 1) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "🗺️ Accès refusé",
            "Vous devez posséder la **Carte du Réseau Souterrain** pour accéder à ces quêtes spéciales.\n\n" +
              "Cette carte légendaire peut être obtenue au **Marché Noir** (400 💰) ou en récompense de certaines quêtes de guilde difficiles."
          ),
        ],
        ephemeral: true,
      });
    }

    const quests = specialQuestsData.underground_network;

    const embed = new EmbedBuilder()
      .setTitle("🗺️ Quêtes Spéciales du Réseau Souterrain")
      .setDescription(
        "**Bienvenue dans les profondeurs, explorateur...**\n\n" +
          "Votre Carte du Réseau Souterrain vous donne accès à des quêtes exclusives dans les tunnels secrets sous le royaume. " +
          "Ces missions sont dangereuses mais extrêmement lucratives.\n\n" +
          `**Votre niveau :** ${player.level}\n` +
          `**Quêtes disponibles :**`
      )
      .setColor("#2c1810");

    // Grouper par difficulté
    const questsByDifficulty = {
      facile: [],
      moyen: [],
      difficile: [],
    };

    quests.forEach((quest) => {
      questsByDifficulty[quest.difficulty].push(quest);
    });

    // Ajouter les quêtes faciles
    if (questsByDifficulty.facile.length > 0) {
      const easyQuests = questsByDifficulty.facile
        .map((quest) => {
          const available = player.level >= quest.requirements.minLevel;
          const status = available ? "✅" : "🔒";
          return (
            `${status} **${quest.title}** (Niveau ${quest.requirements.minLevel}+)\n` +
            `ID: \`${quest.id}\` • ⏱️ ${quest.duration}min • 💰 ${quest.rewards.gold} or • ⭐ ${quest.rewards.experience} XP\n` +
            `${quest.description.substring(0, 100)}...`
          );
        })
        .join("\n\n");

      embed.addFields({
        name: "🟢 Quêtes Faciles",
        value: easyQuests,
        inline: false,
      });
    }

    // Ajouter les quêtes moyennes
    if (questsByDifficulty.moyen.length > 0) {
      const mediumQuests = questsByDifficulty.moyen
        .map((quest) => {
          const available = player.level >= quest.requirements.minLevel;
          const status = available ? "✅" : "🔒";
          return (
            `${status} **${quest.title}** (Niveau ${quest.requirements.minLevel}+)\n` +
            `ID: \`${quest.id}\` • ⏱️ ${quest.duration}min • 💰 ${quest.rewards.gold} or • ⭐ ${quest.rewards.experience} XP\n` +
            `${quest.description.substring(0, 100)}...`
          );
        })
        .join("\n\n");

      embed.addFields({
        name: "🟡 Quêtes Moyennes",
        value: mediumQuests,
        inline: false,
      });
    }

    // Ajouter les quêtes difficiles
    if (questsByDifficulty.difficile.length > 0) {
      const hardQuests = questsByDifficulty.difficile
        .map((quest) => {
          const available = player.level >= quest.requirements.minLevel;
          const status = available ? "✅" : "🔒";
          return (
            `${status} **${quest.title}** (Niveau ${quest.requirements.minLevel}+)\n` +
            `ID: \`${quest.id}\` • ⏱️ ${quest.duration}min • 💰 ${quest.rewards.gold} or • ⭐ ${quest.rewards.experience} XP\n` +
            `${quest.description.substring(0, 100)}...`
          );
        })
        .join("\n\n");

      embed.addFields({
        name: "🔴 Quêtes Difficiles",
        value: hardQuests,
        inline: false,
      });
    }

    embed.setFooter({
      text: "Utilisez /quetespeciale accepter id:<id> pour commencer une quête",
    });

    await interaction.reply({ embeds: [embed] });
  },

  async acceptQuest(interaction) {
    const userId = interaction.user.id;
    const player = getPlayer(userId);
    const questId = interaction.options.getString("id");

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

    // Vérifier la possession de la carte
    if (!player.inventory.carte_reseau || player.inventory.carte_reseau < 1) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez posséder la **Carte du Réseau Souterrain** pour accepter cette quête."
          ),
        ],
        ephemeral: true,
      });
    }

    // Initialiser specialQuests si nécessaire
    if (!player.specialQuests) {
      player.specialQuests = {
        active: null,
        completed: [],
        lastQuestTime: null,
      };
    }

    // Vérifier si une quête spéciale est déjà active
    if (player.specialQuests.active) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous avez déjà une quête spéciale active ! Terminez-la ou abandonnez-la d'abord."
          ),
        ],
        ephemeral: true,
      });
    }

    // Vérifier le cooldown (1 heure)
    if (player.specialQuests.lastQuestTime) {
      const lastQuest = new Date(player.specialQuests.lastQuestTime);
      const now = new Date();
      const cooldownMs = 60 * 60 * 1000; // 1 heure
      const timeSinceLastQuest = now - lastQuest;

      if (timeSinceLastQuest < cooldownMs) {
        const remainingMinutes = Math.ceil(
          (cooldownMs - timeSinceLastQuest) / 60000
        );
        return await interaction.reply({
          embeds: [
            createEmbed(
              "error",
              `Les quêtes spéciales sont épuisantes. Vous devez attendre encore ${remainingMinutes} minutes avant d'en accepter une nouvelle.`
            ),
          ],
          ephemeral: true,
        });
      }
    }

    // Trouver la quête
    const quest = specialQuestsData.underground_network.find(
      (q) => q.id === questId
    );

    if (!quest) {
      return await interaction.reply({
        embeds: [createEmbed("error", "Cette quête spéciale n'existe pas.")],
        ephemeral: true,
      });
    }

    // Vérifier le niveau requis
    if (player.level < quest.requirements.minLevel) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            `Vous devez être niveau ${quest.requirements.minLevel} minimum pour accepter cette quête (vous êtes niveau ${player.level}).`
          ),
        ],
        ephemeral: true,
      });
    }

    // Accepter la quête
    player.specialQuests.active = {
      ...quest,
      startTime: new Date().toISOString(),
      progress: 0,
    };
    updatePlayer(userId, player);

    const difficultyEmoji = {
      facile: "🟢",
      moyen: "🟡",
      difficile: "🔴",
    };

    const embed = createEmbed("success", "🗺️ Quête Spéciale Acceptée !")
      .setDescription(
        "Vous vous enfoncez dans les tunnels secrets du réseau souterrain..."
      )
      .addFields(
        { name: "🎯 Titre", value: quest.title, inline: false },
        { name: "📖 Description", value: quest.description, inline: false },
        {
          name: "📊 Difficulté",
          value: `${difficultyEmoji[quest.difficulty]} ${
            quest.difficulty.charAt(0).toUpperCase() + quest.difficulty.slice(1)
          }`,
          inline: true,
        },
        {
          name: "⏱️ Durée estimée",
          value: `${quest.duration} minutes`,
          inline: true,
        },
        {
          name: "🎁 Récompenses",
          value: this.formatRewards(quest.rewards),
          inline: false,
        }
      )
      .setColor("#2c1810");

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

    if (!player.specialQuests || !player.specialQuests.active) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "info",
            "Aucune quête spéciale active",
            "Utilisez `/quetespeciale liste` pour voir les quêtes disponibles."
          ),
        ],
        ephemeral: true,
      });
    }

    const quest = player.specialQuests.active;
    const startTime = new Date(quest.startTime);
    const now = new Date();
    const elapsedMinutes = Math.floor((now - startTime) / 60000);

    const difficultyEmoji = {
      facile: "🟢",
      moyen: "🟡",
      difficile: "🔴",
    };

    const embed = createEmbed("info", `🗺️ Quête Spéciale : ${quest.title}`)
      .addFields(
        { name: "📖 Description", value: quest.description, inline: false },
        {
          name: "📊 Difficulté",
          value: `${difficultyEmoji[quest.difficulty]} ${
            quest.difficulty.charAt(0).toUpperCase() + quest.difficulty.slice(1)
          }`,
          inline: true,
        },
        {
          name: "⏱️ Temps écoulé",
          value: `${elapsedMinutes}/${quest.duration} minutes`,
          inline: true,
        },
        {
          name: "🎁 Récompenses",
          value: this.formatRewards(quest.rewards),
          inline: false,
        }
      )
      .setColor("#2c1810");

    // Vérifier si la quête peut être terminée
    if (elapsedMinutes >= quest.duration) {
      embed.addFields({
        name: "✅ Statut",
        value:
          "Quête terminée ! Utilisez `/quetespeciale terminer` pour récupérer vos récompenses.",
        inline: false,
      });
    } else {
      const remaining = quest.duration - elapsedMinutes;
      embed.addFields({
        name: "⏳ Temps restant",
        value: `${remaining} minutes`,
        inline: true,
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

    if (!player.specialQuests || !player.specialQuests.active) {
      return await interaction.reply({
        embeds: [
          createEmbed("error", "Vous n'avez pas de quête spéciale active."),
        ],
        ephemeral: true,
      });
    }

    const quest = player.specialQuests.active;
    const startTime = new Date(quest.startTime);
    const now = new Date();
    const elapsedMinutes = Math.floor((now - startTime) / 60000);

    if (elapsedMinutes < quest.duration) {
      const remaining = quest.duration - elapsedMinutes;
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            `Votre quête spéciale n'est pas encore terminée ! Il reste ${remaining} minutes.`
          ),
        ],
        ephemeral: true,
      });
    }

    // Appliquer les récompenses
    const oldLevel = player.level;
    player.experience += quest.rewards.experience;
    player.gold += quest.rewards.gold;

    if (quest.rewards.reputation) {
      player.reputation = (player.reputation || 0) + quest.rewards.reputation;
    }

    // Ajouter les items
    const itemsReceived = [];
    if (quest.rewards.items && quest.rewards.items.length > 0) {
      quest.rewards.items.forEach((item) => {
        if (!player.inventory[item]) {
          player.inventory[item] = 0;
        }
        player.inventory[item]++;
        itemsReceived.push(item);
      });
    }

    // Vérifier la montée de niveau (formule linéaire : niveau * 100 exp requis)
    let currentLevel = player.level;
    let totalExp = player.experience;
    let leveledUp = false;
    const statsGained = {
      health: 0,
      mana: 0,
      attack: 0,
      defense: 0,
    };

    while (totalExp >= currentLevel * 100) {
      totalExp -= currentLevel * 100;
      currentLevel++;
      leveledUp = true;
    }

    if (leveledUp) {
      const levelsGained = currentLevel - player.level;

      // Augmenter les stats
      const healthGain = levelsGained * 10;
      const manaGain = levelsGained * 5;

      player.maxHealth += healthGain;
      player.maxMana += manaGain;
      player.health = player.maxHealth;
      player.mana = player.maxMana;

      player.stats.attack += levelsGained;
      player.stats.defense += levelsGained;
      player.stats.magicAttack += levelsGained;
      player.stats.magicDefense += levelsGained;

      player.level = currentLevel;
      player.experience = totalExp;

      statsGained.health = healthGain;
      statsGained.mana = manaGain;
      statsGained.attack = levelsGained;
      statsGained.defense = levelsGained;
    }

    // Ajouter à l'historique
    player.specialQuests.completed.push({
      id: quest.id,
      title: quest.title,
      completedAt: new Date().toISOString(),
      rewards: quest.rewards,
    });

    // Réinitialiser la quête active et mettre à jour le cooldown
    player.specialQuests.active = null;
    player.specialQuests.lastQuestTime = new Date().toISOString();

    updatePlayer(userId, player);

    const embed = createEmbed(
      "success",
      `🎉 Quête Spéciale "${quest.title}" Terminée !`
    )
      .setDescription(
        "Vous émergez des tunnels souterrains, vos poches pleines de trésors..."
      )
      .addFields(
        {
          name: "✨ Expérience gagnée",
          value: `+${quest.rewards.experience} XP`,
          inline: true,
        },
        {
          name: "💰 Or gagné",
          value: `+${quest.rewards.gold} or`,
          inline: true,
        }
      )
      .setColor("#2c1810");

    if (quest.rewards.reputation) {
      embed.addFields({
        name: "⭐ Réputation gagnée",
        value: `+${quest.rewards.reputation} points`,
        inline: true,
      });
    }

    if (leveledUp) {
      embed.addFields({
        name: "🌟 Niveau supérieur !",
        value: `Vous êtes maintenant niveau ${player.level} !\n+${statsGained.health} PV, +${statsGained.mana} Mana, +${statsGained.attack} Attaque, +${statsGained.defense} Défense`,
        inline: false,
      });
    }

    if (itemsReceived.length > 0) {
      embed.addFields({
        name: "🎁 Objets obtenus",
        value: itemsReceived.join(", "),
        inline: false,
      });
    }

    embed.setFooter({
      text: "Cooldown : 1 heure avant la prochaine quête spéciale",
    });

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

    if (!player.specialQuests || !player.specialQuests.active) {
      return await interaction.reply({
        embeds: [
          createEmbed("error", "Vous n'avez pas de quête spéciale active."),
        ],
        ephemeral: true,
      });
    }

    const questTitle = player.specialQuests.active.title;
    player.specialQuests.active = null;
    updatePlayer(userId, player);

    const embed = createEmbed("info", "❌ Quête Spéciale Abandonnée")
      .setDescription(
        `Vous avez abandonné la quête "${questTitle}" et êtes remonté à la surface.`
      )
      .addFields({
        name: "ℹ️ Information",
        value:
          "Vous pouvez accepter une nouvelle quête spéciale immédiatement (pas de cooldown pour les abandons).",
        inline: false,
      })
      .setColor("#2c1810");

    await interaction.reply({ embeds: [embed] });
  },

  formatRewards(rewards) {
    const parts = [];

    if (rewards.experience) {
      parts.push(`⭐ ${rewards.experience} XP`);
    }

    if (rewards.gold) {
      parts.push(`💰 ${rewards.gold} or`);
    }

    if (rewards.reputation) {
      parts.push(`⭐ ${rewards.reputation} réputation`);
    }

    if (rewards.items && rewards.items.length > 0) {
      const itemNames = rewards.items.map(
        (itemId) => itemsData.items[itemId]?.name || itemId
      );
      parts.push(`🎁 ${itemNames.join(", ")}`);
    }

    return parts.join("\n") || "Aucune récompense";
  },
};
