import React, { useState, useEffect } from 'react';

const RARITY_CONFIG = {
  common:    { label: 'Commun',    color: '#aaa',    bg: '#1a1a1a', border: '#333' },
  uncommon:  { label: 'Peu commun', color: '#1eff00', bg: '#0a1f0a', border: '#1a4a1a' },
  rare:      { label: 'Rare',      color: '#0070dd', bg: '#0a0f2a', border: '#1a2a5a' },
  legendary: { label: 'Légendaire', color: '#ff8000', bg: '#1f100a', border: '#4a2a1a' },
  mythic:    { label: 'Mythique',  color: '#ff4080', bg: '#1f0a15', border: '#5a1a2a' },
};

const TYPE_ICONS = {
  objet:   '🧪',
  arme:    '⚔️',
  armure:  '🛡️',
  titre:   '📜',
  familier:'🐾',
};

const DAY_NAMES = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

function RarityBadge({ rarity }) {
  const cfg = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
  return (
    <span style={{
      fontSize: '0.68rem', fontFamily: 'Cinzel, serif',
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 4, padding: '2px 6px',
    }}>
      {cfg.label}
    </span>
  );
}

function Countdown({ nextRefresh }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const diff = nextRefresh - now;
      if (diff <= 0) { setTimeLeft('Renouvellement imminent…'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [nextRefresh]);

  return <span style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold)', fontSize: '0.95rem' }}>{timeLeft}</span>;
}

function ShopItem({ item, gems, onBuy, buying }) {
  const cfg = RARITY_CONFIG[item.rarity] || RARITY_CONFIG.common;
  const canAfford = gems >= item.price;
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `2px solid ${cfg.border}`,
      borderRadius: 12, padding: 18,
      display: 'flex', flexDirection: 'column', gap: 10,
      position: 'relative', overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      {/* Rarity accent strip */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: cfg.color, opacity: 0.7 }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.6rem' }}>{TYPE_ICONS[item.type] || '📦'}</span>
          <div>
            <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--text-bright)', fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.2 }}>
              {item.name}
            </div>
            <RarityBadge rarity={item.rarity} />
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', fontWeight: 700, color: canAfford ? 'var(--gold)' : '#e74c3c' }}>
            {item.price} 💎
          </div>
        </div>
      </div>

      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, flex: 1 }}>
        {item.description}
      </p>

      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        Type : {item.type}
      </div>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={!canAfford || buying}
          style={{
            padding: '9px 0', borderRadius: 8,
            border: `1px solid ${canAfford ? cfg.color : 'var(--border)'}`,
            background: canAfford ? cfg.bg : 'transparent',
            color: canAfford ? cfg.color : 'var(--text-muted)',
            cursor: canAfford ? 'pointer' : 'not-allowed',
            fontFamily: 'Cinzel, serif', fontSize: '0.8rem',
            transition: 'all 0.15s',
            opacity: canAfford ? 1 : 0.5,
          }}
        >
          {canAfford ? '🛒 Acheter' : '💎 Insuffisant'}
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => { onBuy(item); setShowConfirm(false); }}
            disabled={buying}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 8,
              border: '1px solid var(--gold-dark)', background: '#1a1200',
              color: 'var(--gold)', cursor: 'pointer',
              fontFamily: 'Cinzel, serif', fontSize: '0.78rem',
            }}
          >
            {buying ? '⏳' : '✅ Confirmer'}
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 8,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-muted)', cursor: 'pointer',
              fontFamily: 'Cinzel, serif', fontSize: '0.78rem',
            }}
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

export default function ShopPage() {
  const [shop, setShop] = useState(null);
  const [gems, setGems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [filterType, setFilterType] = useState('all');

  // Midnight of tomorrow
  const nextRefresh = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/shop', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/player', { credentials: 'include' }).then(r => r.json()),
    ]).then(([shopData, playerData]) => {
      if (shopData.shop) setShop(shopData.shop);
      else setError(shopData.error || 'Erreur boutique.');
      if (playerData.player) setGems(playerData.player.gemmes || 0);
    }).catch(() => setError('Impossible de charger la boutique.'))
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg, success = true) => {
    setToast({ msg, success });
    setTimeout(() => setToast(null), 4000);
  };

  const handleBuy = async (item) => {
    setBuying(true);
    setError('');
    try {
      const res = await fetch('/api/shop/buy', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Erreur lors de l\'achat.', false);
      } else {
        setGems(data.player.gemmes);
        showToast(data.message, true);
      }
    } catch {
      showToast('Erreur réseau.', false);
    } finally {
      setBuying(false);
    }
  };

  const types = ['all', ...new Set((shop?.items || []).map(i => i.type))];
  const filtered = (shop?.items || []).filter(i => filterType === 'all' || i.type === filterType);
  const rarityOrder = { mythic: 0, legendary: 1, rare: 2, uncommon: 3, common: 4 };
  const sorted = [...filtered].sort((a, b) => (rarityOrder[a.rarity] ?? 5) - (rarityOrder[b.rarity] ?? 5));

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
        <div className="spinner" />
        <span style={{ color: 'var(--text-muted)' }}>Chargement de la boutique…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ padding: 16, background: '#2a0e0e', border: '1px solid var(--red)', borderRadius: 8, color: '#e74c3c' }}>
          ⚠️ {error}
        </div>
      </div>
    );
  }

  const dayName = shop ? DAY_NAMES[shop.dayOfWeek] : '';

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', position: 'relative' }}>

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 1000,
          background: toast.success ? '#0e2a0e' : '#2a0e0e',
          border: `1px solid ${toast.success ? '#1e8449' : '#c0392b'}`,
          borderRadius: 10, padding: '12px 20px',
          color: toast.success ? '#58d68d' : '#e74c3c',
          fontFamily: 'Cinzel, serif', fontSize: '0.85rem',
          maxWidth: 320, boxShadow: 'var(--shadow)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.success ? '✅' : '⚠️'} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold)', marginBottom: 4 }}>🏪 Boutique du Jour</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {dayName} — Stock renouvelé chaque nuit à minuit
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-gold)',
            borderRadius: 10, padding: '8px 16px',
            fontFamily: 'Cinzel, serif', color: 'var(--gold)', fontSize: '1.05rem',
          }}>
            💎 {gems.toLocaleString()} gemmes
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            ⏳ Prochain renouvellement : <Countdown nextRefresh={nextRefresh} />
          </div>
        </div>
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {types.map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            style={{
              padding: '6px 14px', borderRadius: 20,
              border: `1px solid ${filterType === t ? 'var(--gold-dark)' : 'var(--border)'}`,
              background: filterType === t ? '#1a1200' : 'var(--bg-card)',
              color: filterType === t ? 'var(--gold)' : 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'Cinzel, serif', fontSize: '0.78rem',
              transition: 'all 0.15s',
            }}
          >
            {t === 'all' ? '🔎 Tout' : `${TYPE_ICONS[t] || '📦'} ${t.charAt(0).toUpperCase() + t.slice(1)}`}
          </button>
        ))}
      </div>

      {/* Item count */}
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>
        {sorted.length} article{sorted.length > 1 ? 's' : ''} disponible{sorted.length > 1 ? 's' : ''} aujourd'hui
      </p>

      {/* Items grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 16,
      }}>
        {sorted.map(item => (
          <ShopItem
            key={item.id}
            item={item}
            gems={gems}
            onBuy={handleBuy}
            buying={buying}
          />
        ))}
      </div>

      {sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          Aucun article dans cette catégorie aujourd'hui.
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: 32, padding: 16, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 10 }}>
          Raretés
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(RARITY_CONFIG).map(([key, cfg]) => (
            <span key={key} style={{ fontSize: '0.75rem', color: cfg.color }}>
              ● {cfg.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
