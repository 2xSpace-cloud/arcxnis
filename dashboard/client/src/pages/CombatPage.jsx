import React, { useState, useEffect, useRef } from 'react';

const MONSTERS = {
  gobelin:  { name: 'Gobelin',       emoji: '👺', diff: 1, desc: 'Faible mais rapide. Idéal pour débuter.' },
  loup:     { name: 'Loup',          emoji: '🐺', diff: 2, desc: 'Agile et féroce. Attention à sa vitesse.' },
  squelette:{ name: 'Squelette',     emoji: '💀', diff: 3, desc: 'Résistance magique élevée.' },
  orc:      { name: 'Orc',           emoji: '👹', diff: 4, desc: 'Très robuste. Force brute redoutable.' },
  dragon:   { name: 'Jeune Dragon',  emoji: '🐉', diff: 5, desc: 'Boss ultime. Réservé aux héros confirmés.' },
};

function DiffStars({ n }) {
  return (
    <span style={{ color: 'var(--gold)', fontSize: '0.75rem' }}>
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  );
}

function HpBar({ current, max, color = '#c0392b' }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const barColor = pct > 50 ? '#27ae60' : pct > 25 ? '#e67e22' : '#c0392b';
  return (
    <div style={{ background: '#1a1408', borderRadius: 6, height: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        background: barColor,
        transition: 'width 0.4s ease',
        borderRadius: 6,
      }} />
    </div>
  );
}

function ManaBar({ current, max }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  return (
    <div style={{ background: '#1a1408', borderRadius: 6, height: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        background: '#2980b9',
        transition: 'width 0.4s ease',
        borderRadius: 6,
      }} />
    </div>
  );
}

function CombatantCard({ data, isPlayer, lastAction }) {
  const shakeClass = lastAction?.type?.startsWith('player') ? '' : (isPlayer ? 'shake' : '');
  return (
    <div style={{
      flex: 1, background: 'var(--bg-card)', border: `2px solid ${isPlayer ? 'var(--border-gold)' : '#5a1010'}`,
      borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ textAlign: 'center', fontSize: isPlayer ? '2.5rem' : '3rem', lineHeight: 1 }}>
        {isPlayer ? '🧙' : data.emoji}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold)', fontSize: '0.9rem', fontWeight: 700 }}>
          {data.name}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {isPlayer ? `Niv. ${data.level}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
          <span style={{ color: '#e74c3c' }}>❤️ PV</span>
          <span style={{ color: 'var(--text-bright)', fontWeight: 700 }}>{data.hp} / {data.maxHp}</span>
        </div>
        <HpBar current={data.hp} max={data.maxHp} />
        {isPlayer && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: 4 }}>
              <span style={{ color: '#3498db' }}>💧 Mana</span>
              <span style={{ color: 'var(--text-bright)', fontWeight: 700 }}>{data.mana} / {data.maxMana}</span>
            </div>
            <ManaBar current={data.mana} max={data.maxMana} />
          </>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginTop: 4 }}>
        {[
          ['⚔️', data.stats?.attack],
          ['🛡️', data.stats?.defense],
          ['🔮', data.stats?.magicAttack],
          ['✨', data.stats?.magicDefense],
          ['💨', data.stats?.speed],
        ].map(([icon, val], i) => (
          <div key={i} style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {icon} {val ?? '—'}
          </div>
        ))}
      </div>
      {isPlayer && data.defenseUsed > 0 && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          🛡️ Défenses : {data.defenseUsed}/3
        </div>
      )}
    </div>
  );
}

function LogEntry({ entry }) {
  const colors = {
    system: 'var(--gold)',
    reward: '#27ae60',
    levelup: '#FFD700',
    'player-attack': '#e8d9b0',
    'player-spell': '#9b59b6',
    'player-defend': '#3498db',
    'player-item': '#27ae60',
    attack: '#e74c3c',
    magic: '#8e44ad',
    dodge: '#2ecc71',
    blocked: '#3498db',
    miss: '#7f8c8d',
    default: 'var(--text-muted)',
  };
  const color = colors[entry.type] || colors.default;
  return (
    <div style={{ padding: '4px 8px', borderLeft: `3px solid ${color}`, fontSize: '0.85rem', color, lineHeight: 1.4 }}>
      {entry.msg}
    </div>
  );
}

export default function CombatPage() {
  const [phase, setPhase] = useState('select'); // 'select' | 'combat' | 'result'
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedMonster, setSelectedMonster] = useState(null);
  const logRef = useRef(null);

  // Scroll log to bottom on update
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [session?.log]);

  // Check for existing combat session on mount
  useEffect(() => {
    fetch('/api/combat/state', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.session && data.session.status === 'active') {
          setSession(data.session);
          setPhase('combat');
        }
      })
      .catch(() => {});
  }, []);

  const startCombat = async (monsterKey) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/combat/start', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monsterKey }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur'); return; }
      setSession(data.session);
      setPhase('combat');
    } catch { setError('Impossible de démarrer le combat.'); }
    finally { setLoading(false); }
  };

  const doAction = async (action) => {
    if (actionLoading || session?.status !== 'active') return;
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch('/api/combat/action', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur'); return; }
      setSession(data.session);
      if (data.session.status !== 'active') {
        setTimeout(() => setPhase('result'), 400);
      }
    } catch { setError('Erreur lors de l\'action.'); }
    finally { setActionLoading(false); }
  };

  const flee = async () => {
    await fetch('/api/combat/flee', { method: 'DELETE', credentials: 'include' });
    setSession(null);
    setPhase('select');
    setError('');
  };

  const reset = () => {
    setSession(null);
    setPhase('select');
    setError('');
    setSelectedMonster(null);
  };

  // ── MONSTER SELECTION ──────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold)', marginBottom: 6 }}>⚔️ Combat</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: '0.9rem' }}>
          Choisissez votre adversaire. Les récompenses (or, expérience) sont sauvegardées sur votre compte.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Object.entries(MONSTERS).map(([key, m]) => (
            <div
              key={key}
              onClick={() => setSelectedMonster(key === selectedMonster ? null : key)}
              style={{
                background: selectedMonster === key ? 'var(--bg-card2)' : 'var(--bg-card)',
                border: `2px solid ${selectedMonster === key ? 'var(--gold-dark)' : 'var(--border)'}`,
                borderRadius: 12, padding: '16px 20px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 16,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '2.5rem', lineHeight: 1 }}>{m.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold)', fontSize: '1rem' }}>{m.name}</span>
                  <DiffStars n={m.diff} />
                </div>
                <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)' }}>{m.desc}</div>
              </div>
              {selectedMonster === key && (
                <button
                  className="btn btn-gold"
                  style={{ padding: '8px 20px', minWidth: 110 }}
                  disabled={loading}
                  onClick={(e) => { e.stopPropagation(); startCombat(key); }}
                >
                  {loading ? '⏳' : '⚔️ Combattre'}
                </button>
              )}
            </div>
          ))}
        </div>
        {error && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: '#2a0e0e', border: '1px solid var(--red)', borderRadius: 'var(--radius)', color: '#e74c3c', fontSize: '0.85rem' }}>
            ⚠️ {error}
          </div>
        )}
      </div>
    );
  }

  // ── COMBAT ARENA ───────────────────────────────────────────────────────────
  if (phase === 'combat' && session) {
    const { player, monster, turn, maxTurns, log, status } = session;
    const isActive = status === 'active';
    const canSpell = player.mana >= 10;
    const canDefend = (player.defenseUsed || 0) < 3;

    return (
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h1 style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold)' }}>⚔️ Combat</h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Tour {turn}/{maxTurns}</span>
            {isActive && (
              <button onClick={flee}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Cinzel, serif' }}>
                🏃 Fuir
              </button>
            )}
          </div>
        </div>

        {/* Combatants */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', marginBottom: 20 }}>
          <CombatantCard data={player} isPlayer={true} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px' }}>
            <span style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold)', fontSize: '1.5rem', fontWeight: 900 }}>VS</span>
          </div>
          <CombatantCard data={monster} isPlayer={false} />
        </div>

        {/* Error */}
        {error && (
          <div style={{ marginBottom: 12, padding: '8px 14px', background: '#2a0e0e', border: '1px solid var(--red)', borderRadius: 'var(--radius)', color: '#e74c3c', fontSize: '0.83rem' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Actions */}
        {isActive && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { action: 'attack', label: '⚔️ Attaquer', desc: 'Dégâts physiques', enabled: true, color: 'var(--red)' },
              { action: 'spell',  label: '🔮 Sort',     desc: `Coût : 10 mana`, enabled: canSpell, color: '#8e44ad' },
              { action: 'defend', label: '🛡️ Défendre', desc: `Bloque 1 attaque (${3 - (player.defenseUsed||0)} restant)`, enabled: canDefend, color: '#2980b9' },
              { action: 'item',   label: '🧪 Potion',   desc: '+25% PV +15 mana', enabled: true, color: '#27ae60' },
            ].map(({ action, label, desc, enabled, color }) => (
              <button
                key={action}
                onClick={() => doAction(action)}
                disabled={!enabled || actionLoading}
                style={{
                  background: enabled ? 'var(--bg-card2)' : 'var(--bg-card)',
                  border: `2px solid ${enabled ? color : 'var(--border)'}`,
                  borderRadius: 10, padding: '12px 8px',
                  color: enabled ? 'var(--text-bright)' : 'var(--text-muted)',
                  cursor: enabled ? 'pointer' : 'not-allowed',
                  fontFamily: 'Cinzel, serif', fontSize: '0.8rem',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  opacity: enabled ? 1 : 0.5,
                  transition: 'all 0.1s',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{label}</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'Crimson Text, serif' }}>{desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* Combat log */}
        <div
          ref={logRef}
          style={{
            background: 'var(--bg-dark)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '12px 14px',
            height: 220, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}
        >
          {log.map((entry, i) => <LogEntry key={i} entry={entry} />)}
          {actionLoading && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>…</div>
          )}
        </div>
      </div>
    );
  }

  // ── RESULT ─────────────────────────────────────────────────────────────────
  if (phase === 'result' && session) {
    const won = session.status === 'victory';
    const { rewards, monster, log } = session;
    return (
      <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
        <div style={{
          background: 'var(--bg-card)', border: `2px solid ${won ? 'var(--gold-dark)' : '#5a1010'}`,
          borderRadius: 16, padding: 36, textAlign: 'center',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: 12 }}>{won ? '🏆' : '💀'}</div>
          <h1 style={{ fontFamily: 'Cinzel, serif', color: won ? 'var(--gold)' : '#e74c3c', fontSize: '1.8rem', marginBottom: 8 }}>
            {won ? 'Victoire !' : 'Défaite'}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem' }}>
            {won
              ? `Vous avez triomphé de ${monster.emoji} ${monster.name} !`
              : `${monster.emoji} ${monster.name} vous a vaincu...`
            }
          </p>

          {won && rewards && (
            <div style={{
              display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 28,
            }}>
              {[
                { icon: '💰', label: 'Or gagné', value: `+${rewards.gold}` },
                { icon: '✨', label: 'Expérience', value: `+${rewards.xp}` },
              ].map(({ icon, label, value }) => (
                <div key={label} style={{
                  background: 'var(--bg-dark)', borderRadius: 12, padding: '14px 24px',
                  border: '1px solid var(--border-gold)',
                }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: 4 }}>{icon}</div>
                  <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold)', fontSize: '1.2rem', fontWeight: 700 }}>{value}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Last log entries */}
          <div style={{ background: 'var(--bg-dark)', borderRadius: 10, padding: '10px 14px', marginBottom: 24, textAlign: 'left', maxHeight: 160, overflowY: 'auto' }}>
            {log.slice(-5).map((entry, i) => <LogEntry key={i} entry={entry} />)}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-gold" onClick={reset}>
              ⚔️ Nouveau combat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div className="spinner" />
    </div>
  );
}
