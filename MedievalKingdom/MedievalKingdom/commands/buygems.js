const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// Charger les variables d'environnement
require("dotenv").config();

// Valider les variables requises
if (!process.env.PAYPAL_EMAIL) {
  console.error("⚠️ PAYPAL_EMAIL manquant dans les variables d'environnement");
}

const gemPacks = [
  { id: "pack1", name: "Pack Découverte", gemmes: 100, price: 1.99, bonus: "" },
  {
    id: "pack2",
    name: "Pack Aventurier",
    gemmes: 600,
    price: 9.99,
    bonus: "+100 gemmes offerts",
  },
  {
    id: "pack3",
    name: "Pack Héros",
    gemmes: 1300,
    price: 19.99,
    bonus: "+300 gemmes offerts",
  },
  {
    id: "pack4",
    name: "Pack Légendaire",
    gemmes: 3500,
    price: 49.99,
    bonus: "+1000 gemmes offerts",
  },
];

// Récupérer l'email PayPal depuis les variables d'environnement
const PAYPAL_EMAIL = process.env.PAYPAL_EMAIL || "changez_moi_dans_.env";

// Validation de l'email PayPal
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("achetergemmes")
    .setDescription(
      "Voir les packs de gemmes et obtenir un lien PayPal sécurisé.",
    )
    .addStringOption((option) =>
      option
        .setName("pack")
        .setDescription("ID du pack à acheter (optionnel)")
        .setRequired(false),
    ),
  async execute(interaction) {
    // Vérifier que PayPal est configuré correctement
    if (!isValidEmail(PAYPAL_EMAIL)) {
      return interaction.reply({
        content:
          "❌ PayPal n'est pas configuré correctement. Contactez l'administrateur.",
        ephemeral: true,
      });
    }

    const packId = interaction.options.getString("pack");
    if (!packId) {
      // Affiche la liste des packs avec liens PayPal personnalisés
      const embed = new EmbedBuilder()
        .setTitle("💎 Acheter des gemmes via PayPal")
        .setDescription(
          "Voici les packs disponibles. Clique sur le lien pour payer via PayPal. Les gemmes seront créditées automatiquement après paiement.",
        )
        .addFields(
          gemPacks.map((p) => ({
            name: `${p.name} — ${p.gemmes} gemmes pour ${p.price}€ ${
              p.bonus ? `\n${p.bonus}` : ""
            }`,
            value: `[Acheter sur PayPal](https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(
              PAYPAL_EMAIL,
            )}&item_name=${encodeURIComponent(p.name)}&amount=${
              p.price
            }&currency_code=EUR&custom=${interaction.user.id})`,
          })),
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    // Génère le lien PayPal pour le pack choisi
    const pack = gemPacks.find((p) => p.id === packId);
    if (!pack) {
      return interaction.reply({
        content: "❌ Pack invalide.",
        ephemeral: true,
      });
    }
    const url = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(
      PAYPAL_EMAIL,
    )}&item_name=${encodeURIComponent(pack.name)}&amount=${
      pack.price
    }&currency_code=EUR&custom=${interaction.user.id}`;
    return interaction.reply({
      content: `✅ Clique ici pour acheter ton pack : ${url}\nLes gemmes seront créditées automatiquement après paiement.`,
      ephemeral: true,
    });
  },
};
