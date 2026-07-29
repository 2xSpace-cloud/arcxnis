const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { getPlayer, updatePlayer } = require("../utils/database");
const { createEmbed } = require("../utils/embeds");
const { ALL_SHOP_ITEMS, getRarityEmoji } = require("../utils/dailyShop");
const fs = require("fs");
const path = require("path");

// Fichier pour sauvegarder les giveaways actifs
const GIVEAWAYS_FILE = path.join(__dirname, "../database/giveaways.json");

// Map pour stocker les timeouts des giveaways
const giveawayTimeouts = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Gérer les giveaways du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Créer un nouveau giveaway")
        .addStringOption((option) =>
          option
            .setName("recompense")
            .setDescription("La récompense du giveaway")
            .setRequired(true)
        )
        .addIntegerOption(
          (option) =>
            option
              .setName("duree")
              .setDescription("Durée en minutes")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(10080) // 1 semaine max
        )
        .addIntegerOption((option) =>
          option
            .setName("gagnants")
            .setDescription("Nombre de gagnants")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(20)
        )
        .addStringOption((option) =>
          option
            .setName("emoji")
            .setDescription("Émoji pour participer (défaut: 🎉)")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("conditions")
            .setDescription("Conditions pour participer (optionnel)")
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("type_recompense")
            .setDescription("Type de récompense")
            .setRequired(false)
            .addChoices(
              { name: "💎 Gemmes", value: "gemmes" },
              { name: "🪙 Or", value: "or" },
              { name: "📦 Item", value: "item" },
              { name: "🏆 Titre", value: "titre" },
              { name: "🐺 Familier", value: "familier" },
              { name: "🎁 Personnalisé", value: "custom" }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName("quantite")
            .setDescription("Quantité (pour gemmes/or)")
            .setRequired(false)
            .setMinValue(1)
        )
        .addStringOption((option) =>
          option
            .setName("item_id")
            .setDescription("ID de l'item (pour items/titres/familiers)")
            .setRequired(false)
        )
        .addChannelOption((option) =>
          option
            .setName("canal")
            .setDescription(
              "Canal où poster le giveaway (défaut: canal actuel)"
            )
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("end")
        .setDescription("Terminer un giveaway immédiatement")
        .addStringOption((option) =>
          option
            .setName("message_id")
            .setDescription("ID du message du giveaway")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reroll")
        .setDescription("Retirer de nouveaux gagnants")
        .addStringOption((option) =>
          option
            .setName("message_id")
            .setDescription("ID du message du giveaway")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("nouveaux_gagnants")
            .setDescription("Nombre de nouveaux gagnants à tirer")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("Lister tous les giveaways actifs")
    ),

  async execute(interaction) {
    // Vérifier les permissions
    if (
      !interaction.member.permissions.has(PermissionFlagsBits.Administrator)
    ) {
      return interaction.reply({
        content:
          "❌ Tu n'as pas les permissions d'administrateur pour utiliser cette commande.",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "create":
          await handleCreate(interaction);
          break;
        case "end":
          await handleEnd(interaction);
          break;
        case "reroll":
          await handleReroll(interaction);
          break;
        case "list":
          await handleList(interaction);
          break;
        default:
          await interaction.reply({
            content: "❌ Sous-commande non reconnue.",
            ephemeral: true,
          });
      }
    } catch (error) {
      console.error("Erreur dans la commande giveaway:", error);
      await interaction.reply({
        content:
          "❌ Une erreur s'est produite lors de l'exécution de la commande.",
        ephemeral: true,
      });
    }
  },
};

// Fonction pour créer un giveaway
async function handleCreate(interaction) {
  const recompense = interaction.options.getString("recompense");
  const duree = interaction.options.getInteger("duree");
  const gagnants = interaction.options.getInteger("gagnants");
  const emoji = interaction.options.getString("emoji") || "🎉";
  const conditions = interaction.options.getString("conditions");
  const typeRecompense = interaction.options.getString("type_recompense");
  const quantite = interaction.options.getInteger("quantite");
  const itemId = interaction.options.getString("item_id");
  const canal = interaction.options.getChannel("canal") || interaction.channel;

  // Validation de l'émoji
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})$/u;
  if (!emojiRegex.test(emoji) && !emoji.match(/^<a?:\w+:\d+>$/)) {
    return interaction.reply({
      content: "❌ L'émoji fourni n'est pas valide.",
      ephemeral: true,
    });
  }

  // Validation des récompenses avec type
  if (typeRecompense) {
    if ((typeRecompense === "gemmes" || typeRecompense === "or") && !quantite) {
      return interaction.reply({
        content: `❌ Veuillez spécifier une quantité pour ${typeRecompense}.`,
        ephemeral: true,
      });
    }

    if (
      (typeRecompense === "item" ||
        typeRecompense === "titre" ||
        typeRecompense === "familier") &&
      !itemId
    ) {
      return interaction.reply({
        content: `❌ Veuillez spécifier un item_id pour ${typeRecompense}.`,
        ephemeral: true,
      });
    }

    // Vérifier que l'item existe
    if (itemId) {
      const item = ALL_SHOP_ITEMS.find((i) => i.id === itemId);
      if (!item) {
        return interaction.reply({
          content: `❌ Item avec l'ID "${itemId}" non trouvé.`,
          ephemeral: true,
        });
      }

      if (typeRecompense === "titre" && item.type !== "titre") {
        return interaction.reply({
          content: `❌ L'item "${itemId}" n'est pas un titre.`,
          ephemeral: true,
        });
      }

      if (typeRecompense === "familier" && item.type !== "familier") {
        return interaction.reply({
          content: `❌ L'item "${itemId}" n'est pas un familier.`,
          ephemeral: true,
        });
      }
    }
  }

  const endTime = new Date(Date.now() + duree * 60 * 1000);
  const giveawayId = `gw_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  // Créer l'embed du giveaway
  const embed = new EmbedBuilder()
    .setTitle("🎉 GIVEAWAY 🎉")
    .setDescription(
      `**Récompense:** ${recompense}\n` +
        `**Gagnants:** ${gagnants}\n` +
        `**Fin:** <t:${Math.floor(endTime.getTime() / 1000)}:R>\n` +
        `**Pour participer:** Réagissez avec ${emoji}\n` +
        (conditions ? `**Conditions:** ${conditions}\n` : "") +
        `\n**Organisé par:** ${interaction.user}`
    )
    .setColor("#FFD700")
    .setFooter({
      text: `ID: ${giveawayId} • Se termine le`,
      iconURL: interaction.client.user.displayAvatarURL(),
    })
    .setTimestamp(endTime);

  // Ajouter des détails sur la récompense si c'est automatique
  if (typeRecompense && typeRecompense !== "custom") {
    let rewardDetails = "";
    switch (typeRecompense) {
      case "gemmes":
        rewardDetails = `💎 ${quantite} gemmes seront automatiquement ajoutées`;
        break;
      case "or":
        rewardDetails = `🪙 ${quantite} or sera automatiquement ajouté`;
        break;
      case "item":
      case "titre":
      case "familier":
        const item = ALL_SHOP_ITEMS.find((i) => i.id === itemId);
        rewardDetails = `${getRarityEmoji(item.rarity)} ${
          item.name
        } sera automatiquement ajouté`;
        break;
    }

    embed.addFields({
      name: "🤖 Récompense automatique",
      value: rewardDetails,
      inline: false,
    });
  }

  await interaction.reply({
    content: `✅ Giveaway créé dans ${canal}!`,
    ephemeral: true,
  });

  // Poster le giveaway
  const giveawayMessage = await canal.send({ embeds: [embed] });
  await giveawayMessage.react(emoji);

  // Sauvegarder le giveaway
  const giveawayData = {
    id: giveawayId,
    messageId: giveawayMessage.id,
    channelId: canal.id,
    guildId: interaction.guild.id,
    hostId: interaction.user.id,
    recompense,
    gagnants,
    emoji,
    conditions,
    typeRecompense,
    quantite,
    itemId,
    endTime: endTime.getTime(),
    createdAt: Date.now(),
    ended: false,
    winners: [],
  };

  saveGiveaway(giveawayData);

  // Programmer la fin du giveaway
  const timeout = setTimeout(() => {
    endGiveaway(giveawayData, interaction.client);
  }, duree * 60 * 1000);

  giveawayTimeouts.set(giveawayId, timeout);
}

// Fonction pour terminer un giveaway manuellement
async function handleEnd(interaction) {
  const messageId = interaction.options.getString("message_id");

  const giveaway = getGiveawayByMessageId(messageId);
  if (!giveaway) {
    return interaction.reply({
      content: "❌ Giveaway non trouvé ou déjà terminé.",
      ephemeral: true,
    });
  }

  if (giveaway.ended) {
    return interaction.reply({
      content: "❌ Ce giveaway est déjà terminé.",
      ephemeral: true,
    });
  }

  // Annuler le timeout automatique
  if (giveawayTimeouts.has(giveaway.id)) {
    clearTimeout(giveawayTimeouts.get(giveaway.id));
    giveawayTimeouts.delete(giveaway.id);
  }

  await interaction.reply({
    content: "✅ Giveaway terminé manuellement!",
    ephemeral: true,
  });

  await endGiveaway(giveaway, interaction.client);
}

// Fonction pour reroll
async function handleReroll(interaction) {
  const messageId = interaction.options.getString("message_id");
  const nouveauxGagnants =
    interaction.options.getInteger("nouveaux_gagnants") || 1;

  const giveaway = getGiveawayByMessageId(messageId);
  if (!giveaway) {
    return interaction.reply({
      content: "❌ Giveaway non trouvé.",
      ephemeral: true,
    });
  }

  if (!giveaway.ended) {
    return interaction.reply({
      content: "❌ Ce giveaway n'est pas encore terminé.",
      ephemeral: true,
    });
  }

  try {
    const channel = await interaction.client.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(giveaway.messageId);

    // Récupérer les réactions
    const reaction = message.reactions.cache.get(giveaway.emoji);
    if (!reaction) {
      return interaction.reply({
        content: "❌ Aucune réaction trouvée sur ce giveaway.",
        ephemeral: true,
      });
    }

    const users = await reaction.users.fetch();
    const participants = users.filter((user) => !user.bot);

    if (participants.size === 0) {
      return interaction.reply({
        content: "❌ Aucun participant valide trouvé.",
        ephemeral: true,
      });
    }

    // Sélectionner de nouveaux gagnants
    const participantsArray = Array.from(participants.values());
    const newWinners = [];

    for (
      let i = 0;
      i < Math.min(nouveauxGagnants, participantsArray.length);
      i++
    ) {
      const randomIndex = Math.floor(Math.random() * participantsArray.length);
      const winner = participantsArray.splice(randomIndex, 1)[0];
      newWinners.push(winner);
    }

    // Créer l'embed de reroll
    const rerollEmbed = new EmbedBuilder()
      .setTitle("🔄 GIVEAWAY REROLL")
      .setDescription(
        `**Récompense:** ${giveaway.recompense}\n` +
          `**Nouveaux gagnants:**\n${newWinners
            .map((w) => `🎉 ${w}`)
            .join("\n")}\n\n` +
          `**Giveaway original:** [Cliquez ici](https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId})`
      )
      .setColor("#00FF00")
      .setFooter({ text: `Reroll par ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [rerollEmbed] });

    // Distribuer les récompenses automatiques si configurées
    if (giveaway.typeRecompense && giveaway.typeRecompense !== "custom") {
      for (const winner of newWinners) {
        await distributeReward(winner.id, giveaway);
      }
    }
  } catch (error) {
    console.error("Erreur lors du reroll:", error);
    await interaction.reply({
      content: "❌ Erreur lors du reroll du giveaway.",
      ephemeral: true,
    });
  }
}

// Fonction pour lister les giveaways actifs
async function handleList(interaction) {
  const activeGiveaways = getActiveGiveaways();

  if (activeGiveaways.length === 0) {
    return interaction.reply({
      content: "📭 Aucun giveaway actif pour le moment.",
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("📋 Giveaways Actifs")
    .setColor("#FFD700")
    .setTimestamp();

  for (const giveaway of activeGiveaways.slice(0, 10)) {
    // Limiter à 10
    const endTime = Math.floor(giveaway.endTime / 1000);
    const channel = `<#${giveaway.channelId}>`;

    embed.addFields({
      name: `🎉 ${giveaway.recompense}`,
      value:
        `**Canal:** ${channel}\n` +
        `**Gagnants:** ${giveaway.gagnants}\n` +
        `**Fin:** <t:${endTime}:R>\n` +
        `**ID:** \`${giveaway.messageId}\``,
      inline: true,
    });
  }

  if (activeGiveaways.length > 10) {
    embed.setFooter({
      text: `... et ${activeGiveaways.length - 10} autres giveaways`,
    });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Fonction pour terminer un giveaway
async function endGiveaway(giveaway, client) {
  try {
    const channel = await client.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(giveaway.messageId);

    // Récupérer les réactions
    const reaction = message.reactions.cache.get(giveaway.emoji);
    if (!reaction) {
      // Aucune réaction, giveaway sans gagnant
      const noWinnerEmbed = new EmbedBuilder()
        .setTitle("🎉 GIVEAWAY TERMINÉ")
        .setDescription(
          `**Récompense:** ${giveaway.recompense}\n` +
            `**Gagnants:** Aucun participant 😢\n\n` +
            `Personne n'a participé à ce giveaway.`
        )
        .setColor("#FF0000")
        .setTimestamp();

      await message.edit({ embeds: [noWinnerEmbed] });

      // Marquer comme terminé
      giveaway.ended = true;
      giveaway.winners = [];
      updateGiveaway(giveaway);

      return;
    }

    const users = await reaction.users.fetch();
    const participants = users.filter((user) => !user.bot);

    if (participants.size === 0) {
      // Aucun participant valide
      const noWinnerEmbed = new EmbedBuilder()
        .setTitle("🎉 GIVEAWAY TERMINÉ")
        .setDescription(
          `**Récompense:** ${giveaway.recompense}\n` +
            `**Gagnants:** Aucun participant valide 😢\n\n` +
            `Seuls des bots ont participé à ce giveaway.`
        )
        .setColor("#FF0000")
        .setTimestamp();

      await message.edit({ embeds: [noWinnerEmbed] });

      giveaway.ended = true;
      giveaway.winners = [];
      updateGiveaway(giveaway);

      return;
    }

    // Sélectionner les gagnants
    const participantsArray = Array.from(participants.values());
    const winners = [];

    for (
      let i = 0;
      i < Math.min(giveaway.gagnants, participantsArray.length);
      i++
    ) {
      const randomIndex = Math.floor(Math.random() * participantsArray.length);
      const winner = participantsArray.splice(randomIndex, 1)[0];
      winners.push(winner);
    }

    // Créer l'embed de fin
    const endEmbed = new EmbedBuilder()
      .setTitle("🎉 GIVEAWAY TERMINÉ")
      .setDescription(
        `**Récompense:** ${giveaway.recompense}\n` +
          `**Gagnants:**\n${winners.map((w) => `🎉 ${w}`).join("\n")}\n\n` +
          `Félicitations aux gagnants !`
      )
      .setColor("#00FF00")
      .setFooter({
        text: `${participants.size} participants • Organisé par`,
        iconURL: client.user.displayAvatarURL(),
      })
      .setTimestamp();

    await message.edit({ embeds: [endEmbed] });

    // Message de félicitations
    const congratsMessage = `🎉 **FÉLICITATIONS !** 🎉\n\n${winners
      .map((w) => `${w}`)
      .join(", ")}\n\nVous avez gagné : **${giveaway.recompense}** !`;
    await channel.send(congratsMessage);

    // Distribuer les récompenses automatiques si configurées
    if (giveaway.typeRecompense && giveaway.typeRecompense !== "custom") {
      for (const winner of winners) {
        await distributeReward(winner.id, giveaway);
      }

      await channel.send(
        "✅ Les récompenses ont été automatiquement distribuées aux gagnants !"
      );
    }

    // Marquer comme terminé
    giveaway.ended = true;
    giveaway.winners = winners.map((w) => w.id);
    updateGiveaway(giveaway);

    // Nettoyer le timeout
    if (giveawayTimeouts.has(giveaway.id)) {
      giveawayTimeouts.delete(giveaway.id);
    }
  } catch (error) {
    console.error("Erreur lors de la fin du giveaway:", error);
  }
}

// Fonction pour distribuer les récompenses automatiques
async function distributeReward(userId, giveaway) {
  const player = getPlayer(userId);
  if (!player) {
    console.log(
      `Joueur ${userId} n'a pas de personnage, récompense non distribuée`
    );
    return;
  }

  switch (giveaway.typeRecompense) {
    case "gemmes":
      player.gemmes = (player.gemmes || 0) + giveaway.quantite;
      break;
    case "or":
      player.gold = (player.gold || 0) + giveaway.quantite;
      break;
    case "item":
      player.inventory = Array.isArray(player.inventory)
        ? player.inventory
        : [];
      player.inventory.push(giveaway.itemId);
      break;
    case "titre":
      player.titres = Array.isArray(player.titres) ? player.titres : [];
      if (!player.titres.includes(giveaway.itemId)) {
        player.titres.push(giveaway.itemId);
      }
      break;
    case "familier":
      player.familiers = Array.isArray(player.familiers)
        ? player.familiers
        : [];
      if (!player.familiers.includes(giveaway.itemId)) {
        player.familiers.push(giveaway.itemId);
      }
      break;
  }

  updatePlayer(userId, player);
}

// Fonctions utilitaires pour la gestion des giveaways
function loadGiveaways() {
  try {
    if (!fs.existsSync(GIVEAWAYS_FILE)) {
      return {};
    }
    const data = fs.readFileSync(GIVEAWAYS_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Erreur lors du chargement des giveaways:", error);
    return {};
  }
}

function saveGiveaways(giveaways) {
  try {
    const dbDir = path.dirname(GIVEAWAYS_FILE);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    fs.writeFileSync(GIVEAWAYS_FILE, JSON.stringify(giveaways, null, 2));
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des giveaways:", error);
  }
}

function saveGiveaway(giveaway) {
  const giveaways = loadGiveaways();
  giveaways[giveaway.id] = giveaway;
  saveGiveaways(giveaways);
}

function updateGiveaway(giveaway) {
  const giveaways = loadGiveaways();
  giveaways[giveaway.id] = giveaway;
  saveGiveaways(giveaways);
}

function getGiveawayByMessageId(messageId) {
  const giveaways = loadGiveaways();
  return Object.values(giveaways).find((g) => g.messageId === messageId);
}

function getActiveGiveaways() {
  const giveaways = loadGiveaways();
  return Object.values(giveaways).filter(
    (g) => !g.ended && g.endTime > Date.now()
  );
}

// Fonction pour restaurer les timeouts au démarrage du bot
function restoreGiveawayTimeouts(client) {
  const activeGiveaways = getActiveGiveaways();

  for (const giveaway of activeGiveaways) {
    const timeLeft = giveaway.endTime - Date.now();

    if (timeLeft > 0) {
      const timeout = setTimeout(() => {
        endGiveaway(giveaway, client);
      }, timeLeft);

      giveawayTimeouts.set(giveaway.id, timeout);
      console.log(
        `Giveaway ${giveaway.id} restauré, fin dans ${Math.round(
          timeLeft / 1000 / 60
        )} minutes`
      );
    } else {
      // Le giveaway aurait dû se terminer, le terminer maintenant
      endGiveaway(giveaway, client);
    }
  }
}

module.exports.restoreGiveawayTimeouts = restoreGiveawayTimeouts;
