const fs = require("fs");
const path = require("path");
const config = require("../config.js");

// Charger les données des quêtes et des objets
const questsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../database/quests.json"), "utf8")
);
const itemsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../database/items.json"), "utf8")
);

/**
 * Génère une quête aléatoire appropriée pour le joueur
 */
function generateRandomQuest(player) {
  try {
    // Vérifier et nettoyer les quêtes expirées
    if (player.quests && player.quests.active) {
      const now = new Date();
      const startTime = new Date(player.quests.active.startTime);
      const ageMinutes = (now - startTime) / 60000;

      // Si la quête est expirée (+ de 48 heures), la supprimer automatiquement
      if (ageMinutes > 2880) {
        console.log(`Quête expirée supprimée pour ${player.name}`);
        player.quests.active = null;
      }
    }

    if (
      !questsData ||
      !questsData.templates ||
      !Array.isArray(questsData.templates)
    ) {
      console.error(
        "Les données de quêtes sont corrompues ou inaccessibles",
        questsData
      );
      return null;
    }

    const availableQuests = questsData.templates.filter((quest) => {
      // Vérifier le niveau minimum
      if (
        quest.requirements.minLevel &&
        player.level < quest.requirements.minLevel
      ) {
        return false;
      }

      // Les classes ne sont plus une restriction - toutes les quêtes sont disponibles
      // Commenté : Vérifier les classes autorisées
      // if (quest.requirements.classes && !quest.requirements.classes.includes(player.class)) {
      //     return false;
      // }

      // Vérifier la faction si requise
      if (
        quest.requirements.faction &&
        player.faction !== quest.requirements.faction
      ) {
        return false;
      }

      return true;
    });

    if (availableQuests.length === 0) {
      return null;
    }

    // Mélanger légèrement la liste pour éviter des répétitions évidentes
    const shuffledQuests = shuffleArray(availableQuests);

    // Sélectionner une quête aléatoire parmi la liste mélangée
    const selectedQuest =
      shuffledQuests[Math.floor(Math.random() * shuffledQuests.length)];

    // Créer une copie de la quête avec des récompenses ajustées et aléatoires
    const quest = {
      ...selectedQuest,
      rewards: adjustRewardsForLevel(
        selectedQuest.rewards,
        player.level,
        createRewardVariance(player.level)
      ),
      id: generateQuestId(),
    };

    return quest;
  } catch (error) {
    console.error("Erreur lors de la génération de quête:", error);
    return null;
  }
}

/**
 * Crée une plage de variation multiplicative pour les récompenses selon le niveau
 */
function createRewardVariance(playerLevel) {
  const baseVariance = 0.15;
  const levelBonus = Math.min(0.15, Math.max(0, (playerLevel - 1) * 0.02));
  const variance = baseVariance + levelBonus;
  const min = Math.max(0.6, 1 - variance);
  const max = 1 + variance;
  return { min, max };
}

/**
 * Mélange un tableau en place et renvoie une nouvelle référence
 */
function shuffleArray(array) {
  // Copier le tableau pour éviter les mutations d'origine
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Retourne un nombre aléatoire dans l'intervalle [min, max]
 */
function randomInRange(min, max) {
  if (min === max) {
    return min;
  }
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return Math.random() * (upper - lower) + lower;
}

/**
 * Ajuste les récompenses en fonction du niveau du joueur
 */
function adjustRewardsForLevel(baseRewards, playerLevel, varianceRange = null) {
  const baseMultiplier = 1 + (playerLevel - 1) * 0.1; // +10% par niveau au-dessus de 1
  const variance = varianceRange || { min: 1, max: 1 };
  const appliedMultiplier = randomInRange(
    baseMultiplier * variance.min,
    baseMultiplier * variance.max
  );

  return {
    experience: Math.max(
      0,
      Math.floor(
        randomInRange(
          (baseRewards.experience || 0) * appliedMultiplier * 0.9,
          (baseRewards.experience || 0) * appliedMultiplier * 1.1
        )
      )
    ),
    gold: Math.max(
      0,
      Math.floor(
        randomInRange(
          (baseRewards.gold || 0) * appliedMultiplier * 0.85,
          (baseRewards.gold || 0) * appliedMultiplier * 1.15
        )
      )
    ),
    items: baseRewards.items || [],
  };
}

/**
 * Termine une quête et distribue les récompenses
 */
function completeQuest(player, quest) {
  const now = new Date();
  const today = now.toDateString();

  // Vérifier si c'est le premier jour de quête aujourd'hui
  const lastQuestDate = player.quests.lastQuestTime
    ? new Date(player.quests.lastQuestTime).toDateString()
    : null;
  if (lastQuestDate !== today) {
    player.quests.completedToday = 0;
  }

  // Calculer les récompenses avec bonus éventuels
  let experienceGained = quest.rewards.experience || 0;
  let goldGained = quest.rewards.gold || 0;
  const itemsGained = [];

  // Bonus de faction
  if (player.faction) {
    experienceGained = Math.floor(experienceGained * 1.1); // +10% pour les membres de faction
  }

  // Bonus pour les quêtes répétées dans la journée (diminue)
  const dailyPenalty = Math.max(0.5, 1 - player.quests.completedToday * 0.1);
  experienceGained = Math.floor(experienceGained * dailyPenalty);
  goldGained = Math.floor(goldGained * dailyPenalty);

  // Distribuer l'expérience et vérifier le niveau
  const oldLevel = player.level;
  player.experience += experienceGained;

  // Vérifier la montée de niveau (formule linéaire : niveau * 100 exp requis)
  let currentLevel = player.level;
  let totalExp = player.experience;
  while (totalExp >= currentLevel * 100) {
    totalExp -= currentLevel * 100;
    currentLevel++;
  }

  const newLevel = currentLevel;
  const levelUp = newLevel > oldLevel;

  if (levelUp) {
    player.level = newLevel;
    player.experience = totalExp; // Mettre à jour l'expérience restante
    levelUpPlayer(player, oldLevel, newLevel);
  }

  // Distribuer l'or
  player.gold += goldGained;

  // Distribuer les objets
  if (quest.rewards.items && quest.rewards.items.length > 0) {
    for (const itemId of quest.rewards.items) {
      if (itemsData.items[itemId]) {
        if (!player.inventory[itemId]) {
          player.inventory[itemId] = 0;
        }
        player.inventory[itemId]++;
        itemsGained.push(itemsData.items[itemId].name);
      }
    }
  }

  // Mettre à jour les statistiques de quête
  const questCompleted = {
    id: quest.id,
    title: quest.title,
    completedAt: now.toISOString(),
    rewards: {
      experience: experienceGained,
      gold: goldGained,
      items: itemsGained,
    },
  };

  player.quests.completed.push(questCompleted);
  player.quests.completedToday++;
  player.quests.lastQuestTime = now.toISOString();
  player.quests.active = null;

  // Augmenter légèrement la réputation
  player.reputation += Math.floor(quest.rewards.experience / 10);

  return {
    experience: experienceGained,
    gold: goldGained,
    items: itemsGained,
    levelUp: levelUp,
    newLevel: newLevel,
  };
}

/**
 * Gère la montée de niveau du joueur
 */
function levelUpPlayer(player, oldLevel, newLevel) {
  const levelsGained = newLevel - oldLevel;

  // Augmenter les stats de base
  const healthGain = levelsGained * 10;
  const manaGain = levelsGained * 5;

  player.maxHealth += healthGain;
  player.maxMana += manaGain;

  // Soigner complètement le joueur lors de la montée de niveau
  player.health = player.maxHealth;
  player.mana = player.maxMana;

  // Améliorer légèrement les statistiques de combat
  player.stats.attack += levelsGained;
  player.stats.defense += levelsGained;
  player.stats.magicAttack += levelsGained;
  player.stats.magicDefense += levelsGained;

  console.log(
    `${player.name} est passé du niveau ${oldLevel} au niveau ${newLevel} !`
  );
}

/**
 * Génère un ID unique pour une quête
 */
function generateQuestId() {
  return `quest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Vérifie si une quête active est valide
 */
function isActiveQuestValid(quest) {
  if (!quest) return false;

  // Une quête valide doit avoir un startTime
  if (!quest.startTime) return false;

  // Vérifier si startTime est une date valide
  try {
    const startTime = new Date(quest.startTime);
    if (isNaN(startTime.getTime())) return false;
  } catch (e) {
    return false;
  }

  // Vérifier que la quête a les champs de base
  if (!quest.title || !quest.description || !quest.duration) return false;

  return true;
}

/**
 * Vérifie si un joueur peut prendre une nouvelle quête
 */
function canTakeNewQuest(player) {
  // Vérifier si la quête active est valide, sinon l'abandonner
  if (player.quests.active) {
    if (!isActiveQuestValid(player.quests.active)) {
      console.log(
        `🧹 Quête invalide détectée pour ${player.name}: abandonnée automatiquement`
      );
      player.quests.active = null;
    } else {
      return { canTake: false, reason: "Vous avez déjà une quête active." };
    }
  }

  const now = new Date();
  const today = now.toDateString();

  // Vérifier si c'est le premier jour de quête aujourd'hui
  const lastQuestDate = player.quests.lastQuestTime
    ? new Date(player.quests.lastQuestTime).toDateString()
    : null;
  if (lastQuestDate !== today) {
    player.quests.completedToday = 0;
  }

  // Vérifier la limite de 10 quêtes par jour
  const DAILY_QUEST_LIMIT = 10;
  if (player.quests.completedToday >= DAILY_QUEST_LIMIT) {
    return {
      canTake: false,
      reason: `Vous avez atteint la limite de ${DAILY_QUEST_LIMIT} quêtes par jour. Revenez demain pour en faire d'autres.`,
    };
  }

  return { canTake: true };
}

/**
 * Génère une quête spéciale basée sur la faction du joueur
 */
function generateFactionQuest(player) {
  if (!player.faction) {
    return null;
  }

  // Cette fonction pourrait être étendue pour créer des quêtes spécifiques aux factions
  const factionQuests = {
    ordre_royal: {
      title: "Patrouille Royale",
      description: "Effectuez une patrouille dans les terres du royaume.",
      duration: 20,
      rewards: { experience: 50, gold: 30, items: ["epee_longue"] },
    },
    guilde_ombres: {
      title: "Mission d'Espionnage",
      description: "Collectez des informations sur les activités suspectes.",
      duration: 25,
      rewards: { experience: 45, gold: 40, items: ["dague_empoisonnee"] },
    },
    cercle_druidique: {
      title: "Communion avec la Nature",
      description:
        "Méditez dans la forêt ancienne et communiquez avec les esprits.",
      duration: 30,
      rewards: { experience: 40, gold: 20, items: ["livre_sorts"] },
    },
    academie_arcanique: {
      title: "Recherche Arcanique",
      description: "Étudiez un phénomène magique mystérieux.",
      duration: 35,
      rewards: { experience: 60, gold: 25, items: ["baton_mage"] },
    },
  };

  const factionQuest = factionQuests[player.faction];
  if (!factionQuest) {
    return null;
  }

  return {
    ...factionQuest,
    id: generateQuestId(),
    requirements: { faction: player.faction },
    rewards: adjustRewardsForLevel(factionQuest.rewards, player.level),
  };
}

/**
 * Initialise les objectifs de progression sur une quête active.
 * Appelé quand une quête est assignée (startTime).
 */
function initQuestObjectives(quest) {
  if (!quest.objectives) return;
  quest.objectiveProgress = quest.objectives.map(obj => ({
    type: obj.type,
    required: obj.required,
    current: 0,
    description: obj.description,
    ...(obj.monsterKey ? { monsterKey: obj.monsterKey } : {}),
  }));
}

/**
 * Met à jour la progression des objectifs d'une quête active.
 * @param {Object} player - L'objet joueur (modifié en place)
 * @param {string} actionType - ex: 'win_combats'
 * @param {number} amount - Valeur à ajouter (défaut: 1)
 * @returns {boolean} - true si la quête vient d'être complétée
 */
function updateQuestProgress(player, actionType, amount = 1, context = {}) {
  if (!player.quests || !player.quests.active) return false;
  const quest = player.quests.active;

  // Compatibilité : quêtes créées avant le nouveau système (pas d'objectives)
  if (!quest.objectives) return false;

  // Initialiser objectiveProgress si absent
  if (!quest.objectiveProgress) {
    initQuestObjectives(quest);
  }

  let changed = false;
  for (const obj of quest.objectiveProgress) {
    let matches = false;

    if (obj.type === 'kill_monster') {
      // Requiert un type de monstre précis + victoire PvE
      matches = (actionType === 'win_pve' || actionType === 'kill_monster') &&
                context.monsterKey && obj.monsterKey === context.monsterKey;
    } else if (obj.type === 'win_pvp') {
      matches = actionType === 'win_pvp';
    } else if (obj.type === 'win_pve') {
      matches = actionType === 'win_pve' || actionType === 'win_combats';
    } else if (obj.type === 'kill_player_bandit') {
      // Cible dynamique : Voleur pour tout le monde sauf Voleurs, Chevalier pour les Voleurs
      const banditClass = (player.class === 'voleur') ? 'chevalier' : 'voleur';
      matches = actionType === 'kill_player_bandit' && context.loserClass === banditClass;
    } else if (obj.type === 'win_combats') {
      // Générique : compte tout (PvE ou PvP)
      matches = actionType === 'win_combats' || actionType === 'win_pve' || actionType === 'win_pvp';
    }

    if (matches && obj.current < obj.required) {
      obj.current = Math.min(obj.current + amount, obj.required);
      changed = true;
    }
  }

  if (changed) {
    const complete = isQuestComplete(quest);
    if (complete) {
      console.log(`✅ Quête complétée : ${quest.title} pour ${player.name}`);
    }
    return complete;
  }
  return false;
}

/**
 * Vérifie si tous les objectifs d'une quête sont atteints.
 */
function isQuestComplete(quest) {
  if (!quest) return false;

  // Ancienne logique (quêtes sans objectifs) : basée sur le temps
  if (!quest.objectives || quest.objectives.length === 0) {
    if (!quest.startTime || !quest.duration) return false;
    const elapsed = (Date.now() - new Date(quest.startTime)) / 60000;
    return elapsed >= quest.duration;
  }

  if (!quest.objectiveProgress) return false;
  return quest.objectiveProgress.every(obj => obj.current >= obj.required);
}

module.exports = {
  generateRandomQuest,
  initQuestObjectives,
  updateQuestProgress,
  isQuestComplete,
  completeQuest,
  canTakeNewQuest,
  generateFactionQuest,
  adjustRewardsForLevel,
  isActiveQuestValid,
};
