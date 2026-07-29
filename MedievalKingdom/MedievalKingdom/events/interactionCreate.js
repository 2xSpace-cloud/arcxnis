const { Events, Collection } = require("discord.js");
const { createEmbed } = require("../utils/embeds.js");
const { getPlayer, updatePlayer } = require("../utils/database.js");
const { updateQuestProgress } = require("../systems/questSystem.js");
const {
  processCombatAction,
  applyCombatRewards,
  calculateCombatRewards,
  useItemInCombat,
} = require("../systems/combatSystem.js");

// Import des combats actifs depuis le module combat
const {
  activeCombats,
  COMBAT_EXPIRATION_TIME,
} = require("../commands/combat.js");

// Cooldown pour éviter le spam de commandes
const cooldowns = new Collection();

// File d'attente pour les interactions (rate limiting)
const interactionQueue = new Map();
const processingInteractions = new Set();

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      // Déférer immédiatement pour éviter l'expiration des interactions
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        // Vérifier si cette interaction est déjà en cours de traitement
        const interactionKey = `${interaction.user.id}_${interaction.customId}`;

        if (processingInteractions.has(interactionKey)) {
          // Interaction déjà en cours, ignorer silencieusement
          return;
        }

        // Marquer comme en cours de traitement
        processingInteractions.add(interactionKey);

        // Nettoyer après 5 secondes
        setTimeout(() => {
          processingInteractions.delete(interactionKey);
        }, 5000);
      }

      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(interaction);
      } else if (interaction.isAutocomplete()) {
        await handleAutocomplete(interaction);
      } else if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await handleSelectMenuInteraction(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction);
      }
    } catch (error) {
      console.error("Erreur dans interactionCreate:", error);

      const errorEmbed = createEmbed(
        "error",
        "Une erreur est survenue lors du traitement de votre interaction."
      );

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        } else {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
      } catch (replyError) {
        console.error("Impossible de répondre à l'interaction:", replyError);
      }
    }
  },
};

/**
 * Gère les commandes slash
 */
async function handleSlashCommand(interaction) {
  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(
      `Aucune commande correspondant à ${interaction.commandName} n'a été trouvée.`
    );
    return;
  }

  // Vérifier le cooldown
  if (!checkCooldown(interaction, command)) {
    return;
  }

  try {
    console.log(
      `🎯 Commande exécutée: ${interaction.commandName} par ${interaction.user.tag}`
    );
    await command.execute(interaction);
  } catch (error) {
    console.error(
      `Erreur lors de l'exécution de ${interaction.commandName}:`,
      error
    );

    const errorEmbed = createEmbed(
      "error",
      "Erreur de commande",
      "Une erreur est survenue lors de l'exécution de cette commande."
    );

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}

/**
 * Gère l'autocomplétion
 */
async function handleAutocomplete(interaction) {
  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(
      `Aucune commande correspondant à ${interaction.commandName} n'a été trouvée.`
    );
    return;
  }

  if (!command.autocomplete) {
    return;
  }

  try {
    await command.autocomplete(interaction);
  } catch (error) {
    console.error(
      `Erreur lors de l'autocomplétion de ${interaction.commandName}:`,
      error
    );
  }
}

/**
 * Gère les interactions de boutons
 */
async function handleButtonInteraction(interaction) {
  const { customId } = interaction;

  console.log(`🔘 Bouton cliqué: ${customId} par ${interaction.user.tag}`);

  // Gestion des duels
  if (
    customId.startsWith("accept_duel_") ||
    customId.startsWith("decline_duel_")
  ) {
    await handleDuelButtons(interaction);
  }

  // Gestion des actions de combat
  else if (customId.startsWith("combat_")) {
    await handleCombatButtons(interaction);
  }

  // Gestion des quêtes MJ
  else if (customId.startsWith("accept_gm_quest_")) {
    await handleGMQuestAccept(interaction);
  }

  // Gestion des missions collectives
  else if (customId.startsWith("join_collective_")) {
    await handleCollectiveJoin(interaction);
  } else if (customId.startsWith("start_collective_")) {
    await handleCollectiveStart(interaction);
  }

  // Gestion du panel d'édition admin
  else if (customId.startsWith("edit_")) {
    const adminEditInteraction = require("./adminEditInteraction.js");
    await adminEditInteraction.handleAdminEditInteraction(interaction);
  }

  // Gestion des drops
  else if (customId.startsWith("drop_claim_")) {
    await handleDropClaim(interaction);
  }

  // Autres boutons...
  else {
    await interaction.reply({
      embeds: [createEmbed("error", "Interaction expirée ou invalide.")],
      ephemeral: true,
    });
  }
}

/**
 * Gère les clics sur le bouton de drop
 */
async function handleDropClaim(interaction) {
  const { customId } = interaction;
  const dropCommand = require('../commands/drop.js');
  const { activeDrops, finalizeDrop } = dropCommand;

  // Extraire l'ID du drop depuis le customId (drop_claim_drop_TIMESTAMP_RANDOM)
  const dropId = customId.replace('drop_claim_', '');
  const drop = activeDrops.get(dropId);

  if (!drop) {
    return await interaction.reply({
      embeds: [createEmbed('error', '❌ Ce drop est expiré ou introuvable.')],
      ephemeral: true,
    });
  }

  const userId = interaction.user.id;

  if (drop.participants.has(userId)) {
    return await interaction.reply({
      embeds: [createEmbed('info', '🎁 Déjà inscrit !', 'Vous participez déjà au tirage de ce drop. Bonne chance !')],
      ephemeral: true,
    });
  }

  drop.participants.set(userId, { userId, username: interaction.user.username });

  await interaction.reply({
    embeds: [createEmbed('success', '✅ Participation enregistrée !',
      'Vous participez au tirage de **' + drop.itemName + '** x' + drop.quantity + ' !\n👥 ' + drop.participants.size + ' participant(s) pour ' + drop.winners + ' gagnant(s).'
    )],
    ephemeral: true,
  });
}

/**
 * Gère les boutons de duel
 */
async function handleDuelButtons(interaction) {
  const { customId } = interaction;
  const [action, , challengerId, opponentId] = customId.split("_");

  // Vérifier que c'est bien l'adversaire qui répond
  if (interaction.user.id !== opponentId) {
    return await interaction.reply({
      embeds: [
        createEmbed("error", "Seul le joueur défié peut répondre à ce défi."),
      ],
      ephemeral: true,
    });
  }

  const challengerPlayer = getPlayer(challengerId);
  const opponentPlayer = getPlayer(opponentId);

  if (!challengerPlayer || !opponentPlayer) {
    return await interaction.reply({
      embeds: [createEmbed("error", "L'un des joueurs n'a pas de personnage.")],
      ephemeral: true,
    });
  }

  if (action === "accept") {
    // Vérifier que les joueurs ne sont pas déjà en combat
    if (activeCombats.has(challengerId) || activeCombats.has(opponentId)) {
      return await interaction.reply({
        embeds: [createEmbed("error", "L'un des joueurs est déjà en combat.")],
        ephemeral: true,
      });
    }

    // Initialiser le combat PvP
    const { initiateCombat } = require("../systems/combatSystem.js");
    const combat = initiateCombat(challengerPlayer, opponentPlayer, "pvp");

    // Ajouter le timestamp d'expiration
    combat.expiresAt = Date.now() + COMBAT_EXPIRATION_TIME;

    activeCombats.set(challengerId, combat);
    activeCombats.set(opponentId, combat);

    // Créer l'interface de combat
    const combatCommand = require("../commands/combat.js");

    const embed = combatCommand.createCombatEmbed(combat);
    // Pour les combats PvP, utiliser un ID générique qui permet aux deux joueurs d'interagir
    const buttons = combatCommand.createCombatButtons("pvp");

    await interaction.update({
      embeds: [embed],
      components: [buttons],
    });
  } else {
    // Défi refusé
    await interaction.update({
      embeds: [
        createEmbed(
          "info",
          "❌ Défi refusé",
          `${opponentPlayer.name} a refusé le duel.`
        ),
      ],
      components: [],
    });
  }
}

/**
 * Gère les boutons de combat
 */
async function handleCombatButtons(interaction) {
  const { customId } = interaction;
  const [, action, buttonUserId] = customId.split("_");
  const userId = interaction.user.id;

  // Pour les combats PvE, vérifier que c'est bien le joueur du bouton qui clique
  if (buttonUserId !== "pvp" && buttonUserId !== userId) {
    try {
      if (!interaction.replied && !interaction.deferred) {
        return await interaction.reply({
          embeds: [
            createEmbed(
              "error",
              "❌ Ce n'est pas votre combat ! Utilisez `/combat monstre` pour démarrer votre propre combat."
            ),
          ],
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Erreur lors de la réponse (mauvais utilisateur):", error);
    }
    return;
  }

  // Récupérer le combat selon le type
  let combat = activeCombats.get(userId);

  // Si pas trouvé et que c'est un bouton PvP, chercher dans tous les combats actifs
  if (!combat && buttonUserId === "pvp") {
    for (const [playerId, c] of activeCombats.entries()) {
      if (
        c.type === "pvp" &&
        (c.player.id === userId || c.opponent.id === userId)
      ) {
        combat = c;
        break;
      }
    }
  }

  if (!combat) {
    // Utiliser deferReply si possible pour éviter l'expiration
    try {
      if (!interaction.replied && !interaction.deferred) {
        return await interaction.reply({
          embeds: [
            createEmbed(
              "error",
              "❌ Combat non trouvé ou expiré.\n\nLe combat a été automatiquement supprimé."
            ),
          ],
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Erreur lors de la réponse (combat non trouvé):", error);
    }
    return;
  }

  // Vérification de sécurité : s'assurer que le combat appartient bien au joueur
  if (combat.player.id !== userId && combat.opponent.id !== userId) {
    console.warn(
      `⚠️ Tentative d'accès au combat d'un autre joueur par ${userId}`
    );
    try {
      if (!interaction.replied && !interaction.deferred) {
        return await interaction.reply({
          embeds: [
            createEmbed(
              "error",
              "❌ Ce combat ne vous appartient pas !\n\nUtilisez `/combat monstre` pour démarrer votre propre combat."
            ),
          ],
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Erreur lors de la réponse (combat non autorisé):", error);
    }
    return;
  }

  // Vérifier si le combat a expiré
  if (combat.expiresAt && Date.now() > combat.expiresAt) {
    // Supprimer le combat expiré
    activeCombats.delete(combat.player.id);
    if (combat.type === "pvp") {
      activeCombats.delete(combat.opponent.id);
    }

    try {
      if (!interaction.replied && !interaction.deferred) {
        return await interaction.reply({
          embeds: [
            createEmbed(
              "error",
              "⏰ Ce combat a expiré et a été automatiquement supprimé.\n\nVous pouvez démarrer un nouveau combat."
            ),
          ],
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Erreur lors de la réponse (combat expiré):", error);
    }
    return;
  }

  // Vérifier que c'est le tour du joueur
  if (combat.currentTurn !== userId) {
    try {
      if (!interaction.replied && !interaction.deferred) {
        return await interaction.reply({
          embeds: [createEmbed("error", "Ce n'est pas votre tour !")],
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Erreur lors de la réponse (pas votre tour):", error);
    }
    return;
  }

  // Marquer le combat comme étant en cours de traitement pour éviter les actions simultanées
  if (combat.processing) {
    try {
      if (!interaction.replied && !interaction.deferred) {
        return await interaction.reply({
          embeds: [
            createEmbed(
              "error",
              "⏳ Action en cours de traitement, veuillez patienter..."
            ),
          ],
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Erreur lors de la réponse (action en cours):", error);
    }
    return;
  }

  combat.processing = true;

  try {
    // Si l'action est "item", afficher le menu de sélection d'items
    if (action === "item") {
      combat.processing = false;
      await showItemSelectionMenu(interaction, combat, userId);
      return;
    }

    // Traiter l'action de combat
    const result = processCombatAction(combat, userId, action);

    if (!result.success) {
      combat.processing = false;
      try {
        if (!interaction.replied && !interaction.deferred) {
          return await interaction.reply({
            embeds: [createEmbed("error", result.message)],
            ephemeral: true,
          });
        }
      } catch (error) {
        console.error("Erreur lors de la réponse (action échouée):", error);
      }
      return;
    }

    if (result.combatEnd) {
      // Combat terminé
      await handleCombatEnd(interaction, combat, result);
    } else {
      // Combat continue
      const combatCommand = require("../commands/combat.js");

      const embed = combatCommand.createCombatEmbed(combat);
      // Utiliser un ID approprié selon le type de combat
      const buttonId = combat.type === "pvp" ? "pvp" : userId;
      const buttons = combatCommand.createCombatButtons(buttonId);

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.update({
            embeds: [embed],
            components: [buttons],
          });
        } else {
          // Si déjà répondu, utiliser editReply
          await interaction.editReply({
            embeds: [embed],
            components: [buttons],
          });
        }
      } catch (updateError) {
        console.error("Erreur lors de la mise à jour du combat:", updateError);
        // Tenter une réponse alternative
        try {
          await interaction.followUp({
            embeds: [embed],
            components: [buttons],
          });
        } catch (followUpError) {
          console.error(
            "Impossible de mettre à jour l'interface de combat:",
            followUpError
          );
        }
      }

      combat.processing = false;
    }
  } catch (error) {
    if (combat) {
      combat.processing = false;
    }
    console.error("Erreur dans handleCombatButtons:", error);
    throw error;
  }
}

/**
 * Affiche le menu de sélection d'items pour le combat
 */
async function showItemSelectionMenu(interaction, combat, userId) {
  const player = getPlayer(userId);

  if (!player || !player.inventory) {
    return await interaction.reply({
      embeds: [createEmbed("error", "Vous n'avez pas d'inventaire !")],
      ephemeral: true,
    });
  }

  // Charger les données des items
  const fs = require("fs");
  const path = require("path");
  const itemsPath = path.join(__dirname, "..", "database", "items.json");
  let itemsData = { items: {} };

  try {
    if (fs.existsSync(itemsPath)) {
      itemsData = JSON.parse(fs.readFileSync(itemsPath, "utf8"));
    }
  } catch (error) {
    console.error("Erreur lors du chargement des items:", error);
  }

  // Filtrer les items utilisables en combat
  const usableItems = [];
  for (const [itemId, quantity] of Object.entries(player.inventory)) {
    if (quantity > 0 && itemsData.items[itemId]) {
      const itemData = itemsData.items[itemId];
      // Vérifier si l'item a un effet utilisable en combat
      if (
        itemData.effect &&
        [
          "heal",
          "mana_restore",
          "damage",
          "buff_attack",
          "buff_defense",
        ].includes(itemData.effect.type)
      ) {
        usableItems.push({
          id: itemId,
          name: itemData.name,
          quantity: quantity,
          description: itemData.description,
        });
      }
    }
  }

  if (usableItems.length === 0) {
    return await interaction.reply({
      embeds: [
        createEmbed("error", "Vous n'avez aucun item utilisable en combat !"),
      ],
      ephemeral: true,
    });
  }

  // Créer le menu de sélection (limité à 25 items)
  const { StringSelectMenuBuilder, ActionRowBuilder } = require("discord.js");

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`combat_use_item_${userId}`)
    .setPlaceholder("Sélectionnez un item à utiliser")
    .addOptions(
      usableItems.slice(0, 25).map((item) => ({
        label: `${item.name} (x${item.quantity})`,
        description: item.description.substring(0, 100),
        value: item.id,
      }))
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  const embed = createEmbed(
    "info",
    "🎒 Sélection d'item",
    "Choisissez un item à utiliser en combat :"
  );

  try {
    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  } catch (error) {
    console.error("Erreur lors de l'affichage du menu d'items:", error);
  }
}

/**
 * Gère la fin d'un combat
 */
async function handleCombatEnd(interaction, combat, result) {
  const { winner } = result;

  // Supprimer le combat des combats actifs
  activeCombats.delete(combat.player.id);
  if (combat.type === "pvp") {
    activeCombats.delete(combat.opponent.id);
  }

  let embed;

  if (winner === null) {
    // Match nul (limite de tours atteinte) ou fuite
    if (result.isDraw) {
      embed = createEmbed(
        "info",
        "⚖️ Match nul",
        result.message || "Le combat s'est terminé en égalité parfaite !"
      );

      // Mettre à jour les statistiques sans donner de victoire/défaite
      if (combat.type === "pve") {
        const player = getPlayer(combat.player.id);
        if (player) {
          // Petite récompense pour avoir survécu
          player.experience += 5;
          player.gold += 2;
          updatePlayer(combat.player.id, player);

          embed.addFields(
            { name: "✨ Expérience", value: "+5 XP", inline: true },
            { name: "💰 Or", value: "+2 or", inline: true }
          );
        }
      }
    } else {
      // Fuite
      embed = createEmbed(
        "info",
        "🏃‍♂️ Fuite",
        "Le combat s'est terminé par une fuite."
      );
    }
  } else {
    const winnerEntity =
      combat.player.id === winner ? combat.player : combat.opponent;
    const loserEntity =
      combat.player.id === winner ? combat.opponent : combat.player;

    // Calculer et appliquer les récompenses
    if (combat.type === "pve" && winner === combat.player.id) {
      const rewards = calculateCombatRewards(winnerEntity, loserEntity, "pve");
      const player = getPlayer(combat.player.id);

      if (player) {
        const levelUpResult = applyCombatRewards(player, rewards);
        // ── Progression de quête ──
        const monsterKey = loserEntity.monsterKey || null;
        const questJustComplete = updateQuestProgress(player, 'win_pve', 1, { monsterKey });
        if (questJustComplete) {
          console.log(`🎯 Quête accomplie via combat pour ${player.name}`);
        }
        // ─────────────────────────
        updatePlayer(combat.player.id, player);

        // Déterminer le texte de difficulté
        const difficultyTexts = {
          1: "Très facile 🟢",
          2: "Facile 🟢",
          3: "Moyen 🟡",
          4: "Difficile 🔴",
          5: "Très difficile / Boss 🔴🔴",
        };
        const difficultyLevel = rewards.difficultyLevel || 1;
        const difficultyText = difficultyTexts[difficultyLevel] || "Inconnu";

        embed = createEmbed(
          "success",
          "🎉 Victoire !",
          `${winnerEntity.name} a vaincu ${loserEntity.name} !`
        ).addFields(
          {
            name: "⚔️ Difficulté du monstre",
            value: difficultyText,
            inline: true,
          },
          {
            name: "✨ Expérience gagnée",
            value: `+${rewards.experience} XP`,
            inline: true,
          },
          { name: "💰 Or gagné", value: `+${rewards.gold} or`, inline: true }
        );

        if (levelUpResult.levelUp) {
          embed.addFields({
            name: "🌟 Niveau supérieur !",
            value: `Vous êtes maintenant niveau ${levelUpResult.newLevel} !`,
            inline: false,
          });
        }

        if (rewards.items && rewards.items.length > 0) {
          embed.addFields({
            name: "🎁 Objets obtenus",
            value: rewards.items.join(", "),
            inline: false,
          });
        }
      }
    } else if (combat.type === "pve" && winner === combat.opponent.id) {
      // Défaite contre un monstre
      const player = getPlayer(combat.player.id);
      if (player) {
        player.combat.losses++;
        updatePlayer(combat.player.id, player);
      }

      embed = createEmbed(
        "error",
        "💀 Défaite",
        `${combat.player.name} a été vaincu par ${combat.opponent.name}...`
      ).setDescription(
        "Vous ne gagnez aucune récompense, mais vous apprenez de vos erreurs."
      );
    } else if (combat.type === "pvp") {
      // Combat PvP classique (duel choisi)
      const winnerPlayer = getPlayer(winnerEntity.id);
      const loserPlayer = getPlayer(loserEntity.id);

      if (winnerPlayer && loserPlayer) {
        winnerPlayer.combat.wins++;
        loserPlayer.combat.losses++;

        const rewards = calculateCombatRewards(
          winnerEntity,
          loserEntity,
          "pvp"
        );
        applyCombatRewards(winnerPlayer, rewards);

        // ── Progression de quête PvP ──
        const pvpQuestDone = updateQuestProgress(winnerPlayer, 'win_pvp', 1);
        if (pvpQuestDone) {
          console.log(`🎯 Quête PvP accomplie pour ${winnerPlayer.name}`);
        }
        // ─────────────────────────────

        updatePlayer(winnerEntity.id, winnerPlayer);
        updatePlayer(loserEntity.id, loserPlayer);
      }

      embed = createEmbed(
        "success",
        "⚔️ Duel terminé !",
        `${winnerEntity.name} remporte le duel contre ${loserEntity.name} !`
      ).addFields({
        name: "🏆 Vainqueur",
        value: winnerEntity.name,
        inline: true,
      });
    } else if (combat.type === "pvp_random") {
      // Combat PvP aléatoire (adversaire contrôlé par IA)
      const initiatorId = combat.player.id;

      if (winner === initiatorId) {
        // Le joueur initiateur a gagné
        const initiatorPlayer = getPlayer(initiatorId);
        if (initiatorPlayer) {
          initiatorPlayer.combat.wins = (initiatorPlayer.combat.wins || 0) + 1;

          const rewards = calculateCombatRewards(winnerEntity, loserEntity, "pvp");
          applyCombatRewards(initiatorPlayer, rewards);

          // ── Progression quête bandit (cible selon classe) ──
          const loserClass = loserEntity.playerClass || combat.opponentClass || null;
          const banditDone = updateQuestProgress(initiatorPlayer, 'kill_player_bandit', 1, { loserClass });
          if (banditDone) console.log(`🎯 Quête bandit accomplie pour ${initiatorPlayer.name}`);
          // ───────────────────────────────────────────────────

          updatePlayer(initiatorId, initiatorPlayer);

          const classEmojis = { chevalier: '⚔️', mage: '🔮', voleur: '🗡️', barde: '🎵' };
          const oppEmoji = classEmojis[loserEntity.playerClass || combat.opponentClass] || '👤';
          embed = createEmbed(
            "success",
            "⚔️ Victoire !",
            `Vous avez vaincu ${oppEmoji} **${loserEntity.name}** !`
          ).addFields(
            { name: "💰 Or gagné", value: `${rewards.gold}`, inline: true },
            { name: "⭐ XP gagnée", value: `${rewards.experience}`, inline: true }
          );
        }
      } else {
        // Le joueur initiateur a perdu
        const initiatorPlayer = getPlayer(initiatorId);
        if (initiatorPlayer) {
          initiatorPlayer.combat.losses = (initiatorPlayer.combat.losses || 0) + 1;
          updatePlayer(initiatorId, initiatorPlayer);
        }
        embed = createEmbed(
          "error",
          "💀 Défaite",
          `Vous avez été vaincu par ${winnerEntity.name}...`
        ).setDescription("Vous ne gagnez aucune récompense, mais vous apprenez de vos erreurs.");
      }
    }
  }

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.update({
        embeds: [embed],
        components: [],
      });
    } else {
      await interaction.editReply({
        embeds: [embed],
        components: [],
      });
    }
  } catch (error) {
    console.error("Erreur lors de la mise à jour de fin de combat:", error);
    // Tenter une réponse alternative
    try {
      await interaction.followUp({
        embeds: [embed],
      });
    } catch (followUpError) {
      console.error("Impossible d'afficher la fin du combat:", followUpError);
    }
  }
}

/**
 * Gère les menus de sélection
 */
async function handleSelectMenuInteraction(interaction) {
  const { customId, values } = interaction;

  // Gestion de l'utilisation d'items en combat
  if (customId.startsWith("combat_use_item_")) {
    const userId = customId.replace("combat_use_item_", "");

    // Vérifier que c'est bien le joueur qui a demandé le menu
    if (interaction.user.id !== userId) {
      return await interaction.reply({
        embeds: [createEmbed("error", "Ce n'est pas votre menu !")],
        ephemeral: true,
      });
    }

    // Récupérer le combat
    let combat = activeCombats.get(userId);

    // Si pas trouvé, chercher dans les combats PvP
    if (!combat) {
      for (const [playerId, c] of activeCombats.entries()) {
        if (
          c.type === "pvp" &&
          (c.player.id === userId || c.opponent.id === userId)
        ) {
          combat = c;
          break;
        }
      }
    }

    if (!combat) {
      return await interaction.reply({
        embeds: [createEmbed("error", "Combat non trouvé ou expiré.")],
        ephemeral: true,
      });
    }

    // Vérifier que c'est le tour du joueur
    if (combat.currentTurn !== userId) {
      return await interaction.reply({
        embeds: [createEmbed("error", "Ce n'est pas votre tour !")],
        ephemeral: true,
      });
    }

    // Utiliser l'item sélectionné
    const itemId = values[0];
    const player = getPlayer(userId);

    const result = useItemInCombat(combat, userId, itemId, player);

    if (!result.success) {
      return await interaction.reply({
        embeds: [createEmbed("error", result.message)],
        ephemeral: true,
      });
    }

    // Consommer l'item de l'inventaire du joueur
    if (result.itemConsumed) {
      player.inventory[itemId]--;
      if (player.inventory[itemId] <= 0) {
        delete player.inventory[itemId];
      }
      updatePlayer(userId, player);
    }

    // Mettre à jour le message de combat
    combat.lastAction = result.message;

    // Vérifier si le combat est terminé (adversaire KO)
    const defender =
      combat.player.id === userId ? combat.opponent : combat.player;
    if (defender.health <= 0) {
      await interaction.reply({
        embeds: [createEmbed("success", result.message)],
        ephemeral: true,
      });

      await handleCombatEnd(interaction, combat, {
        success: true,
        message: result.message,
        combatEnd: true,
        winner: userId,
        combat: combat,
      });
      return;
    }

    // Passer au tour suivant
    combat.currentTurn =
      combat.currentTurn === combat.player.id
        ? combat.opponent.id
        : combat.player.id;
    combat.turn++;

    // Si c'est un combat PvE et que c'est le tour du monstre
    if (combat.type === "pve" && combat.currentTurn === combat.opponent.id) {
      const { performAIAction } = require("../systems/combatSystem.js");

      // Simuler l'action du monstre
      const aiAction = performAIAction(combat);
      combat.lastAction += "\n" + aiAction.message;

      // Vérifier si le joueur est KO
      if (combat.player.health <= 0) {
        await interaction.reply({
          embeds: [createEmbed("info", result.message)],
          ephemeral: true,
        });

        await handleCombatEnd(interaction, combat, {
          success: true,
          message: combat.lastAction,
          combatEnd: true,
          winner: combat.opponent.id,
          combat: combat,
        });
        return;
      }

      // Repasser au tour du joueur
      combat.currentTurn = combat.player.id;
      combat.turn++;
    }

    // Mettre à jour l'interface de combat
    const combatCommand = require("../commands/combat.js");
    const embed = combatCommand.createCombatEmbed(combat);
    const buttonId = combat.type === "pvp" ? "pvp" : userId;
    const buttons = combatCommand.createCombatButtons(buttonId);

    try {
      // Répondre au menu de sélection
      await interaction.reply({
        embeds: [createEmbed("success", result.message)],
        ephemeral: true,
      });

      // Mettre à jour le message de combat principal
      const originalMessage = await interaction.channel.messages.fetch(
        interaction.message.id
      );
      if (originalMessage) {
        // Trouver le message de combat (c'est le message parent ou un message récent)
        const messages = await interaction.channel.messages.fetch({
          limit: 10,
        });
        for (const msg of messages.values()) {
          if (
            msg.embeds.length > 0 &&
            msg.embeds[0].title &&
            msg.embeds[0].title.includes("Combat")
          ) {
            await msg.edit({
              embeds: [embed],
              components: [buttons],
            });
            break;
          }
        }
      }
    } catch (error) {
      console.error(
        "Erreur lors de la mise à jour du combat après utilisation d'item:",
        error
      );
    }

    return;
  }

  // Gestion du panel d'édition admin (menus de sélection)
  if (customId.startsWith("edit_")) {
    const adminEditInteraction = require("./adminEditInteraction.js");
    await adminEditInteraction.handleAdminEditInteraction(interaction);
    return;
  }

  // Autres menus de sélection
  await interaction.reply({
    embeds: [createEmbed("info", "Fonctionnalité en développement")],
    ephemeral: true,
  });
}

/**
 * Gère les soumissions de modals
 */
async function handleModalSubmit(interaction) {
  const { customId } = interaction;

  // Gestion du panel d'édition admin (modals)
  if (customId.startsWith("edit_modal_")) {
    const adminEditInteraction = require("./adminEditInteraction.js");
    await adminEditInteraction.handleAdminEditInteraction(interaction);
    return;
  }

  // Autres modals
  await interaction.reply({
    embeds: [createEmbed("info", "Fonctionnalité en développement")],
    ephemeral: true,
  });
}

/**
 * Vérifie le cooldown des commandes
 */
function checkCooldown(interaction, command) {
  const { commandName } = interaction;
  const userId = interaction.user.id;

  if (!cooldowns.has(commandName)) {
    cooldowns.set(commandName, new Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(commandName);
  const cooldownAmount = (command.cooldown || 3) * 1000; // 3 secondes par défaut

  if (timestamps.has(userId)) {
    const expirationTime = timestamps.get(userId) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      const embed = createEmbed(
        "warning",
        "Cooldown actif",
        `Veuillez attendre ${timeLeft.toFixed(
          1
        )} secondes avant d'utiliser cette commande à nouveau.`
      );

      interaction.reply({ embeds: [embed], ephemeral: true });
      return false;
    }
  }

  timestamps.set(userId, now);
  setTimeout(() => timestamps.delete(userId), cooldownAmount);

  return true;
}

/**
 * Gère l'acceptation d'une quête MJ
 */
async function handleGMQuestAccept(interaction) {
  const { customId } = interaction;
  const questId = customId.replace("accept_gm_quest_", "");
  const userId = interaction.user.id;

  const { activeGMQuests } = require("../commands/mjquest.js");
  const quest = activeGMQuests.get(questId);

  if (!quest) {
    return await interaction.reply({
      embeds: [createEmbed("error", "Cette quête n'est plus disponible.")],
      ephemeral: true,
    });
  }

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

  // Vérifier le niveau minimum
  if (player.level < quest.requirements.minLevel) {
    return await interaction.reply({
      embeds: [
        createEmbed(
          "error",
          `Vous devez être niveau ${quest.requirements.minLevel} minimum pour cette quête.`
        ),
      ],
      ephemeral: true,
    });
  }

  // Vérifier si le joueur a déjà une quête active
  if (player.quests.active) {
    return await interaction.reply({
      embeds: [
        createEmbed(
          "error",
          "Vous avez déjà une quête active ! Terminez-la ou abandonnez-la d'abord."
        ),
      ],
      ephemeral: true,
    });
  }

  // Assigner la quête
  player.quests.active = {
    ...quest,
    startTime: new Date().toISOString(),
    progress: 0,
    isGMQuest: true,
  };
  player.lastActive = new Date().toISOString();
  updatePlayer(userId, player);

  // Ajouter le joueur aux participants
  if (!quest.participants.includes(userId)) {
    quest.participants.push(userId);
  }

  const embed = createEmbed("success", `📜 Quête acceptée : ${quest.title}`)
    .setDescription(quest.description)
    .addFields(
      { name: "⏱️ Durée", value: `${quest.duration} minutes`, inline: true },
      {
        name: "🎁 Récompenses",
        value: `${quest.rewards.experience} XP\n${quest.rewards.gold} or`,
        inline: true,
      },
      {
        name: "ℹ️ Information",
        value: `Utilisez \`/quete active\` pour voir votre progression et \`/quete terminer\` une fois le temps écoulé.`,
        inline: false,
      }
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Gère la participation à une mission collective
 */
async function handleCollectiveJoin(interaction) {
  const { customId } = interaction;
  const missionId = customId.replace("join_collective_", "");
  const userId = interaction.user.id;

  const { activeCollectiveMissions } = require("../commands/mjquest.js");
  const mission = activeCollectiveMissions.get(missionId);

  if (!mission) {
    return await interaction.reply({
      embeds: [createEmbed("error", "Cette mission n'est plus disponible.")],
      ephemeral: true,
    });
  }

  if (mission.status !== "recruiting") {
    return await interaction.reply({
      embeds: [
        createEmbed("error", "Cette mission n'accepte plus de participants."),
      ],
      ephemeral: true,
    });
  }

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

  // Vérifier si le joueur participe déjà
  if (mission.participants.includes(userId)) {
    return await interaction.reply({
      embeds: [createEmbed("error", "Vous participez déjà à cette mission !")],
      ephemeral: true,
    });
  }

  // Vérifier le nombre maximum de participants
  if (mission.participants.length >= mission.maxParticipants) {
    return await interaction.reply({
      embeds: [createEmbed("error", "Cette mission est complète !")],
      ephemeral: true,
    });
  }

  // Ajouter le joueur
  mission.participants.push(userId);

  // Sauvegarder les modifications
  const { saveCollectiveMissions } = require("../commands/mjquest.js");
  saveCollectiveMissions();

  // Mettre à jour l'embed
  const embed = createEmbed("info", `🏰 Mission Collective : ${mission.title}`)
    .setDescription(mission.description)
    .addFields(
      {
        name: "⏱️ Durée",
        value: `${mission.duration / 60} heures`,
        inline: true,
      },
      {
        name: "👥 Participants",
        value: `${mission.participants.length}/${mission.maxParticipants}`,
        inline: true,
      },
      {
        name: "🎁 Récompenses",
        value: `${mission.rewards.experience} XP\n${mission.rewards.gold} or (par participant)`,
        inline: true,
      },
      {
        name: "👤 Créée par",
        value: `<@${mission.createdBy}>`,
        inline: false,
      },
      {
        name: "📋 Statut",
        value: "🔵 Recrutement en cours",
        inline: false,
      }
    )
    .setFooter({ text: `ID: ${missionId}` });

  // Activer le bouton de démarrage si au moins 2 participants
  const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
  } = require("discord.js");

  const joinButton = new ButtonBuilder()
    .setCustomId(`join_collective_${missionId}`)
    .setLabel("⚔️ Rejoindre la mission")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(mission.participants.length >= mission.maxParticipants);

  const startButton = new ButtonBuilder()
    .setCustomId(`start_collective_${missionId}`)
    .setLabel("🚀 Démarrer la mission")
    .setStyle(ButtonStyle.Success)
    .setDisabled(mission.participants.length < 2);

  const row = new ActionRowBuilder().addComponents(joinButton, startButton);

  await interaction.update({ embeds: [embed], components: [row] });

  // Envoyer une confirmation au joueur
  await interaction.followUp({
    embeds: [
      createEmbed(
        "success",
        `✅ Vous avez rejoint la mission "${mission.title}" !`
      ),
    ],
    ephemeral: true,
  });
}

/**
 * Gère le démarrage d'une mission collective
 */
async function handleCollectiveStart(interaction) {
  const { customId } = interaction;
  const missionId = customId.replace("start_collective_", "");
  const userId = interaction.user.id;

  const { activeCollectiveMissions } = require("../commands/mjquest.js");
  const mission = activeCollectiveMissions.get(missionId);

  if (!mission) {
    return await interaction.reply({
      embeds: [createEmbed("error", "Cette mission n'est plus disponible.")],
      ephemeral: true,
    });
  }

  // Vérifier que c'est le créateur ou un participant
  const MJ_ROLE_ID = "1392254528899776582";
  const isMJ = interaction.member.roles.cache.has(MJ_ROLE_ID);
  const isCreator = mission.createdBy === userId;
  const isParticipant = mission.participants.includes(userId);

  if (!isMJ && !isCreator && !isParticipant) {
    return await interaction.reply({
      embeds: [
        createEmbed(
          "error",
          "Seul le créateur, un MJ ou un participant peut démarrer cette mission."
        ),
      ],
      ephemeral: true,
    });
  }

  if (mission.participants.length < 2) {
    return await interaction.reply({
      embeds: [
        createEmbed(
          "error",
          "Il faut au moins 2 participants pour démarrer la mission."
        ),
      ],
      ephemeral: true,
    });
  }

  // Démarrer la mission
  mission.status = "in_progress";
  mission.startTime = new Date().toISOString();

  // Assigner la mission à tous les participants
  for (const participantId of mission.participants) {
    const player = getPlayer(participantId);
    if (player && !player.quests.active) {
      player.quests.active = {
        id: mission.id,
        title: mission.title,
        description: mission.description,
        duration: mission.duration,
        rewards: mission.rewards,
        startTime: mission.startTime,
        progress: 0,
        isCollectiveMission: true,
      };
      updatePlayer(participantId, player);
    }
  }

  const embed = createEmbed("success", `🚀 Mission lancée : ${mission.title}`)
    .setDescription(mission.description)
    .addFields(
      {
        name: "⏱️ Durée",
        value: `${mission.duration / 60} heures`,
        inline: true,
      },
      {
        name: "👥 Participants",
        value: mission.participants.map((id) => `<@${id}>`).join(", "),
        inline: false,
      },
      {
        name: "🎁 Récompenses",
        value: `${mission.rewards.experience} XP\n${mission.rewards.gold} or (par participant)`,
        inline: true,
      },
      {
        name: "📋 Statut",
        value: "🟢 Mission en cours !",
        inline: false,
      }
    )
    .setFooter({
      text: `La mission se terminera automatiquement dans ${
        mission.duration / 60
      } heures`,
    });

  await interaction.update({ embeds: [embed], components: [] });

  // Programmer la fin automatique de la mission
  setTimeout(() => {
    completeCollectiveMission(missionId);
  }, mission.duration * 60 * 1000);
}

/**
 * Termine automatiquement une mission collective
 */
function completeCollectiveMission(missionId) {
  const { activeCollectiveMissions } = require("../commands/mjquest.js");
  const mission = activeCollectiveMissions.get(missionId);

  if (!mission || mission.status !== "in_progress") {
    return;
  }

  mission.status = "completed";

  // Distribuer les récompenses à tous les participants
  for (const participantId of mission.participants) {
    const player = getPlayer(participantId);
    if (
      player &&
      player.quests.active &&
      player.quests.active.id === missionId
    ) {
      // Appliquer les récompenses
      player.experience += mission.rewards.experience;
      player.gold += mission.rewards.gold;

      // Vérifier la montée de niveau
      const oldLevel = player.level;
      let currentLevel = player.level;
      let totalExp = player.experience;
      while (totalExp >= currentLevel * 100) {
        totalExp -= currentLevel * 100;
        currentLevel++;
      }

      if (currentLevel > oldLevel) {
        const levelsGained = currentLevel - oldLevel;
        player.level = currentLevel;
        player.experience = totalExp;
        player.maxHealth += 10 * levelsGained;
        player.maxMana += 5 * levelsGained;
        player.health = player.maxHealth;
        player.mana = player.maxMana;

        // Améliorer les statistiques de combat
        player.stats.attack += levelsGained;
        player.stats.defense += levelsGained;
        player.stats.magicAttack += levelsGained;
        player.stats.magicDefense += levelsGained;
      }

      // Enregistrer dans l'historique
      player.quests.completed.push({
        id: mission.id,
        title: mission.title,
        completedAt: new Date().toISOString(),
        rewards: mission.rewards,
        isCollectiveMission: true,
      });

      player.quests.active = null;
      player.quests.lastQuestTime = new Date().toISOString();
      updatePlayer(participantId, player);
    }
  }

  // Supprimer la mission après 1 heure
  setTimeout(() => {
    activeCollectiveMissions.delete(missionId);
  }, 3600000);

  console.log(
    `✅ Mission collective "${mission.title}" terminée avec succès !`
  );
}
