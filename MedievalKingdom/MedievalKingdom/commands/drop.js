const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
} = require("discord.js");
const { getPlayer, updatePlayer } = require("../utils/database.js");
const { createEmbed } = require("../utils/embeds.js");
const fs = require("fs");
const path = require("path");

const ITEMS_PATH = path.join(__dirname, "../database/items.json");
const activeDrops = new Map();

const RARITY_CONFIG = {
  common: { emoji: "⬜", label: "Commun", color: 0x95a5a6 },
  uncommon: { emoji: "🟢", label: "Peu commun", color: 0x2ecc71 },
  rare: { emoji: "🔵", label: "Rare", color: 0x3498db },
  legendary: { emoji: "🟣", label: "Légendaire", color: 0x9b59b6 },
};

function loadItems() {
  const d = JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));
  return d.items || d;
}

function pickRandomItem(rarityFilter) {
  const items = loadItems();
  let pool = Object.entries(items);
  if (rarityFilter) pool = pool.filter(([, it]) => it.rarity === rarityFilter);
  if (!pool.length) pool = Object.entries(items);
  const [id, item] = pool[Math.floor(Math.random() * pool.length)];
  return { id, ...item };
}

// 1. Embed mis à jour pour refléter le mode "Premier arrivé, premier servi"
function buildDropEmbed(drop) {
  const rCfg = RARITY_CONFIG[drop.itemRarity] || RARITY_CONFIG.common;
  return new EmbedBuilder()
    .setTitle("🎁 Drop Instantané !")
    .setColor(rCfg.color)
    .setDescription(
      "✨ Un drop vient d'apparaître ! Soyez le plus rapide pour le réclamer !",
    )
    .addFields(
      {
        name: `${rCfg.emoji} Objet`,
        value: `**${drop.itemName}**`,
        inline: true,
      },
      {
        name: "📦 Quantité",
        value: `${drop.quantity}x par personne`,
        inline: true,
      },
      {
        name: "👥 Places disponibles",
        value: `${drop.winnersClaimed} / ${drop.winners}`,
        inline: true,
      },
    )
    .setFooter({ text: "Cliquez vite sur le bouton vert ci-dessous !" });
}

// 2. Fonction de finalisation modifiée (Griser le bouton et afficher les gagnants)
async function finalizeDrop(drop, client, reason = "time") {
  if (!activeDrops.has(drop.id)) return;
  activeDrops.delete(drop.id);
  const rCfg = RARITY_CONFIG[drop.itemRarity] || RARITY_CONFIG.common;

  const disabledBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`drop_claim_disabled`)
      .setLabel("Réclamé")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );

  const winnerMentions = drop.participants.map((userId) => `<@${userId}>`);

  const resultEmbed = new EmbedBuilder()
    .setTitle("🛑 Drop terminé !")
    .setColor(0x95a5a6)
    .setDescription(
      reason === "full"
        ? "Tous les objets ont été réclamés à la vitesse de l'éclair ! ⚡"
        : "Le temps imparti est écoulé.",
    )
    .addFields(
      {
        name: `${rCfg.emoji} Objet`,
        value: `**${drop.itemName}** x${drop.quantity}`,
        inline: true,
      },
      {
        name: "🏆 Gagnant(s)",
        value: winnerMentions.join("\n") || "Aucun",
        inline: false,
      },
    );

  try {
    const ch = await client.channels.fetch(drop.channelId);
    const msg = await ch.messages.fetch(drop.messageId);
    await msg.edit({ embeds: [resultEmbed], components: [disabledBtn] });
  } catch (err) {
    console.error("Erreur finalisation drop:", err);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("drop")
    .setDescription("Lancer un drop d'objet dans un salon")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("lancer")
        .setDescription(
          "Lancer un drop avec un objet précis (ou aléatoire si aucun ID fourni)",
        )
        .addStringOption((opt) =>
          opt
            .setName("item")
            .setDescription(
              "ID de l'objet (ex: epee_longue). Laissez vide pour aléatoire.",
            )
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("quantite")
            .setDescription("Quantité par gagnant (défaut: 1)")
            .setMinValue(1)
            .setMaxValue(99)
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("gagnants")
            .setDescription("Nombre de gagnants / clics possibles (défaut: 1)")
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("duree")
            .setDescription(
              "Durée max en secondes avant expiration (défaut: 60)",
            )
            .setMinValue(10)
            .setMaxValue(3600)
            .setRequired(false),
        )
        .addChannelOption((opt) =>
          opt
            .setName("salon")
            .setDescription("Salon cible (défaut: salon actuel)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("aleatoire")
        .setDescription("Lancer un drop d'objet entièrement aléatoire")
        .addStringOption((opt) =>
          opt
            .setName("rarete")
            .setDescription("Filtrer par rareté (optionnel)")
            .addChoices(
              { name: "⬜ Commun", value: "common" },
              { name: "🟢 Peu commun", value: "uncommon" },
              { name: "🔵 Rare", value: "rare" },
              { name: "🟣 Légendaire", value: "legendary" },
            )
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("quantite")
            .setDescription("Quantité par gagnant (défaut: 1)")
            .setMinValue(1)
            .setMaxValue(99)
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("gagnants")
            .setDescription("Nombre de gagnants / clics possibles (défaut: 1)")
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("duree")
            .setDescription("Durée max en secondes (défaut: 60)")
            .setMinValue(10)
            .setMaxValue(3600)
            .setRequired(false),
        )
        .addChannelOption((opt) =>
          opt.setName("salon").setDescription("Salon cible").setRequired(false),
        ),
    ),

  activeDrops,
  finalizeDrop,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    try {
      await this.launchDrop(interaction, sub === "aleatoire");
    } catch (err) {
      console.error("Erreur /drop:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [createEmbed("error", "Une erreur est survenue.")],
          flags: 64,
        });
      }
    }
  },

  async launchDrop(interaction, forceRandom) {
    const items = loadItems();
    let itemId, itemData;
    const itemInput = interaction.options.getString("item") || null;
    const rarityFilter = interaction.options.getString("rarete") || null;

    if (forceRandom || !itemInput) {
      const picked = pickRandomItem(rarityFilter);
      itemId = picked.id;
      itemData = items[itemId];
    } else {
      if (!items[itemInput]) {
        return await interaction.reply({
          embeds: [
            createEmbed(
              "error",
              `❌ Objet inconnu : \`${itemInput}\`\nConsultez \`/items\` pour la liste des IDs.`,
            ),
          ],
          flags: 64,
        });
      }
      itemId = itemInput;
      itemData = items[itemInput];
    }

    const quantity = interaction.options.getInteger("quantite") || 1;
    const winners = interaction.options.getInteger("gagnants") || 1;
    const duration = interaction.options.getInteger("duree") || 60;
    const targetCh =
      interaction.options.getChannel("salon") || interaction.channel;

    const dropId = `drop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const drop = {
      id: dropId,
      itemId,
      itemName: itemData.name,
      itemRarity: itemData.rarity || "common",
      quantity,
      winners,
      winnersClaimed: 0, // Compteur de clics réussis
      channelId: targetCh.id,
      messageId: null,
      participants: [], // Liste ordonnée des IDs des gagnants
      mode: forceRandom ? "aleatoire" : "lancer",
    };

    const rCfg = RARITY_CONFIG[drop.itemRarity] || RARITY_CONFIG.common;
    const claimBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`drop_claim_${dropId}`)
        .setLabel("🎁 Réclamer !")
        .setStyle(ButtonStyle.Success),
    );

    let message;
    try {
      message = await targetCh.send({
        embeds: [buildDropEmbed(drop)],
        components: [claimBtn],
      });
    } catch {
      return await interaction.reply({
        embeds: [
          createEmbed(
            "error",
            "❌ Impossible d'envoyer le drop dans ce salon.",
          ),
        ],
        flags: 64,
      });
    }

    drop.messageId = message.id;
    activeDrops.set(dropId, drop);

    await interaction.reply({
      embeds: [
        createEmbed(
          "success",
          "✅ Drop lancé !",
          `${rCfg.emoji} **${itemData.name}** x${quantity} — ${winners} place(s) — Posté dans <#${targetCh.id}>`,
        ),
      ],
      flags: 64,
    });

    const client = interaction.client;

    // 3. Création du collecteur de bouton en tâche de fond pour réagir instantanément
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: duration * 1000,
    });

    collector.on("collect", async (i) => {
      // Sécurité : on vérifie si le drop existe encore au cas où
      if (!activeDrops.has(dropId)) {
        return i.reply({
          content: "❌ Ce drop n'est plus disponible.",
          flags: 64,
        });
      }

      // Sécurité anti-doublon : le joueur a-t-il déjà cliqué ?
      if (drop.participants.includes(i.user.id)) {
        return i.reply({
          content: "❌ Tu as déjà réclamé une place sur ce drop !",
          flags: 64,
        });
      }

      // Enregistrement immédiat du gagnant
      drop.winnersClaimed++;
      drop.participants.push(i.user.id);

      // Attribution de l'objet en Base de Données (reprise de ta logique)
      const player = getPlayer(i.user.id);
      if (player) {
        if (!player.inventory || Array.isArray(player.inventory))
          player.inventory = {};
        player.inventory[drop.itemId] =
          (player.inventory[drop.itemId] || 0) + drop.quantity;
        updatePlayer(i.user.id, player);
      }

      // Réponse éphémère instantanée pour le joueur
      await i.reply({
        content: `🎉 Bravo ! Tu as récupéré **${drop.itemName}** x${drop.quantity} ! L'objet est dans ton inventaire.`,
        flags: 64,
      });

      // Message public dans le salon pour notifier le clic
      await i.channel.send({
        content: `🎊 **${i.user.username}** a récupéré un(e) **${drop.itemName}** ! (${drop.winnersClaimed}/${drop.winners})`,
      });

      // Si le stock est vide, on arrête le collecteur
      if (drop.winnersClaimed >= drop.winners) {
        collector.stop("full");
      } else {
        // Sinon, on met juste à jour le nombre de places restantes sur l'embed
        await message
          .edit({ embeds: [buildDropEmbed(drop)], components: [claimBtn] })
          .catch(() => {});
      }
    });

    collector.on("end", async (collected, reason) => {
      await finalizeDrop(drop, client, reason);
    });
  },
};
