import React, { useEffect, useState } from 'react';

const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };
const TYPE_ICONS = {
  consumable: '🧪',
  weapon: '⚔️',
  armor: '🛡️',
  material: '🪨',
  quest: '📜',
  accessory: '💍',
};

function RarityBadge({ rarity }) {
  return <span className={`badge badge-${rarity || 'common'}`}>{rarity || 'common'}</span>;
}

export default function InventoryPage() {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('rarity');

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
        <div className="page-header"><h1>🎒 Inventaire</h1></div>
        <div className="no-char"><h2>Aucun personnage trouvé</h2></div>
      </div>
    );
  }

  const inv = player.inventoryDetails || {};
  const items = Object.entries(inv);

  const types = ['all', ...new Set(items.map(([, i]) => i.type).filter(Boolean))];

  let filtered = filter === 'all' ? items : items.filter(([, i]) => i.type === filter);

  filtered = filtered.sort((a, b) => {
    const [, ia] = a; const [, ib] = b;
    if (sort === 'rarity') return (RARITY_ORDER[ia.rarity] ?? 4) - (RARITY_ORDER[ib.rarity] ?? 4);
    if (sort === 'name') return (ia.name || '').localeCompare(ib.name || '');
    if (sort === 'value') return (ib.value || 0) - (ia.value || 0);
    if (sort === 'qty') return (ib.quantity || 0) - (ia.quantity || 0);
    return 0;
  });

  const totalValue = items.reduce((s, [, i]) => s + (i.value || 0) * (i.quantity || 1), 0);

  return (
    <div>
      <div className="page-header">
        <h1>🎒 Inventaire</h1>
        <p>{items.length} types d'objets — Valeur totale : <span className="num-gold">{totalValue.toLocaleString()} or</span></p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid',
              borderColor: filter === t ? 'var(--gold)' : 'var(--border)',
              background: filter === t ? 'var(--bg-card2)' : 'transparent',
              color: filter === t ? 'var(--gold)' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Cinzel, serif'
            }}>
              {TYPE_ICONS[t] || ''} {t === 'all' ? 'Tout' : t}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Trier par :</label>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)',
            padding: '6px 10px', borderRadius: 'var(--radius)', fontSize: '0.85rem', fontFamily: 'Crimson Text, serif'
          }}>
            <option value="rarity">Rareté</option>
            <option value="name">Nom</option>
            <option value="value">Valeur</option>
            <option value="qty">Quantité</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🎒</span>
          <p>{filter === 'all' ? "Votre inventaire est vide. Complétez des quêtes pour obtenir des objets !" : "Aucun objet de ce type."}</p>
        </div>
      ) : (
        <div className="inv-grid">
          {filtered.map(([id, item]) => (
            <div key={id} className="inv-item">
              <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>{TYPE_ICONS[item.type] || '📦'}</div>
              <div className="inv-item-name">{item.name || id}</div>
              <div className="inv-item-desc">{item.description || '—'}</div>
              <div className="inv-item-footer">
                <RarityBadge rarity={item.rarity} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  x{item.quantity || 1}
                </span>
              </div>
              {item.value > 0 && (
                <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--gold)' }}>
                  💰 {item.value} or
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
