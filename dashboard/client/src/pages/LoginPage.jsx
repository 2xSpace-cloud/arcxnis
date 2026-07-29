import React, { useState } from 'react';

export default function LoginPage({ onLogin }) {
  const [step, setStep] = useState(1); // 1 = enter ID, 2 = enter code
  const [discordId, setDiscordId] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Step 1 — Request OTP code
  const handleRequestCode = async (e) => {
    e.preventDefault();
    if (!discordId.trim()) return;
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/auth/request-code', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordId: discordId.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur inconnue');
      } else {
        setInfo(data.message);
        setStep(2);
      }
    } catch {
      setError('Impossible de contacter le serveur.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — Verify OTP code
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/auth/verify-code', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordId: discordId.trim(), code: code.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Code incorrect');
      } else {
        onLogin(data.user);
      }
    } catch {
      setError('Impossible de contacter le serveur.');
    } finally {
      setLoading(false);
    }
  };

  // Demo login
  const handleDemo = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/auth/demo', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) onLogin(data.user);
      else setError(data.error || 'Erreur de connexion');
    } catch { setError('Impossible de contacter le serveur.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <span className="login-crown">👑</span>
        <h1>Medieval Kingdom</h1>
        <p>Connexion au tableau de bord des aventuriers</p>

        {/* Step indicators */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
          {[1, 2].map(s => (
            <div key={s} style={{
              width: 32, height: 32, borderRadius: '50%',
              border: `2px solid ${step >= s ? 'var(--gold)' : 'var(--border)'}`,
              background: step > s ? 'var(--gold)' : step === s ? 'var(--bg-card2)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Cinzel, serif', fontSize: '0.8rem',
              color: step > s ? '#000' : step === s ? 'var(--gold)' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}>{step > s ? '✓' : s}</div>
          ))}
        </div>

        {/* Step 1 — Discord ID */}
        {step === 1 && (
          <form onSubmit={handleRequestCode}>
            <div style={{ marginBottom: 16, textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'Cinzel, serif', marginBottom: 6 }}>
                Votre ID Discord
              </label>
              <input
                type="text"
                value={discordId}
                onChange={e => { setDiscordId(e.target.value); setError(''); }}
                placeholder="ex: 123456789012345678"
                autoFocus
                style={{
                  width: '100%', padding: '12px 14px',
                  background: 'var(--bg-dark)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', color: 'var(--text)',
                  fontSize: '1rem', fontFamily: 'Crimson Text, serif',
                  outline: 'none', transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = 'var(--gold-dark)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                💡 Trouvez votre ID : Discord → Paramètres → Avancé → Mode développeur activé → clic droit sur votre nom → "Copier l'identifiant"
              </p>
            </div>

            <button type="submit" className="btn btn-gold" disabled={loading || !discordId.trim()}>
              {loading ? '⏳ Envoi en cours...' : '📨 Envoyer le code par DM'}
            </button>
          </form>
        )}

        {/* Step 2 — Enter code */}
        {step === 2 && (
          <form onSubmit={handleVerifyCode}>
            {info && (
              <div style={{ background: '#0e2a0e', border: '1px solid #1e8449', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16, fontSize: '0.85rem', color: '#58d68d', textAlign: 'left' }}>
                ✅ {info}
              </div>
            )}
            <div style={{ marginBottom: 8, textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              ID Discord : <span style={{ color: 'var(--gold)' }}>{discordId}</span>
              <button type="button" onClick={() => { setStep(1); setCode(''); setError(''); setInfo(''); }}
                style={{ marginLeft: 10, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}>
                Changer
              </button>
            </div>
            <div style={{ marginBottom: 16, textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'Cinzel, serif', marginBottom: 6 }}>
                Code à 6 chiffres reçu par DM
              </label>
              <input
                type="text"
                value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                placeholder="_ _ _ _ _ _"
                maxLength={6}
                autoFocus
                style={{
                  width: '100%', padding: '14px', textAlign: 'center',
                  background: 'var(--bg-dark)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', color: 'var(--text)',
                  fontSize: '1.8rem', letterSpacing: '0.3em', fontFamily: 'Cinzel, serif',
                  outline: 'none', transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = 'var(--gold-dark)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                ⏱️ Ce code expire dans 5 minutes.
              </p>
            </div>

            <button type="submit" className="btn btn-gold" disabled={loading || code.length !== 6}>
              {loading ? '⏳ Vérification...' : '🔓 Se connecter'}
            </button>

            <button type="button"
              onClick={() => { setStep(1); setCode(''); setError(''); setInfo(''); }}
              style={{ display: 'block', width: '100%', marginTop: 8, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Cinzel, serif' }}>
              ← Renvoyer un code
            </button>
          </form>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#2a0e0e', border: '1px solid #c0392b', borderRadius: 'var(--radius)', fontSize: '0.85rem', color: '#e74c3c', textAlign: 'left' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Demo */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-demo" onClick={handleDemo} disabled={loading} style={{ marginBottom: 0 }}>
            🎭 Connexion démo
          </button>
        </div>
      </div>
    </div>
  );
}
