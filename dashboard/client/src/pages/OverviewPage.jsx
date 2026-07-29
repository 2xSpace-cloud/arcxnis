import React, { useEffect, useState, useContext } from 'react';
import { UserContext } from '../App.jsx';

const CLASS_EMOJI = { chevalier: '⚔️', mage: '🔮', voleur: '🗡️', barde: '🎵' };

export default function OverviewPage() {
  const { user } = useContext(UserContext);
  const [player, setPlayer] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/player', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/stats', { credentials: 'include' }).then(r => r.json())
    ]).then(([pd, sd]) => {
      setPlayer(pd.player);
      setStats(sd);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div><span>Chargement...</span></div>;

  const xpForNextLevel = player ? (player.level || 1) * 100 : 100;
  const xpPct = player ? Math.min(100, ((player.experience || 0) / xpForNextLevel) * 100) : 0;
  const hpPct = player ? Math.min(100, ((player.health || 0) / (player.maxHealth || 1)) * 100) : 0;
  const manaPct = player ? Math.min(100, ((player.mana || 0) / (player.maxMana || 1)) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <h1>🏰 Tableau de bord</h1>
        <p>Bienvenue, <strong style={{ color: 'var(--gold)' }}>{user?.username}</strong> !</p>
      </div>

      {/* Server stats */}
      {stats && (
        <div className="overview-grid">
          <div className="overview-box">
            <span className="overview-icon">⚔️</span>
            <div>
              <div className="overview-label">Aventuriers</div>
              <div className="overview-val">{stats.totalPlayers}</div>
            </div>
          </div>
          <div className="overview-box">
            <span className="overview-icon">💰</span>
            <div>
              <div className="overview-label">Or total</div>
              <div className="overview-val">{(stats.totalGold || 0).toLocaleString()}</div>
            </div>
          </div>
          <div className="overview-box">
            <span className="overview-icon">🏆</span>
            <div>
              <div className="overview-label">Combats gagnés</div>
              <div className="overview-val">{stats.totalWins || 0}</div>
            </div>
          </div>
          <div className="overview-box">
            <span className="overview-icon">📜</span>
            <div>
              <div className="overview-label">Quêtes complétées</div>
              <div className="overview-val">{stats.totalQuests || 0}</div>
            </div>
          </div>
        </div>
      )}

      {!player ? (
        <div className="no-char">
          <h2>🆕 Aucun personnage trouvé</h2>
          <p>Rejoignez le bot Discord pour créer votre personnage et commencer l'aventure.</p>
        </div>
      ) : (
        <div className="grid-2">
          {/* Character summary */}
          <div className="card">
            <div className="card-title">⚔️ Mon Personnage</div>
            <div className="char-header">
              <div className="char-avatar">{CLASS_EMOJI[player.class] || '❓'}</div>
              <div className="char-info">
                <h2>{player.name}</h2>
                <div className="char-meta">
                  <span className="pill pill-gold">Niveau {player.level || 1}</span>
                  <span className="pill pill-blue">{player.classData?.name || player.class}</span>
                  {player.faction && <span className="pill pill-purple">{player.factionData?.name || player.faction}</span>}
                </div>
              </div>
            </div>

            <div className="stat-bar-wrap">
              <div className="stat-bar-label"><span>❤️ Points de vie</span><span>{player.health || 0} / {player.maxHealth || 0}</span></div>
              <div className="stat-bar"><div className="stat-bar-fill bar-hp" style={{ width: `${hpPct}%` }}></div></div>
            </div>
            <div className="stat-bar-wrap">
              <div className="stat-bar-label"><span>💧 Mana</span><span>{player.mana || 0} / {player.maxMana || 0}</span></div>
              <div className="stat-bar"><div className="stat-bar-fill bar-mana" style={{ width: `${manaPct}%` }}></div></div>
            </div>
            <div className="stat-bar-wrap">
              <div className="stat-bar-label"><span>⭐ Expérience</span><span>{player.experience || 0} / {xpForNextLevel}</span></div>
              <div className="stat-bar"><div className="stat-bar-fill bar-xp" style={{ width: `${xpPct}%` }}></div></div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="card">
            <div className="card-title">📊 Résumé</div>
            <div className="info-row"><label>💰 Or</label><value className="num-gold">{(player.gold || 0).toLocaleString()}</value></div>
            <div className="info-row"><label>💎 Gemmes</label><value className="num-blue">{player.gemmes || 0}</value></div>
            <div className="info-row"><label>⭐ Réputation</label><value>{player.reputation || 0}</value></div>
            <div className="info-row"><label>🏆 Victoires</label><value className="num-green">{player.combat?.wins || 0}</value></div>
            <div className="info-row"><label>💀 Défaites</label><value className="num-red">{player.combat?.losses || 0}</value></div>
            <div className="info-row"><label>📜 Quêtes</label><value>{player.quests?.completed?.length || 0} complétées</value></div>
            <div className="info-row"><label>🎒 Inventaire</label><value>{Object.keys(player.inventory || {}).length} objets</value></div>
          </div>
        </div>
      )}

      {/* Class breakdown */}
      {stats?.classCounts && (
        <div className="card">
          <div className="card-title">🗡️ Répartition des classes</div>
          <div className="grid-4">
            {Object.entries(stats.classCounts).map(([cls, count]) => (
              <div key={cls} className="stat-box">
                <span className="stat-val">{CLASS_EMOJI[cls] || '❓'}</span>
                <span className="stat-name">{cls}</span>
                <span style={{ color: 'var(--gold)', fontFamily: 'Cinzel', fontSize: '1.1rem' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
