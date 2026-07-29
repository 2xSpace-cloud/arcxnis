const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");
const { getPlayer, updatePlayer, getAllPlayers } = require("../utils/database");
const { createEmbed } = require("../utils/embeds");
const fs = require("fs");
const path = require("path");

// ID du rôle MJ
const MJ_ROLE_ID = "1392254528899776582";

// Stockage des quêtes MJ actives
const activeGMQuests = new Map();
const activeCollectiveMissions = new Map();

// Chemin du fichier de sauvegarde des missions collectives
const MISSIONS_FILE = path.join(
  __dirname,
  "../database/collectiveMissions.json"
);

/**
 * Sauvegarde les missions collectives dans un fichier
 */
function saveCollectiveMissions() {
  try {
    const missionsData = {
      missions: Object.fromEntries(activeCollectiveMissions),
    };
    fs.writeFileSync(MISSIONS_FILE, JSON.stringify(missionsData, null, 2));
  } catch (error) {
    console.error(
      "❌ Erreur lors de la sauvegarde des missions collectives:",
      error
    );
  }
}

/**
 * Charge les missions collectives depuis le fichier
 */
function loadCollectiveMissions() {
  try {
    if (fs.existsSync(MISSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(MISSIONS_FILE, "utf8"));
      if (data.missions) {
        for (const [id, mission] of Object.entries(data.missions)) {
          activeCollectiveMissions.set(id, mission);
        }
        console.log(
          `✅ ${activeCollectiveMissions.size} missions collectives chargées`
        );
      }
    }
  } catch (error) {
    console.error(
      "❌ Erreur lors du chargement des missions collectives:",
      error
    );
  }
}

// Charger les missions au démarrage
loadCollectiveMissions();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mjquete")
    .setDescription("Gestion des quêtes par les MJ")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("creer")
        .setDescription("Créer une quête personnalisée")
        .addStringOption((option) =>
          option
            .setName("titre")
            .setDescription("Titre de la quête")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("Description de la quête")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("duree")
            .setDescription("Durée en minutes")
            .setRequired(true)
            .setMinValue(5)
            .setMaxValue(300)
        )
        .addIntegerOption((option) =>
          option
            .setName("experience")
            .setDescription("Récompense en expérience")
            .setRequired(true)
            .setMinValue(10)
        )
        .addIntegerOption((option) =>
          option
            .setName("or")
            .setDescription("Récompense en or")
            .setRequired(true)
            .setMinValue(5)
        )
        .addIntegerOption((option) =>
          option
            .setName("niveau_min")
            .setDescription("Niveau minimum requis")
            .setRequired(false)
            .setMinValue(1)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("collective")
        .setDescription("Créer une mission collective")
        .addStringOption((option) =>
          option
            .setName("titre")
            .setDescription("Titre de la mission")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("description")
            .setDescription("Description de la mission")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("duree")
            .setDescription("Durée en heures")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(72)
        )
        .addIntegerOption((option) =>
          option
            .setName("participants_max")
            .setDescription("Nombre maximum de participants")
            .setRequired(true)
            .setMinValue(2)
            .setMaxValue(50)
        )
        .addIntegerOption((option) =>
          option
            .setName("experience")
            .setDescription("Récompense en expérience par participant")
            .setRequired(true)
            .setMinValue(50)
        )
        .addIntegerOption((option) =>
          option
            .setName("or")
            .setDescription("Récompense en or par participant")
            .setRequired(true)
            .setMinValue(20)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("liste").setDescription("Voir les quêtes MJ actives")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("annuler")
        .setDescription("Annuler une quête MJ")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID de la quête à annuler")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    // Vérifier si l'utilisateur a le rôle MJ
    const hasMJRole = interaction.member.roles.cache.has(MJ_ROLE_ID);

    if (!hasMJRole && subcommand !== "liste") {
      return interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "❌ Vous devez avoir le rôle MJ pour utiliser cette commande."
          ),
        ],
        ephemeral: true,
      });
    }

    try {
      switch (subcommand) {
        case "creer":
          await this.createGMQuest(interaction);
          break;
        case "collective":
          await this.createCollectiveMission(interaction);
          break;
        case "liste":
          await this.listGMQuests(interaction);
          break;
        case "annuler":
          await this.cancelGMQuest(interaction);
          break;
      }
    } catch (error) {
      console.error("Erreur dans la commande mjquete:", error);
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

  async createGMQuest(interaction) {
    const titre = interaction.options.getString("titre");
    const description = interaction.options.getString("description");
    const duree = interaction.options.getInteger("duree");
    const experience = interaction.options.getInteger("experience");
    const or = interaction.options.getInteger("or");
    const niveauMin = interaction.options.getInteger("niveau_min") || 1;

    const questId = `gm_quest_${Date.now()}`;
    const quest = {
      id: questId,
      type: "gm_quest",
      title: titre,
      description: description,
      duration: duree,
      rewards: {
        experience: experience,
        gold: or,
      },
      requirements: {
        minLevel: niveauMin,
      },
      createdBy: interaction.user.id,
      createdAt: new Date().toISOString(),
      participants: [],
    };

    activeGMQuests.set(questId, quest);

    // Créer les boutons d'acceptation
    const acceptButton = new ButtonBuilder()
      .setCustomId(`accept_gm_quest_${questId}`)
      .setLabel("✅ Accepter la quête")
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder().addComponents(acceptButton);

    const embed = createEmbed("info", `📜 Nouvelle quête MJ : ${titre}`)
      .setDescription(description)
      .addFields(
        { name: "⏱️ Durée", value: `${duree} minutes`, inline: true },
        {
          name: "📊 Niveau minimum",
          value: niveauMin.toString(),
          inline: true,
        },
        {
          name: "🎁 Récompenses",
          value: `${experience} XP\n${or} or`,
          inline: true,
        },
        {
          name: "👤 Créée par",
          value: `<@${interaction.user.id}>`,
          inline: false,
        }
      )
      .setFooter({ text: `ID: ${questId}` });

    await interaction.reply({
      content: "@everyone Une nouvelle quête est disponible !",
      embeds: [embed],
      components: [row],
    });
  },

  async createCollectiveMission(interaction) {
    const titre = interaction.options.getString("titre");
    const description = interaction.options.getString("description");
    const duree = interaction.options.getInteger("duree");
    const participantsMax = interaction.options.getInteger("participants_max");
    const experience = interaction.options.getInteger("experience");
    const or = interaction.options.getInteger("or");

    const missionId = `collective_${Date.now()}`;
    const mission = {
      id: missionId,
      type: "collective_mission",
      title: titre,
      description: description,
      duration: duree * 60, // Convertir en minutes
      maxParticipants: participantsMax,
      rewards: {
        experience: experience,
        gold: or,
      },
      createdBy: interaction.user.id,
      createdAt: new Date().toISOString(),
      participants: [],
      startTime: null,
      status: "recruiting", // recruiting, in_progress, completed
    };

    activeCollectiveMissions.set(missionId, mission);
    saveCollectiveMissions(); // Sauvegarder la mission

    // Créer les boutons
    const joinButton = new ButtonBuilder()
      .setCustomId(`join_collective_${missionId}`)
      .setLabel("⚔️ Rejoindre la mission")
      .setStyle(ButtonStyle.Primary);

    const startButton = new ButtonBuilder()
      .setCustomId(`start_collective_${missionId}`)
      .setLabel("🚀 Démarrer la mission")
      .setStyle(ButtonStyle.Success)
      .setDisabled(true);

    const row = new ActionRowBuilder().addComponents(joinButton, startButton);

    const embed = createEmbed("info", `🏰 Mission Collective : ${titre}`)
      .setDescription(description)
      .addFields(
        { name: "⏱️ Durée", value: `${duree} heures`, inline: true },
        {
          name: "👥 Participants",
          value: `0/${participantsMax}`,
          inline: true,
        },
        {
          name: "🎁 Récompenses",
          value: `${experience} XP\n${or} or (par participant)`,
          inline: true,
        },
        {
          name: "👤 Créée par",
          value: `<@${interaction.user.id}>`,
          inline: false,
        },
        {
          name: "📋 Statut",
          value: "🔵 Recrutement en cours",
          inline: false,
        }
      )
      .setFooter({ text: `ID: ${missionId}` });

    await interaction.reply({
      content: "@everyone Une nouvelle mission collective est disponible !",
      embeds: [embed],
      components: [row],
    });
  },

  async listGMQuests(interaction) {
    const gmQuests = Array.from(activeGMQuests.values());
    const collectiveMissions = Array.from(activeCollectiveMissions.values());

    if (gmQuests.length === 0 && collectiveMissions.length === 0) {
      return interaction.reply({
        embeds: [
          createEmbed(
            "info",
            "📜 Aucune quête MJ active",
            "Il n'y a actuellement aucune quête créée par les MJ."
          ),
        ],
        ephemeral: true,
      });
    }

    const embed = createEmbed("info", "📜 Quêtes MJ actives");

    if (gmQuests.length > 0) {
      const questList = gmQuests
        .map(
          (q) =>
            `**${q.title}** (${q.duration}min)\n└ Récompenses: ${q.rewards.experience} XP, ${q.rewards.gold} or\n└ ID: \`${q.id}\``
        )
        .join("\n\n");
      embed.addFields({ name: "🎯 Quêtes individuelles", value: questList });
    }

    if (collectiveMissions.length > 0) {
      const missionList = collectiveMissions
        .map(
          (m) =>
            `**${m.title}** (${m.duration / 60}h)\n└ Participants: ${
              m.participants.length
            }/${m.maxParticipants}\n└ Statut: ${
              m.status === "recruiting"
                ? "🔵 Recrutement"
                : m.status === "in_progress"
                ? "🟢 En cours"
                : "✅ Terminée"
            }\n└ ID: \`${m.id}\``
        )
        .join("\n\n");
      embed.addFields({ name: "🏰 Missions collectives", value: missionList });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },

  async cancelGMQuest(interaction) {
    const questId = interaction.options.getString("id");

    if (activeGMQuests.has(questId)) {
      const quest = activeGMQuests.get(questId);

      // Vérifier que c'est le créateur ou un MJ
      if (
        quest.createdBy !== interaction.user.id &&
        !interaction.member.roles.cache.has(MJ_ROLE_ID)
      ) {
        return interaction.reply({
          embeds: [
            createEmbed(
              "error",
              "❌ Vous ne pouvez annuler que vos propres quêtes."
            ),
          ],
          ephemeral: true,
        });
      }

      activeGMQuests.delete(questId);
      return interaction.reply({
        embeds: [
          createEmbed(
            "success",
            `✅ Quête "${quest.title}" annulée avec succès.`
          ),
        ],
        ephemeral: true,
      });
    }

    if (activeCollectiveMissions.has(questId)) {
      const mission = activeCollectiveMissions.get(questId);

      if (
        mission.createdBy !== interaction.user.id &&
        !interaction.member.roles.cache.has(MJ_ROLE_ID)
      ) {
        return interaction.reply({
          embeds: [
            createEmbed(
              "error",
              "❌ Vous ne pouvez annuler que vos propres missions."
            ),
          ],
          ephemeral: true,
        });
      }

      activeCollectiveMissions.delete(questId);
      saveCollectiveMissions(); // Sauvegarder après suppression
      return interaction.reply({
        embeds: [
          createEmbed(
            "success",
            `✅ Mission collective "${mission.title}" annulée avec succès.`
          ),
        ],
        ephemeral: true,
      });
    }

    return interaction.reply({
      embeds: [createEmbed("error", "❌ Quête non trouvée.")],
      ephemeral: true,
    });
  },
};

// Exporter les maps et fonctions pour les utiliser dans interactionCreate
module.exports.activeGMQuests = activeGMQuests;
module.exports.activeCollectiveMissions = activeCollectiveMissions;
module.exports.saveCollectiveMissions = saveCollectiveMissions;
