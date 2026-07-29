import React, { useState } from 'react';

const STEPS = [
  {
    emoji: '🏰',
    title: 'Bienvenue dans Medieval Kingdom !',
    content: (
      <>
        <p style={{ lineHeight: 1.7, marginBottom: 16 }}>
          Votre personnage a été créé sur Discord. Ce tableau de bord vous permet de consulter et gérer votre aventure depuis le web.
        </p>
        <div style={{ background: 'var(--bg-dark)', borderRadius: 10, padding: '14px 18px', border: '1px solid var(--border-gold)' }}>
          <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold)', fontSize: '0.85rem', marginBottom: 10 }}>
            Sur ce site vous pouvez :
          </div>
          {[
            ['🧙', 'Personnage', 'Consulter vos stats, équipements et faction'],
            ['🎒', 'Inventaire', 'Voir et trier tous vos objets'],
            ['📜', 'Quêtes', 'Suivre vos quêtes actives et complétées'],
            ['⚔️', 'Combat', 'Affronter des monstres directement sur le site'],
            ['🏪', 'Boutique', 'Acheter les items du jour avec vos 💎 gemmes'],
            ['🏆', 'Classement', 'Voir le classement de tous les aventuriers'],
          ].map(([icon, name, desc]) => (
            <div key={name} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icon}</span>
              <div>
                <span style={{ fontFamily: 'Cinzel, serif', color: 'var(--text-bright)', fontSize: '0.85rem' }}>{name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}> — {desc}</span>
              </div>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    emoji: '⚔️',
    title: 'Commandes Discord essentielles',
    content: (
      <>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>
          La plupart des actions se font via les commandes slash (<code style={{ background: 'var(--bg-dark)', padding: '1px 5px', borderRadius: 4 }}>/</code>) sur votre serveur Discord.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['/personnage profil', 'Voir votre fiche de personnage'],
            ['/quete', 'Partir en quête pour gagner XP et or'],
            ['/combat', 'Combattre des monstres (aussi dispo sur le site)'],
            ['/boutique', 'Boutique du jour (aussi dispo sur le site)'],
            ['/equiper', 'Équiper vos armes et armures'],
            ['/inventaire', 'Voir vos objets'],
            ['/faction rejoindre', 'Rejoindre une faction'],
            ['/classement', 'Voir le classement'],
            ['/gemmesvocales', 'Gagner des 💎 en vocal'],
          ].map(([cmd, desc]) => (
            <div key={cmd} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <code style={{
                background: 'var(--bg-dark)', border: '1px solid var(--border)',
                borderRadius: 5, padding: '3px 8px', fontSize: '0.78rem',
                color: 'var(--gold)', fontFamily: 'monospace', flexShrink: 0, minWidth: 180,
              }}>{cmd}</code>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{desc}</span>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    emoji: '📈',
    title: 'Comment progresser',
    content: (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['🗺️', 'Faites des quêtes', 'Utilisez /quete pour partir en mission. Chaque quête rapporte XP et or. Vous pouvez en faire plusieurs par jour.'],
            ['⚔️', 'Combattez des monstres', 'Via /combat sur Discord ou directement sur ce site. Les victoires rapportent or et XP. Montez de niveau pour affronter des ennemis plus forts.'],
            ['🛡️', 'Équipez-vous', 'Achetez des armes et armures à la boutique. Équipez-les avec /equiper pour booster vos stats de combat.'],
            ['💎', 'Gagnez des gemmes', 'Restez dans un salon vocal du serveur — le bot vous donne des gemmes automatiquement. Utilisées pour les items rares en boutique.'],
            ['🏛️', 'Rejoignez une faction', 'Chaque faction offre des bonus uniques. Choisissez selon votre classe (ex: Ordre Royal pour les Chevaliers).'],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{
              background: 'var(--bg-card2)', borderRadius: 10, padding: '12px 14px',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                <span style={{ fontFamily: 'Cinzel, serif', color: 'var(--text-bright)', fontSize: '0.85rem' }}>{title}</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    emoji: '🎉',
    title: 'Vous êtes prêt !',
    content: (
      <>
        <p style={{ lineHeight: 1.8, marginBottom: 20, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Votre aventure dans le Royaume Médiéval commence maintenant. Consultez le <strong style={{ color: 'var(--text-bright)' }}>tutoriel complet</strong> envoyé dans vos DMs Discord pour plus de détails.
        </p>
        <div style={{
          background: '#0e1a0e', border: '1px solid #1e8449',
          borderRadius: 10, padding: '14px 18px', marginBottom: 16,
        }}>
          <div style={{ fontFamily: 'Cinzel, serif', color: '#58d68d', fontSize: '0.85rem', marginBottom: 8 }}>
            💡 Conseil de départ
          </div>
          <p style={{ color: '#58d68d', fontSize: '0.82rem', lineHeight: 1.6, margin: 0 }}>
            Commencez par faire <strong>2-3 quêtes</strong> pour accumuler de l'XP, puis visitez la <strong>boutique du jour</strong> pour acheter votre premier équipement avec vos gemmes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            ['⚔️', 'Aller combattre', '/combat'],
            ['🏪', 'Voir la boutique', '/shop'],
            ['🧙', 'Mon personnage', '/character'],
          ].map(([icon, label, path]) => (
            <a key={path} href={path} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--bg-card2)', border: '1px solid var(--border-gold)',
              borderRadius: 8, padding: '8px 14px',
              color: 'var(--gold)', fontFamily: 'Cinzel, serif', fontSize: '0.78rem',
              textDecoration: 'none', transition: 'background 0.15s',
            }}>
              {icon} {label}
            </a>
          ))}
        </div>
      </>
    ),
  },
];

export default function WelcomeGuide({ onClose }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '2px solid var(--border-gold)',
        borderRadius: 16, width: '100%', maxWidth: 560,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: '2rem' }}>{current.emoji}</span>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: 'Cinzel, serif', color: 'var(--gold)', fontSize: '1rem', margin: 0 }}>
              {current.title}
            </h2>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{
                  height: 3, flex: 1, borderRadius: 2,
                  background: i <= step ? 'var(--gold-dark)' : 'var(--border)',
                  transition: 'background 0.3s',
                }} />
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: 4,
            }}
            title="Fermer"
          >✕</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {current.content}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'Cinzel, serif' }}>
            {step + 1} / {STEPS.length}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  padding: '8px 18px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  fontFamily: 'Cinzel, serif', fontSize: '0.8rem',
                }}
              >
                ← Précédent
              </button>
            )}
            <button
              onClick={() => isLast ? onClose() : setStep(s => s + 1)}
              className="btn btn-gold"
              style={{ padding: '8px 22px' }}
            >
              {isLast ? '🎉 Commencer !' : 'Suivant →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
