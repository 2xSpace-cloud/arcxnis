import React, { useEffect, useState, useContext } from 'react';
import { UserContext, Avatar } from '../App.jsx';

const CLASS_EMOJI = { chevalier: '⚔️', mage: '🔮', voleur: '🗡️', barde: '🎵' };

const RANK_STYLES = [
  { color: '#FFD700', icon: '🥇' },
  { color: '#C0C0C0', icon: '🥈' },
  { color: '#CD7F32', icon: '🥉' },
];

export default function LeaderboardPage() {
  const { user } = useContext(UserContext);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('level');

  useEffect(() => {
    fetch('/api/leaderboard', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setLeaderboard(data.leaderboard || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div><span>Chargement...</span></div>;

  const sortOptions = [
    { key: 'level', label: 'Niveau' },
    { key: 'experience', label: 'XP' },
    { key: 'gold', label: 'Or' },
    { key: 'combatWins', label: 'Victoires' },
    { key: 'questsCompleted', label: 'Quêtes' },
    { key: 'reputation', label: 'Réputation' },
  ];

  const sorted = [...leaderboard].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
  const myRank = sorted.findIndex(p => p.id === user?.id) + 1;

  return (
    <div>
      <div className="page-header">
        <h1>🏆 Classement</h1>
        <p>
          {leaderboard.length} aventuriers dans le royaume
          {myRank > 0 && <span> — Vous êtes <span style={{ color: 'var(--gold)' }}>#{myRank}</span></span>}
        </p>
      </div>

      {/* Sort buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {sortOptions.map(opt => (
          <button key={opt.key} onClick={() => setSortBy(opt.key)} style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid',
            borderColor: sortBy === opt.key ? 'var(--gold)' : 'var(--border)',
            background: sortBy === opt.key ? 'var(--bg-card2)' : 'transparent',
            color: sortBy === opt.key ? 'var(--gold)' : 'var(--text-muted)',
            cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'Cinzel, serif'
          }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Podium top 3 */}
      {sorted.length >= 3 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, justifyContent: 'center' }}>
          {[sorted[1], sorted[0], sorted[2]].map((player, idx) => {
            const actualRank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
            const style = RANK_STYLES[actualRank - 1];
            const height = actualRank === 1 ? 120 : actualRank === 2 ? 90 : 70;
            return (
              <div key={player.id} style={{ textAlign: 'center', flex: 1, maxWidth: 180 }}>
                <div style={{ fontSize: '0.85rem', fontFamily: 'Cinzel', color: style.color, marginBottom: 4 }}>{CLASS_EMOJI[player.class] || '❓'} {player.name}</div>
                <div style={{
                  background: `linear-gradient(180deg, ${style.color}22, ${style.color}44)`,
                  border: `1px solid ${style.color}66`,
                  borderRadius: 'var(--radius) var(--radius) 0 0',
                  height, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 8,
                  fontSize: '1.5rem'
                }}>{style.icon}</div>
                <div style={{ background: 'var(--bg-card)', border: `1px solid ${style.color}44`, borderTop: 'none', padding: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Niv. {player.level} • {player[sortBy]?.toLocaleString()} {sortOptions.find(o => o.key === sortBy)?.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Aventurier</th>
              <th>Classe</th>
              <th>Niveau</th>
              <th>Or</th>
              <th>Victoires</th>
              <th>Quêtes</th>
              <th>Réputation</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((player, i) => {
              const isMe = player.id === user?.id;
              return (
                <tr key={player.id} style={isMe ? { background: 'rgba(255,215,0,0.05)' } : {}}>
                  <td>
                    <span className="rank" style={{ color: RANK_STYLES[i]?.color || 'var(--text-muted)' }}>
                      {RANK_STYLES[i]?.icon || `#${i + 1}`}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar user={{ avatarUrl: player.avatarUrl, username: player.name, displayName: player.discordNick || player.name }} size={30} />
                      <span style={{ color: isMe ? 'var(--gold)' : 'var(--text-bright)', fontWeight: isMe ? 700 : 400 }}>
                        {player.discordNick || player.name}
                        {isMe && <span style={{ fontSize: '0.7rem', color: 'var(--gold)', fontFamily: 'Cinzel', marginLeft: 4 }}>← vous</span>}
                      </span>
                    </div>
                  </td>
                  <td>{CLASS_EMOJI[player.class] || '❓'} {player.class}</td>
                  <td><span className="num-gold">{player.level}</span></td>
                  <td>{(player.gold || 0).toLocaleString()}</td>
                  <td><span className="num-green">{player.combatWins}</span></td>
                  <td>{player.questsCompleted}</td>
                  <td>{player.reputation}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
