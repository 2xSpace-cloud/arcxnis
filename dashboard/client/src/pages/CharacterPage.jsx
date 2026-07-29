import React, { useEffect, useState } from 'react';
import { Avatar } from '../App.jsx';

const CLASS_EMOJI = { chevalier: '⚔️', mage: '🔮', voleur: '🗡️', barde: '🎵' };
const STAT_LABELS = {
  attack: { label: 'Attaque', icon: '⚔️' },
  defense: { label: 'Défense', icon: '🛡️' },
  magicAttack: { label: 'Attaque Magique', icon: '🔮' },
  magicDefense: { label: 'Défense Magique', icon: '✨' },
  speed: { label: 'Vitesse', icon: '💨' }
};

const EQUIP_SLOTS = [
  { key: 'weapon', label: 'Arme', icon: '⚔️' },
  { key: 'armor.head', label: 'Tête', icon: '⛑️' },
  { key: 'armor.chest', label: 'Torse', icon: '🥋' },
  { key: 'armor.legs', label: 'Jambes', icon: '👖' },
  { key: 'armor.feet', label: 'Pieds', icon: '👢' },
  { key: 'armor.hands', label: 'Mains', icon: '🧤' },
  { key: 'armor.shield', label: 'Bouclier', icon: '🛡️' },
];

function getEquipVal(equipment, key) {
  if (!equipment) return null;
  if (key === 'weapon') return equipment.weapon;
  const parts = key.split('.');
  return equipment[parts[0]]?.[parts[1]] || null;
}

export default function CharacterPage() {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/player', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setPlayer(data.player))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div><span>Chargement...</span></div>;

  if (!player) {
    return (
      <div>
        <div className="page-header"><h1>⚔️ Mon Personnage</h1></div>
        <div className="no-char">
          <h2>Aucun personnage trouvé</h2>
          <p>Utilisez le bot Discord pour créer votre personnage.</p>
        </div>
      </div>
    );
  }

  const cls = player.classData;
  const faction = player.factionData;
  const xpForNextLevel = (player.level || 1) * 100;
  const xpPct = Math.min(100, ((player.experience || 0) / xpForNextLevel) * 100);
  const hpPct = Math.min(100, ((player.health || 0) / (player.maxHealth || 1)) * 100);
  const manaPct = Math.min(100, ((player.mana || 0) / (player.maxMana || 1)) * 100);
  const winRate = (player.combat?.wins || 0) + (player.combat?.losses || 0) > 0
    ? Math.round(((player.combat?.wins || 0) / ((player.combat?.wins || 0) + (player.combat?.losses || 0))) * 100)
    : 0;

  return (
    <div>
      <div className="page-header">
        <h1>⚔️ Mon Personnage</h1>
        <p>Détails de votre héros</p>
      </div>

      {/* Header card */}
      <div className="card">
        <div className="char-header">
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar user={{ avatarUrl: player.discordAvatarUrl, username: player.name, displayName: player.discordDisplayName }} size={90} />
            <span style={{ position: 'absolute', bottom: -4, right: -4, fontSize: '1.6rem' }}>{CLASS_EMOJI[player.class] || '❓'}</span>
          </div>
          <div className="char-info" style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.6rem' }}>{player.name}</h2>
            <div className="char-meta" style={{ marginTop: 10 }}>
              <span className="pill pill-gold">⭐ Niveau {player.level || 1}</span>
              <span className="pill pill-blue">{cls?.emoji} {cls?.name || player.class}</span>
              {faction && <span className="pill pill-purple">{faction.emoji} {faction.name}</span>}
              <span className="pill pill-green">💰 {(player.gold || 0).toLocaleString()} or</span>
              <span className="pill">💎 {player.gemmes || 0} gemmes</span>
            </div>
            {cls && <p style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 500 }}>{cls.description}</p>}
          </div>
        </div>

        {/* Bars */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div className="stat-bar-wrap">
            <div className="stat-bar-label"><span>❤️ PV</span><span>{player.health || 0}/{player.maxHealth || 0}</span></div>
            <div className="stat-bar"><div className="stat-bar-fill bar-hp" style={{ width: `${hpPct}%` }}></div></div>
          </div>
          <div className="stat-bar-wrap">
            <div className="stat-bar-label"><span>💧 Mana</span><span>{player.mana || 0}/{player.maxMana || 0}</span></div>
            <div className="stat-bar"><div className="stat-bar-fill bar-mana" style={{ width: `${manaPct}%` }}></div></div>
          </div>
          <div className="stat-bar-wrap">
            <div className="stat-bar-label"><span>⭐ XP</span><span>{player.experience || 0}/{xpForNextLevel}</span></div>
            <div className="stat-bar"><div className="stat-bar-fill bar-xp" style={{ width: `${xpPct}%` }}></div></div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Combat stats */}
        <div className="card">
          <div className="card-title">⚔️ Statistiques de combat</div>
          <div className="stats-grid">
            {Object.entries(STAT_LABELS).map(([key, { label, icon }]) => (
              <div key={key} className="stat-box">
                <span className="stat-val">{icon} {player.stats?.[key] ?? 0}</span>
                <span className="stat-name">{label}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <div className="info-row"><label>🏆 Victoires</label><value className="num-green">{player.combat?.wins || 0}</value></div>
            <div className="info-row"><label>💀 Défaites</label><value className="num-red">{player.combat?.losses || 0}</value></div>
            <div className="info-row"><label>📊 Taux de victoire</label><value>{winRate}%</value></div>
            <div className="info-row"><label>⭐ Réputation</label><value>{player.reputation || 0}</value></div>
          </div>
        </div>

        {/* Abilities + equipment */}
        <div>
          {cls && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">✨ Capacités de classe</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cls.abilities.map((ab, i) => (
                  <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-dark)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.9rem' }}>
                    ✦ {ab}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Equipment */}
          <div className="card">
            <div className="card-title">🛡️ Équipement</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {EQUIP_SLOTS.map(slot => {
                const equipped = getEquipVal(player.equipment, slot.key);
                return (
                  <div key={slot.key} className="info-row">
                    <label>{slot.icon} {slot.label}</label>
                    <value style={{ color: equipped ? 'var(--gold)' : 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {equipped || '— vide —'}
                    </value>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Faction */}
      {faction && (
        <div className="card">
          <div className="card-title">🏛️ Faction</div>
          <div className="grid-2">
            <div className="faction-card">
              <span className="faction-emoji">{faction.emoji}</span>
              <div className="faction-name">{faction.name}</div>
              <div className="faction-desc">{faction.description}</div>
            </div>
            <div>
              <div className="card-title" style={{ border: 'none', paddingBottom: 0 }}>Objectifs</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 14 }}>{faction.goals}</p>
              <div className="card-title" style={{ border: 'none', paddingBottom: 0 }}>Avantages</div>
              {faction.bonuses?.map((b, i) => (
                <div key={i} style={{ padding: '6px 0', fontSize: '0.88rem', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>✓ {b}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
