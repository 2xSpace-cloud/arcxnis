const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const {
  getPlayer,
  updatePlayer,
  deletePlayer,
  fixPlayerExperience,
  exportPlayerData,
  importPlayerData,
  getAllPlayers,
} = require("../utils/database");
const fs = require("fs");
const path = require("path");
const { createEmbed } = require("../utils/embeds");
const { ALL_SHOP_ITEMS } = require("../utils/dailyShop");
const {
  syncFactionRoles,
  checkFactionRoleSync,
  syncClassRole,
  checkClassRoleSync,
} = require("../utils/roleManager");
const { classes, factions } = require("../systems/gameData");

// Charger les items depuis items.json
const itemsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../database/items.json"), "utf8"),
);

// 🟢 AJOUTE CETTE LIGNE JUSTE ICI :
const uniqueItemsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../database/uniqueItems.json"), "utf8"),
);
const { generatePermissionReport } = require("../utils/botPermissions");
const {
  AuditEventType,
  logGoldChange,
  logExperienceChange,
  logLevelChange,
  logAdminAction,
  logPlayerDeletion,
  getPlayerHistory,
} = require("../utils/auditLog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Commandes d'administration pour gérer les joueurs")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("give")
        .setDescription("Donner des ressources à un joueur")
        .addUserOption((option) =>
          option
            .setName("joueur")
            .setDescription("Le joueur à qui donner les ressources")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Type de ressource à donner")
            .setRequired(true)
            .addChoices(
              { name: "💎 Gemmes", value: "gemmes" },
              { name: "🪙 Or", value: "or" },
              { name: "⭐ Expérience", value: "experience" },
              { name: "📊 Niveau", value: "niveau" },
              { name: "🏅 Réputation", value: "reputation" },
              { name: "⚔️ Attaque", value: "attaque" },
              { name: "🛡️ Défense", value: "defense" },
              { name: "❤️ PV Max", value: "pvmax" },
              { name: "🔮 Mana Max", value: "manamax" },
              { name: "📦 Item", value: "item" },
              { name: "🏆 Titre", value: "titre" },
              { name: "🐺 Familier", value: "familier" },
            ),
        )
        .addIntegerOption((option) =>
          option
            .setName("quantite")
            .setDescription("Quantité à donner (pour gemmes, or, expérience)")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("item_id")
            .setDescription(
              "ID de l'item à donner (pour items, titres, familiers)",
            )
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Retirer des ressources à un joueur")
        .addUserOption((option) =>
          option
            .setName("joueur")
            .setDescription("Le joueur à qui retirer les ressources")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Type de ressource à retirer")
            .setRequired(true)
            .addChoices(
              { name: "💎 Gemmes", value: "gemmes" },
              { name: "🪙 Or", value: "or" },
              { name: "⭐ Expérience", value: "experience" },
            ),
        )
        .addIntegerOption((option) =>
          option
            .setName("quantite")
            .setDescription("Quantité à retirer")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("edit")
        .setDescription(
          "Modifier les stats, ressources, classe ou faction d'un joueur via un panneau interactif",
        )
        .addUserOption((option) =>
          option
            .setName("joueur")
            .setDescription("Le joueur à modifier")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reset")
        .setDescription("Réinitialiser un joueur")
        .addUserOption((option) =>
          option
            .setName("joueur")
            .setDescription("Le joueur à réinitialiser")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Que réinitialiser")
            .setRequired(true)
            .addChoices(
              { name: "📦 Inventaire", value: "inventory" },
              { name: "🏆 Titres", value: "titres" },
              { name: "🐺 Familiers", value: "familiers" },
              { name: "📊 Statistiques", value: "stats" },
              { name: "🔄 Tout", value: "all" },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription("Voir les informations détaillées d'un joueur")
        .addUserOption((option) =>
          option
            .setName("joueur")
            .setDescription("Le joueur à examiner")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("broadcast")
        .setDescription("Donner des ressources à tous les joueurs")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Type de ressource à donner")
            .setRequired(true)
            .addChoices(
              { name: "💎 Gemmes", value: "gemmes" },
              { name: "🪙 Or", value: "or" },
              { name: "⭐ Expérience", value: "experience" },
            ),
        )
        .addIntegerOption((option) =>
          option
            .setName("quantite")
            .setDescription("Quantité à donner à chaque joueur")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("raison")
            .setDescription("Raison du don (optionnel)")
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("fix-exp")
        .setDescription("Corriger l'expérience de tous les joueurs"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("backup")
        .setDescription("Créer une sauvegarde manuelle des données"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("restore")
        .setDescription("Restaurer les données depuis une sauvegarde")
        .addStringOption((option) =>
          option
            .setName("fichier")
            .setDescription("Nom du fichier de sauvegarde (sans le chemin)")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("sync-roles")
        .setDescription(
          "Synchroniser les rôles Discord avec les factions des joueurs",
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("check-permissions")
        .setDescription(
          "Vérifier les permissions du bot pour gérer les rôles de faction",
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("historique")
        .setDescription("Voir l'historique des modifications d'un joueur")
        .addUserOption((option) =>
          option
            .setName("joueur")
            .setDescription("Le joueur dont voir l'historique")
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName("limite")
            .setDescription("Nombre d'événements à afficher (défaut: 20)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(100),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Supprimer le personnage d'un joueur")
        .addUserOption((option) =>
          option
            .setName("joueur")
            .setDescription("Le joueur dont supprimer le personnage")
            .setRequired(true),
        )
        .addBooleanOption((option) =>
          option
            .setName("confirmer")
            .setDescription(
              "Confirmer la suppression (ATTENTION: irréversible!)",
            )
            .setRequired(true),
        ),
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
        case "give":
          await handleGive(interaction);
          break;
        case "remove":
          await handleRemove(interaction);
          break;
        case "edit":
          await handleEdit(interaction);
          break;
        case "reset":
          await handleReset(interaction);
          break;
        case "info":
          await handleInfo(interaction);
          break;
        case "broadcast":
          await handleBroadcast(interaction);
          break;
        case "fix-exp":
          await handleFixExp(interaction);
          break;
        case "backup":
          await handleBackup(interaction);
          break;
        case "restore":
          await handleRestore(interaction);
          break;
        case "sync-roles":
          await handleSyncRoles(interaction);
          break;
        case "check-permissions":
          await handleCheckPermissions(interaction);
          break;
        case "historique":
          await handleHistorique(interaction);
          break;
        case "delete":
          await handleDelete(interaction);
          break;
        default:
          await interaction.reply({
            content: "❌ Sous-commande non reconnue.",
            ephemeral: true,
          });
      }
    } catch (error) {
      console.error("Erreur dans la commande admin:", error);
      await interaction.reply({
        content:
          "❌ Une erreur s'est produite lors de l'exécution de la commande.",
        ephemeral: true,
      });
    }
  },
};

// Fonction pour donner des ressources
async function handleGive(interaction) {
  const targetUser = interaction.options.getUser("joueur");
  const type = interaction.options.getString("type");
  const quantite = interaction.options.getInteger("quantite");
  const itemId = interaction.options.getString("item_id");

  const player = getPlayer(targetUser.id);
  if (!player) {
    return interaction.reply({
      content: `❌ ${targetUser.username} n'a pas de personnage créé.`,
      ephemeral: true,
    });
  }

  let message = "";

  switch (type) {
    case "gemmes":
      if (!quantite || quantite <= 0) {
        return interaction.reply({
          content: "❌ Veuillez spécifier une quantité valide de gemmes.",
          ephemeral: true,
        });
      }
      player.gemmes = (player.gemmes || 0) + quantite;
      message = `💎 **${quantite} gemmes** données à ${targetUser.username}`;
      break;

    case "or":
      if (!quantite || quantite <= 0) {
        return interaction.reply({
          content: "❌ Veuillez spécifier une quantité valide d'or.",
          ephemeral: true,
        });
      }
      const oldGold = player.gold || 0;
      player.gold = oldGold + quantite;
      logGoldChange(
        targetUser.id,
        player.name,
        oldGold,
        player.gold,
        "/admin give",
        interaction.user.id,
        interaction.user.username,
      );
      message = `🪙 **${quantite} or** donné à ${targetUser.username}`;
      break;

    case "experience":
      if (!quantite || quantite <= 0) {
        return interaction.reply({
          content: "❌ Veuillez spécifier une quantité valide d'expérience.",
          ephemeral: true,
        });
      }
      const oldExp = player.experience || 0;
      const oldLevel = player.level || 1;
      player.experience = oldExp + quantite;

      // Vérifier les montées de niveau
      let newLevel = oldLevel;
      let totalExp = player.experience;
      while (totalExp >= newLevel * 100) {
        totalExp -= newLevel * 100;
        newLevel++;
      }

      if (newLevel > oldLevel) {
        const levelGained = newLevel - oldLevel;
        player.level = newLevel;
        player.experience = totalExp; // Mettre à jour l'expérience restante
        logLevelChange(
          targetUser.id,
          player.name,
          oldLevel,
          newLevel,
          "/admin give",
        );
        message = `⭐ **${quantite} expérience** donnée à ${targetUser.username} (${levelGained} niveau(x) gagné(s)!)`;
      } else {
        message = `⭐ **${quantite} expérience** donnée à ${targetUser.username}`;
      }

      logExperienceChange(
        targetUser.id,
        player.name,
        oldExp,
        player.experience,
        "/admin give",
        interaction.user.id,
        interaction.user.username,
      );
      break;

    case "niveau":
      if (!quantite || quantite <= 0) {
        return interaction.reply({
          content: "❌ Veuillez spécifier une quantité valide de niveaux.",
          ephemeral: true,
        });
      }
      const oldLevelGive = player.level || 1;
      player.level = oldLevelGive + quantite;
      logLevelChange(
        targetUser.id,
        player.name,
        oldLevelGive,
        player.level,
        "/admin give",
      );
      message = `📊 **${quantite} niveau(x)** donné(s) à ${targetUser.username} (Niveau ${oldLevelGive} → ${player.level})`;
      break;

    case "reputation":
      if (!quantite || quantite <= 0) {
        return interaction.reply({
          content: "❌ Veuillez spécifier une quantité valide de réputation.",
          ephemeral: true,
        });
      }
      const oldReputation = player.reputation || 0;
      player.reputation = oldReputation + quantite;
      message = `🏅 **${quantite} réputation** donnée à ${targetUser.username} (${oldReputation} → ${player.reputation})`;
      break;

    case "attaque":
      if (!quantite || quantite <= 0) {
        return interaction.reply({
          content: "❌ Veuillez spécifier une quantité valide d'attaque.",
          ephemeral: true,
        });
      }
      // On prend la valeur existante à la racine (ou 10 par défaut)
      const oldAttack = player.attack || 10;
      player.attack = oldAttack + quantite;

      message = `⚔️ **${quantite} attaque** donnée à ${targetUser.username} (${oldAttack} → ${player.attack})`;
      break;

    case "defense":
      if (!quantite || quantite <= 0) {
        return interaction.reply({
          content: "❌ Veuillez spécifier une quantité valide de défense.",
          ephemeral: true,
        });
      }
      // On prend la valeur existante à la racine (ou 10 par défaut)
      const oldDefense = player.defense || 10;
      player.defense = oldDefense + quantite;

      message = `🛡️ **${quantite} défense** donnée à ${targetUser.username} (${oldDefense} → ${player.defense})`;
      break;

    case "pvmax":
      if (!quantite || quantite <= 0) {
        return interaction.reply({
          content: "❌ Veuillez spécifier une quantité valide de PV max.",
          ephemeral: true,
        });
      }
      const oldMaxHealth = player.maxHealth || 100;
      player.maxHealth = oldMaxHealth + quantite;
      // Ajuster les PV actuels proportionnellement
      const healthRatio = player.health / oldMaxHealth;
      player.health = Math.floor(player.maxHealth * healthRatio);
      message = `❤️ **${quantite} PV max** donnés à ${targetUser.username} (${oldMaxHealth} → ${player.maxHealth})`;
      break;

    case "manamax":
      if (!quantite || quantite <= 0) {
        return interaction.reply({
          content: "❌ Veuillez spécifier une quantité valide de mana max.",
          ephemeral: true,
        });
      }
      const oldMaxMana = player.maxMana || 50;
      player.maxMana = oldMaxMana + quantite;
      // Ajuster le mana actuel proportionnellement
      const manaRatio = player.mana / oldMaxMana;
      player.mana = Math.floor(player.maxMana * manaRatio);
      message = `🔮 **${quantite} mana max** donnés à ${targetUser.username} (${oldMaxMana} → ${player.maxMana})`;
      break;

    case "item":
      if (!itemId) {
        return interaction.reply({
          content: "❌ Veuillez spécifier l'ID de l'item à donner.",
          ephemeral: true,
        });
      }

      let item = null;
      let itemName = "";

      // 1. Chercher d'office dans items.json (gestion racine ou propriété .items)
      const baseItems = itemsData.items ? itemsData.items : itemsData;
      if (baseItems[itemId]) {
        item = baseItems[itemId];
        itemName = item.name;
      }

      // 2. Si pas trouvé, chercher dans uniqueItems.json (items créés par les admins)
      if (!item) {
        const uniqueItems = uniqueItemsData.items
          ? uniqueItemsData.items
          : uniqueItemsData;
        if (uniqueItems[itemId]) {
          item = uniqueItems[itemId];
          itemName = item.name;
        }
      }

      // 3. Si toujours pas trouvé, chercher dans la boutique quotidienne
      if (!item) {
        const shopItem = ALL_SHOP_ITEMS.find((i) => i.id === itemId);
        if (shopItem) {
          item = shopItem;
          itemName = shopItem.name;
        }
      }

      // Si l'item reste introuvable après les 3 vérifications
      if (!item) {
        return interaction.reply({
          content: `❌ Item avec l'ID "${itemId}" non trouvé dans items.json, uniqueItems.json ou la boutique.`,
          ephemeral: true,
        });
      }

      // Initialisation sécurisée de l'inventaire si vide
      if (!player.inventory || typeof player.inventory !== "object") {
        player.inventory = {};
      }

      // Prise en compte de la quantité demandée (par défaut 1 si non spécifiée)
      const qtyToAdd = quantite && quantite > 0 ? quantite : 1;
      player.inventory[itemId] = (player.inventory[itemId] || 0) + qtyToAdd;

      message = `📦 **${itemName}** (x${qtyToAdd}) donné à ${targetUser.username}`;
      break;
    case "titre":
      if (!itemId) {
        return interaction.reply({
          content: "❌ Veuillez spécifier l'ID du titre à donner.",
          ephemeral: true,
        });
      }

      // 1. Chercher d'abord dans la boutique
      let titre = ALL_SHOP_ITEMS.find(
        (i) => i.id === itemId && i.type === "titre",
      );
      let titreName = titre?.name;

      // 2. Si pas trouvé, chercher dans uniqueItems.json
      if (!titre) {
        const uniqueItems = uniqueItemsData.items
          ? uniqueItemsData.items
          : uniqueItemsData;
        if (uniqueItems[itemId] && uniqueItems[itemId].type === "titre") {
          titre = uniqueItems[itemId];
          titreName = titre.name;
        }
      }

      if (!titre) {
        return interaction.reply({
          content: `❌ Titre avec l'ID "${itemId}" non trouvé dans la boutique ou uniqueItems.json.`,
          ephemeral: true,
        });
      }

      player.titres = Array.isArray(player.titres) ? player.titres : [];
      if (!player.titres.includes(itemId)) {
        player.titres.push(itemId);
        message = `🏆 **${titreName}** donné à ${targetUser.username}`;
      } else {
        message = `⚠️ ${targetUser.username} possède déjà ce titre`;
      }
      break;

    case "familier":
      if (!itemId) {
        return interaction.reply({
          content: "❌ Veuillez spécifier l'ID du familier à donner.",
          ephemeral: true,
        });
      }

      // 1. Chercher d'abord dans la boutique
      let familier = ALL_SHOP_ITEMS.find(
        (i) => i.id === itemId && i.type === "familier",
      );
      let familierName = familier?.name;

      // 2. Si pas trouvé, chercher dans uniqueItems.json
      if (!familier) {
        const uniqueItems = uniqueItemsData.items
          ? uniqueItemsData.items
          : uniqueItemsData;
        if (uniqueItems[itemId] && uniqueItems[itemId].type === "familier") {
          familier = uniqueItems[itemId];
          familierName = familier.name;
        }
      }

      if (!familier) {
        return interaction.reply({
          content: `❌ Familier avec l'ID "${itemId}" non trouvé dans la boutique ou uniqueItems.json.`,
          ephemeral: true,
        });
      }

      player.familiers = Array.isArray(player.familiers)
        ? player.familiers
        : [];
      if (!player.familiers.includes(itemId)) {
        player.familiers.push(itemId);
        message = `🐺 **${familierName}** donné à ${targetUser.username}`;
      } else {
        message = `⚠️ ${targetUser.username} possède déjà ce familier`;
      }
      break;

    default:
      return interaction.reply({
        content: "❌ Type de ressource non reconnu.",
        ephemeral: true,
      });
  }

  updatePlayer(targetUser.id, player);

  const embed = createEmbed("success", "✅ Ressource donnée")
    .setDescription(message)
    .addFields({
      name: "👤 Joueur",
      value: `${targetUser.username} (${targetUser.id})`,
      inline: true,
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// Fonction pour retirer des ressources
async function handleRemove(interaction) {
  const targetUser = interaction.options.getUser("joueur");
  const type = interaction.options.getString("type");
  const quantite = interaction.options.getInteger("quantite");

  const player = getPlayer(targetUser.id);
  if (!player) {
    return interaction.reply({
      content: `❌ ${targetUser.username} n'a pas de personnage créé.`,
      ephemeral: true,
    });
  }

  if (quantite <= 0) {
    return interaction.reply({
      content: "❌ La quantité doit être positive.",
      ephemeral: true,
    });
  }

  let message = "";

  switch (type) {
    case "gemmes":
      const currentGemmes = player.gemmes || 0;
      player.gemmes = Math.max(0, currentGemmes - quantite);
      message = `💎 **${quantite} gemmes** retirées à ${targetUser.username} (${currentGemmes} → ${player.gemmes})`;
      break;

    case "or":
      const currentGold = player.gold || 0;
      player.gold = Math.max(0, currentGold - quantite);
      logGoldChange(
        targetUser.id,
        player.name,
        currentGold,
        player.gold,
        "/admin remove",
        interaction.user.id,
        interaction.user.username,
      );
      message = `🪙 **${quantite} or** retiré à ${targetUser.username} (${currentGold} → ${player.gold})`;
      break;

    case "experience":
      const currentExp = player.experience || 0;
      player.experience = Math.max(0, currentExp - quantite);
      logExperienceChange(
        targetUser.id,
        player.name,
        currentExp,
        player.experience,
        "/admin remove",
        interaction.user.id,
        interaction.user.username,
      );
      message = `⭐ **${quantite} expérience** retirée à ${targetUser.username} (${currentExp} → ${player.experience})`;
      break;

    default:
      return interaction.reply({
        content: "❌ Type de ressource non reconnu.",
        ephemeral: true,
      });
  }

  updatePlayer(targetUser.id, player);

  const embed = createEmbed("warning", "⚠️ Ressource retirée")
    .setDescription(message)
    .addFields({
      name: "👤 Joueur",
      value: `${targetUser.username} (${targetUser.id})`,
      inline: true,
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// Fonction pour définir une valeur exacte
// Fonction pour éditer un joueur avec panneau interactif
async function handleEdit(interaction) {
  const targetUser = interaction.options.getUser("joueur");

  const player = getPlayer(targetUser.id);
  if (!player) {
    return interaction.reply({
      content: `❌ ${targetUser.username} n'a pas de personnage créé.`,
      ephemeral: true,
    });
  }

  // Créer l'embed principal avec les infos du joueur
  const embed = createEmbed("info", `🔧 Panneau d'édition - ${player.name}`)
    .setDescription(
      `Sélectionnez une catégorie à modifier pour **${targetUser.username}**`,
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
      },
    )
    .setTimestamp();

  // Créer les boutons de catégories
  const categoryRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`edit_stats_${targetUser.id}`)
      .setLabel("Statistiques")
      .setEmoji("📊")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`edit_resources_${targetUser.id}`)
      .setLabel("Ressources")
      .setEmoji("💰")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`edit_class_${targetUser.id}`)
      .setLabel("Classe")
      .setEmoji("⚔️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`edit_faction_${targetUser.id}`)
      .setLabel("Faction")
      .setEmoji("🏰")
      .setStyle(ButtonStyle.Secondary),
  );

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`edit_close_${targetUser.id}`)
      .setLabel("Fermer")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({
    embeds: [embed],
    components: [categoryRow, closeRow],
    ephemeral: true,
  });
}

// Fonction pour réinitialiser
async function handleReset(interaction) {
  const targetUser = interaction.options.getUser("joueur");
  const type = interaction.options.getString("type");

  const player = getPlayer(targetUser.id);
  if (!player) {
    return interaction.reply({
      content: `❌ ${targetUser.username} n'a pas de personnage créé.`,
      ephemeral: true,
    });
  }

  let message = "";

  switch (type) {
    case "inventory":
      player.inventory = {};
      message = `📦 **Inventaire** réinitialisé pour ${targetUser.username}`;
      break;

    case "titres":
      player.titres = [];
      message = `🏆 **Titres** réinitialisés pour ${targetUser.username}`;
      break;

    case "familiers":
      player.familiers = [];
      message = `🐺 **Familiers** réinitialisés pour ${targetUser.username}`;
      break;

    case "stats":
      const statsOldGold = player.gold || 0;
      const statsOldExp = player.experience || 0;
      const statsOldLevel = player.level || 1;

      player.experience = 0;
      player.level = 1;
      player.health = 100;
      player.attack = 10;
      player.defense = 10;
      player.gold = 0;

      logAdminAction(
        AuditEventType.ADMIN_RESET,
        targetUser.id,
        player.name,
        interaction.user.id,
        interaction.user.username,
        "Réinitialisation des statistiques",
        {
          gold: { before: statsOldGold, after: 0 },
          experience: { before: statsOldExp, after: 0 },
          level: { before: statsOldLevel, after: 1 },
        },
      );

      message = `📊 **Statistiques** réinitialisées pour ${targetUser.username}`;
      break;

    case "all":
      const allOldGold = player.gold || 0;
      const allOldExp = player.experience || 0;
      const allOldLevel = player.level || 1;
      const allOldGemmes = player.gemmes || 0;

      // Garder seulement les infos de base
      const basicInfo = {
        id: player.id,
        name: player.name,
        createdAt: player.createdAt,
      };

      // Réinitialiser tout le reste
      Object.keys(player).forEach((key) => {
        if (!basicInfo.hasOwnProperty(key)) {
          delete player[key];
        }
      });

      // Remettre les valeurs par défaut
      player.level = 1;
      player.experience = 0;
      player.health = 100;
      player.attack = 10;
      player.defense = 10;
      player.gold = 0;
      player.gemmes = 0;
      player.inventory = {};
      player.titres = [];
      player.familiers = [];

      logAdminAction(
        AuditEventType.ADMIN_RESET,
        targetUser.id,
        player.name,
        interaction.user.id,
        interaction.user.username,
        "Réinitialisation complète du personnage",
        {
          gold: { before: allOldGold, after: 0 },
          experience: { before: allOldExp, after: 0 },
          level: { before: allOldLevel, after: 1 },
          gemmes: { before: allOldGemmes, after: 0 },
        },
      );

      message = `🔄 **Tout** réinitialisé pour ${targetUser.username}`;
      break;

    default:
      return interaction.reply({
        content: "❌ Type de réinitialisation non reconnu.",
        ephemeral: true,
      });
  }

  updatePlayer(targetUser.id, player);

  const embed = createEmbed("warning", "🔄 Réinitialisation effectuée")
    .setDescription(message)
    .addFields({
      name: "👤 Joueur",
      value: `${targetUser.username} (${targetUser.id})`,
      inline: true,
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// Fonction pour afficher les infos détaillées
async function handleInfo(interaction) {
  const targetUser = interaction.options.getUser("joueur");
  const player = getPlayer(targetUser.id);

  if (!player) {
    return interaction.reply({
      content: `❌ ${targetUser.username} n'a pas de personnage créé.`,
      ephemeral: true,
    });
  }

  // Normaliser les collections potentiellement non-tableaux
  const inventoryList = Object.entries(player.inventory || {}).map(
    ([id, qty]) => `${id} x${qty}`,
  );
  const titresList = Array.isArray(player.titres) ? player.titres : [];
  const familiersList = Array.isArray(player.familiers) ? player.familiers : [];

  const embed = createEmbed(
    "info",
    `🔍 Informations détaillées - ${player.name}`,
  )
    .setThumbnail(targetUser.displayAvatarURL())
    .addFields(
      {
        name: "👤 Informations de base",
        value: `**Nom:** ${player.name}\n**ID:** ${player.id}\n**Niveau:** ${
          player.level || 1
        }\n**Expérience:** ${player.experience || 0}`,
        inline: true,
      },
      {
        name: "💰 Ressources",
        value: `**💎 Gemmes:** ${player.gemmes || 0}\n**🪙 Or:** ${
          player.gold || 0
        }`,
        inline: true,
      },
      {
        name: "⚔️ Statistiques",
        value: `**❤️ PV:** ${player.health || 100}\n**⚔️ Attaque:** ${
          player.attack || 10
        }\n**🛡️ Défense:** ${player.defense || 10}`,
        inline: true,
      },
      {
        name: "📦 Inventaire",
        value: `**Items:** ${inventoryList.length}\n**Détail:** ${
          inventoryList.slice(0, 5).join(", ") || "Vide"
        }${inventoryList.length > 5 ? "..." : ""}`,
        inline: true,
      },
      {
        name: "🏆 Titres",
        value: `**Nombre:** ${titresList.length}\n**Détail:** ${
          titresList.join(", ") || "Aucun"
        }`,
        inline: true,
      },
      {
        name: "🐺 Familiers",
        value: `**Nombre:** ${familiersList.length}\n**Détail:** ${
          familiersList.join(", ") || "Aucun"
        }`,
        inline: true,
      },
    )
    .addFields({
      name: "📅 Dates",
      value: `**Créé le:** ${
        player.createdAt
          ? new Date(player.createdAt).toLocaleString("fr-FR")
          : "Inconnue"
      }\n**Dernière activité:** ${
        player.lastActive
          ? new Date(player.lastActive).toLocaleString("fr-FR")
          : "Inconnue"
      }`,
      inline: false,
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// Fonction pour donner à tous les joueurs
async function handleBroadcast(interaction) {
  const type = interaction.options.getString("type");
  const quantite = interaction.options.getInteger("quantite");
  const raison =
    interaction.options.getString("raison") || "Cadeau des administrateurs";

  if (quantite <= 0) {
    return interaction.reply({
      content: "❌ La quantité doit être positive.",
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  // Charger tous les joueurs depuis le fichier
  const playersFile = path.join(__dirname, "../database/players.json");
  const allPlayers = JSON.parse(fs.readFileSync(playersFile, "utf8"));
  let playersUpdated = 0;

  for (const [playerId, player] of Object.entries(allPlayers)) {
    switch (type) {
      case "gemmes":
        player.gemmes = (player.gemmes || 0) + quantite;
        break;
      case "or":
        player.gold = (player.gold || 0) + quantite;
        break;
      case "experience":
        player.experience = (player.experience || 0) + quantite;
        break;
    }
    updatePlayer(playerId, player);
    playersUpdated++;
  }

  const typeEmoji = {
    gemmes: "💎",
    or: "🪙",
    experience: "⭐",
  };

  const embed = createEmbed("success", "📢 Distribution globale effectuée")
    .setDescription(
      `${typeEmoji[type]} **${quantite} ${type}** données à tous les joueurs !`,
    )
    .addFields({
      name: "📊 Statistiques",
      value: `**Joueurs mis à jour:** ${playersUpdated}\n**Raison:** ${raison}`,
      inline: false,
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// Fonction pour corriger l'expérience de tous les joueurs
async function handleFixExp(interaction) {
  await interaction.deferReply();

  try {
    const fixedCount = fixPlayerExperience();

    const embed = createEmbed("success", "🔧 Correction de l'expérience")
      .setDescription(
        fixedCount > 0
          ? `✅ **${fixedCount} joueurs** ont été corrigés pour l'expérience et les niveaux.`
          : `✅ Aucune correction nécessaire. Tous les joueurs ont déjà l'expérience correcte.`,
      )
      .addFields({
        name: "📊 Système d'expérience",
        value:
          "**Formule:** Niveau N nécessite N × 100 XP\n**Exemple:** Niveau 3 → 300 XP, Niveau 4 → 400 XP",
        inline: false,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erreur lors de la correction de l'expérience:", error);
    await interaction.editReply({
      content:
        "❌ Une erreur s'est produite lors de la correction de l'expérience.",
    });
  }
}

// Fonction pour créer une sauvegarde manuelle
async function handleBackup(interaction) {
  await interaction.deferReply();

  try {
    const backupPath = exportPlayerData();

    if (backupPath) {
      const fileName = path.basename(backupPath);
      const embed = createEmbed("success", "💾 Sauvegarde créée")
        .setDescription(`✅ Sauvegarde créée avec succès !`)
        .addFields({
          name: "📁 Fichier",
          value: `\`${fileName}\``,
          inline: true,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({
        content: "❌ Erreur lors de la création de la sauvegarde.",
      });
    }
  } catch (error) {
    console.error("Erreur lors de la sauvegarde:", error);
    await interaction.editReply({
      content: "❌ Une erreur s'est produite lors de la sauvegarde.",
    });
  }
}

// Fonction pour restaurer depuis une sauvegarde
async function handleRestore(interaction) {
  await interaction.deferReply();

  try {
    const fileName = interaction.options.getString("fichier");
    const backupPath = path.join(__dirname, "../database", fileName);

    const playersCount = importPlayerData(backupPath);

    if (playersCount >= 0) {
      const embed = createEmbed("success", "🔄 Restauration effectuée")
        .setDescription(`✅ Données restaurées avec succès !`)
        .addFields({
          name: "📊 Statistiques",
          value: `**${playersCount} joueurs** restaurés depuis \`${fileName}\``,
          inline: false,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply({
        content: `❌ Erreur lors de la restauration. Vérifiez que le fichier \`${fileName}\` existe dans le dossier database.`,
      });
    }
  } catch (error) {
    console.error("Erreur lors de la restauration:", error);
    await interaction.editReply({
      content: "❌ Une erreur s'est produite lors de la restauration.",
    });
  }
}

// Fonction pour synchroniser les rôles Discord avec les factions ET les classes
async function handleSyncRoles(interaction) {
  await interaction.deferReply();

  try {
    const allPlayers = getAllPlayers();
    let factionSynced = 0;
    let classSynced = 0;
    let alreadyOk = 0;
    let errorCount = 0;
    let notFoundCount = 0;
    const errors = [];

    await interaction.editReply({
      embeds: [
        createEmbed("info", "🔄 Synchronisation des rôles en cours...")
          .setDescription(
            "Vérification des rôles de **faction** et de **classe** pour tous les joueurs...",
          )
          .setTimestamp(),
      ],
    });

    for (const player of allPlayers) {
      try {
        const member = await interaction.guild.members
          .fetch(player.id)
          .catch(() => null);

        if (!member) {
          notFoundCount++;
          continue;
        }

        let changed = false;

        // ── Synchronisation de la faction ─────────────────────────────────
        const factionOk = checkFactionRoleSync(member, player.faction);
        if (!factionOk) {
          const ok = await syncFactionRoles(member, player.faction);
          if (ok) {
            factionSynced++;
            changed = true;
            console.log(`[sync] Faction corrigée pour ${player.name}`);
          } else {
            errorCount++;
            errors.push(`${player.name}: erreur sync faction`);
          }
        }

        // ── Synchronisation de la classe ──────────────────────────────────
        const classOk = checkClassRoleSync(member, player.class);
        if (!classOk) {
          const ok = await syncClassRole(member, player.class);
          if (ok) {
            classSynced++;
            changed = true;
            console.log(
              `[sync] Classe corrigée pour ${player.name} (${player.class})`,
            );
          } else {
            errorCount++;
            errors.push(`${player.name}: erreur sync classe`);
          }
        }

        if (!changed) alreadyOk++;
      } catch (error) {
        errorCount++;
        errors.push(`${player.name}: ${error.message}`);
        console.error(`Erreur sync ${player.name}:`, error.message);
      }
    }

    const resultEmbed = createEmbed("success", "✅ Synchronisation terminée")
      .setDescription(
        "Les rôles Discord ont été synchronisés avec les **factions** et les **classes** de tous les joueurs.",
      )
      .addFields({
        name: "📊 Résultats",
        value: [
          `👥 **${allPlayers.length}** joueurs au total`,
          `✅ **${alreadyOk}** déjà à jour`,
          `👑 **${factionSynced}** rôles de faction corrigés`,
          `⚔️ **${classSynced}** rôles de classe corrigés`,
          `❌ **${errorCount}** erreurs`,
          `👻 **${notFoundCount}** membres introuvables sur le serveur`,
        ].join("\n"),
        inline: false,
      })
      .setTimestamp();

    if (errors.length > 0) {
      const errorText = errors.slice(0, 10).join("\n");
      const more =
        errors.length > 10 ? `\n... et ${errors.length - 10} autres` : "";
      resultEmbed.addFields({
        name: "⚠️ Erreurs",
        value: errorText + more,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [resultEmbed] });
  } catch (error) {
    console.error("Erreur handleSyncRoles:", error);
    await interaction.editReply({
      content:
        "❌ Une erreur s'est produite lors de la synchronisation des rôles.",
    });
  }
}

// Fonction pour vérifier les permissions du bot
async function handleCheckPermissions(interaction) {
  await interaction.deferReply();

  try {
    // Construire la map ID depuis le cache du serveur (rôles par nom)
    const FACTION_ROLE_NAMES_MAP = {
      ordre_royal: "👑 Ordre Royal",
      guilde_ombres: "🌙 Guilde des Ombres",
      cercle_druidique: "🌿 Cercle Druidique",
      academie_arcanique: "🏛️ Académie Arcanique",
    };
    const dynamicRoleIds = {};
    for (const [key, name] of Object.entries(FACTION_ROLE_NAMES_MAP)) {
      const role = interaction.guild.roles.cache.find((r) => r.name === name);
      if (role) dynamicRoleIds[key] = role.id;
    }
    const report = generatePermissionReport(interaction.guild, dynamicRoleIds);

    // Créer l'embed principal
    const embed = createEmbed(
      report.summary.allRolesManageable ? "success" : "warning",
      "🔍 Vérification des permissions",
    )
      .setDescription(
        "Rapport des permissions du bot pour la gestion des rôles de faction",
      )
      .setTimestamp();

    // Permissions générales
    const generalStatus = report.general.hasPermissions ? "✅" : "❌";
    let generalValue = `${generalStatus} **Statut général:** ${
      report.general.hasPermissions ? "OK" : "Problème"
    }`;

    if (report.general.missingPermissions.length > 0) {
      generalValue += `\n**Permissions manquantes:**\n${report.general.missingPermissions
        .map((p) => `• ${p}`)
        .join("\n")}`;
    }

    if (report.general.botHighestRole) {
      generalValue += `\n**Rôle le plus élevé:** ${report.general.botHighestRole.name} (Position: ${report.general.botPosition})`;
    }

    embed.addFields({
      name: "🤖 Permissions générales",
      value: generalValue,
      inline: false,
    });

    // Vérification des rôles de faction
    const factionNames = {
      ordre_royal: "👑 Ordre Royal",
      guilde_ombres: "🌙 Guilde des Ombres",
      cercle_druidique: "🌿 Cercle Druidique",
      academie_arcanique: "🏛️ Académie Arcanique",
    };

    let rolesValue = "";
    for (const [factionKey, roleCheck] of Object.entries(report.roles)) {
      const status = roleCheck.canManage ? "✅" : "❌";
      const factionName = factionNames[factionKey] || factionKey;
      rolesValue += `${status} **${factionName}**\n`;

      if (!roleCheck.canManage) {
        rolesValue += `   └ *${roleCheck.reason}*\n`;
      }
      rolesValue += "\n";
    }

    embed.addFields({
      name: "🎭 Rôles de faction",
      value: rolesValue || "Aucun rôle configuré",
      inline: false,
    });

    // Résumé
    const summaryValue = [
      `**${report.summary.manageableCount}/${report.summary.totalRoles}** rôles gérables`,
      `**Statut global:** ${
        report.summary.allRolesManageable ? "✅ Prêt" : "⚠️ Action requise"
      }`,
    ].join("\n");

    embed.addFields({
      name: "📊 Résumé",
      value: summaryValue,
      inline: false,
    });

    // Ajouter des recommandations si nécessaire
    if (!report.summary.allRolesManageable) {
      let recommendations = "**Recommandations:**\n";

      if (!report.general.canManageRoles) {
        recommendations +=
          "• Accordez la permission **Gérer les rôles** au bot\n";
      }

      const problematicRoles = Object.entries(report.roles)
        .filter(([_, check]) => !check.canManage)
        .filter(([_, check]) => check.reason.includes("hiérarchie"));

      if (problematicRoles.length > 0) {
        recommendations +=
          "• Déplacez le rôle du bot au-dessus des rôles de faction\n";
      }

      embed.addFields({
        name: "💡 Actions recommandées",
        value: recommendations,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Erreur lors de la vérification des permissions:", error);
    await interaction.editReply({
      content:
        "❌ Une erreur s'est produite lors de la vérification des permissions.",
    });
  }
}

// Fonction pour supprimer un personnage
async function handleDelete(interaction) {
  const targetUser = interaction.options.getUser("joueur");
  const confirmer = interaction.options.getBoolean("confirmer");

  const player = getPlayer(targetUser.id);
  if (!player) {
    return interaction.reply({
      content: `❌ ${targetUser.username} n'a pas de personnage créé.`,
      ephemeral: true,
    });
  }

  if (!confirmer) {
    return interaction.reply({
      content:
        "❌ Vous devez confirmer la suppression en mettant l'option 'confirmer' à True.\n⚠️ **ATTENTION:** Cette action est irréversible !",
      ephemeral: true,
    });
  }

  // Sauvegarder les informations du joueur avant suppression
  const playerInfo = {
    name: player.name,
    level: player.level,
    class: player.class,
    gold: player.gold,
    experience: player.experience,
    reputation: player.reputation || 0,
  };

  // Logger la suppression
  logPlayerDeletion(
    targetUser.id,
    player.name,
    interaction.user.id,
    interaction.user.username,
  );

  // Supprimer le personnage
  deletePlayer(targetUser.id);

  const embed = createEmbed("error", "🗑️ Personnage supprimé")
    .setDescription(
      `Le personnage de **${targetUser.username}** a été définitivement supprimé.`,
    )
    .addFields(
      {
        name: "👤 Joueur Discord",
        value: `${targetUser.username} (${targetUser.id})`,
        inline: false,
      },
      {
        name: "🎭 Personnage supprimé",
        value: `**${playerInfo.name}** - Niveau ${playerInfo.level} ${playerInfo.class}`,
        inline: false,
      },
      {
        name: "📊 Statistiques",
        value: [
          `💰 Or: ${playerInfo.gold}`,
          `⭐ Expérience: ${playerInfo.experience}`,
          `🏅 Réputation: ${playerInfo.reputation}`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "⚠️ Avertissement",
        value:
          "Cette action est **irréversible**. Le joueur devra recréer un personnage avec `/personnage creer`.",
        inline: false,
      },
    )
    .setFooter({
      text: `Supprimé par ${interaction.user.username}`,
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
