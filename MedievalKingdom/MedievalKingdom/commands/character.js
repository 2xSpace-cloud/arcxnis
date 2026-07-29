const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getPlayer, updatePlayer } = require("../utils/database.js");
const { createEmbed } = require("../utils/embeds.js");
const { classes, factions } = require("../systems/gameData.js");
const { ALL_SHOP_ITEMS } = require("../utils/dailyShop.js");

// IDs des rôles de classe
const CLASS_ROLES = {
  chevalier: "1391871534095929364",
  mage: "1392253919303962634",
  voleur: "1392254000304492686",
  barde: "1392254065391570985",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("personnage")
    .setDescription("Gestion de votre personnage")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("creer")
        .setDescription("Créer votre personnage")
        .addStringOption((option) =>
          option
            .setName("classe")
            .setDescription("Choisissez votre classe")
            .setRequired(true)
            .addChoices(
              { name: "⚔️ Chevalier", value: "chevalier" },
              { name: "🔮 Mage", value: "mage" },
              { name: "🗡️ Voleur", value: "voleur" },
              { name: "🎵 Barde", value: "barde" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("nom")
            .setDescription("Nom de votre personnage (optionnel)")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("profil")
        .setDescription("Voir votre profil ou celui d'un autre joueur")
        .addUserOption((option) =>
          option
            .setName("joueur")
            .setDescription("Joueur à consulter (optionnel)")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("classe")
        .setDescription("Changer de classe (coûte 100 or)")
        .addStringOption((option) =>
          option
            .setName("nouvelle_classe")
            .setDescription("Nouvelle classe")
            .setRequired(true)
            .addChoices(
              { name: "⚔️ Chevalier", value: "chevalier" },
              { name: "🔮 Mage", value: "mage" },
              { name: "🗡️ Voleur", value: "voleur" },
              { name: "🎵 Barde", value: "barde" }
            )
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "creer":
          await this.createCharacter(interaction);
          break;
        case "profil":
          await this.showProfile(interaction);
          break;
        case "classe":
          await this.changeClass(interaction);
          break;
      }
    } catch (error) {
      console.error("Erreur dans la commande personnage:", error);
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

  async createCharacter(interaction) {
    const userId = interaction.user.id;
    const classe = interaction.options.getString("classe");
    const nom =
      interaction.options.getString("nom") || interaction.user.displayName;

    // Vérifier si le joueur existe déjà
    const existingPlayer = getPlayer(userId);
    if (existingPlayer) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous avez déjà un personnage ! Utilisez `/personnage profil` pour le voir."
          ),
        ],
        ephemeral: true,
      });
    }

    // Créer le nouveau personnage
    const classData = classes[classe];
    const newPlayer = {
      id: userId,
      name: nom,
      class: classe,
      level: 1,
      experience: 0,
      health: classData.baseHealth,
      maxHealth: classData.baseHealth,
      mana: classData.baseMana,
      maxMana: classData.baseMana,
      gold: 100,
      reputation: 0,
      faction: null,
      inventory: {},
      stats: { ...classData.baseStats },
      quests: {
        active: null,
        completed: [],
        completedToday: 0,
        lastQuestTime: null,
      },
      combat: {
        wins: 0,
        losses: 0,
        totalDamageDealt: 0,
        totalDamageTaken: 0,
      },
      equipment: {
        weapon: null,
        armor: {
          head: null,
          chest: null,
          legs: null,
          feet: null,
          hands: null,
          shield: null,
        },
      },
      gemmes: 0, // Ajout du champ gemmes
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };

    // Sauvegarder le personnage
    updatePlayer(userId, newPlayer);

    // Attribuer le rôle de classe
    try {
      const member = interaction.member;
      const roleId = CLASS_ROLES[classe];

      if (roleId) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (role) {
          await member.roles.add(role);
          console.log(`✅ Rôle ${role.name} attribué à ${member.user.tag}`);
        } else {
          console.error(`⚠️ Rôle avec l'ID ${roleId} introuvable`);
        }
      }
    } catch (error) {
      console.error("Erreur lors de l'attribution du rôle:", error);
    }

    // Réponse
    const embed = createEmbed("success", `🎉 Personnage créé avec succès !`)
      .addFields(
        { name: "👤 Nom", value: nom, inline: true },
        {
          name: "⚔️ Classe",
          value: `${classData.emoji} ${classData.name}`,
          inline: true,
        },
        { name: "💰 Or", value: "100", inline: true },
        {
          name: "❤️ Vie",
          value: `${classData.baseHealth}/${classData.baseHealth}`,
          inline: true,
        },
        {
          name: "🔮 Mana",
          value: `${classData.baseMana}/${classData.baseMana}`,
          inline: true,
        },
        { name: "⭐ Niveau", value: "1", inline: true }
      )
      .setDescription(classData.description);

    await interaction.reply({ embeds: [embed] });

    // ── Tutoriel en DM au nouveau joueur ──────────────────────────────────
    try {
      const siteUrl = process.env.REPLIT_DEV_DOMAIN
        ? 'https://' + process.env.REPLIT_DEV_DOMAIN
        : 'le tableau de bord du royaume';

      const cmds = [
        '`/personnage profil` — Votre fiche de personnage',
        '`/quete` — Partir en quête (XP & or)',
        '`/combat` — Combattre des monstres',
        '`/boutique` — Acheter des items avec vos 💎 gemmes',
        '`/inventaire` — Gérer vos objets',
        '`/equiper` — Équiper armes et armures',
        '`/faction rejoindre` — Rejoindre une faction',
        '`/classement` — Classement des joueurs',
      ].join('\n');

      const progression = [
        '• Faites des **quêtes** pour gagner XP et monter de niveau',
        '• Gagnez des **combats** pour obtenir or et expérience',
        '• Achetez des **équipements** en boutique pour améliorer vos stats',
        '• Rejoignez une **faction** pour accéder à des bonus exclusifs',
        '• Restez dans les salons **vocaux** pour gagner des gemmes 💎',
      ].join('\n');

      const siteInfo = [
        '**Site : ' + siteUrl + '**',
        '',
        '**Connexion en 3 étapes :**',
        '1️⃣ Entrez votre **ID Discord** sur le site',
        '2️⃣ Le bot vous envoie un **code à 6 chiffres** par DM',
        '3️⃣ Entrez le code → connecté !',
        '',
        "💡 Votre ID : Paramètres Discord → Avancé → Mode développeur → clic droit sur votre nom → *Copier l'identifiant*",
      ].join('\n');

      const tutorialEmbed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('📜 Bienvenue dans Medieval Kingdom !')
        .setDescription('Félicitations **' + nom + '** ! Votre aventure commence maintenant. Voici tout ce qu\'il faut savoir.')
        .addFields(
          { name: '⚔️ Commandes essentielles', value: cmds },
          { name: '📈 Comment progresser', value: progression },
          {
            name: '💎 Les Gemmes',
            value: 'Monnaie premium. Gagnez-en avec `/gemmesvocales` (salons vocaux) ou achetez-en avec `/achetergemmes`. Utilisées à la `/boutique` pour les items rares.',
          },
          { name: '🌐 Tableau de bord web', value: siteInfo }
        )
        .setFooter({ text: '⚔️ Bonne aventure, aventurier ! Que la gloire soit avec vous.' })
        .setTimestamp();

      const dmChannel = await interaction.user.createDM();
      await dmChannel.send({ embeds: [tutorialEmbed] });
      console.log('📨 Tutoriel envoyé en DM à ' + nom);
    } catch (dmErr) {
      console.log('ℹ️ Impossible d\'envoyer le tutoriel en DM à ' + nom + ': ' + dmErr.message);
    }
    // ─────────────────────────────────────────────────────────────────────

  },

  async showProfile(interaction) {
    const targetUser =
      interaction.options.getUser("joueur") || interaction.user;
    const player = getPlayer(targetUser.id);

    if (!player) {
      const message =
        targetUser.id === interaction.user.id
          ? "Vous n'avez pas encore de personnage ! Utilisez `/personnage creer` pour en créer un."
          : "Ce joueur n'a pas encore de personnage.";

      return await interaction.reply({
        embeds: [createEmbed("error", message)],
        ephemeral: true,
      });
    }

    const classData = classes[player.class];
    const factionData = player.faction ? factions[player.faction] : null;

    // Calculer l'expérience nécessaire pour le niveau suivant
    const expForNext = player.level * 100;
    const expProgress = `${player.experience}/${expForNext}`;
    // Ajout de l'affichage des gemmes
    const gemmes = player.gemmes || 0;

    const embed = createEmbed("info", `Profil de ${player.name}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        {
          name: "⚔️ Classe",
          value: `${classData.emoji} ${classData.name}`,
          inline: true,
        },
        { name: "⭐ Niveau", value: player.level.toString(), inline: true },
        { name: "✨ Expérience", value: expProgress, inline: true },
        {
          name: "❤️ Vie",
          value: `${player.health}/${player.maxHealth}`,
          inline: true,
        },
        {
          name: "🔮 Mana",
          value: `${player.mana}/${player.maxMana}`,
          inline: true,
        },
        { name: "💰 Or", value: player.gold.toString(), inline: true },
        {
          name: "🏆 Réputation",
          value: player.reputation.toString(),
          inline: true,
        },
        {
          name: "🏛️ Faction",
          value: factionData
            ? `${factionData.emoji} ${factionData.name}`
            : "Aucune",
          inline: true,
        },
        {
          name: "⚔️ Combats",
          value: `${player.combat.wins}V - ${player.combat.losses}D`,
          inline: true,
        },
        { name: "💎 Gemmes", value: `${gemmes}`, inline: true }
      );

    // Ajouter le titre actif s'il existe
    if (player.titles && player.titles.active) {
      const activeTitle = ALL_SHOP_ITEMS.find(
        (item) => item.id === player.titles.active && item.type === "titre"
      );
      if (activeTitle) {
        embed.addFields({
          name: "🏆 Titre",
          value: `**${activeTitle.name}**\n${activeTitle.description}`,
          inline: false,
        });
      }
    }

    // Ajouter des statistiques détaillées
    if (
      player.inventory &&
      ((Array.isArray(player.inventory) && player.inventory.length > 0) ||
        (!Array.isArray(player.inventory) &&
          Object.keys(player.inventory).length > 0))
    ) {
      let itemCount = 0;
      if (Array.isArray(player.inventory)) {
        itemCount = player.inventory.length;
      } else {
        itemCount = Object.values(player.inventory).reduce(
          (sum, count) => sum + (typeof count === "number" ? count : 1),
          0
        );
      }
      embed.addFields({
        name: "🎒 Inventaire",
        value: `${itemCount} objets`,
        inline: true,
      });
    }

    if (player.quests.active) {
      embed.addFields({
        name: "📜 Quête active",
        value: player.quests.active.title,
        inline: true,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },

  async changeClass(interaction) {
    const userId = interaction.user.id;
    const newClass = interaction.options.getString("nouvelle_classe");
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

    if (player.class === newClass) {
      return await interaction.reply({
        embeds: [createEmbed("error", "Vous êtes déjà de cette classe !")],
        ephemeral: true,
      });
    }

    if (player.gold < 100) {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "Vous n'avez pas assez d'or ! Il vous faut 100 or pour changer de classe."
          ),
        ],
        ephemeral: true,
      });
    }

    // Effectuer le changement
    const oldClassData = classes[player.class];
    const newClassData = classes[newClass];

    const oldClass = player.class;
    player.class = newClass;
    player.gold -= 100;

    // Ajuster les stats de base
    const healthRatio = player.health / player.maxHealth;
    const manaRatio = player.mana / player.maxMana;

    player.maxHealth = newClassData.baseHealth;
    player.maxMana = newClassData.baseMana;
    player.health = Math.floor(player.maxHealth * healthRatio);
    player.mana = Math.floor(player.maxMana * manaRatio);

    player.stats = { ...newClassData.baseStats };

    updatePlayer(userId, player);

    // Changer les rôles de classe
    try {
      const member = interaction.member;

      // Retirer l'ancien rôle
      const oldRoleId = CLASS_ROLES[oldClass];
      if (oldRoleId) {
        const oldRole = interaction.guild.roles.cache.get(oldRoleId);
        if (oldRole && member.roles.cache.has(oldRoleId)) {
          await member.roles.remove(oldRole);
          console.log(`✅ Rôle ${oldRole.name} retiré de ${member.user.tag}`);
        }
      }

      // Ajouter le nouveau rôle
      const newRoleId = CLASS_ROLES[newClass];
      if (newRoleId) {
        const newRole = interaction.guild.roles.cache.get(newRoleId);
        if (newRole) {
          await member.roles.add(newRole);
          console.log(`✅ Rôle ${newRole.name} attribué à ${member.user.tag}`);
        } else {
          console.error(`⚠️ Rôle avec l'ID ${newRoleId} introuvable`);
        }
      }
    } catch (error) {
      console.error("Erreur lors du changement de rôle:", error);
    }

    const embed = createEmbed("success", "🔄 Changement de classe réussi !")
      .addFields(
        {
          name: "Ancienne classe",
          value: `${oldClassData.emoji} ${oldClassData.name}`,
          inline: true,
        },
        {
          name: "Nouvelle classe",
          value: `${newClassData.emoji} ${newClassData.name}`,
          inline: true,
        },
        { name: "Coût", value: "100 or", inline: true },
        {
          name: "❤️ Nouvelle vie",
          value: `${player.health}/${player.maxHealth}`,
          inline: true,
        },
        {
          name: "🔮 Nouveau mana",
          value: `${player.mana}/${player.maxMana}`,
          inline: true,
        },
        { name: "💰 Or restant", value: player.gold.toString(), inline: true }
      )
      .setDescription(newClassData.description);

    await interaction.reply({ embeds: [embed] });
  },
};
