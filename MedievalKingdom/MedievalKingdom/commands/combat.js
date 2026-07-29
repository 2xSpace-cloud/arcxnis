const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { getPlayer, updatePlayer, getAllPlayers } = require("../utils/database.js");
const { createEmbed } = require("../utils/embeds.js");
const {
  initiateCombat,
  processCombatAction,
  generateMonster,
} = require("../systems/combatSystem.js");

// Stockage temporaire des combats actifs
const activeCombats = new Map();

// Durée d'expiration des combats (5 minutes en millisecondes)
const COMBAT_EXPIRATION_TIME = 5 * 60 * 1000;

/**
 * Nettoie les combats expirés
 */
function cleanupExpiredCombats() {
  const now = Date.now();
  const expiredCombats = [];

  for (const [userId, combat] of activeCombats.entries()) {
    if (combat.expiresAt && now > combat.expiresAt) {
      expiredCombats.push({ userId, combat });
    }
  }

  // Supprimer les combats expirés
  for (const { userId, combat } of expiredCombats) {
    activeCombats.delete(userId);

    // Si c'est un combat PvP, supprimer aussi l'entrée de l'adversaire
    if (combat.type === "pvp") {
      const opponentId =
        combat.player.id === userId ? combat.opponent.id : combat.player.id;
      activeCombats.delete(opponentId);
    }

    console.log(`🧹 Combat expiré supprimé pour l'utilisateur ${userId}`);
  }

  if (expiredCombats.length > 0) {
    console.log(`✅ ${expiredCombats.length} combat(s) expiré(s) nettoyé(s)`);
  }

  return expiredCombats.length;
}

/**
 * Obtient les statistiques des combats actifs
 */
function getActiveCombatsStats() {
  const now = Date.now();
  let totalCombats = 0;
  let pveCombats = 0;
  let pvpCombats = 0;
  let expiredCombats = 0;
  const uniqueCombats = new Set();

  for (const [userId, combat] of activeCombats.entries()) {
    // Compter les combats uniques (éviter de compter 2 fois les PvP)
    if (!uniqueCombats.has(combat.id)) {
      uniqueCombats.add(combat.id);
      totalCombats++;

      if (combat.type === "pve") {
        pveCombats++;
      } else if (combat.type === "pvp") {
        pvpCombats++;
      }

      if (combat.expiresAt && now > combat.expiresAt) {
        expiredCombats++;
      }
    }
  }

  return {
    total: totalCombats,
    pve: pveCombats,
    pvp: pvpCombats,
    expired: expiredCombats,
    entries: activeCombats.size,
  };
}

// Lancer le nettoyage automatique toutes les 30 secondes
setInterval(cleanupExpiredCombats, 30000);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("combat")
    .setDescription("Système de combat")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("duel")
        .setDescription("Défier un autre joueur en duel")
        .addUserOption((option) =>
          option
            .setName("adversaire")
            .setDescription("Joueur à défier")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("monstre")
        .setDescription("Combattre un monstre aléatoire")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("stats")
        .setDescription("Voir vos statistiques de combat")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("aleatoire")
        .setDescription("Affronter un adversaire aléatoire (compte pour les quêtes de chasseur)")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "duel":
          await this.startDuel(interaction);
          break;
        case "monstre":
          await this.fightMonster(interaction);
          break;
        case "aleatoire":
          await this.startRandomPvP(interaction);
          break;
        case "stats":
          await this.showCombatStats(interaction);
          break;
      }
    } catch (error) {
      console.error("Erreur dans la commande combat:", error);
      await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Une erreur est survenue lors de l'exécution de la commande."
          ),
        ],
        flags: 64,
      });
    }
  },

  async startDuel(interaction) {
    const challenger = interaction.user;
    const opponent = interaction.options.getUser("adversaire");

    if (challenger.id === opponent.id) {
      return await interaction.reply({
        embeds: [
          createEmbed("error", "Vous ne pouvez pas vous défier vous-même !"),
        ],
        flags: 64,
      });
    }

    const challengerPlayer = getPlayer(challenger.id);
    const opponentPlayer = getPlayer(opponent.id);

    if (!challengerPlayer) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez d'abord créer un personnage avec `/personnage creer`."
          ),
        ],
        flags: 64,
      });
    }

    if (!opponentPlayer) {
      return await interaction.reply({
        embeds: [
          createEmbed("error", "Votre adversaire n'a pas de personnage."),
        ],
        flags: 64,
      });
    }

    // Vérifier si les joueurs sont déjà en combat
    if (activeCombats.has(challenger.id) || activeCombats.has(opponent.id)) {
      return await interaction.reply({
        embeds: [createEmbed("error", "L'un des joueurs est déjà en combat !")],
        flags: 64,
      });
    }

    // Vérifier la santé des joueurs
    if (challengerPlayer.health <= 0) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez récupérer vos points de vie avant de combattre !"
          ),
        ],
        flags: 64,
      });
    }

    if (opponentPlayer.health <= 0) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Votre adversaire doit récupérer ses points de vie avant de combattre !"
          ),
        ],
        flags: 64,
      });
    }

    // Créer les boutons d'acceptation
    const acceptButton = new ButtonBuilder()
      .setCustomId(`accept_duel_${challenger.id}_${opponent.id}`)
      .setLabel("Accepter le duel")
      .setStyle(ButtonStyle.Success);

    const declineButton = new ButtonBuilder()
      .setCustomId(`decline_duel_${challenger.id}_${opponent.id}`)
      .setLabel("Refuser le duel")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(
      acceptButton,
      declineButton
    );

    const embed = createEmbed("info", "⚔️ Défi en duel !")
      .setDescription(`${challenger} défie ${opponent} en duel !`)
      .addFields(
        {
          name: "Défiant",
          value: `${challengerPlayer.name} (Niv. ${challengerPlayer.level})`,
          inline: true,
        },
        {
          name: "Défié",
          value: `${opponentPlayer.name} (Niv. ${opponentPlayer.level})`,
          inline: true,
        }
      );

    await interaction.reply({ embeds: [embed], components: [row] });

    // Définir un timeout pour le défi
    setTimeout(() => {
      if (
        !activeCombats.has(challenger.id) &&
        !activeCombats.has(opponent.id)
      ) {
        interaction.editReply({
          embeds: [createEmbed("error", "⏰ Le défi en duel a expiré.")],
          components: [],
        });
      }
    }, 60000); // 1 minute
  },

  async fightMonster(interaction) {
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
        flags: 64,
      });
    }

    // Vérifier si le joueur a déjà un combat actif
    if (activeCombats.has(userId)) {
      return await interaction.reply({
        embeds: [createEmbed("error", "Vous êtes déjà en combat !")],
        flags: 64,
      });
    }

    if (player.health <= 0) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez récupérer vos points de vie avant de combattre !"
          ),
        ],
        flags: 64,
      });
    }

    // Générer un monstre
    const monster = generateMonster(player.level);
    // Initialiser le combat
    const combat = initiateCombat(player, monster, "pve");

    // Ajouter le timestamp d'expiration
    combat.expiresAt = Date.now() + COMBAT_EXPIRATION_TIME;

    // Stocker le combat avec l'ID du joueur pour faciliter la récupération
    activeCombats.set(userId, combat);

    // Créer l'interface de combat
    const embed = this.createCombatEmbed(combat);
    const buttons = this.createCombatButtons(userId);

    await interaction.reply({ embeds: [embed], components: [buttons] });
  },

  async startRandomPvP(interaction) {
    const userId = interaction.user.id;
    const player = getPlayer(userId);

    if (!player) {
      return await interaction.reply({
        embeds: [createEmbed('error', 'Vous devez créer un personnage avec `/personnage creer`.')],
        flags: 64,
      });
    }

    if (player.health <= 0) {
      return await interaction.reply({
        embeds: [createEmbed('error', 'Vous devez récupérer vos points de vie avant de combattre !')],
        flags: 64,
      });
    }

    if (activeCombats.has(userId)) {
      return await interaction.reply({
        embeds: [createEmbed('error', 'Vous êtes déjà en combat !')],
        flags: 64,
      });
    }

    // Trouver un adversaire aléatoire
    const allPlayers = getAllPlayers();
    const eligible = allPlayers.filter(p =>
      p && p.id && p.id !== userId && p.name && p.class && (p.level || 1) >= 1 &&
      (p.health === undefined || p.health > 0) && !activeCombats.has(p.id)
    );

    if (eligible.length === 0) {
      return await interaction.reply({
        embeds: [createEmbed("warning", "⚠️ Aucun adversaire disponible", "Aucun autre joueur n'est disponible pour un combat aléatoire en ce moment.")],
        flags: 64,
      });
    }

    const opponent = eligible[Math.floor(Math.random() * eligible.length)];

    // Normaliser les stats de l'adversaire
    if (!opponent.health) opponent.health = opponent.maxHealth || 100;
    if (!opponent.maxHealth) opponent.maxHealth = opponent.health;
    if (!opponent.mana) opponent.mana = opponent.maxMana || 50;
    if (!opponent.maxMana) opponent.maxMana = opponent.mana;
    if (!opponent.stats) opponent.stats = { attack: 10, defense: 8, magicAttack: 8, magicDefense: 6, speed: 10 };
    if (!opponent.abilities) opponent.abilities = [];

    // Initialiser le combat pvp_random (IA joue l'adversaire)
    const combat = initiateCombat(player, opponent, 'pvp_random');
    combat.expiresAt = Date.now() + COMBAT_EXPIRATION_TIME;
    combat.opponentClass = opponent.class;

    activeCombats.set(userId, combat);

    const classEmojis = { chevalier: '⚔️', mage: '🔮', voleur: '🗡️', barde: '🎵' };
    const oppEmoji = classEmojis[opponent.class] || '👤';
    const embed = this.createCombatEmbed(combat);
    embed.setDescription(`Vous affrontez ${oppEmoji} **${opponent.name}** (Niv.${opponent.level || 1} ${opponent.class || ''}) — un adversaire aléatoire !`);
    const buttons = this.createCombatButtons(userId);

    await interaction.reply({ embeds: [embed], components: [buttons] });
  },

  async showCombatStats(interaction) {
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
        flags: 64,
      });
    }

    const stats = player.combat;
    const totalCombats = stats.wins + stats.losses;
    const winRate =
      totalCombats > 0 ? ((stats.wins / totalCombats) * 100).toFixed(1) : 0;

    const embed = createEmbed(
      "info",
      `⚔️ Statistiques de combat de ${player.name}`
    ).addFields(
      { name: "🏆 Victoires", value: stats.wins.toString(), inline: true },
      { name: "💀 Défaites", value: stats.losses.toString(), inline: true },
      { name: "📊 Taux de victoire", value: `${winRate}%`, inline: true },
      {
        name: "⚔️ Dégâts infligés",
        value: stats.totalDamageDealt.toString(),
        inline: true,
      },
      {
        name: "🛡️ Dégâts subis",
        value: stats.totalDamageTaken.toString(),
        inline: true,
      },
      { name: "🎯 Total combats", value: totalCombats.toString(), inline: true }
    );

    if (totalCombats > 0) {
      const avgDamageDealt = Math.round(stats.totalDamageDealt / totalCombats);
      const avgDamageTaken = Math.round(stats.totalDamageTaken / totalCombats);

      embed.addFields(
        {
          name: "📈 Dégâts moy. infligés",
          value: avgDamageDealt.toString(),
          inline: true,
        },
        {
          name: "📉 Dégâts moy. subis",
          value: avgDamageTaken.toString(),
          inline: true,
        }
      );
    }

    await interaction.reply({ embeds: [embed] });
  },

  createCombatEmbed(combat) {
    const player = combat.player;
    const opponent = combat.opponent;

    const embed = createEmbed("info", "⚔️ Combat en cours").addFields(
      {
        name: `👤 ${player.name}`,
        value: `❤️ ${player.health}/${player.maxHealth}\n🔮 ${player.mana}/${player.maxMana}\n🛡️ Défenses: ${player.defensesRemaining}/3`,
        inline: true,
      },
      { name: "🆚", value: "\u200b", inline: true },
      {
        name: `${combat.type === "pve" ? "👹" : "👤"} ${opponent.name}`,
        value: `❤️ ${opponent.health}/${opponent.maxHealth}${
          opponent.mana ? `\n🔮 ${opponent.mana}/${opponent.maxMana}` : ""
        }`,
        inline: true,
      }
    );

    if (combat.currentTurn) {
      const playerTurnsRemaining = combat.maxTurns - combat.playerTurns;
      const turnWarning = playerTurnsRemaining <= 3 ? " ⚠️" : "";
      embed.addFields({
        name: "🎯 Tour actuel",
        value: `C'est au tour de ${
          combat.currentTurn === player.id ? player.name : opponent.name
        }\n⏱️ Tours de ${player.name}: ${combat.playerTurns}/${
          combat.maxTurns
        }${turnWarning}`,
        inline: false,
      });
    }

    if (combat.lastAction) {
      embed.addFields({
        name: "💥 Dernière action",
        value: combat.lastAction,
        inline: false,
      });
    }

    return embed;
  },

  createCombatButtons(userId) {
    const attackButton = new ButtonBuilder()
      .setCustomId(`combat_attack_${userId}`)
      .setLabel("⚔️ Attaquer")
      .setStyle(ButtonStyle.Danger);

    const spellButton = new ButtonBuilder()
      .setCustomId(`combat_spell_${userId}`)
      .setLabel("🔮 Sort")
      .setStyle(ButtonStyle.Primary);

    const defendButton = new ButtonBuilder()
      .setCustomId(`combat_defend_${userId}`)
      .setLabel("🛡️ Défendre")
      .setStyle(ButtonStyle.Secondary);

    const itemButton = new ButtonBuilder()
      .setCustomId(`combat_item_${userId}`)
      .setLabel("🎒 Item")
      .setStyle(ButtonStyle.Success);

    return new ActionRowBuilder().addComponents(
      attackButton,
      spellButton,
      defendButton,
      itemButton
    );
  },
};

// Export de la map des combats actifs pour l'utiliser dans interactionCreate
module.exports.activeCombats = activeCombats;
module.exports.cleanupExpiredCombats = cleanupExpiredCombats;
module.exports.getActiveCombatsStats = getActiveCombatsStats;
module.exports.COMBAT_EXPIRATION_TIME = COMBAT_EXPIRATION_TIME;
