const { factions } = require('../systems/gameData.js');

// Noms des rôles Discord pour chaque faction (le bot les crée automatiquement si absents)
const FACTION_ROLE_NAMES = {
    ordre_royal:        '👑 Ordre Royal',
    guilde_ombres:      '🌙 Guilde des Ombres',
    cercle_druidique:   '🌿 Cercle Druidique',
    academie_arcanique: '🏛️ Académie Arcanique',
};

// Couleurs associées à chaque faction
const FACTION_COLORS = {
    ordre_royal:        0xFFD700,
    guilde_ombres:      0x9B59B6,
    cercle_druidique:   0x2ECC71,
    academie_arcanique: 0x3498DB,
};

/**
 * Trouve ou crée le rôle Discord d'une faction sur le serveur.
 * @param {Guild} guild
 * @param {string} factionKey
 * @returns {Promise<Role|null>}
 */
async function getOrCreateFactionRole(guild, factionKey) {
    const name = FACTION_ROLE_NAMES[factionKey];
    if (!name) return null;

    // Chercher par nom (insensible à la casse)
    let role = guild.roles.cache.find(r => r.name === name);
    if (role) return role;

    // Pas trouvé → créer le rôle
    try {
        role = await guild.roles.create({
            name,
            color: FACTION_COLORS[factionKey] || 0x99AAB5,
            mentionable: false,
            reason: 'Création automatique du rôle de faction Medieval Kingdom',
        });
        console.log(`✅ Rôle créé automatiquement : ${name}`);
        return role;
    } catch (err) {
        console.error(`❌ Impossible de créer le rôle ${name} :`, err.message);
        return null;
    }
}

// Noms des rôles Discord pour chaque classe
const CLASS_ROLE_NAMES = {
    chevalier:  '⚔️ Chevalier',
    mage:       '🔮 Mage',
    voleur:     '🗡️ Voleur',
    barde:      '🎵 Barde',
};

const CLASS_COLORS = {
    chevalier:  0xE74C3C,
    mage:       0x9B59B6,
    voleur:     0x2ECC71,
    barde:      0xF39C12,
};

/**
 * Trouve ou crée le rôle Discord d'une classe sur le serveur.
 */
async function getOrCreateClassRole(guild, classKey) {
    const name = CLASS_ROLE_NAMES[classKey];
    if (!name) return null;
    let role = guild.roles.cache.find(r => r.name === name);
    if (role) return role;
    try {
        role = await guild.roles.create({
            name,
            color: CLASS_COLORS[classKey] || 0x99AAB5,
            mentionable: false,
            reason: 'Création automatique du rôle de classe Medieval Kingdom',
        });
        console.log(`✅ Rôle classe créé automatiquement : ${name}`);
        return role;
    } catch (err) {
        console.error(`❌ Impossible de créer le rôle classe ${name} :`, err.message);
        return null;
    }
}

/**
 * Ajoute le rôle de classe à un membre Discord (retire les autres rôles de classe).
 */
async function syncClassRole(member, classKey) {
    try {
        // Retirer tous les rôles de classe existants
        for (const key of Object.keys(CLASS_ROLE_NAMES)) {
            const name = CLASS_ROLE_NAMES[key];
            const role = member.guild.roles.cache.find(r => r.name === name);
            if (role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role).catch(() => {});
            }
        }
        // Ajouter le bon rôle
        if (!classKey) return true;
        const role = await getOrCreateClassRole(member.guild, classKey);
        if (!role) return false;
        await member.roles.add(role);
        return true;
    } catch (err) {
        console.error(`Erreur syncClassRole ${classKey} :`, err.message);
        return false;
    }
}

/**
 * Vérifie si un membre a le bon rôle de classe.
 */
function checkClassRoleSync(member, classKey) {
    try {
        const correctName = CLASS_ROLE_NAMES[classKey];
        const correctRole = correctName
            ? member.guild.roles.cache.find(r => r.name === correctName)
            : null;
        // Must have correct role
        if (correctRole && !member.roles.cache.has(correctRole.id)) return false;
        // Must not have other class roles
        for (const [key, name] of Object.entries(CLASS_ROLE_NAMES)) {
            if (key === classKey) continue;
            const r = member.guild.roles.cache.find(x => x.name === name);
            if (r && member.roles.cache.has(r.id)) return false;
        }
        return true;
    } catch { return false; }
}

/**
 * Initialise les rôles de faction au démarrage (crée ceux qui manquent).
 * @param {Guild} guild
 */
async function initFactionRoles(guild) {
    console.log('🔧 Vérification des rôles de faction...');
    for (const key of Object.keys(FACTION_ROLE_NAMES)) {
        await getOrCreateFactionRole(guild, key);
    }
    console.log('✅ Rôles de faction prêts.');
    console.log('🔧 Vérification des rôles de classe...');
    for (const key of Object.keys(CLASS_ROLE_NAMES)) {
        await getOrCreateClassRole(guild, key);
    }
    console.log('✅ Rôles de classe prêts.');
}

/**
 * Ajoute le rôle de faction à un membre Discord.
 */
async function addFactionRole(member, factionKey) {
    try {
        const role = await getOrCreateFactionRole(member.guild, factionKey);
        if (!role) return false;
        if (member.roles.cache.has(role.id)) return true;
        await member.roles.add(role);
        console.log(`Rôle ${role.name} ajouté à ${member.user.tag}`);
        return true;
    } catch (error) {
        console.error(`Erreur lors de l'ajout du rôle ${factionKey} :`, error.message);
        return false;
    }
}

/**
 * Retire le rôle de faction d'un membre Discord.
 */
async function removeFactionRole(member, factionKey) {
    try {
        const name = FACTION_ROLE_NAMES[factionKey];
        if (!name) return false;
        const role = member.guild.roles.cache.find(r => r.name === name);
        if (!role) return true; // Rôle inexistant = pas besoin de retirer
        if (!member.roles.cache.has(role.id)) return true;
        await member.roles.remove(role);
        console.log(`Rôle ${role.name} retiré de ${member.user.tag}`);
        return true;
    } catch (error) {
        console.error(`Erreur lors du retrait du rôle ${factionKey} :`, error.message);
        return false;
    }
}

/**
 * Retire tous les rôles de faction d'un membre Discord.
 */
async function removeAllFactionRoles(member) {
    try {
        let success = true;
        for (const key of Object.keys(FACTION_ROLE_NAMES)) {
            const name = FACTION_ROLE_NAMES[key];
            const role = member.guild.roles.cache.find(r => r.name === name);
            if (role && member.roles.cache.has(role.id)) {
                const ok = await removeFactionRole(member, key);
                if (!ok) success = false;
            }
        }
        return success;
    } catch (error) {
        console.error('Erreur lors du retrait de tous les rôles de faction :', error.message);
        return false;
    }
}

/**
 * Synchronise les rôles d'un membre avec sa faction actuelle.
 */
async function syncFactionRoles(member, currentFaction) {
    try {
        const allRemoved = await removeAllFactionRoles(member);
        if (currentFaction) {
            const added = await addFactionRole(member, currentFaction);
            return allRemoved && added;
        }
        return allRemoved;
    } catch (error) {
        console.error('Erreur lors de la synchronisation des rôles de faction :', error.message);
        return false;
    }
}

/**
 * Vérifie si un membre a le bon rôle pour sa faction.
 */
function checkFactionRoleSync(member, playerFaction) {
    try {
        const allFactionRoles = Object.values(FACTION_ROLE_NAMES)
            .map(name => member.guild.roles.cache.find(r => r.name === name))
            .filter(Boolean);

        if (!playerFaction) {
            return !allFactionRoles.some(r => member.roles.cache.has(r.id));
        }

        const correctName = FACTION_ROLE_NAMES[playerFaction];
        if (!correctName) return false;
        const correctRole = member.guild.roles.cache.find(r => r.name === correctName);
        if (!correctRole || !member.roles.cache.has(correctRole.id)) return false;

        // Vérifier qu'il n'a pas d'autres rôles de faction
        for (const [key, name] of Object.entries(FACTION_ROLE_NAMES)) {
            if (key === playerFaction) continue;
            const role = member.guild.roles.cache.find(r => r.name === name);
            if (role && member.roles.cache.has(role.id)) return false;
        }
        return true;
    } catch (error) {
        console.error('Erreur checkFactionRoleSync :', error.message);
        return false;
    }
}

/**
 * Obtient le nom du rôle Discord pour une faction.
 */
function getFactionRoleName(factionKey, guild) {
    return FACTION_ROLE_NAMES[factionKey] || null;
}

module.exports = {
    FACTION_ROLE_NAMES,
    CLASS_ROLE_NAMES,
    initFactionRoles,
    getOrCreateClassRole,
    syncClassRole,
    checkClassRoleSync,
    addFactionRole,
    removeFactionRole,
    removeAllFactionRoles,
    syncFactionRoles,
    checkFactionRoleSync,
    getFactionRoleName,
};
