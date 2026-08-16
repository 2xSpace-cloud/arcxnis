const { getPlayer, updatePlayer } = require("../utils/database");

// Réglages du gain de gemmes en vocal
const GEMMES_PER_MINUTE_VOCAL = 1; // 1 gemme par minute en vocal
const MAX_GEMMES_PER_DAY = 50; // Maximum 50 gemmes par jour
const CHECK_INTERVAL = 5 * 60 * 1000; // Vérifier toutes les 5 minutes

// Map pour suivre les intervalles actifs
const activeIntervals = new Map();

// Fonction pour réinitialiser les gemmes quotidiennes si nécessaire
function resetDailyGemmesIfNeeded(player) {
  const now = new Date();
  const lastReset = player.voiceGemmes?.lastReset
    ? new Date(player.voiceGemmes.lastReset)
    : null;

  // Si c'est un nouveau jour, réinitialiser
  if (!lastReset || now.toDateString() !== lastReset.toDateString()) {
    return {
      dailyGemmes: 0,
      lastReset: now.toISOString(),
      joinTime: player.voiceGemmes?.joinTime || null,
    };
  }

  return player.voiceGemmes;
}

// Fonction pour calculer et donner des gemmes
async function giveVoiceGemmes(userId, member) {
  try {
    const player = getPlayer(userId);
    if (!player) return;

    // Initialiser voiceGemmes si nécessaire
    if (!player.voiceGemmes) {
      player.voiceGemmes = {
        dailyGemmes: 0,
        lastReset: new Date().toISOString(),
        joinTime: null,
      };
    }

    // Réinitialiser si nouveau jour
    player.voiceGemmes = resetDailyGemmesIfNeeded(player);

    // Vérifier si la limite quotidienne est atteinte
    if (player.voiceGemmes.dailyGemmes >= MAX_GEMMES_PER_DAY) {
      console.log(
        `⚠️ ${member.user.tag} a atteint la limite quotidienne de gemmes vocales`,
      );
      return;
    }

    // Calculer le temps passé depuis le dernier check
    const now = Date.now();
    const joinTime = player.voiceGemmes.joinTime
      ? new Date(player.voiceGemmes.joinTime).getTime()
      : now;
    const timeSpent = now - joinTime;
    const minutes = Math.floor(timeSpent / 60000);

    if (minutes > 0) {
      // Calculer les gemmes à donner
      let gemmesToGive = minutes * GEMMES_PER_MINUTE_VOCAL;

      // Limiter pour ne pas dépasser le maximum quotidien
      const remainingGemmes =
        MAX_GEMMES_PER_DAY - player.voiceGemmes.dailyGemmes;
      gemmesToGive = Math.min(gemmesToGive, remainingGemmes);

      if (gemmesToGive > 0) {
        // Ajouter les gemmes
        player.gemmes = (player.gemmes || 0) + gemmesToGive;
        player.voiceGemmes.dailyGemmes += gemmesToGive;
        player.voiceGemmes.joinTime = new Date().toISOString();

        updatePlayer(userId, player);

        console.log(
          `💎 ${member.user.tag} a gagné ${gemmesToGive} gemmes (${player.voiceGemmes.dailyGemmes}/${MAX_GEMMES_PER_DAY} aujourd'hui)`,
        );

        // Envoyer une notification en MP
        try {
          const remainingToday =
            MAX_GEMMES_PER_DAY - player.voiceGemmes.dailyGemmes;
          let message = `💎 **Gemmes Vocales**\n\nVous avez gagné **${gemmesToGive} gemmes** pour votre temps en vocal !\n\n📊 **Aujourd'hui :** ${player.voiceGemmes.dailyGemmes}/${MAX_GEMMES_PER_DAY} gemmes\n💰 **Total :** ${player.gemmes} gemmes`;

          if (remainingToday === 0) {
            message += `\n\n⚠️ Vous avez atteint la limite quotidienne ! Revenez demain pour gagner plus de gemmes.`;
          } else if (remainingToday <= 10) {
            message += `\n\n⏰ Plus que ${remainingToday} gemmes disponibles aujourd'hui !`;
          }

          await member.send(message);
        } catch (error) {
          console.log(
            `Impossible d'envoyer un MP à ${member.user.tag}:`,
            error.message,
          );
        }
      }
    }
  } catch (error) {
    console.error("Erreur lors du calcul des gemmes vocales:", error);
  }
}

// Fonction pour démarrer le suivi d'un utilisateur
function startVoiceTracking(userId, member) {
  // Arrêter l'intervalle existant si présent
  if (activeIntervals.has(userId)) {
    clearInterval(activeIntervals.get(userId));
  }

  // Initialiser le temps de connexion dans la base de données
  const player = getPlayer(userId);
  if (player) {
    // Marquer le joueur comme actif lorsqu'il rejoint le vocal
    player.active = true;
    if (!player.voiceGemmes) {
      player.voiceGemmes = {
        dailyGemmes: 0,
        lastReset: new Date().toISOString(),
        joinTime: new Date().toISOString(),
      };
    } else {
      player.voiceGemmes = resetDailyGemmesIfNeeded(player);
      player.voiceGemmes.joinTime = new Date().toISOString();
    }
    updatePlayer(userId, player);
  }

  // Créer un intervalle pour donner des gemmes périodiquement
  const interval = setInterval(() => {
    giveVoiceGemmes(userId, member);
  }, CHECK_INTERVAL);

  activeIntervals.set(userId, interval);
  console.log(`👤 ${member.user.tag} a rejoint le vocal - suivi démarré`);
}

// Fonction pour arrêter le suivi d'un utilisateur
async function stopVoiceTracking(userId, member) {
  // Marquer le joueur comme inactif
  const player = getPlayer(userId);
  if (player) {
    player.active = false;
    updatePlayer(userId, player);
  }

  // Donner les gemmes pour le temps restant
  await giveVoiceGemmes(userId, member);

  // Arrêter l'intervalle
  if (activeIntervals.has(userId)) {
    clearInterval(activeIntervals.get(userId));
    activeIntervals.delete(userId);
  }

  // Nettoyer le temps de connexion
  const updatedPlayer = getPlayer(userId);
  if (updatedPlayer && updatedPlayer.voiceGemmes) {
    updatedPlayer.voiceGemmes.joinTime = null;
    updatePlayer(userId, updatedPlayer);
  }

  console.log(`👋 ${member.user.tag} a quitté le vocal - suivi arrêté`);
}

module.exports = {
  name: "voiceStateUpdate",
  async execute(oldState, newState) {
    const userId = newState.id;

    // Si l'utilisateur rejoint un salon vocal
    if (!oldState.channelId && newState.channelId) {
      startVoiceTracking(userId, newState.member);
    }

    // Si l'utilisateur quitte le vocal
    else if (oldState.channelId && !newState.channelId) {
      await stopVoiceTracking(userId, newState.member);
    }

    // Si l'utilisateur change de salon vocal (sans quitter)
    else if (
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !== newState.channelId
    ) {
      // Continuer le suivi sans interruption
      console.log(`🔄 ${newState.member.user.tag} a changé de salon vocal`);
    }
  },

  // Fonction pour restaurer le suivi au démarrage du bot
  async restoreVoiceTracking(client) {
    console.log("🔄 Restauration du suivi vocal...");
    const { getAllPlayers } = require("../utils/database");
    const players = await getAllPlayers();

    for (const player of players) {
      if (player.voiceGemmes?.joinTime) {
        try {
          // Trouver le membre dans tous les serveurs
          for (const guild of client.guilds.cache.values()) {
            const member = await guild.members
              .fetch(player.id)
              .catch(() => null);
            if (member && member.voice.channelId) {
              // L'utilisateur est toujours en vocal
              startVoiceTracking(player.id, member);
              console.log(`✅ Suivi restauré pour ${member.user.tag}`);
              break;
            }
          }
        } catch (error) {
          console.error(
            `Erreur lors de la restauration du suivi pour ${player.id}:`,
            error,
          );
        }
      }
    }
    console.log("✅ Restauration du suivi vocal terminée");
  },
};
