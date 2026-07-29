const { SlashCommandBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { getPlayer, updatePlayer } = require("../utils/database");
const { createEmbed } = require("../utils/embeds");

const MARKET_FILE = path.join(__dirname, "..", "database", "marketplace.json");
const ITEMS_PATH = path.join(__dirname, "..", "database", "items.json");
const GOLDSHOP_PATH = path.join(__dirname, "..", "database", "goldShop.json");

function loadJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (e) {
    console.error("loadJSON error:", e);
  }
  return null;
}

function saveJSON(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const temp = filePath + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(data, null, 2));
    fs.renameSync(temp, filePath);
    return true;
  } catch (e) {
    console.error("saveJSON error:", e);
    return false;
  }
}

function findItemData(itemId) {
  const itemsData = loadJSON(ITEMS_PATH);
  if (itemsData?.items?.[itemId])
    return { data: itemsData.items[itemId], source: "items" };

  const goldShop = loadJSON(GOLDSHOP_PATH);
  if (goldShop?.equipment?.[itemId]) {
    const g = goldShop.equipment[itemId];
    const type = g.type === "shield" ? "armor" : g.type;
    return {
      data: {
        name: g.name,
        description: g.description,
        stats: g.stats || {},
        type,
      },
      source: "goldShop",
    };
  }

  return null;
}

function loadMarketplace() {
  const data = loadJSON(MARKET_FILE);
  return Array.isArray(data) ? data : [];
}

function saveMarketplace(listings) {
  return saveJSON(MARKET_FILE, listings);
}

function generateListingId() {
  return `listing_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vendre")
    .setDescription("Vendre / acheter des items entre joueurs (marketplace)")
    .addSubcommand((sub) =>
      sub
        .setName("lister")
        .setDescription("Lister un item à la vente")
        .addStringOption((o) =>
          o.setName("item").setDescription("ID de l'item").setRequired(true),
        )
        .addIntegerOption((o) =>
          o
            .setName("prix")
            .setDescription("Prix en or (max 1000)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("acheter")
        .setDescription("Acheter une annonce du marketplace")
        .addStringOption((o) =>
          o
            .setName("annonce")
            .setDescription("ID de l'annonce")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("annuler")
        .setDescription("Annuler votre annonce et récupérer l'item")
        .addStringOption((o) =>
          o
            .setName("annonce")
            .setDescription("ID de l'annonce")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("voir").setDescription("Voir les annonces disponibles"),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (sub === "lister") {
      const itemId = interaction.options.getString("item").toLowerCase();
      const price = interaction.options.getInteger("prix");

      if (price <= 0 || price > 1000) {
        return interaction.reply({
          embeds: [
            createEmbed(
              "error",
              "Le prix doit être entre 1 et 1000 pièces d'or.",
            ),
          ],
          ephemeral: true,
        });
      }

      const player = getPlayer(userId);
      if (!player)
        return interaction.reply({
          embeds: [createEmbed("error", "Personnage introuvable.")],
          ephemeral: true,
        });

      if (
        !player.inventory ||
        !player.inventory[itemId] ||
        player.inventory[itemId] <= 0
      ) {
        return interaction.reply({
          embeds: [createEmbed("error", "Vous ne possédez pas cet item.")],
          ephemeral: true,
        });
      }

      const itemResult = findItemData(itemId);
      if (!itemResult)
        return interaction.reply({
          embeds: [
            createEmbed("error", "Item introuvable dans la base de données."),
          ],
          ephemeral: true,
        });

      // Retirer l'item de l'inventaire (verrou simple)
      player.inventory[itemId] -= 1;
      if (player.inventory[itemId] === 0) delete player.inventory[itemId];

      // Créer l'annonce
      const listings = loadMarketplace();
      const listing = {
        id: generateListingId(),
        seller: userId,
        itemId,
        price,
        createdAt: new Date().toISOString(),
      };
      listings.push(listing);

      // Sauvegarder
      saveMarketplace(listings);
      updatePlayer(userId, player);

      return interaction.reply({
        embeds: [
          createEmbed(
            "success",
            "Annonce créée",
            `Votre item **${itemResult.data.name}** a été listé à **${price} 💰** (ID annonce: ${listing.id})`,
          ),
        ],
      });
    }

    if (sub === "voir") {
      const listings = loadMarketplace();
      if (listings.length === 0)
        return interaction.reply({
          embeds: [
            createEmbed("info", "Aucune annonce disponible pour le moment."),
          ],
          ephemeral: false,
        });

      // Construire un résumé concis (max 10 annonces)
      const shown = listings.slice(-10).reverse();
      let text = "";
      for (const l of shown) {
        const it = findItemData(l.itemId);
        const name = it ? it.data.name : l.itemId;
        text += `• ${l.id} — **${name}** — ${l.price} 💰 — vendeur: <@${l.seller}>\n`;
      }

      return interaction.reply({
        embeds: [createEmbed("info", `Annonces (${listings.length})`, text)],
      });
    }

    if (sub === "annuler") {
      const annonceId = interaction.options.getString("annonce");
      const listings = loadMarketplace();
      const idx = listings.findIndex(
        (l) => l.id === annonceId && l.seller === userId,
      );
      if (idx === -1)
        return interaction.reply({
          embeds: [
            createEmbed(
              "error",
              "Annonce introuvable ou vous n'êtes pas le vendeur.",
            ),
          ],
          ephemeral: true,
        });

      const listing = listings.splice(idx, 1)[0];
      saveMarketplace(listings);

      // Rendre l'item au vendeur
      const player = getPlayer(userId);
      if (!player.inventory) player.inventory = {};
      player.inventory[listing.itemId] =
        (player.inventory[listing.itemId] || 0) + 1;
      updatePlayer(userId, player);

      return interaction.reply({
        embeds: [
          createEmbed(
            "success",
            "Annonce annulée",
            `Votre annonce ${listing.id} a été annulée et l'item rendu.`,
          ),
        ],
      });
    }

    if (sub === "acheter") {
      const annonceId = interaction.options.getString("annonce");
      const listings = loadMarketplace();
      const idx = listings.findIndex((l) => l.id === annonceId);
      if (idx === -1)
        return interaction.reply({
          embeds: [createEmbed("error", "Annonce introuvable.")],
          ephemeral: true,
        });

      const listing = listings[idx];
      if (listing.seller === userId)
        return interaction.reply({
          embeds: [
            createEmbed(
              "error",
              "Vous ne pouvez pas acheter votre propre annonce.",
            ),
          ],
          ephemeral: true,
        });

      const buyer = getPlayer(userId);
      if (!buyer)
        return interaction.reply({
          embeds: [createEmbed("error", "Personnage introuvable.")],
          ephemeral: true,
        });

      if ((buyer.gold || 0) < listing.price)
        return interaction.reply({
          embeds: [
            createEmbed("error", "Vous n'avez pas assez d'or pour cet achat."),
          ],
          ephemeral: true,
        });

      const seller = getPlayer(listing.seller);
      if (!seller)
        return interaction.reply({
          embeds: [
            createEmbed(
              "error",
              "Vendeur introuvable (compte supprimé). L'annonce sera retirée.",
            ),
          ],
          ephemeral: true,
        });

      // Transfert
      buyer.gold -= listing.price;
      seller.gold = (seller.gold || 0) + listing.price;

      // Donner l'item au buyer
      if (!buyer.inventory) buyer.inventory = {};
      buyer.inventory[listing.itemId] =
        (buyer.inventory[listing.itemId] || 0) + 1;

      // Retirer l'annonce
      listings.splice(idx, 1);
      saveMarketplace(listings);

      // Sauvegarder joueurs
      updatePlayer(userId, buyer);
      updatePlayer(listing.seller, seller);

      const it = findItemData(listing.itemId);
      const name = it ? it.data.name : listing.itemId;

      return interaction.reply({
        embeds: [
          createEmbed(
            "success",
            "Achat réussi",
            `Vous avez acheté **${name}** pour **${listing.price} 💰** (vendeur: <@${listing.seller}>)`,
          ),
        ],
      });
    }
  },
};
