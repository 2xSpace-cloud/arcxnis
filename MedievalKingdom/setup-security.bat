@echo off
REM Script d'installation de sécurité pour MedievalKingdom Bot (Windows)

echo.
echo 🔒 Installation de sécurité - MedievalKingdom Bot
echo ==================================================
echo.

REM Vérifier que npm est installé
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm n'est pas installé. Veuillez installer Node.js et npm.
    pause
    exit /b 1
)

echo 📦 Installation des dépendances...
call npm install

echo.
echo ✅ Dépendances installées!
echo.
echo 📝 Prochaines étapes:
echo.
echo 1. Créez un fichier .env à la racine du projet
echo    (Copiez .env.example et renommez-le en .env)
echo.
echo 2. Remplissez le fichier .env avec vos vraies valeurs:
echo    - DISCORD_TOKEN: Votre token Discord
echo    - CLIENT_ID: ID de votre application Discord
echo    - GUILD_ID: ID de votre serveur (optionnel)
echo    - STRIPE_SECRET_KEY: Votre clé secrète Stripe
echo    - STRIPE_WEBHOOK_SECRET: Votre secret webhook Stripe
echo    - PAYPAL_EMAIL: Votre email PayPal
echo.
echo 3. Régénérez votre token Discord:
echo    https://discord.com/developers/applications
echo.
echo 4. Lancez le bot:
echo    node index.js
echo.
echo 🔒 Important: Ne jamais commiter le fichier .env!
echo.
pause
