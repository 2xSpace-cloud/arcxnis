// Load environment variables
require("dotenv").config();

// Validate required environment variables
if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
  console.error("❌ ERREUR: Variables Stripe manquantes");
  console.error(
    "Assurez-vous que .env contient STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET",
  );
  process.exit(1);
}

// Serveur Express pour Stripe Webhook et création de sessions de paiement
const express = require("express");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { getPlayer, updatePlayer } = require("./utils/database");

const app = express();
const PORT = process.env.PORT || 4242;

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite 100 requêtes par fenêtre
  message: "Trop de requêtes, veuillez réessayer plus tard",
  standardHeaders: true,
  legacyHeaders: false,
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limite les webhooks
  skip: (req) => req.path !== "/webhook", // s'applique uniquement au webhook
});

app.use(limiter);
app.use(bodyParser.json());
app.use(webhookLimiter);

// Validation de l'ID Discord
function validateDiscordId(id) {
  return /^\d{15,}$/.test(id);
}

const app = express();
const PORT = process.env.PORT || 4242;

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite 100 requêtes par fenêtre
  message: "Trop de requêtes, veuillez réessayer plus tard",
  standardHeaders: true,
  legacyHeaders: false,
});

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limite les webhooks
  skip: (req) => req.path !== "/webhook", // s'applique uniquement au webhook
});

app.use(limiter);
app.use(bodyParser.json());
app.use(webhookLimiter);

// Validation de l'ID Discord
function validateDiscordId(id) {
  return /^\d{15,}$/.test(id);
}

// Packs de gemmes (doivent correspondre à ceux du bot)
const gemPacks = {
  pack1: { gemmes: 100, price: 199 }, // prix en centimes
  pack2: { gemmes: 600, price: 999 },
  pack3: { gemmes: 1300, price: 1999 },
  pack4: { gemmes: 3500, price: 4999 },
};

// Création d'une session Stripe Checkout
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { packId, discordId } = req.body;

    // Valider l'ID Discord
    if (!discordId || !validateDiscordId(discordId)) {
      return res.status(400).json({ error: "ID Discord invalide" });
    }

    const pack = gemPacks[packId];
    if (!pack) return res.status(400).json({ error: "Pack invalide" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: `Pack de ${pack.gemmes} gemmes` },
            unit_amount: pack.price,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "https://votre-site/success",
      cancel_url: "https://votre-site/cancel",
      metadata: { discordId, packId },
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur création session:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Webhook Stripe pour créditer les gemmes
app.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error("Webhook signature error:", err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const discordId = session.metadata?.discordId;
      const packId = session.metadata?.packId;

      // Valider les métadonnées
      if (!discordId || !validateDiscordId(discordId)) {
        console.error("Métadonnées de session invalides");
        return res.status(400).json({ error: "Données de session invalides" });
      }

      const pack = gemPacks[packId];
      if (discordId && pack) {
        try {
          const player = getPlayer(discordId);
          if (player) {
            player.gemmes = (player.gemmes || 0) + pack.gemmes;
            updatePlayer(discordId, player);
            console.log(`✅ Gemmes créditées à ${discordId} : +${pack.gemmes}`);
          }
        } catch (error) {
          console.error("Erreur mise à jour gemmes:", error);
        }
      }
    }
    res.json({ received: true });
  },
);

app.listen(PORT, () =>
  console.log(`🎮 Serveur Stripe en ligne sur le port ${PORT}`),
);
