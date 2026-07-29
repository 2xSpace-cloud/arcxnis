import React, { useEffect, useState } from 'react';

function ObjectiveBar({ obj }) {
  const pct = Math.min(100, Math.round((obj.current / obj.required) * 100));
  const done = obj.current >= obj.required;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.82rem' }}>
        <span style={{ color: done ? '#58d68d' : 'var(--text)' }}>
          {done ? '✅ ' : '⚔️ '}{obj.description}
        </span>
        <span style={{ color: done ? '#58d68d' : 'var(--gold)', fontWeight: 'bold' }}>
          {obj.current}/{obj.required}
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--bg-dark)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4, transition: 'width 0.4s',
          width: `${pct}%`,
          background: done ? '#27ae60' : 'linear-gradient(90deg, #b8860b, #ffd700)',
        }} />
      </div>
    </div>
  );
}

export default function QuestsPage() {
  const [player, setPlayer] = useState(null);
  const [gamedata, setGamedata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');

  useEffect(() => {
    Promise.all([
      fetch('/api/player', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/gamedata', { credentials: 'include' }).then(r => r.json()),
    ]).then(([pd, gd]) => {
      setPlayer(pd.player);
      setGamedata(gd);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div><span>Chargement...</span></div>;
  if (!player) return <div><div className="page-header"><h1>📜 Quêtes</h1></div><div className="no-char"><h2>Aucun personnage trouvé</h2></div></div>;

  const activeQuest = player.quests?.active;
  const completedList = player.quests?.completed || [];
  const completedIds = completedList.map(c => c.id || c);
  const allQuests = gamedata?.quests || [];

  const availableQuests = allQuests.filter(q =>
    !completedIds.includes(q.id) &&
    (!q.requirements?.minLevel || (player.level || 1) >= q.requirements.minLevel) &&
    q.id !== activeQuest?.id
  );

  const tabs = [
    { id: 'active',    label: '⚡ Active',      count: activeQuest ? 1 : 0 },
    { id: 'available', label: '📋 Disponibles', count: availableQuests.length },
    { id: 'completed', label: '✅ Complétées',  count: completedList.length },
  ];

  function isComplete(quest) {
    if (!quest?.objectiveProgress?.length) return false;
    return quest.objectiveProgress.every(o => o.current >= o.required);
  }

  function renderQuestCard(quest, isActive = false) {
    const objectives = quest.objectiveProgress || null;
    const done = isActive && isComplete(quest);

    return (
      <div key={quest.id} className={`quest-card${isActive ? ' active-quest' : ''}`}
        style={done ? { borderColor: '#27ae60' } : {}}>
        <div className="quest-title">
          <span>{quest.title}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {quest.requirements?.minLevel && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Niv. {quest.requirements.minLevel}+</span>
            )}
            {done && <span style={{ fontSize: '0.75rem', color: '#27ae60', fontFamily: 'Cinzel, serif' }}>PRÊTE ✓</span>}
          </div>
        </div>
        <div className="quest-desc">{quest.description}</div>

        {/* Objectifs avec barres de progression */}
        {isActive && objectives && objectives.length > 0 && (
          <div style={{ margin: '12px 0', padding: '12px 14px', background: 'var(--bg-dark)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--gold)', fontFamily: 'Cinzel, serif', marginBottom: 10 }}>
              🎯 Objectifs
            </div>
            {objectives.map((obj, i) => <ObjectiveBar key={i} obj={obj} />)}
          </div>
        )}

        {/* Objectifs en lecture seule (quêtes dispo) */}
        {!isActive && quest.objectives && quest.objectives.length > 0 && (
          <div style={{ margin: '8px 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {quest.objectives.map((obj, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 10 }}>
                ⚔️ {obj.description}
              </span>
            ))}
          </div>
        )}

        <div className="quest-rewards">
          {quest.rewards?.experience && <span className="reward-pill">⭐ {quest.rewards.experience} XP</span>}
          {quest.rewards?.gold && <span className="reward-pill">💰 {quest.rewards.gold} or</span>}
          {quest.rewards?.items?.map((item, i) => (
            <span key={i} className="reward-pill">📦 {item}</span>
          ))}
          {!quest.objectives && quest.duration && (
            <span className="reward-pill">⏱️ {quest.duration} min</span>
          )}
        </div>

        {done && (
          <div style={{
            marginTop: 12, padding: '10px 14px', background: '#0e1a0e',
            border: '1px solid #27ae60', borderRadius: 8,
            fontSize: '0.82rem', color: '#58d68d',
          }}>
            🎉 Objectifs accomplis ! Utilisez <code style={{ background: '#1a2e1a', padding: '1px 5px', borderRadius: 3 }}>/quete terminer</code> sur Discord pour réclamer vos récompenses.
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>📜 Quêtes</h1>
        <p>{completedList.length} complétées — combat requis pour progresser !</p>
      </div>

      {/* Daily progress */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Quêtes complétées aujourd'hui</span>
          <span>{player.quests?.completedToday || 0}/10</span>
        </div>
        <div className="stat-bar" style={{ height: 10 }}>
          <div className="stat-bar-fill bar-xp" style={{ width: `${((player.quests?.completedToday || 0) / 10) * 100}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', borderRadius: 'var(--radius)', border: '1px solid',
            borderColor: tab === t.id ? 'var(--gold)' : 'var(--border)',
            background: tab === t.id ? 'var(--bg-card2)' : 'transparent',
            color: tab === t.id ? 'var(--gold)' : 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'Cinzel, serif', fontSize: '0.8rem'
          }}>
            {t.label} {t.count > 0 && (
              <span style={{ marginLeft: 4, background: 'var(--gold)', color: '#000', borderRadius: 10, padding: '1px 6px', fontSize: '0.7rem' }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Active */}
      {tab === 'active' && (
        activeQuest ? (
          <div>
            <div style={{ marginBottom: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Commencée le {activeQuest.startTime ? new Date(activeQuest.startTime).toLocaleDateString('fr-FR') : '—'}
            </div>
            {renderQuestCard(activeQuest, true)}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">⚡</span>
            <p>Aucune quête active. Utilisez <code>/quete nouvelle</code> sur Discord pour en lancer une.</p>
          </div>
        )
      )}

      {/* Available */}
      {tab === 'available' && (
        availableQuests.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <p>Aucune quête disponible pour votre niveau.</p>
          </div>
        ) : (
          <div>{availableQuests.map(q => renderQuestCard(q))}</div>
        )
      )}

      {/* Completed */}
      {tab === 'completed' && (
        completedList.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">✅</span>
            <p>Aucune quête complétée pour l'instant.</p>
          </div>
        ) : (
          <div>
            {[...completedList].reverse().map((q, i) => (
              <div key={i} className="quest-card" style={{ opacity: 0.7 }}>
                <div className="quest-title">
                  <span>✅ {q.title || q}</span>
                  {q.completedAt && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(q.completedAt).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>
                {q.rewards && (
                  <div className="quest-rewards" style={{ marginTop: 6 }}>
                    {q.rewards.experience && <span className="reward-pill">⭐ +{q.rewards.experience} XP</span>}
                    {q.rewards.gold && <span className="reward-pill">💰 +{q.rewards.gold} or</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
