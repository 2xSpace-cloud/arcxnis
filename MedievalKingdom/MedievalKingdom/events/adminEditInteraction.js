const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { getPlayer, updatePlayer } = require("../utils/database");
const { createEmbed } = require("../utils/embeds");
const { classes, factions } = require("../systems/gameData");
const {
  logGoldChange,
  logExperienceChange,
  logLevelChange,
  logAdminAction,
} = require("../utils/auditLog");

// Fonction principale exportée pour être appelée depuis interactionCreate.js
async function handleAdminEditInteraction(interaction) {
  try {
    // Vérifier les permissions admin
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({
        content: "❌ Vous n'avez pas les permissions d'administrateur.",
        ephemeral: true,
      });
    }

    const customId = interaction.customId;

    // Extraire l'ID du joueur cible
    const parts = customId.split("_");
    const targetUserId = parts[parts.length - 1];

    // Gérer les différentes interactions
    if (customId.startsWith("edit_close_")) {
      await handleClose(interaction);
    } else if (customId.startsWith("edit_stats_")) {
      await handleStatsMenu(interaction, targetUserId);
    } else if (customId.startsWith("edit_resources_")) {
      await handleResourcesMenu(interaction, targetUserId);
    } else if (customId.startsWith("edit_class_")) {
      await handleClassMenu(interaction, targetUserId);
    } else if (customId.startsWith("edit_faction_")) {
      await handleFactionMenu(interaction, targetUserId);
    } else if (customId.startsWith("edit_stat_select_")) {
      await handleStatSelect(interaction, targetUserId);
    } else if (customId.startsWith("edit_resource_select_")) {
      await handleResourceSelect(interaction, targetUserId);
    } else if (customId.startsWith("edit_class_select_")) {
      await handleClassSelect(interaction, targetUserId);
    } else if (customId.startsWith("edit_faction_select_")) {
      await handleFactionSelect(interaction, targetUserId);
    } else if (customId.startsWith("edit_modal_")) {
      await handleModalSubmit(interaction, targetUserId);
    } else if (customId.startsWith("edit_back_")) {
      await handleBack(interaction, targetUserId);
    }
  } catch (error) {
    console.error("❌ Erreur dans adminEditInteraction:", error);
    try {
      await interaction.reply({
        content:
          "❌ Une erreur s'est produite lors du traitement de l'interaction.",
        ephemeral: true,
      });
    } catch (e) {
      console.error("Impossible d'envoyer le message d'erreur:", e);
    }
  }
}

// Exporter SEULEMENT la fonction, pas en tant qu'événement
// Cela évite un conflit avec interactionCreate.js
module.exports = {
  handleAdminEditInteraction,
};

// ============================================
// Handlers des interactions admin
// ============================================

// Fermer le panneau
async function handleClose(interaction) {
  await interaction.update({
    content: "✅ Panneau d'édition fermé.",
    embeds: [],
    components: [],
  });
}

// Retour au menu principal
async function handleBack(interaction, targetUserId) {
  const targetUser = await interaction.client.users.fetch(targetUserId);
  const player = getPlayer(targetUserId);

  if (!player) {
    return interaction.update({
      content: `❌ ${targetUser.username} n'a plus de personnage.`,
      embeds: [],
      components: [],
    });
  }

  const embed = createEmbed("info", `🔧 Panneau d'édition - ${player.name}`)
    .setDescription(
      `Sélectionnez une catégorie à modifier pour **${targetUser.username}**`
    )
    .addFields(
      {
        name: "📊 Statistiques actuelles",
        value: `**Niveau:** ${player.level}\n**PV:** ${player.health}/${player.maxHealth}\n**Mana:** ${player.mana}/${player.maxMana}\n**Attaque:** ${player.attack}\n**Défense:** ${player.defense}`,
        inline: true,
      },
      {
        name: "💰 Ressources actuelles",
        value: `**Or:** ${player.gold || 0}\n**Gemmes:** ${
          player.gemmes || 0
        }\n**XP:** ${player.experience || 0}\n**Réputation:** ${
          player.reputation || 0
        }`,
        inline: true,
      },
      {
        name: "🎭 Informations",
        value: `**Classe:** ${classes[player.class]?.emoji || ""} ${
          classes[player.class]?.name || player.class
        }\n**Faction:** ${
          player.faction
            ? (factions[player.faction]?.emoji || "") +
              " " +
              (factions[player.faction]?.name || player.faction)
            : "Aucune"
        }`,
        inline: false,
      }
    )
    .setTimestamp();

  const categoryRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`edit_stats_${targetUserId}`)
      .setLabel("Statistiques")
      .setEmoji("📊")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`edit_resources_${targetUserId}`)
      .setLabel("Ressources")
      .setEmoji("💰")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`edit_class_${targetUserId}`)
      .setLabel("Classe")
      .setEmoji("⚔️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`edit_faction_${targetUserId}`)
      .setLabel("Faction")
      .setEmoji("🏰")
      .setStyle(ButtonStyle.Secondary)
  );

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`edit_close_${targetUserId}`)
      .setLabel("Fermer")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.update({
    embeds: [embed],
    components: [categoryRow, closeRow],
  });
}

// Menu des statistiques
async function handleStatsMenu(interaction, targetUserId) {
  const targetUser = await interaction.client.users.fetch(targetUserId);
  const player = getPlayer(targetUserId);

  if (!player) {
    return interaction.update({
      content: `❌ ${targetUser.username} n'a plus de personnage.`,
      embeds: [],
      components: [],
    });
  }

  const embed = createEmbed("info", "📊 Modifier les statistiques")
    .setDescription(
      `Sélectionnez la statistique à modifier pour **${targetUser.username}**`
    )
    .addFields({
      name: "Statistiques actuelles",
      value: [
        `**Niveau:** ${player.level}`,
        `**PV:** ${player.health}/${player.maxHealth}`,
        `**Mana:** ${player.mana}/${player.maxMana}`,
        `**Attaque:** ${player.attack}`,
        `**Défense:** ${player.defense}`,
      ].join("\n"),
    });

  const selectMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`edit_stat_select_${targetUserId}`)
      .setPlaceholder("Choisir une statistique")
      .addOptions([
        {
          label: "Niveau",
          description: `Actuel: ${player.level}`,
          value: "level",
          emoji: "📊",
        },
        {
          label: "Points de vie (PV)",
          description: `Actuel: ${player.health}`,
          value: "health",
          emoji: "❤️",
        },
        {
          label: "PV Maximum",
          description: `Actuel: ${player.maxHealth}`,
          value: "maxHealth",
          emoji: "💗",
        },
        {
          label: "Mana",
          description: `Actuel: ${player.mana}`,
          value: "mana",
          emoji: "🔮",
        },
        {
          label: "Mana Maximum",
          description: `Actuel: ${player.maxMana}`,
          value: "maxMana",
          emoji: "💠",
        },
        {
          label: "Attaque",
          description: `Actuel: ${player.attack}`,
          value: "attack",
          emoji: "⚔️",
        },
        {
          label: "Défense",
          description: `Actuel: ${player.defense}`,
          value: "defense",
          emoji: "🛡️",
        },
      ])
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`edit_back_${targetUserId}`)
      .setLabel("Retour")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    embeds: [embed],
    components: [selectMenu, backRow],
  });
}

// Menu des ressources
async function handleResourcesMenu(interaction, targetUserId) {
  const targetUser = await interaction.client.users.fetch(targetUserId);
  const player = getPlayer(targetUserId);

  if (!player) {
    return interaction.update({
      content: `❌ ${targetUser.username} n'a plus de personnage.`,
      embeds: [],
      components: [],
    });
  }

  const embed = createEmbed("info", "💰 Modifier les ressources")
    .setDescription(
      `Sélectionnez la ressource à modifier pour **${targetUser.username}**`
    )
    .addFields({
      name: "Ressources actuelles",
      value: [
        `**Or:** ${player.gold || 0}`,
        `**Gemmes:** ${player.gemmes || 0}`,
        `**Expérience:** ${player.experience || 0}`,
        `**Réputation:** ${player.reputation || 0}`,
      ].join("\n"),
    });

  const selectMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`edit_resource_select_${targetUserId}`)
      .setPlaceholder("Choisir une ressource")
      .addOptions([
        {
          label: "Or",
          description: `Actuel: ${player.gold || 0}`,
          value: "gold",
          emoji: "🪙",
        },
        {
          label: "Gemmes",
          description: `Actuel: ${player.gemmes || 0}`,
          value: "gemmes",
          emoji: "💎",
        },
        {
          label: "Expérience",
          description: `Actuel: ${player.experience || 0}`,
          value: "experience",
          emoji: "⭐",
        },
        {
          label: "Réputation",
          description: `Actuel: ${player.reputation || 0}`,
          value: "reputation",
          emoji: "🏅",
        },
      ])
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`edit_back_${targetUserId}`)
      .setLabel("Retour")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    embeds: [embed],
    components: [selectMenu, backRow],
  });
}

// Menu de sélection de classe
async function handleClassMenu(interaction, targetUserId) {
  const targetUser = await interaction.client.users.fetch(targetUserId);
  const player = getPlayer(targetUserId);

  if (!player) {
    return interaction.update({
      content: `❌ ${targetUser.username} n'a plus de personnage.`,
      embeds: [],
      components: [],
    });
  }

  const currentClass = classes[player.class];
  const embed = createEmbed("info", "⚔️ Changer la classe")
    .setDescription(
      `Sélectionnez la nouvelle classe pour **${targetUser.username}**`
    )
    .addFields({
      name: "Classe actuelle",
      value: `${currentClass?.emoji || ""} **${
        currentClass?.name || player.class
      }**\n${currentClass?.description || ""}`,
    });

  const selectMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`edit_class_select_${targetUserId}`)
      .setPlaceholder("Choisir une classe")
      .addOptions(
        Object.entries(classes).map(([key, classData]) => ({
          label: classData.name,
          description: (
            classData.description || "Pas de description"
          ).substring(0, 100),
          value: key,
          emoji: classData.emoji,
          default: key === player.class,
        }))
      )
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`edit_back_${targetUserId}`)
      .setLabel("Retour")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    embeds: [embed],
    components: [selectMenu, backRow],
  });
}

// Menu de sélection de faction
async function handleFactionMenu(interaction, targetUserId) {
  const targetUser = await interaction.client.users.fetch(targetUserId);
  const player = getPlayer(targetUserId);

  if (!player) {
    return interaction.update({
      content: `❌ ${targetUser.username} n'a plus de personnage.`,
      embeds: [],
      components: [],
    });
  }

  const currentFaction = player.faction ? factions[player.faction] : null;
  const embed = createEmbed("info", "🏰 Changer la faction")
    .setDescription(
      `Sélectionnez la nouvelle faction pour **${targetUser.username}**`
    )
    .addFields({
      name: "Faction actuelle",
      value: currentFaction
        ? `${currentFaction.emoji} **${currentFaction.name}**\n${currentFaction.description}`
        : "Aucune faction",
    });

  const options = [
    {
      label: "Aucune faction",
      description: "Retirer le joueur de sa faction",
      value: "none",
      emoji: "❌",
      default: !player.faction,
    },
    ...Object.entries(factions).map(([key, factionData]) => ({
      label: factionData.name,
      description: (factionData.description || "Pas de description").substring(
        0,
        100
      ),
      value: key,
      emoji: factionData.emoji,
      default: key === player.faction,
    })),
  ];

  const selectMenu = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`edit_faction_select_${targetUserId}`)
      .setPlaceholder("Choisir une faction")
      .addOptions(options)
  );

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`edit_back_${targetUserId}`)
      .setLabel("Retour")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.update({
    embeds: [embed],
    components: [selectMenu, backRow],
  });
}

// Gérer la sélection d'une statistique
async function handleStatSelect(interaction, targetUserId) {
  const statType = interaction.values[0];
  const targetUser = await interaction.client.users.fetch(targetUserId);
  const player = getPlayer(targetUserId);

  if (!player) {
    return interaction.update({
      content: `❌ ${targetUser.username} n'a plus de personnage.`,
      embeds: [],
      components: [],
    });
  }

  const statLabels = {
    level: "Niveau",
    health: "Points de vie",
    maxHealth: "PV Maximum",
    mana: "Mana",
    maxMana: "Mana Maximum",
    attack: "Attaque",
    defense: "Défense",
  };

  // Vérifier que la stat existe
  if (!statLabels[statType]) {
    console.error(`❌ Type de stat invalide: ${statType}`);
    return interaction.reply({
      content: "❌ Erreur: type de statistique invalide.",
      ephemeral: true,
    });
  }

  const currentValue = player[statType] || 0;

  const modal = new ModalBuilder()
    .setCustomId(`edit_modal_stat_${statType}_${targetUserId}`)
    .setTitle(`Modifier ${statLabels[statType]}`);

  const input = new TextInputBuilder()
    .setCustomId("value")
    .setLabel(`Nouvelle valeur (actuelle: ${currentValue})`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(`Entrez la nouvelle valeur`)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(6);

  const row = new ActionRowBuilder().addComponents(input);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

// Gérer la sélection d'une ressource
async function handleResourceSelect(interaction, targetUserId) {
  const resourceType = interaction.values[0];
  const targetUser = await interaction.client.users.fetch(targetUserId);
  const player = getPlayer(targetUserId);

  if (!player) {
    return interaction.update({
      content: `❌ ${targetUser.username} n'a plus de personnage.`,
      embeds: [],
      components: [],
    });
  }

  const resourceLabels = {
    gold: "Or",
    gemmes: "Gemmes",
    experience: "Expérience",
    reputation: "Réputation",
  };

  // Vérifier que la ressource existe
  if (!resourceLabels[resourceType]) {
    console.error(`❌ Type de ressource invalide: ${resourceType}`);
    return interaction.reply({
      content: "❌ Erreur: type de ressource invalide.",
      ephemeral: true,
    });
  }

  const currentValue = player[resourceType] || 0;

  const modal = new ModalBuilder()
    .setCustomId(`edit_modal_resource_${resourceType}_${targetUserId}`)
    .setTitle(`Modifier ${resourceLabels[resourceType]}`);

  const input = new TextInputBuilder()
    .setCustomId("value")
    .setLabel(`Nouvelle valeur (actuelle: ${currentValue})`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(`Entrez la nouvelle valeur`)
    .setRequired(true)
    .setMinLength(1)
    .setMaxLength(10);

  const row = new ActionRowBuilder().addComponents(input);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

// Gérer la sélection d'une classe
async function handleClassSelect(interaction, targetUserId) {
  const newClass = interaction.values[0];
  const targetUser = await interaction.client.users.fetch(targetUserId);
  const player = getPlayer(targetUserId);

  if (!player) {
    return interaction.update({
      content: `❌ ${targetUser.username} n'a plus de personnage.`,
      embeds: [],
      components: [],
    });
  }

  const oldClass = player.class;
  const oldClassData = classes[oldClass];
  const newClassData = classes[newClass];

  // Vérifier que les données de classe existent
  if (!oldClassData || !newClassData) {
    console.error(
      `❌ Données de classe invalides: oldClass=${oldClass}, newClass=${newClass}`
    );
    return interaction.reply({
      content: "❌ Erreur: données de classe invalides.",
      ephemeral: true,
    });
  }

  if (oldClass === newClass) {
    return interaction.reply({
      content: `❌ ${targetUser.username} est déjà de la classe ${newClassData.name}.`,
      ephemeral: true,
    });
  }

  // Changer la classe
  player.class = newClass;

  // Ajuster les stats de base selon la nouvelle classe
  player.maxHealth = newClassData.baseHealth;
  player.maxMana = newClassData.baseMana;
  player.attack = newClassData.baseStats.attack;
  player.defense = newClassData.baseStats.defense;

  // Ajuster les valeurs actuelles proportionnellement
  player.health = Math.min(player.health, player.maxHealth);
  player.mana = Math.min(player.mana, player.maxMana);

  updatePlayer(targetUserId, player);

  logAdminAction(
    targetUserId,
    player.name,
    "Changement de classe",
    `${oldClassData.name} → ${newClassData.name}`,
    interaction.user.id,
    interaction.user.username
  );

  const embed = createEmbed("success", "✅ Classe modifiée")
    .setDescription(
      `La classe de **${targetUser.username}** a été changée avec succès !`
    )
    .addFields(
      {
        name: "Ancienne classe",
        value: `${oldClassData.emoji} ${oldClassData.name}`,
        inline: true,
      },
      {
        name: "Nouvelle classe",
        value: `${newClassData.emoji} ${newClassData.name}`,
        inline: true,
      },
      {
        name: "Nouvelles statistiques de base",
        value: [
          `❤️ PV Max: ${player.maxHealth}`,
          `🔮 Mana Max: ${player.maxMana}`,
          `⚔️ Attaque: ${player.attack}`,
          `🛡️ Défense: ${player.defense}`,
        ].join("\n"),
      }
    )
    .setTimestamp();

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`edit_back_${targetUserId}`)
      .setLabel("Retour au menu")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.update({
    embeds: [embed],
    components: [backRow],
  });
}

// Gérer la sélection d'une faction
async function handleFactionSelect(interaction, targetUserId) {
  const newFaction = interaction.values[0];
  const targetUser = await interaction.client.users.fetch(targetUserId);
  const player = getPlayer(targetUserId);

  if (!player) {
    return interaction.update({
      content: `❌ ${targetUser.username} n'a plus de personnage.`,
      embeds: [],
      components: [],
    });
  }

  const oldFaction = player.faction;
  const oldFactionData = oldFaction ? factions[oldFaction] : null;
  const newFactionData = newFaction !== "none" ? factions[newFaction] : null;

  // Vérifier la validité de la nouvelle faction (sauf si "none")
  if (newFaction !== "none" && !newFactionData) {
    console.error(`❌ Données de faction invalides: newFaction=${newFaction}`);
    return interaction.reply({
      content: "❌ Erreur: données de faction invalides.",
      ephemeral: true,
    });
  }

  if (oldFaction === newFaction || (newFaction === "none" && !oldFaction)) {
    return interaction.reply({
      content: `❌ ${targetUser.username} est déjà ${
        newFaction === "none"
          ? "sans faction"
          : `dans la faction ${newFactionData.name}`
      }.`,
      ephemeral: true,
    });
  }

  // Changer la faction
  player.faction = newFaction === "none" ? null : newFaction;

  updatePlayer(targetUserId, player);

  logAdminAction(
    targetUserId,
    player.name,
    "Changement de faction",
    `${oldFactionData?.name || "Aucune"} → ${newFactionData?.name || "Aucune"}`,
    interaction.user.id,
    interaction.user.username
  );

  const embed = createEmbed("success", "✅ Faction modifiée")
    .setDescription(
      `La faction de **${targetUser.username}** a été changée avec succès !`
    )
    .addFields(
      {
        name: "Ancienne faction",
        value: oldFactionData
          ? `${oldFactionData.emoji} ${oldFactionData.name}`
          : "Aucune",
        inline: true,
      },
      {
        name: "Nouvelle faction",
        value: newFactionData
          ? `${newFactionData.emoji} ${newFactionData.name}`
          : "Aucune",
        inline: true,
      }
    );

  if (newFactionData) {
    embed.addFields({
      name: "Bonus de faction",
      value: newFactionData.bonuses.join("\n"),
    });
  }

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`edit_back_${targetUserId}`)
      .setLabel("Retour au menu")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.update({
    embeds: [embed],
    components: [backRow],
  });
}

// Gérer la soumission du modal
async function handleModalSubmit(interaction, targetUserId) {
  const parts = interaction.customId.split("_");
  const category = parts[2]; // "stat" ou "resource"
  const type = parts[3]; // le type spécifique

  // Validation du type
  if (!type) {
    console.error(`❌ Type invalide dans le customId: ${interaction.customId}`);
    return interaction.reply({
      content: "❌ Erreur: type de modification invalide.",
      ephemeral: true,
    });
  }

  const targetUser = await interaction.client.users.fetch(targetUserId);
  const player = getPlayer(targetUserId);

  if (!player) {
    return interaction.reply({
      content: `❌ ${targetUser.username} n'a plus de personnage.`,
      ephemeral: true,
    });
  }

  const value = parseInt(interaction.fields.getTextInputValue("value"));

  if (isNaN(value)) {
    return interaction.reply({
      content: "❌ Veuillez entrer un nombre valide.",
      ephemeral: true,
    });
  }

  if (value < 0) {
    return interaction.reply({
      content: "❌ La valeur ne peut pas être négative.",
      ephemeral: true,
    });
  }

  const oldValue = player[type] || 0;
  player[type] = value;

  // Logger les changements importants
  if (type === "gold") {
    logGoldChange(
      targetUserId,
      player.name,
      oldValue,
      value,
      "/admin edit",
      interaction.user.id,
      interaction.user.username
    );
  } else if (type === "experience") {
    logExperienceChange(
      targetUserId,
      player.name,
      oldValue,
      value,
      "/admin edit",
      interaction.user.id,
      interaction.user.username
    );
  } else if (type === "level") {
    logLevelChange(targetUserId, player.name, oldValue, value, "/admin edit");
  }

  updatePlayer(targetUserId, player);

  const labels = {
    // Stats
    level: { emoji: "📊", name: "Niveau" },
    health: { emoji: "❤️", name: "Points de vie" },
    maxHealth: { emoji: "💗", name: "PV Maximum" },
    mana: { emoji: "🔮", name: "Mana" },
    maxMana: { emoji: "💠", name: "Mana Maximum" },
    attack: { emoji: "⚔️", name: "Attaque" },
    defense: { emoji: "🛡️", name: "Défense" },
    // Resources
    gold: { emoji: "🪙", name: "Or" },
    gemmes: { emoji: "💎", name: "Gemmes" },
    experience: { emoji: "⭐", name: "Expérience" },
    reputation: { emoji: "🏅", name: "Réputation" },
  };

  const label = labels[type];

  // Vérifier que le label existe
  if (!label) {
    console.error(`❌ Label non trouvé pour le type: ${type}`);
    return interaction.reply({
      content: "❌ Erreur: type de ressource non reconnu.",
      ephemeral: true,
    });
  }

  const embed = createEmbed("success", "✅ Valeur modifiée")
    .setDescription(
      `${label.emoji} **${label.name}** de **${targetUser.username}** modifié avec succès !`
    )
    .addFields(
      {
        name: "Ancienne valeur",
        value: oldValue.toString(),
        inline: true,
      },
      {
        name: "Nouvelle valeur",
        value: value.toString(),
        inline: true,
      }
    )
    .setTimestamp();

  const backRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`edit_back_${targetUserId}`)
      .setLabel("Retour au menu")
      .setEmoji("◀️")
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.reply({
    embeds: [embed],
    components: [backRow],
    ephemeral: true,
  });
}
