const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getPlayer, updatePlayer } = require("../utils/database.js");
const { createEmbed } = require("../utils/embeds.js");
const { classes, factions } = require("../systems/gameData.js");
const { ALL_SHOP_ITEMS } = require("../utils/dailyShop.js");

// IDs des rôles de classe
const CLASS_ROLES = {
  chevalier: "1518199110992269483",
  mage: "1518204463876280380",
  voleur: "1518199112712065104",
  barde: "1518204464962601010",
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

    // FIX: Ajout de await pour interroger correctement la base MongoDB
    const existingPlayer = await getPlayer(userId);
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
      gemmes: 0,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };

    // FIX: Ajout de await pour sauvegarder dans MongoDB Atlas
    await updatePlayer(userId, newPlayer);

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

      const tutorialEmbed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('📜 Bienvenue dans Medieval Kingdom !')
        .setDescription('Félicitations **' + nom + '** ! Votre aventure commence maintenant. Voici tout ce qu\'il faut savoir.')
        .addFields(
          { name: '⚔️ Commandes essentielles', value: cmds },
          { name: '📈 Comment progresser', value: progression }
        );

      await interaction.user.send({ embeds: [tutorialEmbed] });
    } catch (e) {
      console.error("Impossible d'envoyer le DM de tutoriel");
    }
  },

  async showProfile(interaction) {
    const targetUser = interaction.options.getUser("joueur") || interaction.user;
    
    // FIX: Ajout de await pour charger le profil depuis MongoDB
    // ... (Copiez ce bloc uniquement si votre fichier s'est arrêté à "targetUser")
    const player = await getPlayer(targetUser.id);
    
    if (!player) {
      return await interaction.reply({
        embeds: [createEmbed("error", `${targetUser.username} n'a pas encore de personnage.`)],
        ephemeral: true
      });
    }

    const classData = classes[player.class] || { name: "Inconnue", emoji: "❓" };
    const factionData = player.faction ? factions[player.faction] : null;

    const embed = createEmbed("info", `Profil de ${player.name}`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "⚔️ Classe", value: `${classData.emoji} ${classData.name}`, inline: true },
        { name: "🛡️ Faction", value: factionData ? `${factionData.emoji} ${factionData.name}` : "Aucune", inline: true },
        { name: "⭐ Niveau", value: `${player.level}`, inline: true },
        { name: "💰 Or / 💎 Gemmes", value: `${player.gold} 🪙 / ${player.gemmes || 0} 💎`, inline: false },
        { name: "❤️ Vie", value: `${player.health}/${player.maxHealth}`, inline: true },
        { name: "🔮 Mana", value: `${player.mana}/${player.maxMana}`, inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  },

  async changeClass(interaction) {
    const userId = interaction.user.id;
    const nouvelleClasse = interaction.options.getString("nouvelle_classe");
    
    const player = await getPlayer(userId);
    if (!player) {
      return await interaction.reply({
        embeds: [createEmbed("error", "Vous devez d'abord créer un personnage !")],
        ephemeral: true
      });
    }

    if (player.gold < 100) {
      return await interaction.reply({
        embeds: [createEmbed("error", "Changer de classe coûte 100 pièces d'or. Vous n'en avez pas assez.")],
        ephemeral: true
      });
    }

    player.gold -= 100;
    player.class = nouvelleClasse;
    player.stats = { ...classes[nouvelleClasse].baseStats };
    
    await updatePlayer(userId, player);

    await interaction.reply({
      embeds: [createEmbed("success", `🔮 Vous avez changé de classe pour devenir **${classes[nouvelleClasse].name}** ! (100 🪙 retirés)`)],
    });
  }
};
