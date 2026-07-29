const { SlashCommandBuilder } = require("discord.js");
const { getPlayer, updatePlayer } = require("../utils/database.js");
const { createEmbed } = require("../utils/embeds.js");
const { factions } = require("../systems/gameData.js");
const {
  syncFactionRoles,
  getFactionRoleName,
} = require("../utils/roleManager.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("faction")
    .setDescription("Gestion des factions")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("rejoindre")
        .setDescription("Rejoindre une faction")
        .addStringOption((option) =>
          option
            .setName("nom")
            .setDescription("Faction à rejoindre")
            .setRequired(true)
            .addChoices(
              { name: "👑 Ordre Royal", value: "ordre_royal" },
              { name: "🌙 Guilde des Ombres", value: "guilde_ombres" },
              { name: "🌿 Cercle Druidique", value: "cercle_druidique" },
              { name: "🏛️ Académie Arcanique", value: "academie_arcanique" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("quitter")
        .setDescription("Quitter votre faction actuelle")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription("Informations sur les factions")
        .addStringOption((option) =>
          option
            .setName("nom")
            .setDescription("Faction à consulter (optionnel)")
            .setRequired(false)
            .addChoices(
              { name: "👑 Ordre Royal", value: "ordre_royal" },
              { name: "🌙 Guilde des Ombres", value: "guilde_ombres" },
              { name: "🌿 Cercle Druidique", value: "cercle_druidique" },
              { name: "🏛️ Académie Arcanique", value: "academie_arcanique" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("membres")
        .setDescription("Voir les membres de votre faction")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "rejoindre":
          await this.joinFaction(interaction);
          break;
        case "quitter":
          await this.leaveFaction(interaction);
          break;
        case "info":
          await this.showFactionInfo(interaction);
          break;
        case "membres":
          await this.showMembers(interaction);
          break;
      }
    } catch (error) {
      console.error("Erreur dans la commande faction:", error);
      await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Une erreur est survenue lors de l'exécution de la commande."
          ),
        ],
        ephemeral: true,
      });
    }
  },

  async joinFaction(interaction) {
    const userId = interaction.user.id;
    const factionName = interaction.options.getString("nom");
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

    if (player.faction) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            `Vous êtes déjà membre de la faction ${
              factions[player.faction].name
            }. Utilisez \`/faction quitter\` d'abord.`
          ),
        ],
        ephemeral: true,
      });
    }

    const faction = factions[factionName];
    if (!faction) {
      return await interaction.reply({
        embeds: [createEmbed("error", "Faction introuvable.")],
        ephemeral: true,
      });
    }

    // Vérifier les prérequis
    if (
      faction.requirements.minLevel &&
      player.level < faction.requirements.minLevel
    ) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            `Vous devez être niveau ${faction.requirements.minLevel} minimum pour rejoindre cette faction.`
          ),
        ],
        ephemeral: true,
      });
    }

    if (
      faction.requirements.classes &&
      !faction.requirements.classes.includes(player.class)
    ) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            `Cette faction n'accepte que ces classes : ${faction.requirements.classes.join(
              ", "
            )}.`
          ),
        ],
        ephemeral: true,
      });
    }

    if (
      faction.requirements.reputation &&
      player.reputation < faction.requirements.reputation
    ) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            `Vous devez avoir au moins ${faction.requirements.reputation} points de réputation pour rejoindre cette faction.`
          ),
        ],
        ephemeral: true,
      });
    }

    // Vérifier les coûts pour rejoindre la faction
    const joinCost = faction.joinCost;
    if (joinCost) {
      const goldRequired = joinCost.gold || 0;
      const reputationRequired = joinCost.reputation || 0;

      // Vérifier l'or
      if (player.gold < goldRequired) {
        return await interaction.reply({
          embeds: [
            createEmbed(
              "error",
              `❌ Vous n'avez pas assez d'or pour rejoindre cette faction.\n🪙 Requis: **${goldRequired} or**\n🪙 Possédés: **${player.gold} or**`
            ),
          ],
          ephemeral: true,
        });
      }

      // Vérifier la réputation (pour les factions avec coût de réputation négatif)
      if (
        reputationRequired < 0 &&
        player.reputation < Math.abs(reputationRequired)
      ) {
        return await interaction.reply({
          embeds: [
            createEmbed(
              "error",
              `❌ Vous n'avez pas assez de perte de réputation pour rejoindre cette faction.\n📉 Requis: **-${Math.abs(
                reputationRequired
              )} réputation**\n📊 Possédés: **${player.reputation} réputation**`
            ),
          ],
          ephemeral: true,
        });
      }

      // Déduire les coûts
      player.gold -= goldRequired;
      player.reputation += reputationRequired;
    }

    // Rejoindre la faction
    player.faction = factionName;
    updatePlayer(userId, player);

    // Gérer les rôles Discord
    let roleMessage = "";
    try {
      const member = await interaction.guild.members.fetch(userId);
      const roleSuccess = await syncFactionRoles(member, factionName);

      if (roleSuccess) {
        const roleName = getFactionRoleName(factionName, interaction.guild);
        roleMessage = roleName
          ? `\n🎭 Rôle **${roleName}** attribué !`
          : "\n🎭 Rôle de faction attribué !";
      } else {
        roleMessage = "\n⚠️ Erreur lors de l'attribution du rôle Discord.";
      }
    } catch (error) {
      console.error("Erreur lors de la gestion des rôles:", error);
      roleMessage = "\n⚠️ Impossible d'attribuer le rôle Discord.";
    }

    const embed = createEmbed(
      "success",
      `🎉 Bienvenue dans la ${faction.name} !`
    )
      .setDescription(faction.description + roleMessage)
      .addFields(
        { name: "🎯 Objectif", value: faction.goals, inline: false },
        { name: "🎁 Bonus", value: faction.bonuses.join("\n"), inline: false }
      );

    // Ajouter les informations de coût si applicable
    if (joinCost && (joinCost.gold || joinCost.reputation)) {
      let costInfo = "";
      if (joinCost.gold) {
        costInfo += `🪙 **${joinCost.gold} or** payé\n`;
      }
      if (joinCost.reputation) {
        costInfo += `📊 **${joinCost.reputation} réputation** ${
          joinCost.reputation < 0 ? "perdue" : "gagnée"
        }`;
      }
      embed.addFields({
        name: "💰 Coût d'adhésion",
        value: costInfo,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },

  async leaveFaction(interaction) {
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

    if (!player.faction) {
      return await interaction.reply({
        embeds: [createEmbed("error", "Vous n'appartenez à aucune faction.")],
        ephemeral: true,
      });
    }

    const oldFaction = factions[player.faction];
    const oldFactionKey = player.faction;
    player.faction = null;
    updatePlayer(userId, player);

    // Gérer les rôles Discord
    let roleMessage = "";
    try {
      const member = await interaction.guild.members.fetch(userId);
      const roleSuccess = await syncFactionRoles(member, null); // null = retirer tous les rôles de faction

      if (roleSuccess) {
        const oldRoleName = getFactionRoleName(
          oldFactionKey,
          interaction.guild
        );
        roleMessage = oldRoleName
          ? `\n🎭 Rôle **${oldRoleName}** retiré.`
          : "\n🎭 Rôle de faction retiré.";
      } else {
        roleMessage = "\n⚠️ Erreur lors du retrait du rôle Discord.";
      }
    } catch (error) {
      console.error("Erreur lors de la gestion des rôles:", error);
      roleMessage = "\n⚠️ Impossible de retirer le rôle Discord.";
    }

    const embed = createEmbed(
      "info",
      `Vous avez quitté la ${oldFaction.name}`
    ).setDescription(
      "Vous pouvez rejoindre une nouvelle faction quand vous le souhaitez." +
        roleMessage
    );

    await interaction.reply({ embeds: [embed] });
  },

  async showFactionInfo(interaction) {
    const factionName = interaction.options.getString("nom");

    if (factionName) {
      // Afficher une faction spécifique
      const faction = factions[factionName];
      if (!faction) {
        return await interaction.reply({
          embeds: [createEmbed("error", "Faction introuvable.")],
          ephemeral: true,
        });
      }

      const embed = createEmbed("info", `${faction.emoji} ${faction.name}`)
        .setDescription(faction.description)
        .addFields(
          { name: "🎯 Objectif", value: faction.goals, inline: false },
          {
            name: "📋 Prérequis",
            value: this.formatRequirements(faction.requirements),
            inline: false,
          },
          {
            name: "🎁 Bonus de faction",
            value: faction.bonuses.join("\n"),
            inline: false,
          }
        );

      // Ajouter les coûts d'adhésion
      if (
        faction.joinCost &&
        (faction.joinCost.gold || faction.joinCost.reputation)
      ) {
        let costInfo = "";
        if (faction.joinCost.gold) {
          costInfo += `🪙 **${faction.joinCost.gold} or**\n`;
        }
        if (faction.joinCost.reputation) {
          costInfo += `📊 **${Math.abs(
            faction.joinCost.reputation
          )} réputation** ${
            faction.joinCost.reputation < 0 ? "à perdre" : "à gagner"
          }`;
        }
        embed.addFields({
          name: "💰 Coût d'adhésion",
          value: costInfo,
          inline: false,
        });
      }

      await interaction.reply({ embeds: [embed] });
    } else {
      // Afficher toutes les factions
      const embed = createEmbed(
        "info",
        "🏛️ Factions du Royaume"
      ).setDescription(
        "Choisissez votre camp et gagnez des avantages uniques !"
      );

      for (const [key, faction] of Object.entries(factions)) {
        let factionInfo = `${
          faction.description
        }\n**Prérequis:** ${this.formatRequirements(faction.requirements)}`;

        // Ajouter les coûts d'adhésion
        if (
          faction.joinCost &&
          (faction.joinCost.gold || faction.joinCost.reputation)
        ) {
          factionInfo += "\n**Coûts:** ";
          const costs = [];
          if (faction.joinCost.gold) {
            costs.push(`🪙 ${faction.joinCost.gold} or`);
          }
          if (faction.joinCost.reputation) {
            costs.push(
              `📊 ${Math.abs(faction.joinCost.reputation)} réputation`
            );
          }
          factionInfo += costs.join(" + ");
        }

        embed.addFields({
          name: `${faction.emoji} ${faction.name}`,
          value: factionInfo,
          inline: false,
        });
      }

      await interaction.reply({ embeds: [embed] });
    }
  },

  async showMembers(interaction) {
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

    if (!player.faction) {
      return await interaction.reply({
        embeds: [createEmbed("error", "Vous n'appartenez à aucune faction.")],
        ephemeral: true,
      });
    }

    // Cette fonctionnalité nécessiterait de parcourir tous les joueurs
    // Pour la simplicité, on affiche un message informatif
    const faction = factions[player.faction];
    const embed = createEmbed("info", `Membres de la ${faction.name}`)
      .setDescription(
        "Cette fonctionnalité affichera la liste des membres de votre faction."
      )
      .addFields(
        {
          name: "🏛️ Votre faction",
          value: `${faction.emoji} ${faction.name}`,
          inline: true,
        },
        { name: "📊 Statistiques", value: "Bientôt disponible", inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  },

  formatRequirements(requirements) {
    const reqs = [];

    if (requirements.minLevel) {
      reqs.push(`Niveau ${requirements.minLevel}+`);
    }

    if (requirements.classes) {
      reqs.push(`Classes: ${requirements.classes.join(", ")}`);
    }

    if (requirements.reputation) {
      reqs.push(`Réputation: ${requirements.reputation}+`);
    }

    return reqs.length > 0 ? reqs.join(" • ") : "Aucun";
  },
};
