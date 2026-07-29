const fs = require("fs");
const path = require("path");

// Pool complet d'items disponibles
const ALL_SHOP_ITEMS = [
  // ========== POTIONS & CONSOMMABLES ==========
  // Potions de soin
  {
    id: "potion_soin",
    name: "Potion de soin",
    type: "objet",
    price: 10,
    description: "Rend 50 PV.",
    rarity: "common",
  },
  {
    id: "grande_potion_soin",
    name: "Grande potion de soin",
    type: "objet",
    price: 25,
    description: "Rend 100 PV.",
    rarity: "uncommon",
  },
  {
    id: "potion_soin_supreme",
    name: "Potion de soin suprême",
    type: "objet",
    price: 60,
    description: "Rend 200 PV.",
    rarity: "rare",
  },
  {
    id: "elixir_vie",
    name: "Élixir de vie",
    type: "objet",
    price: 120,
    description: "Restaure tous les PV.",
    rarity: "legendary",
  },

  // Potions de mana
  {
    id: "potion_mana",
    name: "Potion de mana",
    type: "objet",
    price: 15,
    description: "Restaure 30 points de mana.",
    rarity: "common",
  },
  {
    id: "grande_potion_mana",
    name: "Grande potion de mana",
    type: "objet",
    price: 35,
    description: "Restaure 75 points de mana.",
    rarity: "uncommon",
  },
  {
    id: "elixir_mana",
    name: "Élixir de mana",
    type: "objet",
    price: 80,
    description: "Restaure tous les points de mana.",
    rarity: "rare",
  },

  // Potions de buff
  {
    id: "potion_force",
    name: "Potion de force",
    type: "objet",
    price: 40,
    description: "+10 d'attaque pendant 1 heure.",
    rarity: "uncommon",
  },
  {
    id: "potion_defense",
    name: "Potion de défense",
    type: "objet",
    price: 40,
    description: "+10 de défense pendant 1 heure.",
    rarity: "uncommon",
  },
  {
    id: "potion_vitesse",
    name: "Potion de vitesse",
    type: "objet",
    price: 35,
    description: "+20% de vitesse pendant 1 heure.",
    rarity: "uncommon",
  },
  {
    id: "potion_chance",
    name: "Potion de chance",
    type: "objet",
    price: 50,
    description: "Double les récompenses pendant 30 minutes.",
    rarity: "rare",
  },
  {
    id: "elixir_titan",
    name: "Élixir du titan",
    type: "objet",
    price: 150,
    description: "+25 attaque, +25 défense, +50 PV max pendant 2 heures.",
    rarity: "legendary",
  },

  // Nourriture
  {
    id: "pain",
    name: "Pain",
    type: "objet",
    price: 5,
    description: "Restaure 20 PV.",
    rarity: "common",
  },
  {
    id: "viande_rotie",
    name: "Viande rôtie",
    type: "objet",
    price: 12,
    description: "Restaure 40 PV et +2 attaque pendant 30 min.",
    rarity: "common",
  },
  {
    id: "festin_royal",
    name: "Festin royal",
    type: "objet",
    price: 45,
    description: "Restaure 100 PV et tous les buffs pendant 1 heure.",
    rarity: "rare",
  },

  // ========== ARMES - ÉPÉES ==========
  {
    id: "epee_bois",
    name: "Épée en bois",
    type: "arme",
    price: 20,
    description: "+3 d'attaque",
    rarity: "common",
  },
  {
    id: "epee_fer",
    name: "Épée en fer",
    type: "arme",
    price: 50,
    description: "+5 d'attaque",
    rarity: "common",
  },
  {
    id: "epee_acier",
    name: "Épée en acier",
    type: "arme",
    price: 100,
    description: "+10 d'attaque",
    rarity: "uncommon",
  },
  {
    id: "epee_argent",
    name: "Épée en argent",
    type: "arme",
    price: 150,
    description: "+15 d'attaque, efficace contre les morts-vivants",
    rarity: "rare",
  },
  {
    id: "epee_mithril",
    name: "Épée en mithril",
    type: "arme",
    price: 220,
    description: "+18 d'attaque, +3 de vitesse",
    rarity: "rare",
  },
  {
    id: "epee_legendaire",
    name: "Épée légendaire",
    type: "arme",
    price: 300,
    description: "+20 d'attaque, +5 de défense",
    rarity: "legendary",
  },
  {
    id: "excalibur",
    name: "Excalibur",
    type: "arme",
    price: 600,
    description: "+35 d'attaque, +10 de défense, +50 PV max",
    rarity: "mythic",
  },

  // ========== ARMES - HACHES ==========
  {
    id: "hache_bucheron",
    name: "Hache de bûcheron",
    type: "arme",
    price: 35,
    description: "+4 d'attaque",
    rarity: "common",
  },
  {
    id: "hache_guerre",
    name: "Hache de guerre",
    type: "arme",
    price: 90,
    description: "+12 d'attaque, -2 de vitesse",
    rarity: "uncommon",
  },
  {
    id: "hache_double",
    name: "Hache double",
    type: "arme",
    price: 180,
    description: "+20 d'attaque, -3 de vitesse, +5 de critique",
    rarity: "rare",
  },
  {
    id: "hache_berserker",
    name: "Hache du berserker",
    type: "arme",
    price: 350,
    description: "+30 d'attaque, +10% de vol de vie",
    rarity: "legendary",
  },

  // ========== ARMES - ARCS ==========
  {
    id: "arc_simple",
    name: "Arc simple",
    type: "arme",
    price: 40,
    description: "+4 d'attaque, +2 de vitesse",
    rarity: "common",
  },
  {
    id: "arc_long",
    name: "Arc long",
    type: "arme",
    price: 85,
    description: "+9 d'attaque, +4 de vitesse",
    rarity: "uncommon",
  },
  {
    id: "arc_composite",
    name: "Arc composite",
    type: "arme",
    price: 160,
    description: "+16 d'attaque, +6 de vitesse",
    rarity: "rare",
  },
  {
    id: "arc_elfique",
    name: "Arc elfique",
    type: "arme",
    price: 280,
    description: "+22 d'attaque, +10 de vitesse, +5 de précision",
    rarity: "legendary",
  },

  // ========== ARMES - BÂTONS MAGIQUES ==========
  {
    id: "baton_apprenti",
    name: "Bâton d'apprenti",
    type: "arme",
    price: 45,
    description: "+5 d'attaque magique",
    rarity: "common",
  },
  {
    id: "baton_mage",
    name: "Bâton de mage",
    type: "arme",
    price: 95,
    description: "+11 d'attaque magique, +20 mana max",
    rarity: "uncommon",
  },
  {
    id: "baton_archimage",
    name: "Bâton d'archimage",
    type: "arme",
    price: 190,
    description: "+18 d'attaque magique, +50 mana max",
    rarity: "rare",
  },
  {
    id: "baton_ancien",
    name: "Bâton des anciens",
    type: "arme",
    price: 320,
    description: "+25 d'attaque magique, +100 mana max, régénération mana",
    rarity: "legendary",
  },
  {
    id: "baton_merlin",
    name: "Bâton de Merlin",
    type: "arme",
    price: 550,
    description:
      "+40 d'attaque magique, +200 mana max, tous les sorts -20% coût",
    rarity: "mythic",
  },

  // ========== ARMES - DAGUES ==========
  {
    id: "dague_simple",
    name: "Dague simple",
    type: "arme",
    price: 30,
    description: "+3 d'attaque, +5 de vitesse",
    rarity: "common",
  },
  {
    id: "dague_empoisonnee",
    name: "Dague empoisonnée",
    type: "arme",
    price: 110,
    description: "+10 d'attaque, +8 de vitesse, poison sur attaque",
    rarity: "uncommon",
  },
  {
    id: "dague_ombre",
    name: "Dague de l'ombre",
    type: "arme",
    price: 200,
    description: "+17 d'attaque, +15 de vitesse, +20% de critique",
    rarity: "rare",
  },
  {
    id: "dague_assassin",
    name: "Dague de l'assassin",
    type: "arme",
    price: 340,
    description: "+24 d'attaque, +20 de vitesse, +35% de critique",
    rarity: "legendary",
  },

  // ========== ARMURES - CASQUES ==========
  {
    id: "casque_cuir",
    name: "Casque en cuir",
    type: "armure",
    price: 25,
    description: "+2 de défense",
    rarity: "common",
  },
  {
    id: "casque_fer",
    name: "Casque en fer",
    type: "armure",
    price: 55,
    description: "+4 de défense",
    rarity: "common",
  },
  {
    id: "casque_acier",
    name: "Casque en acier",
    type: "armure",
    price: 95,
    description: "+8 de défense",
    rarity: "uncommon",
  },
  {
    id: "casque_chevalier",
    name: "Casque de chevalier",
    type: "armure",
    price: 170,
    description: "+12 de défense, +10 PV max",
    rarity: "rare",
  },
  {
    id: "casque_royal",
    name: "Casque royal",
    type: "armure",
    price: 290,
    description: "+18 de défense, +30 PV max, +5 charisme",
    rarity: "legendary",
  },

  // ========== ARMURES - PLASTRONS ==========
  {
    id: "armure_cuir",
    name: "Armure en cuir",
    type: "armure",
    price: 40,
    description: "+3 de défense",
    rarity: "common",
  },
  {
    id: "armure_maille",
    name: "Cotte de mailles",
    type: "armure",
    price: 80,
    description: "+7 de défense",
    rarity: "uncommon",
  },
  {
    id: "armure_plates",
    name: "Armure de plates",
    type: "armure",
    price: 140,
    description: "+12 de défense, +15 PV max",
    rarity: "rare",
  },
  {
    id: "armure_dragon",
    name: "Armure de dragon",
    type: "armure",
    price: 250,
    description: "+15 de défense, +10 PV max",
    rarity: "legendary",
  },
  {
    id: "armure_titan",
    name: "Armure de titan",
    type: "armure",
    price: 450,
    description: "+25 de défense, +50 PV max, +10 force",
    rarity: "mythic",
  },

  // ========== ARMURES - BOUCLIERS ==========
  {
    id: "bouclier_bois",
    name: "Bouclier en bois",
    type: "armure",
    price: 20,
    description: "+2 de défense",
    rarity: "common",
  },
  {
    id: "bouclier_fer",
    name: "Bouclier en fer",
    type: "armure",
    price: 60,
    description: "+5 de défense",
    rarity: "common",
  },
  {
    id: "bouclier_acier",
    name: "Bouclier en acier",
    type: "armure",
    price: 110,
    description: "+9 de défense, +5 PV max",
    rarity: "uncommon",
  },
  {
    id: "bouclier_royal",
    name: "Bouclier royal",
    type: "armure",
    price: 185,
    description: "+14 de défense, +15 PV max",
    rarity: "rare",
  },
  {
    id: "bouclier_divin",
    name: "Bouclier divin",
    type: "armure",
    price: 310,
    description: "+20 de défense, +30 PV max, 10% de blocage",
    rarity: "legendary",
  },

  // ========== ARMURES - BOTTES ==========
  {
    id: "bottes_cuir",
    name: "Bottes en cuir",
    type: "armure",
    price: 18,
    description: "+1 de défense, +2 de vitesse",
    rarity: "common",
  },
  {
    id: "bottes_fer",
    name: "Bottes en fer",
    type: "armure",
    price: 50,
    description: "+3 de défense, +3 de vitesse",
    rarity: "common",
  },
  {
    id: "bottes_ailees",
    name: "Bottes ailées",
    type: "armure",
    price: 130,
    description: "+5 de défense, +10 de vitesse",
    rarity: "rare",
  },
  {
    id: "bottes_hermes",
    name: "Bottes d'Hermès",
    type: "armure",
    price: 260,
    description: "+8 de défense, +20 de vitesse, +5% d'esquive",
    rarity: "legendary",
  },

  // ========== ARMURES - CAPES ==========
  {
    id: "cape_voyageur",
    name: "Cape de voyageur",
    type: "armure",
    price: 35,
    description: "+2 de défense, +1 de charisme",
    rarity: "common",
  },
  {
    id: "cape_noble",
    name: "Cape de noble",
    type: "armure",
    price: 90,
    description: "+5 de défense, +5 de charisme",
    rarity: "uncommon",
  },
  {
    id: "cape_invisible",
    name: "Cape d'invisibilité",
    type: "armure",
    price: 400,
    description: "Permet d'éviter 25% des attaques ennemies",
    rarity: "mythic",
  },

  // ========== TITRES - COMMUNS ==========
  {
    id: "titre_aventurier",
    name: "Titre : Aventurier",
    type: "titre",
    price: 30,
    description: 'Affiche le titre "Aventurier" sur votre profil.',
    rarity: "common",
  },
  {
    id: "titre_guerrier",
    name: "Titre : Guerrier",
    type: "titre",
    price: 35,
    description: 'Affiche le titre "Guerrier" sur votre profil.',
    rarity: "common",
  },

  // ========== TITRES - PEU COMMUNS ==========
  {
    id: "titre_heros",
    name: "Titre : Héros",
    type: "titre",
    price: 50,
    description: 'Affiche le titre "Héros" sur votre profil.',
    rarity: "uncommon",
  },
  {
    id: "titre_chevalier",
    name: "Titre : Chevalier",
    type: "titre",
    price: 60,
    description: 'Affiche le titre "Chevalier" sur votre profil.',
    rarity: "uncommon",
  },
  {
    id: "titre_mage",
    name: "Titre : Mage",
    type: "titre",
    price: 65,
    description: 'Affiche le titre "Mage" sur votre profil.',
    rarity: "uncommon",
  },

  // ========== TITRES - RARES ==========
  {
    id: "titre_champion",
    name: "Titre : Champion",
    type: "titre",
    price: 100,
    description: 'Affiche le titre "Champion" sur votre profil.',
    rarity: "rare",
  },
  {
    id: "titre_seigneur",
    name: "Titre : Seigneur",
    type: "titre",
    price: 120,
    description: 'Affiche le titre "Seigneur" sur votre profil.',
    rarity: "rare",
  },
  {
    id: "titre_archimage",
    name: "Titre : Archimage",
    type: "titre",
    price: 130,
    description: 'Affiche le titre "Archimage" sur votre profil.',
    rarity: "rare",
  },
  {
    id: "titre_tueur_dragons",
    name: "Titre : Tueur de dragons",
    type: "titre",
    price: 150,
    description: 'Affiche le titre "Tueur de dragons" sur votre profil.',
    rarity: "rare",
  },

  // ========== TITRES - LÉGENDAIRES ==========
  {
    id: "titre_legende",
    name: "Titre : Légende",
    type: "titre",
    price: 200,
    description: 'Affiche le titre "Légende" sur votre profil.',
    rarity: "legendary",
  },
  {
    id: "titre_roi",
    name: "Titre : Roi",
    type: "titre",
    price: 250,
    description: 'Affiche le titre "Roi" sur votre profil.',
    rarity: "legendary",
  },
  {
    id: "titre_empereur",
    name: "Titre : Empereur",
    type: "titre",
    price: 300,
    description: 'Affiche le titre "Empereur" sur votre profil.',
    rarity: "legendary",
  },

  // ========== TITRES - MYTHIQUES ==========
  {
    id: "titre_dieu_guerre",
    name: "Titre : Dieu de la guerre",
    type: "titre",
    price: 500,
    description: 'Affiche le titre "Dieu de la guerre" sur votre profil.',
    rarity: "mythic",
  },
  {
    id: "titre_immortel",
    name: "Titre : Immortel",
    type: "titre",
    price: 600,
    description: 'Affiche le titre "Immortel" sur votre profil.',
    rarity: "mythic",
  },

  // ========== FAMILIERS - PEU COMMUNS ==========
  {
    id: "familier_chat",
    name: "Familier : Chat",
    type: "familier",
    price: 40,
    description: "Un chat agile vous accompagne. +3 de vitesse",
    rarity: "uncommon",
  },
  {
    id: "familier_corbeau",
    name: "Familier : Corbeau",
    type: "familier",
    price: 50,
    description: "Un corbeau mystique. +5% de chance de trouver des objets",
    rarity: "uncommon",
  },
  {
    id: "familier_loup",
    name: "Familier : Loup",
    type: "familier",
    price: 100,
    description: "Un loup fidèle vous accompagne. +2 d'attaque",
    rarity: "uncommon",
  },

  // ========== FAMILIERS - RARES ==========
  {
    id: "familier_faucon",
    name: "Familier : Faucon",
    type: "familier",
    price: 140,
    description: "Un faucon royal. +4 d'attaque, +5 de vitesse",
    rarity: "rare",
  },
  {
    id: "familier_ours",
    name: "Familier : Ours",
    type: "familier",
    price: 160,
    description: "Un ours puissant. +6 d'attaque, +5 de défense",
    rarity: "rare",
  },
  {
    id: "familier_tigre",
    name: "Familier : Tigre",
    type: "familier",
    price: 180,
    description: "Un tigre féroce. +7 d'attaque, +8 de vitesse",
    rarity: "rare",
  },

  // ========== FAMILIERS - LÉGENDAIRES ==========
  {
    id: "familier_dragon",
    name: "Familier : Dragonnet",
    type: "familier",
    price: 300,
    description: "Un petit dragon vous accompagne. +5 d'attaque, +20 PV max",
    rarity: "legendary",
  },
  {
    id: "familier_licorne",
    name: "Familier : Licorne",
    type: "familier",
    price: 320,
    description:
      "Une licorne magique. +8 d'attaque magique, +30 PV max, régénération",
    rarity: "legendary",
  },
  {
    id: "familier_griffon",
    name: "Familier : Griffon",
    type: "familier",
    price: 350,
    description: "Un griffon majestueux. +10 d'attaque, +10 de vitesse",
    rarity: "legendary",
  },

  // ========== FAMILIERS - MYTHIQUES ==========
  {
    id: "familier_phoenix",
    name: "Familier : Phénix",
    type: "familier",
    price: 500,
    description:
      "Un phénix majestueux. +10 d'attaque, régénération automatique",
    rarity: "mythic",
  },
  {
    id: "familier_hydre",
    name: "Familier : Hydre",
    type: "familier",
    price: 550,
    description:
      "Une hydre à trois têtes. +15 d'attaque, +50 PV max, régénération",
    rarity: "mythic",
  },
  {
    id: "familier_leviathan",
    name: "Familier : Léviathan",
    type: "familier",
    price: 650,
    description:
      "Un léviathan ancien. +20 d'attaque, +20 de défense, +100 PV max",
    rarity: "mythic",
  },

  // ========== OBJETS SPÉCIAUX ==========
  {
    id: "pierre_resurrection",
    name: "Pierre de résurrection",
    type: "objet",
    price: 150,
    description: "Permet de ressusciter instantanément après une défaite.",
    rarity: "rare",
  },
  {
    id: "parchemin_teleportation",
    name: "Parchemin de téléportation",
    type: "objet",
    price: 75,
    description: "Permet de fuir n'importe quel combat.",
    rarity: "uncommon",
  },
  {
    id: "pierre_affutage",
    name: "Pierre d'affûtage",
    type: "objet",
    price: 30,
    description: "+5 d'attaque pendant 1 heure.",
    rarity: "common",
  },
  {
    id: "amulette_protection",
    name: "Amulette de protection",
    type: "objet",
    price: 120,
    description: "+10 de défense permanent.",
    rarity: "rare",
  },
  {
    id: "anneau_force",
    name: "Anneau de force",
    type: "objet",
    price: 140,
    description: "+12 d'attaque permanent.",
    rarity: "rare",
  },
  {
    id: "collier_vie",
    name: "Collier de vie",
    type: "objet",
    price: 160,
    description: "+50 PV max permanent.",
    rarity: "rare",
  },
  {
    id: "talisman_chance",
    name: "Talisman de chance",
    type: "objet",
    price: 200,
    description: "+15% de chance de loot et de critique.",
    rarity: "legendary",
  },
  {
    id: "orbe_puissance",
    name: "Orbe de puissance",
    type: "objet",
    price: 280,
    description: "+15 d'attaque, +15 de défense permanent.",
    rarity: "legendary",
  },
  {
    id: "cristal_eternite",
    name: "Cristal d'éternité",
    type: "objet",
    price: 500,
    description: "Régénération automatique de PV et mana.",
    rarity: "mythic",
  },
  {
    id: "coeur_dragon",
    name: "Cœur de dragon",
    type: "objet",
    price: 450,
    description: "+30 d'attaque, +100 PV max, résistance au feu.",
    rarity: "mythic",
  },
];

// Items spéciaux pour certains jours
const SPECIAL_ITEMS = {
  // Dimanche - Items légendaires
  0: [
    {
      id: "coffre_tresor",
      name: "Coffre au trésor",
      type: "objet",
      price: 200,
      description: "Contient entre 50 et 200 gemmes aléatoires !",
      rarity: "legendary",
    },
  ],
  // Mercredi - Items à prix réduit
  3: [
    {
      id: "pack_potions",
      name: "Pack de potions",
      type: "objet",
      price: 30, // Prix réduit
      description: "3 potions de soin + 2 potions de mana",
      rarity: "rare",
      originalPrice: 50,
    },
  ],
  // Vendredi - Items exclusifs
  5: [
    {
      id: "cape_invisible",
      name: "Cape d'invisibilité",
      type: "armure",
      price: 400,
      description: "Permet d'éviter 25% des attaques ennemies",
      rarity: "mythic",
    },
  ],
};

const DAILY_SHOP_FILE = path.join(__dirname, "../database/dailyShop.json");

// Fonction pour obtenir la date du jour (format YYYY-MM-DD)
function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

// Fonction pour générer la boutique du jour
function generateDailyShop() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Dimanche, 1 = Lundi, etc.

  // Commencer avec les items spéciaux du jour
  let dailyItems = [];
  if (SPECIAL_ITEMS[dayOfWeek]) {
    dailyItems = [...SPECIAL_ITEMS[dayOfWeek]];
  }

  // Sélectionner des items aléatoires par rareté
  const commonItems = ALL_SHOP_ITEMS.filter((item) => item.rarity === "common");
  const uncommonItems = ALL_SHOP_ITEMS.filter(
    (item) => item.rarity === "uncommon"
  );
  const rareItems = ALL_SHOP_ITEMS.filter((item) => item.rarity === "rare");
  const legendaryItems = ALL_SHOP_ITEMS.filter(
    (item) => item.rarity === "legendary"
  );
  const mythicItems = ALL_SHOP_ITEMS.filter((item) => item.rarity === "mythic");

  // Ajouter des items selon la distribution de rareté
  // 3-4 items communs
  for (let i = 0; i < 3 + Math.floor(Math.random() * 2); i++) {
    const randomItem =
      commonItems[Math.floor(Math.random() * commonItems.length)];
    if (!dailyItems.find((item) => item.id === randomItem.id)) {
      dailyItems.push(randomItem);
    }
  }

  // 2-3 items peu communs
  for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
    const randomItem =
      uncommonItems[Math.floor(Math.random() * uncommonItems.length)];
    if (!dailyItems.find((item) => item.id === randomItem.id)) {
      dailyItems.push(randomItem);
    }
  }

  // 1-2 items rares
  for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) {
    const randomItem = rareItems[Math.floor(Math.random() * rareItems.length)];
    if (!dailyItems.find((item) => item.id === randomItem.id)) {
      dailyItems.push(randomItem);
    }
  }

  // 0-1 item légendaire (30% de chance)
  if (Math.random() < 0.3) {
    const randomItem =
      legendaryItems[Math.floor(Math.random() * legendaryItems.length)];
    if (!dailyItems.find((item) => item.id === randomItem.id)) {
      dailyItems.push(randomItem);
    }
  }

  // 0-1 item mythique (10% de chance, seulement le weekend)
  if ((dayOfWeek === 0 || dayOfWeek === 6) && Math.random() < 0.1) {
    const randomItem =
      mythicItems[Math.floor(Math.random() * mythicItems.length)];
    if (!dailyItems.find((item) => item.id === randomItem.id)) {
      dailyItems.push(randomItem);
    }
  }

  return {
    date: getTodayString(),
    dayOfWeek: dayOfWeek,
    items: dailyItems,
    generatedAt: new Date().toISOString(),
  };
}

// Fonction pour obtenir la boutique du jour
function getDailyShop() {
  const today = getTodayString();

  // Vérifier si le fichier existe
  if (!fs.existsSync(DAILY_SHOP_FILE)) {
    const newShop = generateDailyShop();
    saveDailyShop(newShop);
    return newShop;
  }

  // Lire la boutique existante
  try {
    const shopData = JSON.parse(fs.readFileSync(DAILY_SHOP_FILE, "utf8"));

    // Vérifier si c'est toujours le même jour
    if (shopData.date === today) {
      return shopData;
    }

    // Générer une nouvelle boutique pour aujourd'hui
    const newShop = generateDailyShop();
    saveDailyShop(newShop);
    return newShop;
  } catch (error) {
    console.error(
      "Erreur lors de la lecture de la boutique quotidienne:",
      error
    );
    const newShop = generateDailyShop();
    saveDailyShop(newShop);
    return newShop;
  }
}

// Fonction pour sauvegarder la boutique du jour
function saveDailyShop(shopData) {
  try {
    fs.writeFileSync(DAILY_SHOP_FILE, JSON.stringify(shopData, null, 2));
  } catch (error) {
    console.error(
      "Erreur lors de la sauvegarde de la boutique quotidienne:",
      error
    );
  }
}

// Fonction pour obtenir l'emoji de rareté
function getRarityEmoji(rarity) {
  const emojis = {
    common: "⚪",
    uncommon: "🟢",
    rare: "🔵",
    legendary: "🟡",
    mythic: "🔴",
  };
  return emojis[rarity] || "⚪";
}

// Fonction pour obtenir le nom du jour en français
function getDayName(dayOfWeek) {
  const days = [
    "Dimanche",
    "Lundi",
    "Mardi",
    "Mercredi",
    "Jeudi",
    "Vendredi",
    "Samedi",
  ];
  return days[dayOfWeek];
}

module.exports = {
  getDailyShop,
  generateDailyShop,
  getRarityEmoji,
  getDayName,
  ALL_SHOP_ITEMS,
};
