const { SlashCommandBuilder } = require("discord.js");
const { getPlayer, updatePlayer } = require("../utils/database.js");
const { createEmbed } = require("../utils/embeds.js");
const { ALL_SHOP_ITEMS } = require("../utils/dailyShop.js");
const fs = require("fs");
const path = require("path");

// Charger les items de la boutique d'or
const goldShopData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../database/goldShop.json"), "utf8"),
);

// Fonction pour trouver un item dans toutes les sources
function findItem(itemId, itemType) {
  // D'abord chercher dans ALL_SHOP_ITEMS (boutique à gemmes)
  let item = ALL_SHOP_ITEMS.find(
    (i) =>
      i.id === itemId &&
      (i.type === itemType ||
        (itemType === "arme" && i.type === "arme") ||
        (itemType === "armure" && i.type === "armure")),
  );

  if (item) {
    return { item, source: "gemShop" };
  }

  // Ensuite chercher dans goldShop (boutique d'or)
  if (goldShopData.equipment && goldShopData.equipment[itemId]) {
    const goldItem = goldShopData.equipment[itemId];

    // Vérifier le type
    const isWeapon = goldItem.type === "weapon";
    const isArmor = goldItem.type === "armor" || goldItem.type === "shield";

    if (
      (itemType === "arme" && isWeapon) ||
      (itemType === "armure" && isArmor)
    ) {
      // Convertir le format goldShop vers le format attendu
      return {
        item: {
          id: itemId,
          name: goldItem.name,
          type: itemType,
          description: goldItem.description,
          rarity: goldItem.rarity,
          stats: goldItem.stats || {},
          emoji: goldItem.emoji,
        },
        source: "goldShop",
      };
    }
  }

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("equiper")
    .setDescription("Équiper ou déséquiper des armes et armures")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("arme")
        .setDescription("Équiper une arme")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID de l'arme à équiper (ex: epee_fer)")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("armure")
        .setDescription("Équiper une armure")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID de l'armure à équiper (ex: plastron_fer)")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("titre")
        .setDescription("Équiper un titre")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("ID du titre à équiper (ex: chevalier)")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("voir").setDescription("Voir votre équipement actuel"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("retirer")
        .setDescription("Retirer un équipement")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Type d'équipement à retirer")
            .setRequired(true)
            .addChoices(
              { name: "⚔️ Arme", value: "arme" },
              { name: "🛡️ Armure", value: "armure" },
            ),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "arme":
          await this.equipWeapon(interaction);
          break;
        case "armure":
          await this.equipArmor(interaction);
          break;
        case "titre":
          await this.equipTitle(interaction);
          break;
        case "voir":
          await this.showEquipment(interaction);
          break;
        case "retirer":
          await this.unequip(interaction);
          break;
      }
    } catch (error) {
      console.error("Erreur dans la commande equiper:", error);
      await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Une erreur est survenue lors de l'exécution de la commande.",
          ),
        ],
        ephemeral: true,
      });
    }
  },

  async equipWeapon(interaction) {
    const userId = interaction.user.id;
    const itemId = interaction.options.getString("id").toLowerCase();
    const player = getPlayer(userId);

    if (!player) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez d'abord créer un personnage avec `/personnage creer`.",
          ),
        ],
        ephemeral: true,
      });
    }

    // Trouver l'item dans toutes les sources
    const itemResult = findItem(itemId, "arme");

    if (!itemResult) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Arme introuvable. Vérifiez l'ID de l'arme avec `/inventaire voir` ou `/boutique-or voir equipements`.",
          ),
        ],
        ephemeral: true,
      });
    }

    const item = itemResult.item;

    // Vérifier si le joueur possède l'item
    if (!player.inventory[item.id] || player.inventory[item.id] <= 0) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous ne possédez pas cette arme. Achetez-la d'abord avec `/shop`.",
          ),
        ],
        ephemeral: true,
      });
    }

    // Initialiser l'équipement si nécessaire
    if (!player.equipment) {
      player.equipment = {
        weapon: null,
        armor: {
          head: null,
          chest: null,
          legs: null,
          feet: null,
          hands: null,
          shield: null,
        },
      };
    }

    // Déséquiper l'arme actuelle si elle existe
    if (player.equipment.weapon) {
      const oldWeaponResult = findItem(player.equipment.weapon, "arme");
      if (oldWeaponResult) {
        this.removeItemStats(player, oldWeaponResult.item);
      }
    }

    // Équiper la nouvelle arme
    player.equipment.weapon = item.id;
    this.applyItemStats(player, item);

    updatePlayer(userId, player);

    const embed = createEmbed("success", `⚔️ Arme équipée !`)
      .setDescription(`Vous avez équipé : **${item.name}**`)
      .addFields(
        { name: "📊 Description", value: item.description, inline: false },
        {
          name: "💪 Attaque",
          value: player.stats.attack.toString(),
          inline: true,
        },
        {
          name: "🛡️ Défense",
          value: player.stats.defense.toString(),
          inline: true,
        },
      );

    await interaction.reply({ embeds: [embed] });
  },

  async equipArmor(interaction) {
    const userId = interaction.user.id;
    const itemId = interaction.options.getString("id").toLowerCase();
    const player = getPlayer(userId);

    if (!player) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez d'abord créer un personnage avec `/personnage creer`.",
          ),
        ],
        ephemeral: true,
      });
    }

    // Trouver l'item dans toutes les sources
    const itemResult = findItem(itemId, "armure");

    if (!itemResult) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Armure introuvable. Vérifiez l'ID de l'armure avec `/inventaire voir` ou `/boutique-or voir equipements`.",
          ),
        ],
        ephemeral: true,
      });
    }

    const item = itemResult.item;

    // Vérifier si le joueur possède l'item
    if (!player.inventory[item.id] || player.inventory[item.id] <= 0) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous ne possédez pas cette armure. Achetez-la d'abord avec `/shop`.",
          ),
        ],
        ephemeral: true,
      });
    }

    // Initialiser l'équipement si nécessaire
    if (!player.equipment) {
      player.equipment = {
        weapon: null,
        armor: {
          head: null,
          chest: null,
          legs: null,
          feet: null,
          hands: null,
          shield: null,
        },
      };
    }

    // Initialiser la structure armor si elle n'existe que comme string
    if (
      typeof player.equipment.armor === "string" ||
      player.equipment.armor === null
    ) {
      player.equipment.armor = {
        head: null,
        chest: null,
        legs: null,
        feet: null,
        hands: null,
        shield: null,
      };
    }

    // Déterminer le type d'armure et le slot approprié
    let armorSlot = "chest"; // défaut
    const itemName = item.name.toLowerCase();

    if (itemName.includes("casque") || itemName.includes("helm")) {
      armorSlot = "head";
    } else if (itemName.includes("bouclier") || itemName.includes("shield")) {
      armorSlot = "shield";
    } else if (itemName.includes("jambe") || itemName.includes("leg")) {
      armorSlot = "legs";
    } else if (
      itemName.includes("botte") ||
      itemName.includes("boot") ||
      itemName.includes("pied")
    ) {
      armorSlot = "feet";
    } else if (
      itemName.includes("gant") ||
      itemName.includes("hand") ||
      itemName.includes("bracelet")
    ) {
      armorSlot = "hands";
    }
    // sinon c'est un plastron (chest) par défaut

    // Déséquiper l'ancienne armure du même slot si elle existe
    if (player.equipment.armor[armorSlot]) {
      const oldArmorResult = findItem(
        player.equipment.armor[armorSlot],
        "armure",
      );
      if (oldArmorResult) {
        this.removeItemStats(player, oldArmorResult.item);
      }
    }

    // Équiper la nouvelle armure
    player.equipment.armor[armorSlot] = item.id;
    this.applyItemStats(player, item);

    updatePlayer(userId, player);

    const embed = createEmbed("success", `🛡️ Armure équipée !`)
      .setDescription(`Vous avez équipé : **${item.name}**`)
      .addFields(
        { name: "📊 Description", value: item.description, inline: false },
        {
          name: "💪 Attaque",
          value: player.stats.attack.toString(),
          inline: true,
        },
        {
          name: "🛡️ Défense",
          value: player.stats.defense.toString(),
          inline: true,
        },
        {
          name: "❤️ PV Max",
          value: player.maxHealth.toString(),
          inline: true,
        },
      );

    await interaction.reply({ embeds: [embed] });
  },

  async equipTitle(interaction) {
    const userId = interaction.user.id;
    const itemId = interaction.options.getString("id").toLowerCase();
    const player = getPlayer(userId);

    if (!player) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez d'abord créer un personnage avec `/personnage creer`.",
          ),
        ],
        ephemeral: true,
      });
    }

    // Trouver l'item dans le shop par ID
    const item = ALL_SHOP_ITEMS.find(
      (i) => i.type === "titre" && i.id === itemId,
    );

    if (!item) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Titre introuvable. Vérifiez l'ID du titre avec `/items type:titre`.",
          ),
        ],
        ephemeral: true,
      });
    }

    // Initialiser les titres si nécessaire
    if (!player.titres) {
      player.titres = [];
    }

    // Vérifier si le joueur possède le titre
    if (!player.titres.includes(item.id)) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous ne possédez pas ce titre. Achetez-le d'abord avec `/boutique`.",
          ),
        ],
        ephemeral: true,
      });
    }

    // Initialiser la structure titles pour l'équipement
    if (!player.titles) {
      player.titles = {
        owned: [],
        active: null,
      };
    }

    // Ajouter le titre aux titres possédés s'il n'y est pas déjà
    if (!player.titles.owned.includes(item.id)) {
      player.titles.owned.push(item.id);
    }

    // Équiper le titre
    player.titles.active = item.id;

    updatePlayer(userId, player);

    const embed = createEmbed("success", `🏆 Titre équipé !`)
      .setDescription(`Vous portez maintenant le titre : **${item.name}**`)
      .addFields({
        name: "📊 Description",
        value: item.description,
        inline: false,
      });

    await interaction.reply({ embeds: [embed] });
  },

  async showEquipment(interaction) {
    const userId = interaction.user.id;
    const player = getPlayer(userId);

    if (!player) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez d'abord créer un personnage avec `/personnage creer`.",
          ),
        ],
        ephemeral: true,
      });
    }

    const embed = createEmbed("info", `⚔️ Équipement de ${player.name}`);

    // Arme
    if (player.equipment && player.equipment.weapon) {
      const weaponResult = findItem(player.equipment.weapon, "arme");
      if (weaponResult) {
        embed.addFields({
          name: "⚔️ Arme équipée",
          value: `**${weaponResult.item.name}**\n${weaponResult.item.description}`,
          inline: false,
        });
      }
    } else {
      embed.addFields({
        name: "⚔️ Arme équipée",
        value: "*Aucune arme équipée*",
        inline: false,
      });
    }

    // Armure - nouveaux slots multiples
    if (
      player.equipment &&
      typeof player.equipment.armor === "object" &&
      player.equipment.armor !== null
    ) {
      const armorSlots = [
        { key: "head", emoji: "👤", label: "Casque" },
        { key: "chest", emoji: "🛡️", label: "Plastron" },
        { key: "legs", emoji: "👖", label: "Jambes" },
        { key: "feet", emoji: "👞", label: "Bottes" },
        { key: "hands", emoji: "🤝", label: "Gants" },
        { key: "shield", emoji: "🛡️", label: "Bouclier" },
      ];

      let armorDescription = "";
      for (const slot of armorSlots) {
        if (player.equipment.armor[slot.key]) {
          const armorResult = findItem(
            player.equipment.armor[slot.key],
            "armure",
          );
          if (armorResult) {
            armorDescription += `${slot.emoji} **${slot.label}**: ${armorResult.item.name}\n`;
          }
        } else {
          armorDescription += `${slot.emoji} **${slot.label}**: *Aucun*\n`;
        }
      }

      embed.addFields({
        name: "🛡️ Armure équipée",
        value: armorDescription || "*Aucune armure équipée*",
        inline: false,
      });
    } else if (player.equipment && typeof player.equipment.armor === "string") {
      // Ancienne structure, afficher l'ancienne armure
      const armorResult = findItem(player.equipment.armor, "armure");
      if (armorResult) {
        embed.addFields({
          name: "🛡️ Armure équipée",
          value: `**${armorResult.item.name}**\n${armorResult.item.description}`,
          inline: false,
        });
      }
    } else {
      embed.addFields({
        name: "🛡️ Armure équipée",
        value: "*Aucune armure équipée*",
        inline: false,
      });
    }

    // Titre
    if (player.titles && player.titles.active) {
      const title = ALL_SHOP_ITEMS.find((i) => i.id === player.titles.active);
      if (title) {
        embed.addFields({
          name: "🏆 Titre actif",
          value: `**${title.name}**\n${title.description}`,
          inline: false,
        });
      }
    } else {
      embed.addFields({
        name: "🏆 Titre actif",
        value: "*Aucun titre équipé*",
        inline: false,
      });
    }

    // Statistiques actuelles
    embed.addFields(
      {
        name: "💪 Attaque",
        value: player.stats.attack.toString(),
        inline: true,
      },
      {
        name: "🛡️ Défense",
        value: player.stats.defense.toString(),
        inline: true,
      },
      {
        name: "❤️ PV Max",
        value: player.maxHealth.toString(),
        inline: true,
      },
    );

    await interaction.reply({ embeds: [embed] });
  },

  async unequip(interaction) {
    const userId = interaction.user.id;
    const type = interaction.options.getString("type");
    const player = getPlayer(userId);

    if (!player) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous devez d'abord créer un personnage avec `/personnage creer`.",
          ),
        ],
        ephemeral: true,
      });
    }

    if (!player.equipment) {
      return await interaction.reply({
        embeds: [
          createEmbed("error", "Vous n'avez aucun équipement à retirer."),
        ],
        ephemeral: true,
      });
    }

    let itemName = "";

    if (type === "arme") {
      if (!player.equipment.weapon) {
        return await interaction.reply({
          embeds: [createEmbed("error", "Vous n'avez pas d'arme équipée.")],
          ephemeral: true,
        });
      }

      const weaponResult = findItem(player.equipment.weapon, "arme");
      if (weaponResult) {
        itemName = weaponResult.item.name;
        this.removeItemStats(player, weaponResult.item);
      }
      player.equipment.weapon = null;
    } else if (type === "armure") {
      // Nouvelle structure avec slots multiples
      if (
        typeof player.equipment.armor === "object" &&
        player.equipment.armor !== null
      ) {
        // Vérifier s'il y a au least une armure équipée
        const slots = Object.values(player.equipment.armor);
        if (slots.every((slot) => !slot)) {
          return await interaction.reply({
            embeds: [createEmbed("error", "Vous n'avez pas d'armure équipée.")],
            ephemeral: true,
          });
        }

        // Retirer toutes les armures équipées
        let removedItems = [];
        for (const [slotKey, slotValue] of Object.entries(
          player.equipment.armor,
        )) {
          if (slotValue) {
            const armorResult = findItem(slotValue, "armure");
            if (armorResult) {
              removedItems.push(armorResult.item.name);
              this.removeItemStats(player, armorResult.item);
            }
            player.equipment.armor[slotKey] = null;
          }
        }
        itemName = removedItems.join(", ");
      } else if (
        typeof player.equipment.armor === "string" &&
        player.equipment.armor
      ) {
        // Ancienne structure
        const armorResult = findItem(player.equipment.armor, "armure");
        if (armorResult) {
          itemName = armorResult.item.name;
          this.removeItemStats(player, armorResult.item);
        }
        player.equipment.armor = null;
      } else {
        return await interaction.reply({
          embeds: [createEmbed("error", "Vous n'avez pas d'armure équipée.")],
          ephemeral: true,
        });
      }
    }

    updatePlayer(userId, player);

    const embed = createEmbed("success", `✅ Équipement retiré !`)
      .setDescription(`Vous avez retiré : **${itemName}**`)
      .addFields(
        {
          name: "💪 Attaque",
          value: player.stats.attack.toString(),
          inline: true,
        },
        {
          name: "🛡️ Défense",
          value: player.stats.defense.toString(),
          inline: true,
        },
      );

    await interaction.reply({ embeds: [embed] });
  },

  // Fonction pour appliquer les stats d'un item
  applyItemStats(player, item) {
    // Si l'item a un objet stats (format goldShop)
    if (item.stats) {
      // Vérifier si l'item a été amélioré
      const upgradeLevel = player.itemUpgrades?.[item.id]?.level || 0;

      // Fonction helper pour calculer le bonus
      const getStatBonus = (baseStat, level) => {
        return Math.floor(baseStat * 0.1 * level);
      };

      if (item.stats.attack) {
        const bonus = getStatBonus(item.stats.attack, upgradeLevel);
        player.stats.attack += item.stats.attack + bonus;
      }
      if (item.stats.defense) {
        const bonus = getStatBonus(item.stats.defense, upgradeLevel);
        player.stats.defense += item.stats.defense + bonus;
      }
      if (item.stats.health) {
        const bonus = getStatBonus(item.stats.health, upgradeLevel);
        const totalHealth = item.stats.health + bonus;
        player.maxHealth += totalHealth;
        player.health += totalHealth;
      }
      if (item.stats.speed) {
        if (!player.stats.speed) player.stats.speed = 0;
        const bonus = getStatBonus(item.stats.speed, upgradeLevel);
        player.stats.speed += item.stats.speed + bonus;
      }
      if (item.stats.magicAttack) {
        if (!player.stats.magicAttack) player.stats.magicAttack = 0;
        const bonus = getStatBonus(item.stats.magicAttack, upgradeLevel);
        player.stats.magicAttack += item.stats.magicAttack + bonus;
      }
      if (item.stats.magicDefense) {
        if (!player.stats.magicDefense) player.stats.magicDefense = 0;
        const bonus = getStatBonus(item.stats.magicDefense, upgradeLevel);
        player.stats.magicDefense += item.stats.magicDefense + bonus;
      }
      if (item.stats.manaRegen) {
        if (!player.stats.manaRegen) player.stats.manaRegen = 0;
        const bonus = getStatBonus(item.stats.manaRegen, upgradeLevel);
        player.stats.manaRegen += item.stats.manaRegen + bonus;
      }
      return;
    }

    // Sinon, parser la description (format ancien)
    const description = item.description.toLowerCase();

    // Parser la description pour extraire les bonus
    const attackMatch = description.match(/\+(\d+)\s*d['']attaque/);
    const defenseMatch = description.match(/\+(\d+)\s*de\s*défense/);
    const healthMatch = description.match(/\+(\d+)\s*pv\s*max/);

    if (attackMatch) {
      player.stats.attack += parseInt(attackMatch[1]);
    }

    if (defenseMatch) {
      player.stats.defense += parseInt(defenseMatch[1]);
    }

    if (healthMatch) {
      const healthBonus = parseInt(healthMatch[1]);
      player.maxHealth += healthBonus;
      player.health += healthBonus; // Augmenter aussi la vie actuelle
    }
  },

  // Fonction pour retirer les stats d'un item
  removeItemStats(player, item) {
    // Si l'item a un objet stats (format goldShop)
    if (item.stats) {
      // Vérifier si l'item a été amélioré
      const upgradeLevel = player.itemUpgrades?.[item.id]?.level || 0;

      // Fonction helper pour calculer le bonus
      const getStatBonus = (baseStat, level) => {
        return Math.floor(baseStat * 0.1 * level);
      };

      if (item.stats.attack) {
        const bonus = getStatBonus(item.stats.attack, upgradeLevel);
        player.stats.attack -= item.stats.attack + bonus;
      }
      if (item.stats.defense) {
        const bonus = getStatBonus(item.stats.defense, upgradeLevel);
        player.stats.defense -= item.stats.defense + bonus;
      }
      if (item.stats.health) {
        const bonus = getStatBonus(item.stats.health, upgradeLevel);
        const totalHealth = item.stats.health + bonus;
        player.maxHealth -= totalHealth;
        if (player.health > player.maxHealth) {
          player.health = player.maxHealth;
        }
      }
      if (item.stats.speed && player.stats.speed) {
        const bonus = getStatBonus(item.stats.speed, upgradeLevel);
        player.stats.speed -= item.stats.speed + bonus;
      }
      if (item.stats.magicAttack && player.stats.magicAttack) {
        const bonus = getStatBonus(item.stats.magicAttack, upgradeLevel);
        player.stats.magicAttack -= item.stats.magicAttack + bonus;
      }
      if (item.stats.magicDefense && player.stats.magicDefense) {
        const bonus = getStatBonus(item.stats.magicDefense, upgradeLevel);
        player.stats.magicDefense -= item.stats.magicDefense + bonus;
      }
      if (item.stats.manaRegen && player.stats.manaRegen) {
        const bonus = getStatBonus(item.stats.manaRegen, upgradeLevel);
        player.stats.manaRegen -= item.stats.manaRegen + bonus;
      }
      return;
    }

    // Sinon, parser la description (format ancien)
    const description = item.description.toLowerCase();

    // Parser la description pour extraire les bonus
    const attackMatch = description.match(/\+(\d+)\s*d['']attaque/);
    const defenseMatch = description.match(/\+(\d+)\s*de\s*défense/);
    const healthMatch = description.match(/\+(\d+)\s*pv\s*max/);

    if (attackMatch) {
      player.stats.attack -= parseInt(attackMatch[1]);
    }

    if (defenseMatch) {
      player.stats.defense -= parseInt(defenseMatch[1]);
    }

    if (healthMatch) {
      const healthBonus = parseInt(healthMatch[1]);
      player.maxHealth -= healthBonus;
      // Ajuster la vie actuelle si elle dépasse le nouveau max
      if (player.health > player.maxHealth) {
        player.health = player.maxHealth;
      }
    }
  },
};
