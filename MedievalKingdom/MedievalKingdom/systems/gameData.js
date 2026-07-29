// Configuration des classes de personnages
const classes = {
  chevalier: {
    name: "Chevalier",
    emoji: "⚔️",
    description:
      "Noble guerrier du royaume, maître de l'épée et du bouclier. Excellent en combat rapproché.",
    baseHealth: 120,
    baseMana: 30,
    baseStats: {
      attack: 18,
      defense: 15,
      magicAttack: 5,
      magicDefense: 8,
      speed: 8,
    },
    abilities: ["Charge héroïque", "Défense absolue", "Cri de guerre"],
    preferredWeapons: ["épée", "bouclier", "armure"],
  },

  mage: {
    name: "Mage",
    emoji: "🔮",
    description:
      "Érudit des arts arcaniques, capable de manipuler les forces magiques avec une grande puissance.",
    baseHealth: 90,
    baseMana: 100,
    baseStats: {
      attack: 6,
      defense: 10,
      magicAttack: 22,
      magicDefense: 16,
      speed: 10,
    },
    abilities: ["Boule de feu", "Bouclier magique", "Téléportation"],
    preferredWeapons: ["bâton", "grimoire", "robe"],
  },

  voleur: {
    name: "Voleur",
    emoji: "🗡️",
    description:
      "Maître de la discrétion et de la vitesse, expert en attaques surprises et en esquive.",
    baseHealth: 90,
    baseMana: 50,
    baseStats: {
      attack: 16,
      defense: 10,
      magicAttack: 8,
      magicDefense: 7,
      speed: 18,
    },
    abilities: ["Attaque sournoise", "Esquive", "Poison"],
    preferredWeapons: ["dague", "arc", "armure_cuir"],
  },

  barde: {
    name: "Barde",
    emoji: "🎵",
    description:
      "Artiste et aventurier, utilise la musique et le charisme pour inspirer ses alliés.",
    baseHealth: 100,
    baseMana: 80,
    baseStats: {
      attack: 12,
      defense: 12,
      magicAttack: 14,
      magicDefense: 12,
      speed: 12,
    },
    abilities: ["Chanson de courage", "Charme", "Inspiration"],
    preferredWeapons: ["luth", "épée_courte", "vêtements"],
  },
};

// Configuration des factions
const factions = {
  ordre_royal: {
    name: "Ordre Royal",
    emoji: "👑",
    description:
      "Serviteurs loyaux de la couronne, dévoués à la justice et à la protection du royaume.",
    goals:
      "Maintenir l'ordre, protéger les innocents et servir la couronne avec honneur.",
    powerLevel: 8,
    joinCost: {
      gold: 5000,
      reputation: 50,
    },
    requirements: {
      minLevel: 1,
      classes: ["chevalier"],
      reputation: 0,
    },
    bonuses: [
      "+10% d'or des quêtes officielles",
      "Accès aux équipements royaux",
      "Réputation bonus avec les PNJ nobles",
    ],
    rivals: ["guilde_ombres"],
  },

  guilde_ombres: {
    name: "Guilde des Ombres",
    emoji: "🌙",
    description:
      "Organisation secrète d'espions et d'assassins, opérant dans l'ombre pour leurs propres objectifs.",
    goals:
      "Collecter des informations, éliminer les cibles et contrôler le marché noir.",
    powerLevel: 9,
    joinCost: {
      gold: 8000,
      reputation: -50,
    },
    requirements: {
      minLevel: 3,
      classes: ["voleur"],
      reputation: -10,
    },
    bonuses: [
      "+15% de chance de coup critique",
      "Accès au marché noir",
      "Missions d'espionnage exclusives",
    ],
    rivals: ["ordre_royal"],
  },

  cercle_druidique: {
    name: "Cercle Druidique",
    emoji: "🌿",
    description:
      "Gardiens de la nature et des anciens savoirs, vivant en harmonie avec les forces naturelles.",
    goals:
      "Protéger la nature, préserver l'équilibre et étudier les anciens mystères.",
    powerLevel: 6,
    joinCost: {
      gold: 2000,
      reputation: 30,
    },
    requirements: {
      minLevel: 2,
      classes: ["mage", "barde"],
      reputation: 10,
    },
    bonuses: [
      "Régénération de mana accélérée",
      "Communication avec les animaux",
      "Résistance aux poisons naturels",
    ],
    rivals: [],
  },

  academie_arcanique: {
    name: "Académie Arcanique",
    emoji: "🏛️",
    description:
      "Institution d'apprentissage des arts magiques, rassemblant les plus grands érudits du royaume.",
    goals:
      "Étudier la magie, former de nouveaux mages et préserver les connaissances anciennes.",
    powerLevel: 7,
    joinCost: {
      gold: 6000,
      reputation: 40,
    },
    requirements: {
      minLevel: 5,
      classes: ["mage"],
      reputation: 25,
    },
    bonuses: [
      "+20% d'expérience magique",
      "Accès à la bibliothèque arcanique",
      "Sorts exclusifs de haut niveau",
    ],
    rivals: [],
  },
};

// Configuration des monstres pour le combat PvE
const monsters = {
  gobelin: {
    name: "Gobelin",
    emoji: "👺",
    baseHealth: 40,
    baseMana: 20,
    stats: {
      attack: 8,
      defense: 4,
      magicAttack: 3,
      magicDefense: 2,
      speed: 12,
    },
    abilities: ["Attaque sauvage"],
    loot: {
      gold: [3, 8],
      experience: [8, 15],
      items: ["potion_soin"],
    },
    levelRange: [1, 3],
    difficultyLevel: 1, // Très facile
  },

  loup: {
    name: "Loup",
    emoji: "🐺",
    baseHealth: 60,
    baseMana: 0,
    stats: {
      attack: 12,
      defense: 6,
      magicAttack: 0,
      magicDefense: 3,
      speed: 16,
    },
    abilities: ["Morsure", "Hurlement"],
    loot: {
      gold: [5, 12],
      experience: [12, 20],
      items: ["potion_soin"],
    },
    levelRange: [2, 5],
    difficultyLevel: 2, // Facile
  },

  squelette: {
    name: "Squelette",
    emoji: "💀",
    baseHealth: 50,
    baseMana: 30,
    stats: {
      attack: 10,
      defense: 8,
      magicAttack: 6,
      magicDefense: 10,
      speed: 6,
    },
    abilities: ["Frappe d'os", "Régénération"],
    loot: {
      gold: [8, 15],
      experience: [15, 25],
      items: ["livre_sorts", "potion_soin"],
    },
    levelRange: [3, 7],
    difficultyLevel: 3, // Moyen
  },

  orc: {
    name: "Orc",
    emoji: "👹",
    baseHealth: 100,
    baseMana: 10,
    stats: {
      attack: 16,
      defense: 12,
      magicAttack: 2,
      magicDefense: 4,
      speed: 8,
    },
    abilities: ["Charge brutale", "Rage"],
    loot: {
      gold: [12, 25],
      experience: [20, 35],
      items: ["epee_longue", "potion_soin"],
    },
    levelRange: [4, 8],
    difficultyLevel: 4, // Difficile
  },

  dragon: {
    name: "Jeune Dragon",
    emoji: "🐉",
    baseHealth: 200,
    baseMana: 80,
    stats: {
      attack: 22,
      defense: 18,
      magicAttack: 18,
      magicDefense: 15,
      speed: 12,
    },
    abilities: ["Souffle de feu", "Vol", "Magie draconique"],
    loot: {
      gold: [50, 100],
      experience: [75, 150],
      items: ["baton_mage", "livre_sorts", "potion_soin"],
    },
    levelRange: [8, 15],
    difficultyLevel: 5, // Très difficile / Boss
  },
  bandit: {
    name: "Bandit",
    emoji: "🗡️",
    baseHealth: 70,
    baseMana: 10,
    stats: {
      attack: 14,
      defense: 8,
      magicAttack: 2,
      magicDefense: 3,
      speed: 14,
    },
    abilities: ["Attaque sournoise", "Esquive"],
    loot: {
      gold: [10, 20],
      experience: [15, 28],
      items: ["potion_soin"],
    },
    levelRange: [1, 10],
    difficultyLevel: 2,
  },
};

// Événements spéciaux du royaume
const events = {
  festival_automne: {
    name: "Festival d'Automne",
    description: "Le royaume célèbre la saison des récoltes",
    duration: 7, // jours
    bonuses: {
      questExperience: 1.5,
      questGold: 1.3,
    },
  },

  invasion_orcs: {
    name: "Invasion d'Orcs",
    description: "Des hordes d'orcs menacent les frontières",
    duration: 3,
    bonuses: {
      combatExperience: 2.0,
      orcSpawnRate: 3.0,
    },
  },

  marche_mysterieux: {
    name: "Marché Mystérieux",
    description: "Un marchand ambulant propose des objets rares",
    duration: 1,
    bonuses: {
      rareItemChance: 2.0,
      shopDiscount: 0.7,
    },
  },
};

module.exports = {
  classes,
  factions,
  monsters,
  events,
};
