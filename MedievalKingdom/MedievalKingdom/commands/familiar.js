const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getPlayer, updatePlayer } = require("../utils/database");
const { createEmbed } = require("../utils/embeds");
const fs = require("fs");
const path = require("path");

const familiarsPath = path.join(__dirname, "..", "database", "familiars.json");

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
    .setName("familier")
    .setDescription("Gérez vos familiers")
    .addSubcommand((subcommand) =>
      subcommand.setName("liste").setDescription("Voir tous vos familiers")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("equiper")
        .setDescription("Équiper un familier")
        .addStringOption((option) =>
          option
            .setName("familier")
            .setDescription("ID du familier à équiper")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("desequiper")
        .setDescription("Déséquiper votre familier actuel")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription("Voir les informations d'un familier")
        .addStringOption((option) =>
          option
            .setName("familier")
            .setDescription("ID du familier")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "liste":
        await this.listFamiliars(interaction);
        break;
      case "equiper":
        await this.equipFamiliar(interaction);
        break;
      case "desequiper":
        await this.unequipFamiliar(interaction);
        break;
      case "info":
        await this.showFamiliarInfo(interaction);
        break;
    }
  },

  async listFamiliars(interaction) {
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

    if (!player.familiars || player.familiars.length === 0) {
      return interaction.reply({
        embeds: [
          createEmbed(
            "info",
            "🐾 Vos familiers",
            "Vous n'avez aucun familier.\n\n" +
              "Achetez des familiers à la boutique d'or avec `/boutique-or voir categorie:familiars`"
          ),
        ],
        ephemeral: true,
      });
    }

    const familiarsData = loadJSON(familiarsPath);
    const embed = new EmbedBuilder()
      .setTitle("🐾 Vos familiers")
      .setColor("#3498db");

    if (player.equippedFamiliar) {
      const equippedData = familiarsData?.familiars[player.equippedFamiliar];
      if (equippedData) {
        embed.setDescription(
          `**Familier équipé:** ${equippedData.emoji} **${equippedData.name}**\n\n`
        );
      }
    } else {
      embed.setDescription("**Aucun familier équipé**\n\n");
    }

    for (const familiarId of player.familiars) {
      const familiarData = familiarsData?.familiars[familiarId];
      if (familiarData) {
        let bonusText = "";

        if (familiarData.bonuses.stats) {
          bonusText +=
            "**Stats:** " +
            Object.entries(familiarData.bonuses.stats)
              .map(([stat, value]) => `${stat} +${value}`)
              .join(", ") +
            "\n";
        }

        if (familiarData.bonuses.economic) {
          bonusText +=
            "**Bonus économiques:** " +
            Object.entries(familiarData.bonuses.economic)
              .map(([bonus, value]) => `${bonus} +${Math.round(value * 100)}%`)
              .join(", ") +
            "\n";
        }

        if (familiarData.bonuses.combat) {
          bonusText += `**Capacité de combat:** ${familiarData.bonuses.combat.type}\n`;
        }

        const isEquipped = player.equippedFamiliar === familiarId ? " ✅" : "";

        embed.addFields({
          name: `${getRarityEmoji(familiarData.rarity)} ${familiarData.emoji} ${
            familiarData.name
          }${isEquipped}`,
          value: `ID: \`${familiarId}\`\n${familiarData.description}\n${bonusText}`,
          inline: true,
        });
      }
    }

    embed.setFooter({
      text: "Utilisez /familier equiper pour équiper un familier",
    });

    await interaction.reply({ embeds: [embed] });
  },

  async equipFamiliar(interaction) {
    const familiarId = interaction.options.getString("familier");
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

    // Vérifier si le joueur possède ce familier
    if (!player.familiars || !player.familiars.includes(familiarId)) {
      return interaction.reply({
        embeds: [createEmbed("error", "Vous ne possédez pas ce familier.")],
        ephemeral: true,
      });
    }

    const familiarsData = loadJSON(familiarsPath);
    const familiarData = familiarsData?.familiars[familiarId];

    if (!familiarData) {
      return interaction.reply({
        embeds: [createEmbed("error", "Familier introuvable.")],
        ephemeral: true,
      });
    }

    // Vérifier si le familier est déjà équipé
    if (player.equippedFamiliar === familiarId) {
      return interaction.reply({
        embeds: [createEmbed("error", "Ce familier est déjà équipé.")],
        ephemeral: true,
      });
    }

    // Équiper le familier
    player.equippedFamiliar = familiarId;
    updatePlayer(interaction.user.id, player);

    let bonusText = "";

    if (familiarData.bonuses.stats) {
      bonusText +=
        "\n**Bonus de stats:**\n" +
        Object.entries(familiarData.bonuses.stats)
          .map(([stat, value]) => `• ${stat}: +${value}`)
          .join("\n");
    }

    if (familiarData.bonuses.economic) {
      bonusText +=
        "\n\n**Bonus économiques:**\n" +
        Object.entries(familiarData.bonuses.economic)
          .map(([bonus, value]) => `• ${bonus}: +${Math.round(value * 100)}%`)
          .join("\n");
    }

    if (familiarData.bonuses.combat) {
      bonusText += `\n\n**Capacité de combat:** ${familiarData.bonuses.combat.type}`;
    }

    const embed = createEmbed(
      "success",
      `🐾 Familier équipé !`,
      `Vous avez équipé **${familiarData.emoji} ${familiarData.name}** !\n` +
        `${familiarData.description}${bonusText}\n\n` +
        `Les bonus sont maintenant actifs !`
    );

    await interaction.reply({ embeds: [embed] });
  },

  async unequipFamiliar(interaction) {
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

    if (!player.equippedFamiliar) {
      return interaction.reply({
        embeds: [createEmbed("error", "Vous n'avez aucun familier équipé.")],
        ephemeral: true,
      });
    }

    const familiarsData = loadJSON(familiarsPath);
    const familiarData = familiarsData?.familiars[player.equippedFamiliar];
    const familiarName = familiarData
      ? `${familiarData.emoji} ${familiarData.name}`
      : "votre familier";

    player.equippedFamiliar = null;
    updatePlayer(interaction.user.id, player);

    const embed = createEmbed(
      "success",
      "🐾 Familier déséquipé",
      `Vous avez déséquipé **${familiarName}**.\n\n` +
        `Les bonus ne sont plus actifs.`
    );

    await interaction.reply({ embeds: [embed] });
  },

  async showFamiliarInfo(interaction) {
    const familiarId = interaction.options.getString("familier");
    const familiarsData = loadJSON(familiarsPath);
    const familiarData = familiarsData?.familiars[familiarId];

    if (!familiarData) {
      return interaction.reply({
        embeds: [createEmbed("error", "Familier introuvable.")],
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(
        `${getRarityEmoji(familiarData.rarity)} ${familiarData.emoji} ${
          familiarData.name
        }`
      )
      .setDescription(familiarData.description)
      .setColor(this.getRarityColor(familiarData.rarity));

    if (familiarData.bonuses.stats) {
      const statsText = Object.entries(familiarData.bonuses.stats)
        .map(([stat, value]) => `${stat}: +${value}`)
        .join("\n");
      embed.addFields({
        name: "📊 Bonus de stats",
        value: statsText,
        inline: true,
      });
    }

    if (familiarData.bonuses.economic) {
      const economicText = Object.entries(familiarData.bonuses.economic)
        .map(([bonus, value]) => `${bonus}: +${Math.round(value * 100)}%`)
        .join("\n");
      embed.addFields({
        name: "💰 Bonus économiques",
        value: economicText,
        inline: true,
      });
    }

    if (familiarData.bonuses.combat) {
      let combatText = `Type: ${familiarData.bonuses.combat.type}\n`;
      if (familiarData.bonuses.combat.damage) {
        combatText += `Dégâts: ${familiarData.bonuses.combat.damage}\n`;
      }
      if (familiarData.bonuses.combat.healAmount) {
        combatText += `Soin: ${familiarData.bonuses.combat.healAmount}\n`;
      }
      if (familiarData.bonuses.combat.chance) {
        combatText += `Chance: ${Math.round(
          familiarData.bonuses.combat.chance * 100
        )}%`;
      }
      embed.addFields({
        name: "⚔️ Capacité de combat",
        value: combatText,
        inline: false,
      });
    }

    embed.addFields({
      name: "💰 Prix",
      value: `${familiarData.price} or`,
      inline: true,
    });

    const player = getPlayer(interaction.user.id);
    if (player && player.familiars && player.familiars.includes(familiarId)) {
      const isEquipped = player.equippedFamiliar === familiarId;
      embed.addFields({
        name: "✅ Statut",
        value: isEquipped ? "Possédé et équipé" : "Possédé",
        inline: true,
      });
    } else {
      embed.addFields({
        name: "🛒 Disponibilité",
        value: "Disponible à la boutique d'or",
        inline: true,
      });
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
