const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { getPlayer, updatePlayer } = require("../utils/database");
const {
  getDailyShop,
  getRarityEmoji,
  getDayName,
} = require("../utils/dailyShop");

const app = express();
const PORT = process.env.PORT || 4242;

// Packs de gemmes (doivent correspondre à ceux du bot)
const gemPacks = {
  pack1: { gemmes: 100, price: 199 },
  pack2: { gemmes: 600, price: 999 },
  pack3: { gemmes: 1300, price: 1999 },
  pack4: { gemmes: 3500, price: 4999 },
};

// Packs d'or achetables avec des gemmes (valeurs avant bonus)
const goldPacks = {
  or_pack_small: { gold: 1000, priceGems: 50 },
  or_pack_medium: { gold: 5000, priceGems: 200 },
  or_pack_large: { gold: 15000, priceGems: 500 },
};

app.use(bodyParser.urlencoded({ extended: false }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName("boutique")
    .setDescription(
      "Affiche la boutique quotidienne ou achète un item avec des gemmes.",
    )
    .addStringOption((option) =>
      option
        .setName("item")
        .setDescription("ID de l'item à acheter")
        .setRequired(false),
    ),
  async execute(interaction) {
    const userId = interaction.user.id;
    const player = getPlayer(userId);
    if (!player) {
      return interaction.reply({
        content: "Crée d'abord ton personnage avec /personnage creer !",
        ephemeral: true,
      });
    }

    const itemId = interaction.options.getString("item")
      ? interaction.options.getString("item").toLowerCase()
      : null;
    if (!itemId) {
      // Affiche la boutique quotidienne
      const dailyShop = getDailyShop();
      const dayName = getDayName(dailyShop.dayOfWeek);

      const embed = new EmbedBuilder()
        .setTitle("🏪 Boutique Quotidienne")
        .setDescription(
          `**${dayName} - ${dailyShop.date}**\n` +
            "Utilise `/boutique item:<id>` pour acheter. La boutique change chaque jour à minuit !\n\n" +
            "**Items disponibles aujourd'hui :**",
        )
        .addFields(
          dailyShop.items.map((item) => ({
            name: `${getRarityEmoji(item.rarity)} ${item.name} — ${
              item.price
            } gemmes ${item.originalPrice ? `~~${item.originalPrice}~~` : ""}`,
            value: `ID : \`${item.id}\`\n${item.description}`,
            inline: true,
          })),
        )
        .addFields({
          name: "💰 Packs d'or (achetables avec des gemmes)",
          value: Object.entries(goldPacks)
            .map(
              ([id, p]) =>
                `ID : \`${id}\` — ${p.priceGems} gemmes → ${p.gold} or`,
            )
            .join("\n"),
          inline: false,
        })
        .setFooter({
          text: `Tu as ${
            player.gemmes || 0
          } gemmes • Boutique générée le ${new Date(
            dailyShop.generatedAt,
          ).toLocaleString("fr-FR")}`,
        })
        .setColor("#FFD700");
      return interaction.reply({ embeds: [embed] });
    }

    // Achat d'un item ou d'un pack d'or
    // Priorité aux packs d'or achetables avec des gemmes
    if (goldPacks[itemId]) {
      const pack = goldPacks[itemId];
      if ((player.gemmes || 0) < pack.priceGems) {
        return interaction.reply({
          content: `Tu n'as pas assez de gemmes. Il te faut ${pack.priceGems} gemmes pour ce pack.`,
          ephemeral: true,
        });
      }

      // Retirer les gemmes et donner l'or
      player.gemmes -= pack.priceGems;
      const totalGold = pack.gold;
      player.gold = (player.gold || 0) + totalGold;
      updatePlayer(userId, player);

      return interaction.reply({
        content: `✅ Achat réussi ! Tu as obtenu **${totalGold} pièces d'or**.`,
      });
    }

    // Achat d'un item classique dans la boutique quotidienne
    const dailyShop = getDailyShop();
    const item = dailyShop.items.find((i) => i.id === itemId);
    if (!item) {
      return interaction.reply({
        content:
          "Cet item n'est pas disponible dans la boutique d'aujourd'hui.",
        ephemeral: true,
      });
    }
    if ((player.gemmes || 0) < item.price) {
      return interaction.reply({
        content: `Tu n'as pas assez de gemmes. Il t'en faut ${item.price}.`,
        ephemeral: true,
      });
    }

    player.gemmes -= item.price;

    // Convertir l'inventaire en format Object si nécessaire
    if (!player.inventory || Array.isArray(player.inventory)) {
      const oldInventory = player.inventory || [];
      player.inventory = {};
      if (Array.isArray(oldInventory)) {
        oldInventory.forEach((id) => {
          player.inventory[id] = (player.inventory[id] || 0) + 1;
        });
      }
    }

    // Convertir les titres en format Array si nécessaire
    if (!Array.isArray(player.titres)) {
      player.titres = [];
    }

    // Convertir les familiers en format Array si nécessaire
    if (!Array.isArray(player.familiers)) {
      player.familiers = [];
    }

    // Ajout de l'item selon son type
    if (
      item.type === "objet" ||
      item.type === "arme" ||
      item.type === "armure"
    ) {
      if (!player.inventory[item.id]) {
        player.inventory[item.id] = 0;
      }
      player.inventory[item.id]++;
    } else if (item.type === "titre") {
      if (!player.titres.includes(item.id)) {
        player.titres.push(item.id);
      }
    } else if (item.type === "familier") {
      if (!player.familiers.includes(item.id)) {
        player.familiers.push(item.id);
      }
    }

    // Gestion des items spéciaux
    if (item.id === "coffre_tresor") {
      const bonusGemmes = 50 + Math.floor(Math.random() * 151); // 50-200 gemmes
      player.gemmes = (player.gemmes || 0) + bonusGemmes;
      updatePlayer(userId, player);
      return interaction.reply({
        content: `🎉 Achat réussi ! Tu as ouvert le **${item.name}** et obtenu **${bonusGemmes} gemmes** supplémentaires !`,
      });
    }

    if (item.id === "pack_potions") {
      // Ajouter 3 potions de soin et 2 potions de mana
      if (!player.inventory["potion_soin"]) {
        player.inventory["potion_soin"] = 0;
      }
      player.inventory["potion_soin"] += 3;

      if (!player.inventory["potion_mana"]) {
        player.inventory["potion_mana"] = 0;
      }
      player.inventory["potion_mana"] += 2;
    }

    updatePlayer(userId, player);
    return interaction.reply({
      content: `✅ Achat réussi ! Tu as obtenu : **${getRarityEmoji(
        item.rarity,
      )} ${item.name}**.`,
    });
  },
};

// Vérification IPN PayPal
app.post("/paypal-ipn", async (req, res) => {
  let body = "cmd=_notify-validate";
  for (const key in req.body) {
    body += `&${key}=${encodeURIComponent(req.body[key])}`;
  }
  try {
    const { data } = await axios.post(
      "https://ipnpb.paypal.com/cgi-bin/webscr",
      body,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );
    if (data === "VERIFIED" && req.body.payment_status === "Completed") {
      const discordId = req.body.custom;
      const itemName = req.body.item_name;
      const gemmes = gemPacks[itemName];
      if (discordId && gemmes) {
        const player = getPlayer(discordId);
        if (player) {
          player.gemmes = (player.gemmes || 0) + gemmes;
          updatePlayer(discordId, player);
          console.log(`Gemmes créditées à ${discordId} : +${gemmes}`);
        }
      }
    }
    res.status(200).send("OK");
  } catch (err) {
    console.error("Erreur IPN:", err);
    res.status(500).send("Erreur");
  }
});

app.listen(PORT, () => console.log(`Serveur en ligne sur le port ${PORT}`));
