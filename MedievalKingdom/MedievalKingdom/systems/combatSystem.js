const { monsters } = require("./gameData.js");

// Constante pour la limite de tours
const MAX_TURNS = 10;

/**
 * Initie un combat entre deux entités
 */
function initiateCombat(player, opponent, type = "pve") {
  const combatId = generateCombatId();

  const combat = {
    id: combatId,
    type: type, // 'pve' ou 'pvp'
    player: createCombatant(player),
    opponent: createCombatant(opponent),
    currentTurn: player.id,
    turn: 1,
    playerTurns: 0, // Compteur de tours du joueur uniquement
    opponentTurns: 0, // Compteur de tours de l'adversaire
    maxTurns: MAX_TURNS, // Limite de tours par joueur
    lastAction: null,
    startTime: new Date().toISOString(),
  };

  return combat;
}

/**
 * Crée un combattant à partir d'un joueur ou monstre
 */
function createCombatant(entity) {
  // Copier les stats de base
  const stats = { ...entity.stats };

  // Si l'entité est un joueur et a un familier équipé, appliquer ses bonus de stats
  let familiarCombat = null;
  try {
    if (entity.equippedFamiliar) {
      const fs = require("fs");
      const path = require("path");
      const familiarsPath = path.join(
        __dirname,
        "..",
        "database",
        "familiars.json",
      );
      if (fs.existsSync(familiarsPath)) {
        const familiarsData = JSON.parse(
          fs.readFileSync(familiarsPath, "utf8"),
        );
        const fam = familiarsData?.familiars?.[entity.equippedFamiliar];
        if (fam) {
          // Appliquer les bonus de stats
          if (fam.bonuses && fam.bonuses.stats) {
            for (const [stat, value] of Object.entries(fam.bonuses.stats)) {
              stats[stat] = (stats[stat] || 0) + value;
            }
          }

          // Si le familier a des bonus de combat (dégâts / soin / chance), les exposer
          if (fam.bonuses && fam.bonuses.combat) {
            familiarCombat = fam.bonuses.combat;

            // Si un bonus de dégâts direct est défini, l'ajouter à l'attaque (valeur simple)
            if (familiarCombat.damage) {
              stats.attack = (stats.attack || 0) + familiarCombat.damage;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Erreur lors de l'application des bonus du familier:", err);
  }

  return {
    id: entity.id,
    monsterKey: entity.monsterKey || null,
    playerClass: entity.class || null,
    name: entity.name,
    health: entity.health,
    maxHealth: entity.maxHealth,
    mana: entity.mana || 0,
    maxMana: entity.maxMana || 0,
    stats: stats,
    abilities: entity.abilities || [],
    isDefending: false,
    defensesRemaining: 3, // Limite de 3 défenses par combat
    statusEffects: [],
    familiarCombat: familiarCombat,
  };
}

/**
 * Traite une action de combat
 */
function processCombatAction(combat, playerId, action) {
  if (combat.currentTurn !== playerId) {
    return { success: false, message: "Ce n'est pas votre tour !" };
  }

  const attacker =
    combat.player.id === playerId ? combat.player : combat.opponent;
  const defender =
    combat.player.id === playerId ? combat.opponent : combat.player;

  let actionResult;

  switch (action) {
    case "attack":
      actionResult = performAttack(attacker, defender);
      break;
    case "spell":
      actionResult = castSpell(attacker, defender);
      break;
    case "defend":
      actionResult = defend(attacker);
      break;
    case "item":
      // L'action item nécessite un paramètre supplémentaire (itemId)
      return {
        success: false,
        message: "Veuillez sélectionner un item à utiliser.",
        needsItemSelection: true,
      };
    default:
      return { success: false, message: "Action inconnue !" };
  }

  combat.lastAction = actionResult.message;

  // Vérifier si le combat est terminé
  if (defender.health <= 0) {
    return {
      success: true,
      message: actionResult.message,
      combatEnd: true,
      winner: attacker.id,
      combat: combat,
    };
  }

  // Passer au tour suivant
  switchTurn(combat);

  // Vérifier si la limite de tours du joueur est atteinte
  if (combat.playerTurns >= combat.maxTurns) {
    // Déterminer le gagnant en fonction des PV restants
    const playerHealthPercent =
      (combat.player.health / combat.player.maxHealth) * 100;
    const opponentHealthPercent =
      (combat.opponent.health / combat.opponent.maxHealth) * 100;

    let winner;
    let endMessage;

    if (playerHealthPercent > opponentHealthPercent) {
      winner = combat.player.id;
      endMessage = `⏱️ Limite de ${combat.maxTurns} tours atteinte ! ${
        combat.player.name
      } remporte le combat avec ${Math.round(
        playerHealthPercent,
      )}% de vie restante !`;
    } else if (opponentHealthPercent > playerHealthPercent) {
      winner = combat.opponent.id;
      endMessage = `⏱️ Limite de ${combat.maxTurns} tours atteinte ! ${
        combat.opponent.name
      } remporte le combat avec ${Math.round(
        opponentHealthPercent,
      )}% de vie restante !`;
    } else {
      winner = null; // Match nul
      endMessage = `⏱️ Limite de ${
        combat.maxTurns
      } tours atteinte ! Le combat se termine en **match nul** ! Les deux combattants ont ${Math.round(
        playerHealthPercent,
      )}% de vie.`;
    }

    return {
      success: true,
      message: combat.lastAction + "\n\n" + endMessage,
      combatEnd: true,
      winner: winner,
      isDraw: winner === null,
      combat: combat,
    };
  }

  // Si c'est un combat PvE et que c'est le tour du monstre
  if ((combat.type === "pve" || combat.type === "pvp_random") && combat.currentTurn === combat.opponent.id) {
    const aiAction = performAIAction(combat);
    combat.lastAction += "\n" + aiAction.message;

    // Vérifier si le joueur est KO
    if (combat.player.health <= 0) {
      return {
        success: true,
        message: combat.lastAction,
        combatEnd: true,
        winner: combat.opponent.id,
        combat: combat,
      };
    }

    // Repasser au tour du joueur
    switchTurn(combat);

    // Vérifier à nouveau la limite de tours du joueur après l'action du monstre
    if (combat.playerTurns >= combat.maxTurns) {
      const playerHealthPercent =
        (combat.player.health / combat.player.maxHealth) * 100;
      const opponentHealthPercent =
        (combat.opponent.health / combat.opponent.maxHealth) * 100;

      let winner;
      let endMessage;

      if (playerHealthPercent > opponentHealthPercent) {
        winner = combat.player.id;
        endMessage = `⏱️ Limite de ${combat.maxTurns} tours atteinte ! ${
          combat.player.name
        } remporte le combat avec ${Math.round(
          playerHealthPercent,
        )}% de vie restante !`;
      } else if (opponentHealthPercent > playerHealthPercent) {
        winner = combat.opponent.id;
        endMessage = `⏱️ Limite de ${combat.maxTurns} tours atteinte ! ${
          combat.opponent.name
        } remporte le combat avec ${Math.round(
          opponentHealthPercent,
        )}% de vie restante !`;
      } else {
        winner = null;
        endMessage = `⏱️ Limite de ${combat.maxTurns} tours atteinte ! Le combat se termine en **match nul** !`;
      }

      return {
        success: true,
        message: combat.lastAction + "\n\n" + endMessage,
        combatEnd: true,
        winner: winner,
        isDraw: winner === null,
        combat: combat,
      };
    }
  }

  return {
    success: true,
    message: actionResult.message,
    combatEnd: false,
    combat: combat,
  };
}

/**
 * Effectue une attaque physique
 */
function performAttack(attacker, defender) {
  // Vérifier si le défenseur bloque l'attaque
  if (defender.isDefending) {
    defender.isDefending = false;
    return {
      damage: 0,
      message: `🛡️ ${defender.name} bloque complètement l'attaque de ${attacker.name} !`,
      isBlocked: true,
    };
  }

  // Vérifier la parade basée sur la vitesse (1 vitesse = 1% parade, max 40%)
  const defenderSpeed = defender.stats.speed || 0;
  const parryChance = Math.min(defenderSpeed / 100, 0.4); // Maximum 40%
  const isParried = Math.random() < parryChance;

  if (isParried) {
    return {
      damage: 0,
      message: `⚡ ${defender.name} pare l'attaque de ${
        attacker.name
      } avec agilité ! (${Math.round(parryChance * 100)}% de parade)`,
      isParried: true,
    };
  }

  // Calculer les dégâts de base
  let damage = attacker.stats.attack;

  // Ajouter une variation aléatoire (-20% à +20%)
  const variation = 0.8 + Math.random() * 0.4;
  damage = Math.floor(damage * variation);

  // Appliquer la défense normale
  const defense = defender.stats.defense;
  damage = Math.max(1, damage - Math.floor(defense / 2));

  // Chance de coup critique (5% de base)
  const critChance = 0.05;
  const isCrit = Math.random() < critChance;
  if (isCrit) {
    damage = Math.floor(damage * 1.5);
  }

  // Appliquer les dégâts
  defender.health = Math.max(0, defender.health - damage);

  // Effets du familier (pour les sorts aussi)
  try {
    if (attacker.familiarCombat) {
      const fam = attacker.familiarCombat;
      const chance = fam.chance || 1;
      if (Math.random() < chance) {
        if (fam.damage) {
          const extra = Math.floor(fam.damage);
          defender.health = Math.max(0, defender.health - extra);
          damage += extra;
        }

        if (fam.healAmount) {
          const heal = Math.floor(fam.healAmount);
          attacker.health = Math.min(
            attacker.maxHealth,
            attacker.health + heal,
          );
        }
      }
    }
  } catch (err) {
    console.error(
      "Erreur lors de l'application des effets du familier sur sort:",
      err,
    );
  }

  // Effets du familier (dégâts additionnels ou soin)
  try {
    if (attacker.familiarCombat) {
      const fam = attacker.familiarCombat;
      const chance = fam.chance || 1;
      if (Math.random() < chance) {
        // Dégâts additionnels
        if (fam.damage) {
          const extra = Math.floor(fam.damage);
          defender.health = Math.max(0, defender.health - extra);
          damage += extra;
        }

        // Soin pour l'attaquant
        if (fam.healAmount) {
          const heal = Math.floor(fam.healAmount);
          attacker.health = Math.min(
            attacker.maxHealth,
            attacker.health + heal,
          );
        }
      }
    }
  } catch (err) {
    console.error(
      "Erreur lors de l'application des effets du familier en attaque:",
      err,
    );
  }

  const critText = isCrit ? " **CRITIQUE !**" : "";
  return {
    damage: damage,
    message: `⚔️ ${attacker.name} attaque ${defender.name} et inflige **${damage}** dégâts${critText}`,
    isCritical: isCrit,
  };
}

/**
 * Lance un sort
 */
function castSpell(attacker, defender) {
  if (attacker.mana < 10) {
    return {
      damage: 0,
      message: `🔮 ${attacker.name} n'a pas assez de mana pour lancer un sort !`,
    };
  }

  // Consommer le mana
  attacker.mana = Math.max(0, attacker.mana - 10);

  // Vérifier si le défenseur bloque l'attaque
  if (defender.isDefending) {
    defender.isDefending = false;
    return {
      damage: 0,
      message: `🛡️ ${defender.name} bloque complètement le sort de ${attacker.name} !`,
      isBlocked: true,
    };
  }

  // Vérifier la parade basée sur la vitesse (1 vitesse = 1% parade, max 40%)
  const defenderSpeed = defender.stats.speed || 0;
  const parryChance = Math.min(defenderSpeed / 100, 0.4); // Maximum 40%
  const isParried = Math.random() < parryChance;

  if (isParried) {
    return {
      damage: 0,
      message: `⚡ ${defender.name} esquive le sort de ${
        attacker.name
      } avec agilité ! (${Math.round(parryChance * 100)}% de parade)`,
      isParried: true,
    };
  }

  // Calculer les dégâts magiques (augmentés de 50%)
  let damage = Math.floor(attacker.stats.magicAttack * 1.5);

  // Variation aléatoire
  const variation = 0.8 + Math.random() * 0.4;
  damage = Math.floor(damage * variation);

  // Appliquer la défense magique (réduite pour plus de dégâts)
  const magicDefense = defender.stats.magicDefense;
  damage = Math.max(1, damage - Math.floor(magicDefense / 3));

  // Chance d'effet spécial (25% au lieu de 20%)
  const specialEffect = Math.random() < 0.25;
  let effectText = "";

  if (specialEffect) {
    // Différents effets selon le type de sort
    const effects = ["brûlure", "gel", "étourdissement"];
    const effect = effects[Math.floor(Math.random() * effects.length)];
    effectText = ` et inflige un effet de **${effect}**`;
    damage = Math.floor(damage * 1.3); // Bonus augmenté de 1.2 à 1.3
  }

  // Appliquer les dégâts
  defender.health = Math.max(0, defender.health - damage);

  return {
    damage: damage,
    message: `🔮 ${attacker.name} lance un sort sur ${defender.name} et inflige **${damage}** dégâts magiques${effectText}`,
    hasSpecialEffect: specialEffect,
  };
}

/**
 * Action de défense
 */
function defend(attacker) {
  // Vérifier si le joueur a encore des défenses disponibles
  if (attacker.defensesRemaining <= 0) {
    return {
      damage: 0,
      message: `❌ ${attacker.name} ne peut plus se défendre ! (Limite atteinte)`,
      failed: true,
    };
  }

  // Activer la défense
  attacker.isDefending = true;
  attacker.defensesRemaining--;

  return {
    damage: 0,
    message: `🛡️ ${attacker.name} prend une position défensive ! La prochaine attaque sera **bloquée complètement**. (${attacker.defensesRemaining} défense(s) restante(s))`,
  };
}

/**
 * Utilise un item en combat
 */
function useItemInCombat(combat, playerId, itemId, playerData) {
  const attacker =
    combat.player.id === playerId ? combat.player : combat.opponent;
  const defender =
    combat.player.id === playerId ? combat.opponent : combat.player;

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

  // Vérifier si l'item existe
  const itemData = itemsData.items[itemId];
  if (!itemData) {
    return {
      success: false,
      message: `❌ Item inconnu : ${itemId}`,
    };
  }

  // Vérifier si le joueur possède cet item
  if (
    !playerData.inventory ||
    !playerData.inventory[itemId] ||
    playerData.inventory[itemId] <= 0
  ) {
    return {
      success: false,
      message: `❌ Vous ne possédez pas cet item !`,
    };
  }

  let resultMessage = "";
  let itemConsumed = false;

  // Appliquer l'effet de l'item selon son type
  if (itemData.effect) {
    switch (itemData.effect.type) {
      case "heal":
        // Potion de soin
        const healAmount = itemData.effect.amount;
        const actualHeal = Math.min(
          healAmount,
          attacker.maxHealth - attacker.health,
        );
        attacker.health = Math.min(
          attacker.maxHealth,
          attacker.health + healAmount,
        );
        resultMessage = `💚 ${attacker.name} utilise **${itemData.name}** et récupère **${actualHeal}** PV !`;
        itemConsumed = true;
        break;

      case "mana_restore":
        // Potion de mana
        const manaAmount = itemData.effect.amount;
        const actualMana = Math.min(
          manaAmount,
          attacker.maxMana - attacker.mana,
        );
        attacker.mana = Math.min(attacker.maxMana, attacker.mana + manaAmount);
        resultMessage = `💙 ${attacker.name} utilise **${itemData.name}** et récupère **${actualMana}** mana !`;
        itemConsumed = true;
        break;

      case "damage":
        // Item offensif (bombe, poison, etc.)
        const damage = itemData.effect.amount;
        defender.health = Math.max(0, defender.health - damage);
        resultMessage = `💥 ${attacker.name} utilise **${itemData.name}** sur ${defender.name} et inflige **${damage}** dégâts !`;
        itemConsumed = true;
        break;

      case "buff_attack":
        // Buff d'attaque temporaire
        const attackBoost = itemData.effect.amount;
        attacker.stats.attack += attackBoost;
        resultMessage = `⚔️ ${attacker.name} utilise **${itemData.name}** ! Attaque augmentée de **${attackBoost}** pour ce combat !`;
        itemConsumed = true;
        break;

      case "buff_defense":
        // Buff de défense temporaire
        const defenseBoost = itemData.effect.amount;
        attacker.stats.defense += defenseBoost;
        resultMessage = `🛡️ ${attacker.name} utilise **${itemData.name}** ! Défense augmentée de **${defenseBoost}** pour ce combat !`;
        itemConsumed = true;
        break;

      case "stat_boost":
        // Boost de stat permanent (ne devrait pas être utilisable en combat normalement)
        resultMessage = `❌ ${itemData.name} ne peut pas être utilisé en combat !`;
        break;

      default:
        resultMessage = `❌ Cet item ne peut pas être utilisé en combat !`;
    }
  } else {
    resultMessage = `❌ Cet item ne peut pas être utilisé en combat !`;
  }

  return {
    success: itemConsumed,
    message: resultMessage,
    itemConsumed: itemConsumed,
    itemId: itemId,
  };
}

/**
 * Action de l'IA pour les monstres
 */
function performAIAction(combat) {
  const monster = combat.opponent;
  const player = combat.player;

  // Logique simple d'IA
  let action;

  // Se défendre seulement si faible en vie ET qu'il reste des défenses
  if (
    monster.health < monster.maxHealth * 0.25 &&
    monster.defensesRemaining > 0 &&
    Math.random() < 0.3
  ) {
    action = "defend";
  } else if (monster.mana >= 10 && Math.random() < 0.3) {
    // Utiliser un sort parfois
    action = "spell";
  } else {
    // Attaquer le plus souvent
    action = "attack";
  }

  switch (action) {
    case "attack":
      return performAttack(monster, player);
    case "spell":
      return castSpell(monster, player);
    case "defend":
      return defend(monster);
  }
}

/**
 * Change le tour de combat
 */
function switchTurn(combat) {
  // Incrémenter le compteur du joueur qui vient de jouer
  if (combat.currentTurn === combat.player.id) {
    combat.playerTurns++;
  } else {
    combat.opponentTurns++;
  }

  // Changer le tour
  combat.currentTurn =
    combat.currentTurn === combat.player.id
      ? combat.opponent.id
      : combat.player.id;
  combat.turn++;
}

/**
 * Construit les poids pour la sélection pondérée des monstres
 */
function buildMonsterWeights(availableMonsters, playerLevel) {
  return availableMonsters.map(([key, monster]) => {
    // Calculer un poids basé sur la proximité du niveau
    const midLevel = (monster.levelRange[0] + monster.levelRange[1]) / 2;
    const levelDiff = Math.abs(playerLevel - midLevel);
    const weight = Math.max(1, 10 - levelDiff);

    return { key, monster, weight };
  });
}

/**
 * Sélectionne un monstre de manière pondérée
 */
function pickWeightedMonster(weightedMonsters) {
  const totalWeight = weightedMonsters.reduce((sum, m) => sum + m.weight, 0);
  let random = Math.random() * totalWeight;

  for (const { monster, weight } of weightedMonsters) {
    random -= weight;
    if (random <= 0) {
      return monster;
    }
  }

  // Fallback sur le premier monstre
  return weightedMonsters[0].monster;
}

/**
 * Génère un monstre aléatoire adapté au niveau du joueur
 */
function generateMonster(playerLevel) {
  // Filtrer les monstres appropriés au niveau du joueur
  const availableMonsters = Object.entries(monsters).filter(
    ([key, monster]) => {
      return (
        playerLevel >= monster.levelRange[0] &&
        playerLevel <= monster.levelRange[1] + 2
      );
    },
  );

  if (availableMonsters.length === 0) {
    // Fallback sur le gobelin si aucun monstre approprié
    availableMonsters.push(["gobelin", monsters.gobelin]);
  }

  // Sélection pondérée des monstres pour éviter la répétition
  const weightedSelection = buildMonsterWeights(availableMonsters, playerLevel);
  const selectedMonster = pickWeightedMonster(weightedSelection);
  // Trouver la clé correspondante dans availableMonsters
  const selectedKey = availableMonsters.find(([k, m]) => m === selectedMonster)?.[0] || 'gobelin';
  const monsterTemplate = { ...selectedMonster, key: selectedKey };

  // Créer une instance du monstre avec des stats ajustées
  const levelMultiplier = 1 + (playerLevel - 1) * 0.1;

  const monster = {
    id: `monster_${Date.now()}`,
    monsterKey: monsterTemplate.key,
    name: monsterTemplate.name,
    emoji: monsterTemplate.emoji,
    health: Math.floor(monsterTemplate.baseHealth * levelMultiplier),
    maxHealth: Math.floor(monsterTemplate.baseHealth * levelMultiplier),
    mana: monsterTemplate.baseMana || 0,
    maxMana: monsterTemplate.baseMana || 0,
    stats: {},
    abilities: [...monsterTemplate.abilities],
    loot: monsterTemplate.loot,
  };

  // Ajuster les stats
  for (const [stat, value] of Object.entries(monsterTemplate.stats)) {
    monster.stats[stat] = Math.floor(value * levelMultiplier);
  }

  return monster;
}

/**
 * Calcule les récompenses de combat
 */
function calculateCombatRewards(winner, loser, combatType) {
  const baseRewards = {
    experience: 15,
    gold: 5,
  };

  if (combatType === "pve") {
    // Récompenses basées sur la difficulté du monstre vaincu
    const monster = loser;
    if (monster.loot) {
      const goldRange = monster.loot.gold;
      const expRange = monster.loot.experience;

      // Récupérer le level de difficulté du monstre (1-5)
      const difficultyLevel = monster.difficultyLevel || 1;

      // Calculer les récompenses basées sur la plage de loot
      let experience =
        Math.floor(Math.random() * (expRange[1] - expRange[0] + 1)) +
        expRange[0];
      let gold =
        Math.floor(Math.random() * (goldRange[1] - goldRange[0] + 1)) +
        goldRange[0];

      // Appliquer un bonus basé sur la difficulté du monstre
      const difficultyBonus = 1 + (difficultyLevel - 1) * 0.15;
      experience = Math.floor(experience * difficultyBonus);
      gold = Math.floor(gold * difficultyBonus);

      // Si le vainqueur est un joueur (id non préfixé par 'monster_'), appliquer +50% d'or
      try {
        const winnerId = winner && winner.id ? String(winner.id) : "";
        if (winnerId && !winnerId.startsWith("monster_")) {
          gold = Math.floor(gold * 1.5);
        }
      } catch (err) {
        console.error(
          "Erreur lors de l'application du bonus d'or de victoire:",
          err,
        );
      }

      return {
        experience: experience,
        gold: gold,
        items: monster.loot.items || [],
        difficultyLevel: difficultyLevel, // Inclure le level pour affichage
      };
    }
  } else {
    // PvP - récompenses basées sur le niveau de l'adversaire
    const levelDifference = loser.level - winner.level;
    const multiplier = Math.max(0.5, 1 + levelDifference * 0.1);

    // PvP : appliquer aussi le bonus de victoire de 50% si le vainqueur est un joueur
    let pvpGold = Math.floor(baseRewards.gold * multiplier);
    try {
      const winnerId = winner && winner.id ? String(winner.id) : "";
      if (winnerId && !winnerId.startsWith("monster_")) {
        pvpGold = Math.floor(pvpGold * 1.5);
      }
    } catch (err) {
      console.error("Erreur lors de l'application du bonus d'or PvP:", err);
    }

    return {
      experience: Math.floor(baseRewards.experience * multiplier),
      gold: pvpGold,
      items: [],
    };
  }

  return baseRewards;
}

/**
 * Génère un ID unique pour un combat
 */
function generateCombatId() {
  return `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Applique les récompenses de combat au joueur
 */
function applyCombatRewards(player, rewards) {
  player.experience += rewards.experience;
  player.gold += rewards.gold;
  player.reputation += Math.floor(rewards.experience / 5);

  // Ajouter les objets à l'inventaire
  if (rewards.items && rewards.items.length > 0) {
    for (const itemId of rewards.items) {
      if (!player.inventory[itemId]) {
        player.inventory[itemId] = 0;
      }
      player.inventory[itemId]++;
    }
  }

  // Mettre à jour les statistiques de combat
  player.combat.wins++;
  player.combat.totalDamageDealt += rewards.damageDealt || 0;

  // Vérifier la montée de niveau (formule linéaire : niveau * 100 exp requis)
  let currentLevel = player.level;
  let totalExp = player.experience;
  while (totalExp >= currentLevel * 100) {
    totalExp -= currentLevel * 100;
    currentLevel++;
  }

  if (currentLevel > player.level) {
    const levelGained = currentLevel - player.level;
    player.level = currentLevel;
    player.experience = totalExp; // Mettre à jour l'expérience restante
    player.maxHealth += 10 * levelGained;
    player.maxMana += 5 * levelGained;
    player.health = player.maxHealth; // Soigner complètement
    player.mana = player.maxMana;

    return { levelUp: true, newLevel: currentLevel };
  }

  return { levelUp: false };
}

module.exports = {
  initiateCombat,
  processCombatAction,
  generateMonster,
  calculateCombatRewards,
  applyCombatRewards,
  performAttack,
  castSpell,
  defend,
  useItemInCombat,
  performAIAction,
};
