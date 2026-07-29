const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { getPlayer, updatePlayer } = require("../utils/database");
const fs = require("fs");
const path = require("path");

// IDs des utilisateurs autorisés à créer des items uniques
const AUTHORIZED_USERS = ["1509907317515096254"];

// Fichier pour stocker les items uniques créés
const UNIQUE_ITEMS_FILE = path.join(
  __dirname,
  "..",
  "database",
  "uniqueItems.json",
);

// Charger les items uniques existants
function loadUniqueItems() {
  try {
    if (fs.existsSync(UNIQUE_ITEMS_FILE)) {
      const data = fs.readFileSync(UNIQUE_ITEMS_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Erreur lors du chargement des items uniques:", error);
  }
  return { items: [] };
}

// Sauvegarder les items uniques
function saveUniqueItems(data) {
  try {
    fs.writeFileSync(UNIQUE_ITEMS_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des items uniques:", error);
    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("createitem")
    .setDescription("Créer et gérer des items uniques (réservé aux créateurs)")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("new")
        .setDescription("Créer un nouvel item unique")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID unique de l'item (ex: epee_divine)")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("nom")
            .setDescription("Nom de l'item")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Type d'item")
            .setRequired(true)
            .addChoices(
              { name: "⚔️ Arme", value: "arme" },
              { name: "🛡️ Armure", value: "armure" },
              { name: "📦 Objet", value: "objet" },
              { name: "🏆 Titre", value: "titre" },
              { name: "🐺 Familier", value: "familier" },
              { name: "✨ Accessoire", value: "accessoire" },
              { name: "🎭 Cosmétique", value: "cosmetique" },
            ),
        )
        .addStringOption((option) =>
          option
            .setName("rarete")
            .setDescription("Rareté de l'item")
            .setRequired(true)
            .addChoices(
              { name: "⚪ Commun", value: "common" },
              { name: "🟢 Peu commun", value: "uncommon" },
              { name: "🔵 Rare", value: "rare" },
              { name: "🟣 Épique", value: "epic" },
              { name: "🟠 Légendaire", value: "legendary" },
              { name: "🔴 Mythique", value: "mythic" },
              { name: "⭐ Unique", value: "unique" },
            ),
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("Description de l'item")
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName("attaque")
            .setDescription("Bonus d'attaque (optionnel)")
            .setRequired(false),
        )
        .addIntegerOption((option) =>
          option
            .setName("defense")
            .setDescription("Bonus de défense (optionnel)")
            .setRequired(false),
        )
        .addIntegerOption((option) =>
          option
            .setName("pv")
            .setDescription("Bonus de PV max (optionnel)")
            .setRequired(false),
        )
        .addIntegerOption((option) =>
          option
            .setName("vitesse")
            .setDescription("Bonus de vitesse (optionnel)")
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("give")
        .setDescription("Donner un item unique à un ou plusieurs joueurs")
        .addStringOption((option) =>
          option
            .setName("item_id")
            .setDescription("ID de l'item unique à donner")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addUserOption((option) =>
          option
            .setName("joueur1")
            .setDescription("Premier joueur")
            .setRequired(true),
        )
        .addUserOption((option) =>
          option
            .setName("joueur2")
            .setDescription("Deuxième joueur (optionnel)")
            .setRequired(false),
        )
        .addUserOption((option) =>
          option
            .setName("joueur3")
            .setDescription("Troisième joueur (optionnel)")
            .setRequired(false),
        )
        .addUserOption((option) =>
          option
            .setName("joueur4")
            .setDescription("Quatrième joueur (optionnel)")
            .setRequired(false),
        )
        .addUserOption((option) =>
          option
            .setName("joueur5")
            .setDescription("Cinquième joueur (optionnel)")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription("Message personnalisé à envoyer avec l'item")
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("Voir la liste de tous les items uniques créés"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription("Voir les détails d'un item unique")
        .addStringOption((option) =>
          option
            .setName("item_id")
            .setDescription("ID de l'item unique")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Supprimer un item unique")
        .addStringOption((option) =>
          option
            .setName("item_id")
            .setDescription("ID de l'item unique à supprimer")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("edit")
        .setDescription("Modifier un item unique existant")
        .addStringOption((option) =>
          option
            .setName("item_id")
            .setDescription("ID de l'item unique à modifier")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((option) =>
          option
            .setName("propriete")
            .setDescription("Propriété à modifier")
            .setRequired(true)
            .addChoices(
              { name: "Nom", value: "name" },
              { name: "Description", value: "description" },
              { name: "Attaque", value: "attack" },
              { name: "Défense", value: "defense" },
              { name: "PV", value: "health" },
              { name: "Vitesse", value: "speed" },
            ),
        )
        .addStringOption((option) =>
          option
            .setName("valeur")
            .setDescription("Nouvelle valeur")
            .setRequired(true),
        ),
    ),

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === "item_id") {
      const uniqueItems = loadUniqueItems();
      const filtered = uniqueItems.items
        .filter((item) =>
          item.id.toLowerCase().includes(focusedOption.value.toLowerCase()),
        )
        .slice(0, 25);

      await interaction.respond(
        filtered.map((item) => ({
          name: `${item.name} (${item.id})`,
          value: item.id,
        })),
      );
    }
  },

  async execute(interaction) {
    // Vérifier si l'utilisateur est autorisé
    if (!AUTHORIZED_USERS.includes(interaction.user.id)) {
      return interaction.reply({
        content:
          "❌ Vous n'avez pas la permission d'utiliser cette commande. Cette commande est réservée aux créateurs du jeu.",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "new":
          await handleCreateItem(interaction);
          break;
        case "give":
          await handleGiveItem(interaction);
          break;
        case "list":
          await handleListItems(interaction);
          break;
        case "info":
          await handleItemInfo(interaction);
          break;
        case "delete":
          await handleDeleteItem(interaction);
          break;
        case "edit":
          await handleEditItem(interaction);
          break;
        default:
          await interaction.reply({
            content: "❌ Sous-commande non reconnue.",
            ephemeral: true,
          });
      }
    } catch (error) {
      console.error("Erreur dans la commande createitem:", error);
      const errorMessage =
        "❌ Une erreur s'est produite lors de l'exécution de la commande.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
  },
};

// Fonction pour créer un nouvel item unique
async function handleCreateItem(interaction) {
  const itemId = interaction.options.getString("id");
  const name = interaction.options.getString("nom");
  const type = interaction.options.getString("type");
  const rarity = interaction.options.getString("rarete");
  const description = interaction.options.getString("description");
  const attack = interaction.options.getInteger("attaque");
  const defense = interaction.options.getInteger("defense");
  const health = interaction.options.getInteger("pv");
  const speed = interaction.options.getInteger("vitesse");

  const uniqueItems = loadUniqueItems();

  // Vérifier si l'ID existe déjà
  if (uniqueItems.items.find((item) => item.id === itemId)) {
    return interaction.reply({
      content: `❌ Un item avec l'ID "${itemId}" existe déjà. Utilisez un ID différent ou modifiez l'item existant avec \`/createitem edit\`.`,
      ephemeral: true,
    });
  }

  // Créer le nouvel item
  const newItem = {
    id: itemId,
    name: name,
    type: type,
    rarity: rarity,
    description: description,
    unique: true,
    tradeable: false, // Les items uniques ne sont pas échangeables par défaut
    createdBy: interaction.user.id,
    createdAt: new Date().toISOString(),
    stats: {},
  };

  // Ajouter les stats si elles sont définies
  if (attack !== null) newItem.stats.attack = attack;
  if (defense !== null) newItem.stats.defense = defense;
  if (health !== null) newItem.stats.health = health;
  if (speed !== null) newItem.stats.speed = speed;

  uniqueItems.items.push(newItem);

  if (!saveUniqueItems(uniqueItems)) {
    return interaction.reply({
      content: "❌ Erreur lors de la sauvegarde de l'item.",
      ephemeral: true,
    });
  }

  // Créer l'embed de confirmation
  const rarityEmojis = {
    common: "⚪",
    uncommon: "🟢",
    rare: "🔵",
    epic: "🟣",
    legendary: "🟠",
    mythic: "🔴",
    unique: "⭐",
  };

  const typeEmojis = {
    arme: "⚔️",
    armure: "🛡️",
    objet: "📦",
    titre: "🏆",
    familier: "🐺",
    accessoire: "✨",
    cosmetique: "🎭",
  };

  const embed = new EmbedBuilder()
    .setTitle("✨ Item Unique Créé !")
    .setColor("#FFD700")
    .setDescription(
      `${typeEmojis[type] || "📦"} **${name}** ${rarityEmojis[rarity] || "⚪"}`,
    )
    .addFields(
      { name: "🆔 ID", value: `\`${itemId}\``, inline: true },
      { name: "📝 Type", value: type, inline: true },
      { name: "💎 Rareté", value: rarity, inline: true },
      { name: "📖 Description", value: description },
    )
    .setFooter({
      text: `Créé par ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .setTimestamp();

  // Ajouter les stats si elles existent
  if (Object.keys(newItem.stats).length > 0) {
    let statsText = "";
    if (attack) statsText += `⚔️ Attaque: +${attack}\n`;
    if (defense) statsText += `🛡️ Défense: +${defense}\n`;
    if (health) statsText += `❤️ PV Max: +${health}\n`;
    if (speed) statsText += `⚡ Vitesse: +${speed}\n`;
    embed.addFields({ name: "📊 Statistiques", value: statsText });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Fonction pour donner un item unique à des joueurs
async function handleGiveItem(interaction) {
  const itemId = interaction.options.getString("item_id");
  const customMessage = interaction.options.getString("message");

  const uniqueItems = loadUniqueItems();
  const item = uniqueItems.items.find((i) => i.id === itemId);

  if (!item) {
    return interaction.reply({
      content: `❌ Item unique avec l'ID "${itemId}" non trouvé.`,
      ephemeral: true,
    });
  }

  // Récupérer tous les joueurs mentionnés
  const players = [];
  for (let i = 1; i <= 5; i++) {
    const user = interaction.options.getUser(`joueur${i}`);
    if (user) {
      players.push(user);
    }
  }

  if (players.length === 0) {
    return interaction.reply({
      content: "❌ Aucun joueur spécifié.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const results = [];
  const typeEmojis = {
    arme: "⚔️",
    armure: "🛡️",
    objet: "📦",
    titre: "🏆",
    familier: "🐺",
    accessoire: "✨",
    cosmetique: "🎭",
  };

  for (const user of players) {
    const playerData = getPlayer(user.id);

    if (!playerData) {
      results.push(`❌ ${user.username} n'a pas de personnage créé.`);
      continue;
    }

    // Ajouter l'item à l'inventaire du joueur
    if (!playerData.inventory || typeof playerData.inventory !== "object") {
      playerData.inventory = {};
    }

    playerData.inventory[itemId] = (playerData.inventory[itemId] || 0) + 1;
    updatePlayer(user.id, playerData);

    results.push(`✅ ${user.username} a reçu **${item.name}**`);

    // Envoyer un message privé au joueur
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle("🎁 Vous avez reçu un item unique !")
        .setColor("#FFD700")
        .setDescription(
          `${typeEmojis[item.type] || "📦"} **${item.name}**\n\n${
            item.description
          }`,
        )
        .addFields(
          { name: "🆔 ID", value: `\`${item.id}\``, inline: true },
          { name: "💎 Rareté", value: item.rarity, inline: true },
        )
        .setFooter({
          text: `Offert par ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      if (Object.keys(item.stats || {}).length > 0) {
        let statsText = "";
        if (item.stats.attack)
          statsText += `⚔️ Attaque: +${item.stats.attack}\n`;
        if (item.stats.defense)
          statsText += `🛡️ Défense: +${item.stats.defense}\n`;
        if (item.stats.health)
          statsText += `❤️ PV Max: +${item.stats.health}\n`;
        if (item.stats.speed) statsText += `⚡ Vitesse: +${item.stats.speed}\n`;
        dmEmbed.addFields({ name: "📊 Statistiques", value: statsText });
      }

      if (customMessage) {
        dmEmbed.addFields({ name: "💬 Message", value: customMessage });
      }

      await user.send({ embeds: [dmEmbed] });
    } catch (error) {
      console.error(
        `Impossible d'envoyer un message privé à ${user.username}:`,
        error,
      );
    }
  }

  const resultEmbed = new EmbedBuilder()
    .setTitle("📦 Distribution d'item unique")
    .setColor("#00FF00")
    .setDescription(results.join("\n"))
    .addFields({ name: "🎁 Item distribué", value: `**${item.name}**` })
    .setTimestamp();

  await interaction.editReply({ embeds: [resultEmbed] });
}

// Fonction pour lister tous les items uniques
async function handleListItems(interaction) {
  const uniqueItems = loadUniqueItems();

  if (uniqueItems.items.length === 0) {
    return interaction.reply({
      content: "📦 Aucun item unique n'a été créé pour le moment.",
      ephemeral: true,
    });
  }

  const typeEmojis = {
    arme: "⚔️",
    armure: "🛡️",
    objet: "📦",
    titre: "🏆",
    familier: "🐺",
    accessoire: "✨",
    cosmetique: "🎭",
  };

  const rarityEmojis = {
    common: "⚪",
    uncommon: "🟢",
    rare: "🔵",
    epic: "🟣",
    legendary: "🟠",
    mythic: "🔴",
    unique: "⭐",
  };

  // Grouper les items par type
  const itemsByType = {};
  uniqueItems.items.forEach((item) => {
    if (!itemsByType[item.type]) {
      itemsByType[item.type] = [];
    }
    itemsByType[item.type].push(item);
  });

  const embed = new EmbedBuilder()
    .setTitle("📚 Liste des Items Uniques")
    .setColor("#FFD700")
    .setDescription(`Total: **${uniqueItems.items.length}** item(s) unique(s)`)
    .setTimestamp();

  for (const [type, items] of Object.entries(itemsByType)) {
    const itemList = items
      .map(
        (item) =>
          `${rarityEmojis[item.rarity] || "⚪"} **${item.name}** (\`${
            item.id
          }\`)`,
      )
      .join("\n");

    embed.addFields({
      name: `${typeEmojis[type] || "📦"} ${
        type.charAt(0).toUpperCase() + type.slice(1)
      }s (${items.length})`,
      value: itemList || "Aucun",
      inline: false,
    });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Fonction pour voir les détails d'un item unique
async function handleItemInfo(interaction) {
  const itemId = interaction.options.getString("item_id");
  const uniqueItems = loadUniqueItems();
  const item = uniqueItems.items.find((i) => i.id === itemId);

  if (!item) {
    return interaction.reply({
      content: `❌ Item unique avec l'ID "${itemId}" non trouvé.`,
      ephemeral: true,
    });
  }

  const typeEmojis = {
    arme: "⚔️",
    armure: "🛡️",
    objet: "📦",
    titre: "🏆",
    familier: "🐺",
    accessoire: "✨",
    cosmetique: "🎭",
  };

  const rarityEmojis = {
    common: "⚪",
    uncommon: "🟢",
    rare: "🔵",
    epic: "🟣",
    legendary: "🟠",
    mythic: "🔴",
    unique: "⭐",
  };

  const embed = new EmbedBuilder()
    .setTitle(`${typeEmojis[item.type] || "📦"} ${item.name}`)
    .setColor("#FFD700")
    .setDescription(item.description)
    .addFields(
      { name: "🆔 ID", value: `\`${item.id}\``, inline: true },
      { name: "📝 Type", value: item.type, inline: true },
      {
        name: "💎 Rareté",
        value: `${rarityEmojis[item.rarity] || "⚪"} ${item.rarity}`,
        inline: true,
      },
      {
        name: "🔒 Échangeable",
        value: item.tradeable ? "Oui" : "Non",
        inline: true,
      },
    )
    .setTimestamp();

  if (Object.keys(item.stats || {}).length > 0) {
    let statsText = "";
    if (item.stats.attack) statsText += `⚔️ Attaque: +${item.stats.attack}\n`;
    if (item.stats.defense) statsText += `🛡️ Défense: +${item.stats.defense}\n`;
    if (item.stats.health) statsText += `❤️ PV Max: +${item.stats.health}\n`;
    if (item.stats.speed) statsText += `⚡ Vitesse: +${item.stats.speed}\n`;
    embed.addFields({ name: "📊 Statistiques", value: statsText });
  }

  if (item.createdBy) {
    try {
      const creator = await interaction.client.users.fetch(item.createdBy);
      embed.setFooter({
        text: `Créé par ${creator.username} le ${new Date(
          item.createdAt,
        ).toLocaleDateString("fr-FR")}`,
        iconURL: creator.displayAvatarURL(),
      });
    } catch (error) {
      embed.setFooter({
        text: `Créé le ${new Date(item.createdAt).toLocaleDateString("fr-FR")}`,
      });
    }
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// Fonction pour supprimer un item unique
async function handleDeleteItem(interaction) {
  const itemId = interaction.options.getString("item_id");
  const uniqueItems = loadUniqueItems();
  const itemIndex = uniqueItems.items.findIndex((i) => i.id === itemId);

  if (itemIndex === -1) {
    return interaction.reply({
      content: `❌ Item unique avec l'ID "${itemId}" non trouvé.`,
      ephemeral: true,
    });
  }

  const item = uniqueItems.items[itemIndex];
  uniqueItems.items.splice(itemIndex, 1);

  if (!saveUniqueItems(uniqueItems)) {
    return interaction.reply({
      content: "❌ Erreur lors de la suppression de l'item.",
      ephemeral: true,
    });
  }

  await interaction.reply({
    content: `✅ L'item unique **${item.name}** (\`${itemId}\`) a été supprimé avec succès.\n\n⚠️ Note: Les joueurs qui possèdent déjà cet item le conservent dans leur inventaire.`,
    ephemeral: true,
  });
}

// Fonction pour modifier un item unique
async function handleEditItem(interaction) {
  const itemId = interaction.options.getString("item_id");
  const property = interaction.options.getString("propriete");
  const value = interaction.options.getString("valeur");

  const uniqueItems = loadUniqueItems();
  const item = uniqueItems.items.find((i) => i.id === itemId);

  if (!item) {
    return interaction.reply({
      content: `❌ Item unique avec l'ID "${itemId}" non trouvé.`,
      ephemeral: true,
    });
  }

  const oldValue =
    property === "attack" ||
    property === "defense" ||
    property === "health" ||
    property === "speed"
      ? item.stats?.[property]
      : item[property];

  // Modifier la propriété
  switch (property) {
    case "name":
      item.name = value;
      break;
    case "description":
      item.description = value;
      break;
    case "attack":
    case "defense":
    case "health":
    case "speed":
      if (!item.stats) item.stats = {};
      const numValue = parseInt(value);
      if (isNaN(numValue)) {
        return interaction.reply({
          content: "❌ La valeur doit être un nombre.",
          ephemeral: true,
        });
      }
      item.stats[property] = numValue;
      break;
    default:
      return interaction.reply({
        content: "❌ Propriété non reconnue.",
        ephemeral: true,
      });
  }

  if (!saveUniqueItems(uniqueItems)) {
    return interaction.reply({
      content: "❌ Erreur lors de la modification de l'item.",
      ephemeral: true,
    });
  }

  const propertyNames = {
    name: "Nom",
    description: "Description",
    attack: "Attaque",
    defense: "Défense",
    health: "PV Max",
    speed: "Vitesse",
  };

  await interaction.reply({
    content: `✅ L'item **${item.name}** a été modifié avec succès.\n\n**${
      propertyNames[property]
    }:** \`${oldValue || "Non défini"}\` → \`${value}\``,
    ephemeral: true,
  });
}
