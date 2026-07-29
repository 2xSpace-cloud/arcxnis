const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const { getPlayer, updatePlayer } = require("../utils/database");
const { createEmbed } = require("../utils/embeds");
const fs = require("fs");
const path = require("path");

// Charger les données de la boutique
const goldShopPath = path.join(__dirname, "..", "database", "goldShop.json");
const itemsPath = path.join(__dirname, "..", "database", "items.json");
const familiarsPath = path.join(__dirname, "..", "database", "familiars.json");
const enchantmentsPath = path.join(
  __dirname,
  "..",
  "database",
  "enchantments.json"
);

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

function getRarityColor(rarity) {
  const colors = {
    common: "#95a5a6",
    uncommon: "#2ecc71",
    rare: "#3498db",
    epic: "#9b59b6",
    legendary: "#f39c12",
  };
  return colors[rarity] || "#95a5a6";
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("boutique-or")
    .setDescription("Boutique où vous pouvez acheter des items avec de l'or")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("voir")
        .setDescription("Voir les items disponibles")
        .addStringOption((option) =>
          option
            .setName("categorie")
            .setDescription("Catégorie à afficher")
            .setRequired(false)
            .addChoices(
              { name: "🧪 Consommables", value: "consumables" },
              { name: "⚔️ Équipements", value: "equipment" },
              { name: "🐾 Familiers", value: "familiars" },
              { name: "📦 Coffres d'Enchantement", value: "chests" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("acheter")
        .setDescription("Acheter un item")
        .addStringOption((option) =>
          option
            .setName("item")
            .setDescription("ID de l'item à acheter")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("quantite")
            .setDescription("Quantité à acheter (pour les consommables)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(99)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "voir") {
      await this.showShop(interaction);
    } else if (subcommand === "acheter") {
      await this.buyItem(interaction);
    }
  },

  async showShop(interaction) {
    const category = interaction.options.getString("categorie");
    const goldShop = loadJSON(goldShopPath);
    const familiarsData = loadJSON(familiarsPath);

    if (!goldShop) {
      return interaction.reply({
        embeds: [
          createEmbed("error", "Erreur lors du chargement de la boutique."),
        ],
        ephemeral: true,
      });
    }

    const player = getPlayer(interaction.user.id);
    if (!player) {
      return interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez d'abord créer un personnage avec `/personnage creer`."
          ),
        ],
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("🏪 Boutique d'Or du Royaume")
      .setColor("#FFD700")
      .setFooter({ text: `Votre or: ${player.gold} 💰` });

    if (!category) {
      embed.setDescription(
        "**Bienvenue dans la boutique d'or !**\n\n" +
          "Utilisez `/boutique-or voir categorie:<catégorie>` pour voir les items disponibles.\n\n" +
          "**Catégories disponibles:**\n" +
          "🧪 **Consommables** - Potions et items à usage unique\n" +
          "⚔️ **Équipements** - Armes, armures et boucliers\n" +
          "🐾 **Familiers** - Compagnons qui vous aident\n" +
          "📦 **Coffres d'Enchantement** - Obtenez des enchantements aléatoires\n\n" +
          "**Pour acheter:** `/boutique-or acheter item:<id>`"
      );
      return interaction.reply({ embeds: [embed] });
    }

    // Afficher la catégorie sélectionnée
    if (category === "consumables") {
      embed.setDescription("**🧪 Consommables disponibles**\n\n");
      for (const [id, item] of Object.entries(goldShop.consumables)) {
        embed.addFields({
          name: `${item.emoji} ${item.name} - ${item.price} 💰`,
          value: `ID: \`${id}\`\n${item.description}`,
          inline: true,
        });
      }
    } else if (category === "equipment") {
      embed.setDescription("**⚔️ Équipements disponibles**\n\n");
      for (const [id, item] of Object.entries(goldShop.equipment)) {
        const statsText = Object.entries(item.stats)
          .map(([stat, value]) => `${stat}: ${value > 0 ? "+" : ""}${value}`)
          .join(", ");
        embed.addFields({
          name: `${getRarityEmoji(item.rarity)} ${item.emoji} ${item.name} - ${
            item.price
          } 💰`,
          value: `ID: \`${id}\`\n${item.description}\n**Stats:** ${statsText}`,
          inline: true,
        });
      }
    } else if (category === "familiars") {
      embed.setDescription("**🐾 Familiers disponibles**\n\n");
      if (familiarsData && familiarsData.familiars) {
        for (const [id, familiar] of Object.entries(familiarsData.familiars)) {
          let bonusText = "";
          if (familiar.bonuses.stats) {
            bonusText +=
              "Stats: " +
              Object.entries(familiar.bonuses.stats)
                .map(([stat, value]) => `${stat} +${value}`)
                .join(", ") +
              "\n";
          }
          if (familiar.bonuses.economic) {
            bonusText +=
              "Bonus: " +
              Object.entries(familiar.bonuses.economic)
                .map(
                  ([bonus, value]) => `${bonus} +${Math.round(value * 100)}%`
                )
                .join(", ") +
              "\n";
          }
          if (familiar.bonuses.combat) {
            bonusText += `Combat: ${familiar.bonuses.combat.type}`;
          }

          embed.addFields({
            name: `${getRarityEmoji(familiar.rarity)} ${familiar.emoji} ${
              familiar.name
            } - ${familiar.price} 💰`,
            value: `ID: \`${id}\`\n${familiar.description}\n${bonusText}`,
            inline: true,
          });
        }
      }
    } else if (category === "chests") {
      embed.setDescription("**📦 Coffres d'Enchantement disponibles**\n\n");
      for (const [id, chest] of Object.entries(goldShop.magicChests)) {
        const lootText = Object.entries(chest.lootTable)
          .map(
            ([rarity, chance]) =>
              `${getRarityEmoji(rarity)} ${rarity}: ${Math.round(
                chance * 100
              )}%`
          )
          .join("\n");
        embed.addFields({
          name: `${chest.emoji} ${chest.name} - ${chest.price} 💰`,
          value: `ID: \`${id}\`\n${chest.description}\n**Chances:**\n${lootText}`,
          inline: true,
        });
      }
    }

    await interaction.reply({ embeds: [embed] });
  },

  async buyItem(interaction) {
    const itemId = interaction.options.getString("item");
    const quantity = interaction.options.getInteger("quantite") || 1;
    const player = getPlayer(interaction.user.id);

    if (!player) {
      return interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez d'abord créer un personnage avec `/personnage creer`."
          ),
        ],
        ephemeral: true,
      });
    }

    const goldShop = loadJSON(goldShopPath);
    const itemsData = loadJSON(itemsPath);
    const familiarsData = loadJSON(familiarsPath);
    const enchantmentsData = loadJSON(enchantmentsPath);

    // Chercher l'item dans toutes les catégories
    let item = null;
    let itemType = null;
    let price = 0;

    // Vérifier dans les consommables
    if (goldShop.consumables[itemId]) {
      item = goldShop.consumables[itemId];
      itemType = "consumable";
      price = item.price * quantity;
    }
    // Vérifier dans les équipements
    else if (goldShop.equipment[itemId]) {
      item = goldShop.equipment[itemId];
      itemType = "equipment";
      price = item.price;
      if (quantity > 1) {
        return interaction.reply({
          embeds: [
            createEmbed(
              "error",
              "Vous ne pouvez acheter qu'un seul équipement à la fois."
            ),
          ],
          ephemeral: true,
        });
      }
    }
    // Vérifier dans les familiers
    else if (familiarsData && familiarsData.familiars[itemId]) {
      item = familiarsData.familiars[itemId];
      itemType = "familiar";
      price = item.price;
      if (quantity > 1) {
        return interaction.reply({
          embeds: [
            createEmbed(
              "error",
              "Vous ne pouvez acheter qu'un seul familier à la fois."
            ),
          ],
          ephemeral: true,
        });
      }
    }
    // Vérifier dans les coffres magiques
    else if (goldShop.magicChests[itemId]) {
      item = goldShop.magicChests[itemId];
      itemType = "magicChest";
      price = item.price * quantity;
    }

    if (!item) {
      return interaction.reply({
        embeds: [
          createEmbed("error", "Item introuvable. Vérifiez l'ID de l'item."),
        ],
        ephemeral: true,
      });
    }

    // Vérifier si le joueur a assez d'or
    if (player.gold < price) {
      return interaction.reply({
        embeds: [
          createEmbed(
            "error",
            `Vous n'avez pas assez d'or. Prix: ${price} 💰, Vous avez: ${player.gold} 💰`
          ),
        ],
        ephemeral: true,
      });
    }

    // Traiter l'achat selon le type
    if (itemType === "consumable") {
      // Ajouter à l'inventaire
      if (!player.inventory) player.inventory = {};
      if (!player.inventory[itemId]) player.inventory[itemId] = 0;
      player.inventory[itemId] += quantity;
      player.gold -= price;
      updatePlayer(interaction.user.id, player);

      return interaction.reply({
        embeds: [
          createEmbed(
            "success",
            `✅ Achat réussi !`,
            `Vous avez acheté **${quantity}x ${item.emoji} ${item.name}** pour **${price} 💰**\n\n` +
              `Or restant: **${player.gold} 💰**`
          ),
        ],
      });
    } else if (itemType === "equipment") {
      // Ajouter l'équipement à l'inventaire
      if (!player.inventory) player.inventory = {};
      if (!player.inventory[itemId]) player.inventory[itemId] = 0;
      player.inventory[itemId]++;
      player.gold -= price;
      updatePlayer(interaction.user.id, player);

      return interaction.reply({
        embeds: [
          createEmbed(
            "success",
            `✅ Achat réussi !`,
            `Vous avez acheté **${getRarityEmoji(item.rarity)} ${item.emoji} ${
              item.name
            }** pour **${price} 💰**\n\n` + `Or restant: **${player.gold} 💰**`
          ),
        ],
      });
    } else if (itemType === "familiar") {
      // Vérifier si le joueur a déjà ce familier
      if (!player.familiars) player.familiars = [];
      if (player.familiars.includes(itemId)) {
        return interaction.reply({
          embeds: [createEmbed("error", "Vous possédez déjà ce familier !")],
          ephemeral: true,
        });
      }

      player.familiars.push(itemId);
      player.gold -= price;
      updatePlayer(interaction.user.id, player);

      return interaction.reply({
        embeds: [
          createEmbed(
            "success",
            `✅ Familier obtenu !`,
            `Vous avez acheté **${getRarityEmoji(item.rarity)} ${item.emoji} ${
              item.name
            }** pour **${price} 💰**\n\n` +
              `${item.description}\n\n` +
              `Utilisez \`/familier equiper\` pour l'équiper !\n\n` +
              `Or restant: **${player.gold} 💰**`
          ),
        ],
      });
    } else if (itemType === "magicChest") {
      // Ouvrir le coffre et donner un enchantement aléatoire
      const results = [];
      for (let i = 0; i < quantity; i++) {
        const enchantment = this.getRandomEnchantment(
          item.lootTable,
          enchantmentsData
        );
        if (enchantment) {
          if (!player.enchantments) player.enchantments = [];
          player.enchantments.push(enchantment.id);
          results.push(
            `${enchantment.emoji} **${enchantment.name}** (${getRarityEmoji(
              enchantment.rarity
            )} ${enchantment.rarity})`
          );
        }
      }

      player.gold -= price;
      updatePlayer(interaction.user.id, player);

      const embed = createEmbed(
        "success",
        `✨ Coffre(s) ouvert(s) !`,
        `Vous avez ouvert **${quantity}x ${item.emoji} ${item.name}** pour **${price} 💰**\n\n` +
          `**Enchantements obtenus:**\n${results.join("\n")}\n\n` +
          `Utilisez \`/forge enchanter\` pour appliquer ces enchantements à vos items !\n\n` +
          `Or restant: **${player.gold} 💰**`
      );

      return interaction.reply({ embeds: [embed] });
    }
  },

  getRandomEnchantment(lootTable, enchantmentsData) {
    if (!enchantmentsData || !enchantmentsData.enchantments) return null;

    // Déterminer la rareté
    const rand = Math.random();
    let cumulativeChance = 0;
    let selectedRarity = null;

    for (const [rarity, chance] of Object.entries(lootTable)) {
      cumulativeChance += chance;
      if (rand <= cumulativeChance) {
        selectedRarity = rarity;
        break;
      }
    }

    // Filtrer les enchantements par rareté
    const availableEnchantments = Object.entries(enchantmentsData.enchantments)
      .filter(([id, ench]) => ench.rarity === selectedRarity)
      .map(([id, ench]) => ({ id, ...ench }));

    if (availableEnchantments.length === 0) return null;

    // Sélectionner un enchantement aléatoire
    const selected =
      availableEnchantments[
        Math.floor(Math.random() * availableEnchantments.length)
      ];
    return selected;
  },
};
