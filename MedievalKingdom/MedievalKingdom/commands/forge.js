const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getPlayer, updatePlayer } = require("../utils/database");
const { createEmbed } = require("../utils/embeds");
const { ALL_SHOP_ITEMS } = require("../utils/dailyShop");
const fs = require("fs");
const path = require("path");

const itemsPath = path.join(__dirname, "..", "database", "items.json");
const enchantmentsPath = path.join(
  __dirname,
  "..",
  "database",
  "enchantments.json",
);
const goldShopPath = path.join(__dirname, "..", "database", "goldShop.json");

function loadJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (error) {
    console.error(`Erreur lors du chargement de ${filePath}:`, error);
  }
  return null;
}

// Fonction pour trouver un item dans toutes les sources (items.json, goldShop.json, et boutique gemmes)
function findItemData(itemId) {
  // D'abord chercher dans items.json
  const itemsData = loadJSON(itemsPath);
  if (itemsData?.items[itemId]) {
    return {
      data: itemsData.items[itemId],
      source: "items",
    };
  }

  // Ensuite chercher dans goldShop.json
  const goldShopData = loadJSON(goldShopPath);
  if (goldShopData?.equipment?.[itemId]) {
    const goldItem = goldShopData.equipment[itemId];

    // Convertir le format goldShop vers le format items.json
    // Mapper les types: weapon -> weapon, armor/shield -> armor
    let itemType = goldItem.type;
    if (goldItem.type === "shield") {
      itemType = "armor";
    }

    return {
      data: {
        name: goldItem.name,
        description: goldItem.description,
        type: itemType,
        rarity: goldItem.rarity || "common",
        value: goldItem.price || 0,
        stats: goldItem.stats || {},
        emoji: goldItem.emoji,
      },
      source: "goldShop",
    };
  }

  // Chercher dans la boutique gemmes (ALL_SHOP_ITEMS)
  try {
    const gemItem = ALL_SHOP_ITEMS.find((i) => i.id === itemId);
    if (gemItem && (gemItem.type === "arme" || gemItem.type === "armure")) {
      return {
        data: {
          name: gemItem.name,
          description: gemItem.description || "",
          type: gemItem.type === "arme" ? "weapon" : "armor",
          rarity: gemItem.rarity || "common",
          value: gemItem.price || 0,
          stats: gemItem.stats || {},
          emoji: gemItem.emoji,
        },
        source: "gemShop",
      };
    }
  } catch (err) {
    console.error("Erreur lors de la recherche dans la boutique gemmes:", err);
  }

  return null;
}

function getRarityEmoji(rarity) {
  const emojis = {
    common: "⚪",
    uncommon: "🟢",
    rare: "🔵",
    epic: "🟣",
    legendary: "🟡",
  };
  return emojis[rarity] || "⚪";
}

// Calcul du coût d'amélioration (exponentiel)
function getUpgradeCost(currentLevel) {
  // Formule: 100 * (1.5 ^ niveau)
  return Math.floor(100 * Math.pow(1.5, currentLevel));
}

// Calcul du bonus de stats par niveau
function getStatBonus(baseStat, level) {
  // Chaque niveau ajoute 10% de la stat de base
  return Math.floor(baseStat * 0.1 * level);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("forge")
    .setDescription("Améliorez et enchantez vos équipements")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("ameliorer")
        .setDescription("Améliorer un équipement")
        .addStringOption((option) =>
          option
            .setName("item")
            .setDescription("ID de l'item à améliorer")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("enchanter")
        .setDescription("Appliquer un enchantement à un équipement")
        .addStringOption((option) =>
          option
            .setName("item")
            .setDescription("ID de l'item à enchanter")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("enchantement")
            .setDescription("ID de l'enchantement à appliquer")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription("Voir les informations d'un équipement")
        .addStringOption((option) =>
          option
            .setName("item")
            .setDescription("ID de l'item")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("enchantements")
        .setDescription("Voir vos enchantements disponibles"),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "ameliorer":
        await this.upgradeItem(interaction);
        break;
      case "enchanter":
        await this.enchantItem(interaction);
        break;
      case "info":
        await this.showItemInfo(interaction);
        break;
      case "enchantements":
        await this.showEnchantments(interaction);
        break;
    }
  },

  async upgradeItem(interaction) {
    const itemId = interaction.options.getString("item");
    const player = getPlayer(interaction.user.id);

    if (!player) {
      return interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez d'abord créer un personnage avec `/personnage creer`.",
          ),
        ],
        ephemeral: true,
      });
    }

    // Vérifier si le joueur possède l'item
    if (
      !player.inventory ||
      !player.inventory[itemId] ||
      player.inventory[itemId] <= 0
    ) {
      return interaction.reply({
        embeds: [createEmbed("error", "Vous ne possédez pas cet item.")],
        ephemeral: true,
      });
    }

    // Utiliser la fonction unifiée pour trouver l'item
    const itemResult = findItemData(itemId);

    if (!itemResult) {
      return interaction.reply({
        embeds: [createEmbed("error", "Item introuvable.")],
        ephemeral: true,
      });
    }

    const itemData = itemResult.data;

    // Vérifier que c'est un équipement
    if (itemData.type === "consumable") {
      return interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous ne pouvez améliorer que des équipements (armes, armures).",
          ),
        ],
        ephemeral: true,
      });
    }

    // Initialiser les données d'amélioration si nécessaire
    if (!player.itemUpgrades) player.itemUpgrades = {};
    if (!player.itemUpgrades[itemId]) {
      player.itemUpgrades[itemId] = { level: 0 };
    }

    const currentLevel = player.itemUpgrades[itemId].level;
    const upgradeCost = getUpgradeCost(currentLevel);

    // Vérifier si le joueur a assez d'or
    if (player.gold < upgradeCost) {
      return interaction.reply({
        embeds: [
          createEmbed(
            "error",
            `Vous n'avez pas assez d'or pour améliorer cet item.\n\n` +
              `Coût: **${upgradeCost} 💰**\n` +
              `Vous avez: **${player.gold} 💰**`,
          ),
        ],
        ephemeral: true,
      });
    }

    // Si l'item est équipé, retirer d'abord les anciens bonus (au niveau actuel),
    // puis on incrémente le niveau et on réapplique les nouveaux bonus.
    const isEquipped = (() => {
      if (!player.equipment) return false;
      if (player.equipment.weapon === itemId) return true;
      if (
        typeof player.equipment.armor === "object" &&
        player.equipment.armor
      ) {
        for (const slot of Object.values(player.equipment.armor)) {
          if (slot === itemId) return true;
        }
      } else if (player.equipment.armor === itemId) {
        return true;
      }
      return false;
    })();

    // Construire un objet item compatible avec apply/removeItemStats
    const itemObj = {
      id: itemId,
      name: itemData.name,
      description: itemData.description || "",
      stats: itemData.stats || {},
    };

    // Si équipé, retirer anciens bonus (utilise le niveau actuel)
    if (isEquipped) {
      try {
        const equipModule = require("../commands/equip");
        if (typeof equipModule.removeItemStats === "function") {
          equipModule.removeItemStats(player, itemObj);
        }
      } catch (err) {
        console.error("Erreur lors du retrait des anciens bonus d'item:", err);
      }
    }

    // Améliorer l'item (incrémenter le niveau) et retirer l'or
    player.itemUpgrades[itemId].level++;
    player.gold -= upgradeCost;

    // Si équipé, réappliquer les nouveaux bonus (utilise le nouveau niveau)
    if (isEquipped) {
      try {
        const equipModule = require("../commands/equip");
        if (typeof equipModule.applyItemStats === "function") {
          equipModule.applyItemStats(player, itemObj);
        }
      } catch (err) {
        console.error(
          "Erreur lors de l'application des nouveaux bonus d'item:",
          err,
        );
      }
    }

    // Sauvegarder le joueur après ajustements
    updatePlayer(interaction.user.id, player);

    const newLevel = player.itemUpgrades[itemId].level;
    const nextUpgradeCost = getUpgradeCost(newLevel);

    // Calculer les nouveaux bonus
    let bonusText = "";
    if (itemData.stats) {
      for (const [stat, value] of Object.entries(itemData.stats)) {
        const bonus = getStatBonus(value, newLevel);
        bonusText += `${stat}: ${value} → **${value + bonus}** (+${bonus})\n`;
      }
    }

    const embed = createEmbed(
      "success",
      `⚒️ Amélioration réussie !`,
      `**${itemData.name}** a été amélioré au niveau **+${newLevel}** !\n\n` +
        `**Nouvelles stats:**\n${bonusText}\n` +
        `**Coût payé:** ${upgradeCost} 💰\n` +
        `**Prochain niveau:** ${nextUpgradeCost} 💰\n\n` +
        `Or restant: **${player.gold} 💰**`,
    );

    await interaction.reply({ embeds: [embed] });
  },

  async enchantItem(interaction) {
    const itemId = interaction.options.getString("item");
    const enchantmentId = interaction.options.getString("enchantement");
    const player = getPlayer(interaction.user.id);

    if (!player) {
      return interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez d'abord créer un personnage avec `/personnage creer`.",
          ),
        ],
        ephemeral: true,
      });
    }

    // Vérifier si le joueur possède l'item
    if (
      !player.inventory ||
      !player.inventory[itemId] ||
      player.inventory[itemId] <= 0
    ) {
      return interaction.reply({
        embeds: [createEmbed("error", "Vous ne possédez pas cet item.")],
        ephemeral: true,
      });
    }

    // Vérifier si le joueur possède l'enchantement
    if (!player.enchantments || !player.enchantments.includes(enchantmentId)) {
      return interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous ne possédez pas cet enchantement. Achetez des coffres d'enchantement à la boutique d'or !",
          ),
        ],
        ephemeral: true,
      });
    }

    // Utiliser la fonction unifiée pour trouver l'item
    const itemResult = findItemData(itemId);
    const enchantmentsData = loadJSON(enchantmentsPath);
    const enchantmentData = enchantmentsData?.enchantments[enchantmentId];

    if (!itemResult || !enchantmentData) {
      return interaction.reply({
        embeds: [createEmbed("error", "Item ou enchantement introuvable.")],
        ephemeral: true,
      });
    }

    const itemData = itemResult.data;

    // Vérifier que c'est un équipement
    if (itemData.type === "consumable") {
      return interaction.reply({
        embeds: [
          createEmbed("error", "Vous ne pouvez enchanter que des équipements."),
        ],
        ephemeral: true,
      });
    }

    // Vérifier la compatibilité
    if (!enchantmentData.applicableTypes.includes(itemData.type)) {
      return interaction.reply({
        embeds: [
          createEmbed(
            "error",
            `Cet enchantement ne peut pas être appliqué à ce type d'item.\n\n` +
              `**Types compatibles:** ${enchantmentData.applicableTypes.join(
                ", ",
              )}`,
          ),
        ],
        ephemeral: true,
      });
    }

    // Initialiser les enchantements d'items si nécessaire
    if (!player.itemEnchantments) player.itemEnchantments = {};

    // Vérifier si l'item a déjà un enchantement
    let replacedEnchantment = null;
    if (player.itemEnchantments[itemId]) {
      replacedEnchantment = player.itemEnchantments[itemId];
      // Rendre l'ancien enchantement au joueur
      player.enchantments.push(replacedEnchantment);
    }

    // Appliquer le nouvel enchantement
    player.itemEnchantments[itemId] = enchantmentId;

    // Retirer l'enchantement de l'inventaire
    const enchIndex = player.enchantments.indexOf(enchantmentId);
    if (enchIndex > -1) {
      player.enchantments.splice(enchIndex, 1);
    }

    updatePlayer(interaction.user.id, player);

    // Afficher les effets
    let effectsText = "";
    if (enchantmentData.effects) {
      for (const [effect, value] of Object.entries(enchantmentData.effects)) {
        if (typeof value === "number") {
          if (value < 1 && value > 0) {
            effectsText += `${effect}: +${Math.round(value * 100)}%\n`;
          } else {
            effectsText += `${effect}: +${value}\n`;
          }
        } else {
          effectsText += `${effect}: ${value}\n`;
        }
      }
    }

    let message =
      `**${itemData.name}** a été enchanté avec **${enchantmentData.emoji} ${enchantmentData.name}** !\n\n` +
      `**Effets:**\n${effectsText}`;

    if (replacedEnchantment) {
      const oldEnch = enchantmentsData.enchantments[replacedEnchantment];
      message += `\n\n⚠️ L'ancien enchantement **${oldEnch.name}** a été remplacé et rendu à votre inventaire.`;
    }

    const embed = createEmbed("success", `✨ Enchantement appliqué !`, message);
    await interaction.reply({ embeds: [embed] });
  },

  async showItemInfo(interaction) {
    const itemId = interaction.options.getString("item");
    const player = getPlayer(interaction.user.id);

    if (!player) {
      return interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez d'abord créer un personnage avec `/personnage creer`.",
          ),
        ],
        ephemeral: true,
      });
    }

    // Utiliser la fonction unifiée pour trouver l'item
    const itemResult = findItemData(itemId);
    const enchantmentsData = loadJSON(enchantmentsPath);

    if (!itemResult) {
      return interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Item introuvable. Vérifiez l'ID avec `/inventaire voir` ou `/boutique-or voir equipements`.",
          ),
        ],
        ephemeral: true,
      });
    }

    const itemData = itemResult.data;

    const embed = new EmbedBuilder()
      .setTitle(`${getRarityEmoji(itemData.rarity)} ${itemData.name}`)
      .setDescription(itemData.description)
      .setColor(this.getRarityColor(itemData.rarity));

    // Stats de base
    if (itemData.stats) {
      let statsText = "";
      const upgradeLevel = player.itemUpgrades?.[itemId]?.level || 0;

      for (const [stat, value] of Object.entries(itemData.stats)) {
        const bonus = getStatBonus(value, upgradeLevel);
        if (bonus > 0) {
          statsText += `${stat}: ${value} + **${bonus}** = **${
            value + bonus
          }**\n`;
        } else {
          statsText += `${stat}: ${value}\n`;
        }
      }
      embed.addFields({ name: "📊 Stats", value: statsText, inline: true });
    }

    // Niveau d'amélioration
    if (player.itemUpgrades && player.itemUpgrades[itemId]) {
      const level = player.itemUpgrades[itemId].level;
      const nextCost = getUpgradeCost(level);
      embed.addFields({
        name: "⚒️ Amélioration",
        value: `Niveau: **+${level}**\nProchain niveau: **${nextCost} 💰**`,
        inline: true,
      });
    } else {
      const firstCost = getUpgradeCost(0);
      embed.addFields({
        name: "⚒️ Amélioration",
        value: `Niveau: **+0**\nPremière amélioration: **${firstCost} 💰**`,
        inline: true,
      });
    }

    // Enchantement
    if (player.itemEnchantments && player.itemEnchantments[itemId]) {
      const enchId = player.itemEnchantments[itemId];
      const enchData = enchantmentsData?.enchantments[enchId];
      if (enchData) {
        let effectsText = "";
        for (const [effect, value] of Object.entries(enchData.effects)) {
          if (typeof value === "number") {
            if (value < 1 && value > 0) {
              effectsText += `${effect}: +${Math.round(value * 100)}%\n`;
            } else {
              effectsText += `${effect}: +${value}\n`;
            }
          } else {
            effectsText += `${effect}: ${value}\n`;
          }
        }
        embed.addFields({
          name: `✨ Enchantement: ${enchData.emoji} ${enchData.name}`,
          value: effectsText,
          inline: false,
        });
      }
    } else {
      embed.addFields({
        name: "✨ Enchantement",
        value: "Aucun enchantement appliqué",
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },

  async showEnchantments(interaction) {
    const player = getPlayer(interaction.user.id);

    if (!player) {
      return interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez d'abord créer un personnage avec `/personnage creer`.",
          ),
        ],
        ephemeral: true,
      });
    }

    if (!player.enchantments || player.enchantments.length === 0) {
      return interaction.reply({
        embeds: [
          createEmbed(
            "info",
            "✨ Enchantements disponibles",
            "Vous n'avez aucun enchantement.\n\n" +
              "Achetez des coffres d'enchantement à la boutique d'or avec `/boutique-or voir categorie:chests`",
          ),
        ],
        ephemeral: true,
      });
    }

    const enchantmentsData = loadJSON(enchantmentsPath);
    const embed = new EmbedBuilder()
      .setTitle("✨ Vos enchantements disponibles")
      .setDescription(
        "Utilisez `/forge enchanter` pour appliquer un enchantement à un équipement.",
      )
      .setColor("#9b59b6");

    for (const enchId of player.enchantments) {
      const enchData = enchantmentsData?.enchantments[enchId];
      if (enchData) {
        let effectsText = "";
        for (const [effect, value] of Object.entries(enchData.effects)) {
          if (typeof value === "number") {
            if (value < 1 && value > 0) {
              effectsText += `${effect}: +${Math.round(value * 100)}%\n`;
            } else {
              effectsText += `${effect}: +${value}\n`;
            }
          } else {
            effectsText += `${effect}: ${value}\n`;
          }
        }
        embed.addFields({
          name: `${getRarityEmoji(enchData.rarity)} ${enchData.emoji} ${
            enchData.name
          }`,
          value: `ID: \`${enchId}\`\n${
            enchData.description
          }\n**Effets:**\n${effectsText}\n**Compatible:** ${enchData.applicableTypes.join(
            ", ",
          )}`,
          inline: true,
        });
      }
    }

    await interaction.reply({ embeds: [embed] });
  },

  getRarityColor(rarity) {
    const colors = {
      common: "#95a5a6",
      uncommon: "#2ecc71",
      rare: "#3498db",
      epic: "#9b59b6",
      legendary: "#f39c12",
    };
    return colors[rarity] || "#95a5a6";
  },
};
