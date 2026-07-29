const { EmbedBuilder } = require('discord.js');
const config = require('../config.js');

/**
 * Crée un embed Discord avec un style cohérent
 */
function createEmbed(type, title, description = null) {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setTimestamp()
        .setFooter({ text: '🏰 Royaume Médiéval' });
    
    if (description) {
        embed.setDescription(description);
    }
    
    // Définir les couleurs selon le type
    switch (type) {
        case 'success':
            embed.setColor(config.successColor);
            embed.setThumbnail('https://cdn.discordapp.com/emojis/852818906871644180.png'); // Icône de succès
            break;
            
        case 'error':
            embed.setColor(config.errorColor);
            embed.setThumbnail('https://cdn.discordapp.com/emojis/852818906611204116.png'); // Icône d'erreur
            break;
            
        case 'warning':
            embed.setColor('#FFA500'); // Orange
            embed.setThumbnail('https://cdn.discordapp.com/emojis/852818906880032768.png'); // Icône d'avertissement
            break;
            
        case 'info':
            embed.setColor(config.embedColor);
            break;
            
        case 'combat':
            embed.setColor('#8B0000'); // Rouge foncé
            embed.setThumbnail('https://cdn.discordapp.com/emojis/852818907153408030.png'); // Icône de combat
            break;
            
        case 'quest':
            embed.setColor('#4B0082'); // Indigo
            embed.setThumbnail('https://cdn.discordapp.com/emojis/852818907107270676.png'); // Icône de quête
            break;
            
        case 'level_up':
            embed.setColor('#FFD700'); // Or
            embed.setThumbnail('https://cdn.discordapp.com/emojis/852818907144888330.png'); // Icône de niveau
            break;
            
        default:
            embed.setColor(config.embedColor);
    }
    
    return embed;
}

/**
 * Crée un embed pour afficher un profil de joueur
 */
function createPlayerProfileEmbed(player, user) {
    const { classes, factions } = require('../systems/gameData.js');
    
    const classData = classes[player.class];
    const factionData = player.faction ? factions[player.faction] : null;
    
    const embed = createEmbed('info', `👤 ${player.name}`)
        .setThumbnail(user.displayAvatarURL())
        .setDescription(`Profil du ${classData.name} ${player.name}`)
        .addFields(
            { 
                name: '⚔️ Classe', 
                value: `${classData.emoji} ${classData.name}`, 
                inline: true 
            },
            { 
                name: '⭐ Niveau', 
                value: player.level.toString(), 
                inline: true 
            },
            { 
                name: '✨ Expérience', 
                value: `${player.experience}/${player.level * 100}`, 
                inline: true 
            },
            { 
                name: '❤️ Vie', 
                value: `${player.health}/${player.maxHealth}`, 
                inline: true 
            },
            { 
                name: '🔮 Mana', 
                value: `${player.mana}/${player.maxMana}`, 
                inline: true 
            },
            { 
                name: '💰 Or', 
                value: player.gold.toString(), 
                inline: true 
            },
            { 
                name: '🏆 Réputation', 
                value: player.reputation.toString(), 
                inline: true 
            },
            { 
                name: '🏛️ Faction', 
                value: factionData ? `${factionData.emoji} ${factionData.name}` : 'Aucune', 
                inline: true 
            },
            { 
                name: '⚔️ Combats', 
                value: `${player.combat.wins}V - ${player.combat.losses}D`, 
                inline: true 
            }
        );
    
    // Ajouter la progression de niveau
    const expForNext = player.level * 100;
    const expProgress = Math.floor((player.experience / expForNext) * 100);
    const progressBar = createProgressBar(expProgress, 20);
    
    embed.addFields({ 
        name: '📈 Progression', 
        value: `${progressBar} ${expProgress}%`, 
        inline: false 
    });
    
    return embed;
}

/**
 * Crée un embed pour les quêtes
 */
function createQuestEmbed(quest, player = null) {
    const embed = createEmbed('quest', `📜 ${quest.title}`)
        .setDescription(quest.description)
        .addFields(
            { 
                name: '⏱️ Durée estimée', 
                value: `${quest.duration} minutes`, 
                inline: true 
            },
            { 
                name: '🎁 Récompenses', 
                value: formatQuestRewards(quest.rewards), 
                inline: true 
            }
        );
    
    if (quest.requirements) {
        embed.addFields({ 
            name: '📋 Prérequis', 
            value: formatQuestRequirements(quest.requirements), 
            inline: false 
        });
    }
    
    if (player && quest.startTime) {
        const startTime = new Date(quest.startTime);
        const elapsed = Math.floor((Date.now() - startTime) / 60000);
        const remaining = Math.max(0, quest.duration - elapsed);
        
        const progressPercent = Math.floor((elapsed / quest.duration) * 100);
        const progressBar = createProgressBar(progressPercent, 15);
        
        embed.addFields({ 
            name: '⏳ Progression', 
            value: `${progressBar}\n${elapsed}/${quest.duration} min (${remaining} min restantes)`, 
            inline: false 
        });
    }
    
    return embed;
}

/**
 * Crée un embed pour les combats
 */
function createCombatEmbed(combat) {
    const { player, opponent } = combat;
    
    const embed = createEmbed('combat', '⚔️ Combat en cours')
        .setDescription(`${player.name} affronte ${opponent.name}`)
        .addFields(
            { 
                name: `👤 ${player.name}`, 
                value: `❤️ ${player.health}/${player.maxHealth}\n🔮 ${player.mana}/${player.maxMana}`, 
                inline: true 
            },
            { 
                name: '🆚', 
                value: '\u200b', 
                inline: true 
            },
            { 
                name: `${combat.type === 'pve' ? '👹' : '👤'} ${opponent.name}`, 
                value: `❤️ ${opponent.health}/${opponent.maxHealth}${opponent.mana ? `\n🔮 ${opponent.mana}/${opponent.maxMana}` : ''}`, 
                inline: true 
            }
        );
    
    // Barres de vie visuelles
    const playerHealthPercent = Math.floor((player.health / player.maxHealth) * 100);
    const opponentHealthPercent = Math.floor((opponent.health / opponent.maxHealth) * 100);
    
    const playerHealthBar = createHealthBar(playerHealthPercent);
    const opponentHealthBar = createHealthBar(opponentHealthPercent);
    
    embed.addFields(
        { 
            name: `💖 Vie de ${player.name}`, 
            value: playerHealthBar, 
            inline: true 
        },
        { 
            name: '\u200b', 
            value: '\u200b', 
            inline: true 
        },
        { 
            name: `💖 Vie de ${opponent.name}`, 
            value: opponentHealthBar, 
            inline: true 
        }
    );
    
    if (combat.lastAction) {
        embed.addFields({ 
            name: '💥 Dernière action', 
            value: combat.lastAction, 
            inline: false 
        });
    }
    
    embed.addFields({ 
        name: '🎯 Tour actuel', 
        value: `Tour ${combat.turn} - ${combat.currentTurn === player.id ? player.name : opponent.name}`, 
        inline: false 
    });
    
    return embed;
}

/**
 * Crée un embed pour les classements
 */
function createLeaderboardEmbed(players, type, title) {
    const embed = createEmbed('info', `🏆 ${title}`)
        .setDescription('Classement des meilleurs aventuriers du royaume');
    
    if (players.length === 0) {
        embed.addFields({ 
            name: '📊 Classement', 
            value: 'Aucun joueur à afficher', 
            inline: false 
        });
        return embed;
    }
    
    let leaderboard = '';
    const medals = ['🥇', '🥈', '🥉'];
    
    players.slice(0, 10).forEach((player, index) => {
        const rank = index < 3 ? medals[index] : `${index + 1}.`;
        const value = getLeaderboardValue(player, type);
        
        leaderboard += `${rank} **${player.name}** - ${value}\n`;
    });
    
    embed.addFields({ 
        name: '👥 Top 10', 
        value: leaderboard, 
        inline: false 
    });
    
    return embed;
}

/**
 * Crée une barre de progression
 */
function createProgressBar(percentage, length = 20) {
    const filled = Math.floor((percentage / 100) * length);
    const empty = length - filled;
    
    const fillChar = '█';
    const emptyChar = '░';
    
    return fillChar.repeat(filled) + emptyChar.repeat(empty);
}

/**
 * Crée une barre de vie colorée
 */
function createHealthBar(percentage) {
    const length = 10;
    const filled = Math.floor((percentage / 100) * length);
    const empty = length - filled;
    
    let fillChar = '🟩'; // Vert
    if (percentage < 30) {
        fillChar = '🟥'; // Rouge
    } else if (percentage < 60) {
        fillChar = '🟨'; // Jaune
    }
    
    return fillChar.repeat(filled) + '⬛'.repeat(empty) + ` ${percentage}%`;
}

/**
 * Formate les récompenses d'une quête
 */
function formatQuestRewards(rewards) {
    const parts = [];
    
    if (rewards.experience) {
        parts.push(`✨ ${rewards.experience} XP`);
    }
    
    if (rewards.gold) {
        parts.push(`💰 ${rewards.gold} or`);
    }
    
    if (rewards.items && rewards.items.length > 0) {
        parts.push(`🎁 ${rewards.items.length} objet(s)`);
    }
    
    return parts.join('\n') || 'Aucune récompense';
}

/**
 * Formate les prérequis d'une quête
 */
function formatQuestRequirements(requirements) {
    const parts = [];
    
    if (requirements.minLevel) {
        parts.push(`⭐ Niveau ${requirements.minLevel} minimum`);
    }
    
    if (requirements.classes) {
        parts.push(`⚔️ Classes: ${requirements.classes.join(', ')}`);
    }
    
    if (requirements.faction) {
        parts.push(`🏛️ Faction: ${requirements.faction}`);
    }
    
    return parts.join('\n') || 'Aucun prérequis';
}

/**
 * Obtient la valeur d'affichage pour un classement
 */
function getLeaderboardValue(player, type) {
    switch (type) {
        case 'level':
            return `Niveau ${player.level} (${player.experience} XP)`;
        case 'gold':
            return `${player.gold} 💰`;
        case 'reputation':
            return `${player.reputation} 🏆`;
        case 'wins':
            const totalCombats = player.combat.wins + player.combat.losses;
            const winRate = totalCombats > 0 ? ((player.combat.wins / totalCombats) * 100).toFixed(1) : 0;
            return `${player.combat.wins} victoires (${winRate}%)`;
        case 'quests':
            return `${player.quests.completed.length} quêtes terminées`;
        default:
            return 'N/A';
    }
}

/**
 * Crée un embed d'erreur standard
 */
function createErrorEmbed(message, details = null) {
    const embed = createEmbed('error', '❌ Erreur', message);
    
    if (details) {
        embed.addFields({ 
            name: '🔍 Détails', 
            value: details, 
            inline: false 
        });
    }
    
    return embed;
}

/**
 * Crée un embed de succès standard
 */
function createSuccessEmbed(message, details = null) {
    const embed = createEmbed('success', '✅ Succès', message);
    
    if (details) {
        embed.addFields({ 
            name: '📋 Détails', 
            value: details, 
            inline: false 
        });
    }
    
    return embed;
}

module.exports = {
    createEmbed,
    createPlayerProfileEmbed,
    createQuestEmbed,
    createCombatEmbed,
    createLeaderboardEmbed,
    createProgressBar,
    createHealthBar,
    createErrorEmbed,
    createSuccessEmbed,
    formatQuestRewards,
    formatQuestRequirements
};
