const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getPlayer, updatePlayer } = require("../utils/database.js");
const { createEmbed } = require("../utils/embeds.js");

// Items du marché noir (uniquement pour les voleurs)
const blackMarketItems = {
  dague_empoisonnee: {
    name: "Dague Empoisonnée",
    description:
      "Une dague enduite d'un poison mortel. +15 attaque, 20% chance d'empoisonner.",
    price: 250,
    type: "arme",
    rarity: "rare",
    stats: { attack: 15 },
    emoji: "🗡️",
  },
  cape_ombre: {
    name: "Cape des Ombres",
    description:
      "Une cape qui vous rend presque invisible. +10 vitesse, +5 esquive.",
    price: 300,
    type: "armure",
    rarity: "rare",
    stats: { speed: 10, defense: 5 },
    emoji: "🧥",
  },
  crochet_maitre: {
    name: "Crochet de Maître Voleur",
    description:
      "Permet de crocheter n'importe quelle serrure. +20% d'or des quêtes.",
    price: 180,
    type: "objet",
    rarity: "rare",
    emoji: "🔓",
  },
  poison_paralysant: {
    name: "Fiole de Poison Paralysant",
    description: "Paralyse l'ennemi pendant 1 tour en combat.",
    price: 120,
    type: "consommable",
    rarity: "commun",
    emoji: "🧪",
  },
  masque_voleur: {
    name: "Masque du Voleur Fantôme",
    description: "Cache votre identité. +8 défense, +12 vitesse.",
    price: 220,
    type: "armure",
    rarity: "rare",
    stats: { defense: 8, speed: 12 },
    emoji: "🎭",
  },
  gants_pickpocket: {
    name: "Gants de Pickpocket",
    description: "Augmente vos chances de voler de l'or. +15% d'or en combat.",
    price: 150,
    type: "objet",
    rarity: "commun",
    emoji: "🧤",
  },
  arc_silencieux: {
    name: "Arc Silencieux",
    description: "Un arc qui ne fait aucun bruit. +18 attaque, +5 vitesse.",
    price: 350,
    type: "arme",
    rarity: "épique",
    stats: { attack: 18, speed: 5 },
    emoji: "🏹",
  },
  parchemin_teleportation: {
    name: "Parchemin de Téléportation",
    description: "Permet de fuir instantanément un combat.",
    price: 200,
    type: "consommable",
    rarity: "rare",
    emoji: "📜",
  },
  armure_cuir_renforce: {
    name: "Armure de Cuir Renforcé",
    description: "Légère mais résistante. +12 défense, +8 vitesse.",
    price: 280,
    type: "armure",
    rarity: "rare",
    stats: { defense: 12, speed: 8 },
    emoji: "🦺",
  },
  carte_reseau: {
    name: "Carte du Réseau Souterrain",
    description: "Révèle des passages secrets. Accès à des quêtes spéciales.",
    price: 400,
    type: "objet",
    rarity: "épique",
    emoji: "🗺️",
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("marchenoir")
    .setDescription("Accéder au marché noir (réservé aux voleurs)")
    .addStringOption((option) =>
      option
        .setName("item")
        .setDescription("ID de l'item à acheter")
        .setRequired(false)
    ),

  async execute(interaction) {
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

    // Vérifier que le joueur est un voleur
    if (player.class !== "voleur") {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "🚫 Accès refusé",
            "Le marché noir est réservé aux membres de la classe **Voleur**. Seuls les maîtres de la discrétion peuvent y accéder."
          ),
        ],
        ephemeral: true,
      });
    }

    const itemId = interaction.options.getString("item");

    // Si aucun item spécifié, afficher le catalogue
    if (!itemId) {
      return await this.showBlackMarket(interaction, player);
    }

    // Acheter un item
    return await this.buyItem(interaction, player, itemId);
  },

  async showBlackMarket(interaction, player) {
    const embed = new EmbedBuilder()
      .setTitle("🌙 Marché Noir")
      .setDescription(
        "**Bienvenue dans les ombres, voleur...**\n\n" +
          "Ici, vous trouverez des objets que les marchands ordinaires n'oseraient jamais vendre.\n" +
          "Utilisez `/marchenoir item:<id>` pour acheter.\n\n" +
          "**Articles disponibles :**"
      )
      .setColor("#1a1a1a");

    // Grouper les items par rareté
    const itemsByRarity = {
      épique: [],
      rare: [],
      commun: [],
    };

    Object.entries(blackMarketItems).forEach(([id, item]) => {
      itemsByRarity[item.rarity].push({ id, ...item });
    });

    // Ajouter les items épiques
    if (itemsByRarity.épique.length > 0) {
      const epicItems = itemsByRarity.épique
        .map(
          (item) =>
            `${item.emoji} **${item.name}** — ${item.price} 💰\nID: \`${item.id}\` • ${item.description}`
        )
        .join("\n\n");
      embed.addFields({
        name: "✨ Items Épiques",
        value: epicItems,
        inline: false,
      });
    }

    // Ajouter les items rares
    if (itemsByRarity.rare.length > 0) {
      const rareItems = itemsByRarity.rare
        .map(
          (item) =>
            `${item.emoji} **${item.name}** — ${item.price} 💰\nID: \`${item.id}\` • ${item.description}`
        )
        .join("\n\n");
      embed.addFields({
        name: "💎 Items Rares",
        value: rareItems,
        inline: false,
      });
    }

    // Ajouter les items communs
    if (itemsByRarity.commun.length > 0) {
      const commonItems = itemsByRarity.commun
        .map(
          (item) =>
            `${item.emoji} **${item.name}** — ${item.price} 💰\nID: \`${item.id}\` • ${item.description}`
        )
        .join("\n\n");
      embed.addFields({
        name: "⚪ Items Communs",
        value: commonItems,
        inline: false,
      });
    }

    embed.setFooter({
      text: `Votre or : ${player.gold} 💰 | "Les affaires se font dans l'ombre..."`,
    });

    await interaction.reply({ embeds: [embed] });
  },

  async buyItem(interaction, player, itemId) {
    const item = blackMarketItems[itemId];

    if (!item) {
      return await interaction.reply({
        embeds: [
          createEmbed("error", "Cet item n'existe pas sur le marché noir."),
        ],
        ephemeral: true,
      });
    }

    if (player.gold < item.price) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            `Vous n'avez pas assez d'or. Il vous faut ${item.price} 💰 (vous avez ${player.gold} 💰).`
          ),
        ],
        ephemeral: true,
      });
    }

    // Déduire l'or
    player.gold -= item.price;

    // Ajouter l'item à l'inventaire (format Object avec compteurs)
    if (!player.inventory || Array.isArray(player.inventory)) {
      // Convertir l'ancien format Array en Object si nécessaire
      const oldInventory = player.inventory || [];
      player.inventory = {};
      if (Array.isArray(oldInventory)) {
        oldInventory.forEach((id) => {
          player.inventory[id] = (player.inventory[id] || 0) + 1;
        });
      }
    }

    // Ajouter l'item
    if (!player.inventory[itemId]) {
      player.inventory[itemId] = 0;
    }
    player.inventory[itemId]++;

    // Note: Les stats ne sont plus appliquées automatiquement
    // Elles seront appliquées via le système d'équipement (/equiper)
    // Cela évite les problèmes de stats permanentes

    updatePlayer(interaction.user.id, player);

    const embed = createEmbed("success", "🌙 Achat réussi !")
      .setDescription(
        `Vous avez acheté **${item.emoji} ${item.name}** pour ${item.price} 💰\n\n` +
          `L'item a été ajouté à votre inventaire.`
      )
      .addFields(
        { name: "💼 Item", value: item.description, inline: false },
        { name: "💰 Or restant", value: player.gold.toString(), inline: true }
      );

    if (item.stats) {
      const statsText = Object.entries(item.stats)
        .map(([stat, value]) => `+${value} ${stat}`)
        .join(", ");
      embed.addFields({
        name: "📊 Bonus disponibles",
        value: `${statsText}\n\n*Utilisez \`/equiper arme id:${itemId}\` ou \`/equiper armure id:${itemId}\` pour équiper cet item et bénéficier de ses bonus.*`,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
