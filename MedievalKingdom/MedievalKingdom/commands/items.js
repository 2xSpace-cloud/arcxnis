const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { ALL_SHOP_ITEMS, getRarityEmoji } = require("../utils/dailyShop");
const { createEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("items")
    .setDescription("Affiche la liste de tous les items disponibles")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Filtrer par type d'item")
        .setRequired(false)
        .addChoices(
          { name: "🧪 Objets", value: "objet" },
          { name: "⚔️ Armes", value: "arme" },
          { name: "🛡️ Armures", value: "armure" },
          { name: "🏆 Titres", value: "titre" },
          { name: "🐺 Familiers", value: "familier" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("rarity")
        .setDescription("Filtrer par rareté")
        .setRequired(false)
        .addChoices(
          { name: "⚪ Commun", value: "common" },
          { name: "🟢 Peu commun", value: "uncommon" },
          { name: "🔵 Rare", value: "rare" },
          { name: "🟡 Légendaire", value: "legendary" },
          { name: "🔴 Mythique", value: "mythic" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("recherche")
        .setDescription("Rechercher un item par nom")
        .setRequired(false)
    ),

  async execute(interaction) {
    const typeFilter = interaction.options.getString("type");
    const rarityFilter = interaction.options.getString("rarity");
    const searchQuery = interaction.options.getString("recherche");

    let filteredItems = ALL_SHOP_ITEMS;

    // Appliquer les filtres
    if (typeFilter) {
      filteredItems = filteredItems.filter((item) => item.type === typeFilter);
    }

    if (rarityFilter) {
      filteredItems = filteredItems.filter(
        (item) => item.rarity === rarityFilter
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredItems = filteredItems.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.id.toLowerCase().includes(query)
      );
    }

    if (filteredItems.length === 0) {
      return interaction.reply({
        content: "❌ Aucun item trouvé avec ces critères.",
        ephemeral: true,
      });
    }

    // Grouper les items par type
    const itemsByType = {};
    filteredItems.forEach((item) => {
      if (!itemsByType[item.type]) {
        itemsByType[item.type] = [];
      }
      itemsByType[item.type].push(item);
    });

    const typeEmojis = {
      objet: "🧪",
      arme: "⚔️",
      armure: "🛡️",
      titre: "🏆",
      familier: "🐺",
    };

    const typeNames = {
      objet: "Objets",
      arme: "Armes",
      armure: "Armures",
      titre: "Titres",
      familier: "Familiers",
    };

    // Créer les pages d'embed
    const pages = [];
    let currentPage = createEmbed("info", "📋 Liste des items disponibles");
    let currentFieldCount = 0;
    let currentCharCount = 0;

    // Description de base
    const baseDescription =
      `**Total:** ${filteredItems.length} items\n` +
      (typeFilter
        ? `**Filtre type:** ${typeEmojis[typeFilter]} ${typeNames[typeFilter]}\n`
        : "") +
      (rarityFilter
        ? `**Filtre rareté:** ${getRarityEmoji(rarityFilter)} ${rarityFilter}\n`
        : "") +
      (searchQuery ? `**Recherche:** "${searchQuery}"\n` : "") +
      "\n*Utilisez ces IDs avec `/admin give` pour donner des items aux joueurs.*";

    currentPage.setDescription(baseDescription);
    currentCharCount += baseDescription.length;

    // Ajouter les statistiques en premier
    const rarityStats = {};
    filteredItems.forEach((item) => {
      rarityStats[item.rarity] = (rarityStats[item.rarity] || 0) + 1;
    });

    const statsText = Object.entries(rarityStats)
      .map(([rarity, count]) => `${getRarityEmoji(rarity)} ${count}`)
      .join(" • ");

    currentPage.addFields({
      name: "📊 Répartition par rareté",
      value: statsText,
      inline: false,
    });
    currentFieldCount++;
    currentCharCount += statsText.length + 30;

    // Ajouter les items par type
    for (const [type, items] of Object.entries(itemsByType)) {
      // Trier par prix
      items.sort((a, b) => a.price - b.price);

      // Créer des chunks pour ce type
      const chunks = [];
      let currentChunk = "";

      for (const item of items) {
        const itemText = `${getRarityEmoji(item.rarity)} **${item.name}** (${
          item.price
        }💎)\n└ \`${item.id}\` - ${item.description}\n\n`;

        // Si ajouter cet item dépasse 1000 caractères, créer un nouveau chunk
        if (currentChunk.length + itemText.length > 950) {
          chunks.push(currentChunk);
          currentChunk = itemText;
        } else {
          currentChunk += itemText;
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      // Ajouter les chunks comme champs
      for (let i = 0; i < chunks.length; i++) {
        const fieldName = `${typeEmojis[type]} ${typeNames[type]}${
          chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : ""
        }`;
        const fieldValue = chunks[i];

        // Vérifier si on doit créer une nouvelle page
        // Limites Discord: 25 champs max, 6000 caractères total
        if (
          currentFieldCount >= 24 ||
          currentCharCount + fieldValue.length + fieldName.length > 5500
        ) {
          // Ajouter footer et sauvegarder la page actuelle
          currentPage.setFooter({
            text: `Page ${
              pages.length + 1
            } • Utilisez les boutons pour naviguer`,
          });
          pages.push(currentPage);

          // Créer une nouvelle page
          currentPage = createEmbed("info", "📋 Liste des items disponibles");
          currentPage.setDescription(baseDescription);
          currentFieldCount = 0;
          currentCharCount = baseDescription.length;
        }

        currentPage.addFields({
          name: fieldName,
          value: fieldValue,
          inline: false,
        });
        currentFieldCount++;
        currentCharCount += fieldValue.length + fieldName.length;
      }
    }

    // Ajouter la dernière page
    if (currentFieldCount > 0) {
      currentPage.setFooter({
        text:
          pages.length > 0
            ? `Page ${pages.length + 1}/${
                pages.length + 1
              } • Utilisez les boutons pour naviguer`
            : "💡 Astuce: Utilisez les filtres pour affiner votre recherche",
      });
      pages.push(currentPage);
    }

    // Si une seule page, envoyer directement
    if (pages.length === 1) {
      return interaction.reply({ embeds: [pages[0]] });
    }

    // Sinon, créer un système de pagination
    let currentPageIndex = 0;

    const getButtons = (index) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("items_first")
          .setLabel("⏮️ Début")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(index === 0),
        new ButtonBuilder()
          .setCustomId("items_prev")
          .setLabel("◀️ Précédent")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(index === 0),
        new ButtonBuilder()
          .setCustomId("items_page")
          .setLabel(`${index + 1}/${pages.length}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("items_next")
          .setLabel("Suivant ▶️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(index === pages.length - 1),
        new ButtonBuilder()
          .setCustomId("items_last")
          .setLabel("Fin ⏭️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(index === pages.length - 1)
      );
    };

    // Mettre à jour le footer de chaque page
    pages.forEach((page, index) => {
      page.setFooter({
        text: `Page ${index + 1}/${
          pages.length
        } • Utilisez les boutons pour naviguer`,
      });
    });

    const message = await interaction.reply({
      embeds: [pages[currentPageIndex]],
      components: [getButtons(currentPageIndex)],
      fetchReply: true,
    });

    // Créer le collecteur de boutons
    const collector = message.createMessageComponentCollector({
      time: 300000, // 5 minutes
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: "❌ Ces boutons ne sont pas pour vous !",
          ephemeral: true,
        });
      }

      switch (i.customId) {
        case "items_first":
          currentPageIndex = 0;
          break;
        case "items_prev":
          currentPageIndex = Math.max(0, currentPageIndex - 1);
          break;
        case "items_next":
          currentPageIndex = Math.min(pages.length - 1, currentPageIndex + 1);
          break;
        case "items_last":
          currentPageIndex = pages.length - 1;
          break;
      }

      await i.update({
        embeds: [pages[currentPageIndex]],
        components: [getButtons(currentPageIndex)],
      });
    });

    collector.on("end", () => {
      // Désactiver tous les boutons après expiration
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("items_first")
          .setLabel("⏮️ Début")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("items_prev")
          .setLabel("◀️ Précédent")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("items_page")
          .setLabel(`${currentPageIndex + 1}/${pages.length}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("items_next")
          .setLabel("Suivant ▶️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("items_last")
          .setLabel("Fin ⏭️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true)
      );

      message
        .edit({
          embeds: [pages[currentPageIndex]],
          components: [disabledRow],
        })
        .catch(() => {});
    });
  },
};
