const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getPlayer, updatePlayer } = require("../utils/database.js");
const { createEmbed } = require("../utils/embeds.js");
const { ALL_SHOP_ITEMS } = require("../utils/dailyShop");
const fs = require("fs");
const path = require("path");

// Charger les données des objets
const itemsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../database/items.json"), "utf8"),
);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("inventaire")
    .setDescription("Gestion de votre inventaire")
    .addSubcommand((subcommand) =>
      subcommand.setName("voir").setDescription("Voir votre inventaire"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("utiliser")
        .setDescription("Utiliser un objet")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID de l'objet à utiliser (ex: potion_soin)")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription("Voir les détails d'un objet")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID de l'objet à examiner (ex: potion_soin)")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("donner")
        .setDescription("Donner un objet à un autre joueur")
        .addUserOption((option) =>
          option
            .setName("joueur")
            .setDescription("Joueur qui recevra l'objet")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID de l'objet à donner (ex: potion_soin)")
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName("quantite")
            .setDescription("Quantité à donner (par défaut: 1)")
            .setRequired(false)
            .setMinValue(1),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "voir":
          await this.showInventory(interaction);
          break;
        case "utiliser":
          await this.useItem(interaction);
          break;
        case "info":
          await this.showItemInfo(interaction);
          break;
        case "donner":
          await this.giveItem(interaction);
          break;
      }
    } catch (error) {
      console.error("Erreur dans la commande inventaire:", error);
      await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Une erreur est survenue lors de l'exécution de la commande.",
          ),
        ],
        ephemeral: true,
      });
    }
  },

  async showInventory(interaction) {
    const userId = interaction.user.id;
    const player = getPlayer(userId);

    if (!player) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez d'abord créer un personnage avec `/personnage creer`.",
          ),
        ],
        ephemeral: true,
      });
    }

    if (Object.keys(player.inventory).length === 0) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "info",
            "🎒 Inventaire vide",
            "Votre inventaire est vide. Complétez des quêtes pour obtenir des objets !",
          ),
        ],
      });
    }

    const embed = createEmbed(
      "info",
      `🎒 Inventaire de ${player.name}`,
    ).addFields({ name: "💰 Or", value: player.gold.toString(), inline: true });

    // Organiser les objets par catégorie
    const categories = {
      weapon: { name: "⚔️ Armes", items: [] },
      consumable: { name: "🧪 Consommables", items: [] },
      instrument: { name: "🎵 Instruments", items: [] },
      misc: { name: "📦 Divers", items: [] },
    };

    for (const [itemId, quantity] of Object.entries(player.inventory)) {
      let item = itemsData.items[itemId];
      if (!item) {
        // Fallback to shop items if not present in items.json
        item = ALL_SHOP_ITEMS.find((i) => i.id === itemId) || null;
      }
      if (item) {
        // Normalize type names between sources
        const typeKey =
          item.type === "objet" || item.type === "item"
            ? "consumable"
            : item.type === "arme"
              ? "weapon"
              : item.type === "armure"
                ? "armor"
                : item.type;
        const category = categories[typeKey] || categories.misc;
        const rarity = this.getRarityEmoji(item.rarity);
        category.items.push(`${rarity} ${item.name} x${quantity}`);
      }
    }

    // Ajouter les catégories non vides à l'embed
    for (const category of Object.values(categories)) {
      if (category.items.length > 0) {
        embed.addFields({
          name: category.name,
          value: category.items.join("\n"),
          inline: false,
        });
      }
    }

    await interaction.reply({ embeds: [embed] });
  },

  async useItem(interaction) {
    const userId = interaction.user.id;
    const itemId = interaction.options.getString("id").toLowerCase();
    const player = getPlayer(userId);

    if (!player) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez d'abord créer un personnage avec `/personnage creer`.",
          ),
        ],
        ephemeral: true,
      });
    }

    // Vérifier que l'objet existe (fallback vers la source de la boutique)
    let item = itemsData.items[itemId];
    if (!item) {
      item = ALL_SHOP_ITEMS.find((i) => i.id === itemId) || null;
    }

    if (!item) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Objet introuvable. Vérifiez l'ID de l'objet avec `/items`.",
          ),
        ],
        ephemeral: true,
      });
    }

    if (!player.inventory[itemId] || player.inventory[itemId] <= 0) {
      return await interaction.reply({
        embeds: [createEmbed("error", "Vous ne possédez pas cet objet.")],
        ephemeral: true,
      });
    }

    // Vérifier si l'objet est utilisable (accepter les deux vocabulaires)
    if (item.type !== "consumable" && item.type !== "objet") {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Cet objet ne peut pas être utilisé directement.",
          ),
        ],
        ephemeral: true,
      });
    }

    // Appliquer l'effet de l'objet
    const result = this.applyItemEffect(player, item);

    if (!result.success) {
      return await interaction.reply({
        embeds: [createEmbed("error", result.message)],
        ephemeral: true,
      });
    }

    // Retirer l'objet de l'inventaire
    player.inventory[itemId]--;
    if (player.inventory[itemId] <= 0) {
      delete player.inventory[itemId];
    }

    updatePlayer(userId, player);

    const embed = createEmbed("success", `✨ ${item.name} utilisé !`)
      .setDescription(result.message)
      .addFields(
        {
          name: "❤️ Vie",
          value: `${player.health}/${player.maxHealth}`,
          inline: true,
        },
        {
          name: "🔮 Mana",
          value: `${player.mana}/${player.maxMana}`,
          inline: true,
        },
      );

    await interaction.reply({ embeds: [embed] });
  },

  async showItemInfo(interaction) {
    const itemId = interaction.options.getString("id").toLowerCase();

    // Supporter fallback depuis la boutique
    let item = itemsData.items[itemId];
    if (!item) {
      item = ALL_SHOP_ITEMS.find((i) => i.id === itemId) || null;
    }

    if (!item) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Objet introuvable. Vérifiez l'ID de l'objet avec `/items`.",
          ),
        ],
        ephemeral: true,
      });
    }
    const rarity = this.getRarityEmoji(item.rarity);

    const embed = createEmbed("info", `${rarity} ${item.name}`)
      .setDescription(item.description)
      .addFields(
        {
          name: "🏷️ Type",
          value: this.getTypeDisplay(item.type),
          inline: true,
        },
        { name: "💎 Rareté", value: item.rarity, inline: true },
        { name: "💰 Valeur", value: `${item.value} or`, inline: true },
      );

    // Ajouter les statistiques si l'objet en a
    if (item.stats) {
      const stats = Object.entries(item.stats)
        .map(([stat, value]) => `${this.getStatDisplay(stat)}: +${value}`)
        .join("\n");
      embed.addFields({ name: "📊 Statistiques", value: stats, inline: false });
    }

    // Ajouter l'effet si l'objet en a un
    if (item.effect) {
      embed.addFields({
        name: "✨ Effet",
        value: this.getEffectDisplay(item.effect),
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },

  async giveItem(interaction) {
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser("joueur");
    const itemId = interaction.options.getString("id").toLowerCase();
    const quantity = interaction.options.getInteger("quantite") || 1;

    const player = getPlayer(userId);
    const targetPlayer = getPlayer(targetUser.id);

    if (!player) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez d'abord créer un personnage avec `/personnage creer`.",
          ),
        ],
        ephemeral: true,
      });
    }

    if (!targetPlayer) {
      return await interaction.reply({
        embeds: [
          createEmbed("error", "Le joueur cible n'a pas de personnage."),
        ],
        ephemeral: true,
      });
    }

    if (targetUser.id === userId) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous ne pouvez pas vous donner des objets à vous-même.",
          ),
        ],
        ephemeral: true,
      });
    }

    // Fallback si l'item n'est pas dans items.json
    let item = itemsData.items[itemId];
    if (!item) {
      item = ALL_SHOP_ITEMS.find((i) => i.id === itemId) || null;
    }

    if (!item) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Objet introuvable. Vérifiez l'ID de l'objet avec `/items`.",
          ),
        ],
        ephemeral: true,
      });
    }

    if (!player.inventory[itemId] || player.inventory[itemId] < quantity) {
      return await interaction.reply({
        embeds: [
          createEmbed("error", `Vous n'avez pas assez de ${item.name}.`),
        ],
        ephemeral: true,
      });
    }

    // Effectuer le transfert
    player.inventory[itemId] -= quantity;
    if (player.inventory[itemId] <= 0) {
      delete player.inventory[itemId];
    }

    if (!targetPlayer.inventory[itemId]) {
      targetPlayer.inventory[itemId] = 0;
    }
    targetPlayer.inventory[itemId] += quantity;

    updatePlayer(userId, player);
    updatePlayer(targetUser.id, targetPlayer);

    const embed = createEmbed(
      "success",
      "🎁 Objet donné avec succès !",
    ).addFields(
      { name: "Donneur", value: player.name, inline: true },
      { name: "Receveur", value: targetPlayer.name, inline: true },
      { name: "Objet", value: `${item.name} x${quantity}`, inline: true },
    );

    await interaction.reply({ embeds: [embed] });
  },

  findItemByName(itemName) {
    const name = itemName.toLowerCase();
    for (const [itemId, item] of Object.entries(itemsData.items)) {
      if (item.name.toLowerCase().includes(name)) {
        return itemId;
      }
    }
    // Fallback: search in ALL_SHOP_ITEMS
    const shopItem = ALL_SHOP_ITEMS.find((i) =>
      i.name.toLowerCase().includes(name),
    );
    if (shopItem) return shopItem.id;
    return null;
  },

  applyItemEffect(player, item) {
    if (!item.effect) {
      return { success: false, message: "Cet objet n'a pas d'effet." };
    }

    switch (item.effect.type) {
      case "heal":
        const healAmount = Math.min(
          item.effect.amount,
          player.maxHealth - player.health,
        );
        player.health += healAmount;
        return {
          success: true,
          message: `Vous récupérez ${healAmount} points de vie.`,
        };

      case "mana":
        const manaAmount = Math.min(
          item.effect.amount,
          player.maxMana - player.mana,
        );
        player.mana += manaAmount;
        return {
          success: true,
          message: `Vous récupérez ${manaAmount} points de mana.`,
        };

      case "stat_boost":
        if (item.effect.stat === "maxHealth") {
          player.maxHealth += item.effect.amount;
          player.health += item.effect.amount;
        } else if (item.effect.stat === "maxMana") {
          player.maxMana += item.effect.amount;
          player.mana += item.effect.amount;
        }
        return {
          success: true,
          message: `Votre ${item.effect.stat} augmente de ${item.effect.amount} !`,
        };

      default:
        return { success: false, message: "Effet inconnu." };
    }
  },

  getRarityEmoji(rarity) {
    const rarities = {
      common: "⚪",
      uncommon: "🟢",
      rare: "🔵",
      epic: "🟣",
      legendary: "🟡",
    };
    return rarities[rarity] || "⚪";
  },

  getTypeDisplay(type) {
    const types = {
      weapon: "⚔️ Arme",
      consumable: "🧪 Consommable",
      instrument: "🎵 Instrument",
      misc: "📦 Divers",
    };
    return types[type] || type;
  },

  getStatDisplay(stat) {
    const stats = {
      attack: "⚔️ Attaque",
      magicAttack: "🔮 Attaque magique",
      defense: "🛡️ Défense",
      magicDefense: "✨ Défense magique",
      charisma: "🎭 Charisme",
      manaRegen: "💙 Régén. mana",
      poisonChance: "☠️ Chance poison",
    };
    return stats[stat] || stat;
  },

  getEffectDisplay(effect) {
    switch (effect.type) {
      case "heal":
        return `Restaure ${effect.amount} PV`;
      case "mana":
        return `Restaure ${effect.amount} PM`;
      case "stat_boost":
        return `Augmente ${effect.stat} de ${effect.amount}`;
      default:
        return "Effet spécial";
    }
  },
};
