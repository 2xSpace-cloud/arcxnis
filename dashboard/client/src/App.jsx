import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';

import CharacterPage from './pages/CharacterPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';
import QuestsPage from './pages/QuestsPage.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import CombatPage from './pages/CombatPage.jsx';
import ShopPage from './pages/ShopPage.jsx';
import WelcomeGuide from './components/WelcomeGuide.jsx';

const API = 'https://arcxnis-izfy.onrender.com';

export const UserContext = createContext(null);

function useUser() {
  return useContext(UserContext);
}

function Avatar({ user, size = 36 }) {
  const [imgError, setImgError] = React.useState(false);
  const avatarUrl = user?.avatarUrl;
  const initial = (user?.displayName || user?.username || '?')[0].toUpperCase();

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={user.username}
        onError={() => setImgError(true)}
        style={{
          width: size, height: size, borderRadius: '50%',
          border: '2px solid var(--border-gold)', objectFit: 'cover', flexShrink: 0
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: '2px solid var(--border-gold)', background: 'var(--bg-dark)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Cinzel, serif', fontWeight: 700, color: 'var(--gold)',
      fontSize: size * 0.4, flexShrink: 0
    }}>
      {initial}
    </div>
  );
}

export { Avatar };

function Sidebar({ user }) {
  const handleLogout = () => {
    window.location.href = '/auth/logout';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="crown">⚔️</span>
        <h2>Kingdom</h2>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <span className="icon">🏰</span>
          <span>Accueil</span>
        </NavLink>
        <NavLink to="/character" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <span className="icon">⚔️</span>
          <span>Personnage</span>
        </NavLink>
        <NavLink to="/inventory" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <span className="icon">🎒</span>
          <span>Inventaire</span>
        </NavLink>
        <NavLink to="/quests" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <span className="icon">📜</span>
          <span>Quêtes</span>
        </NavLink>
        <NavLink to="/combat" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <span className="icon">⚔️</span>
          <span>Combat</span>
        </NavLink>
        <NavLink to="/shop" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <span className="icon">🏪</span>
          <span>Boutique</span>
        </NavLink>
        <NavLink to="/leaderboard" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <span className="icon">🏆</span>
          <span>Classement</span>
        </NavLink>
      </nav>
      <div className="sidebar-user">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Avatar user={user} size={36} />
          <div style={{ minWidth: 0 }}>
            <div className="user-name">{user?.displayName || user?.username || 'Aventurier'}</div>
            <div className="user-sub">{user?.demo ? 'Mode démo' : 'Discord'}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>Déconnexion</button>
      </div>
    </aside>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [discordAuthEnabled, setDiscordAuthEnabled] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/me`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setUser(data.user || null); })
      .catch(() => setUser(null));
  }, []);

  // Show welcome guide for new players (level 1, never seen it)
  useEffect(() => {
    if (!user) return;
    const key = `welcome_seen_${user.id}`;
    if (localStorage.getItem(key)) return;
    fetch(`${API}/api/player`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const p = data.player;
        if (p && p.level <= 1 && !p.faction && Object.keys(p.inventory || {}).length === 0) {
          setShowWelcome(true);
        }
      })
      .catch(() => {});
  }, [user]);

  const closeWelcome = () => {
    setShowWelcome(false);
    if (user) localStorage.setItem(`welcome_seen_${user.id}`, '1');
  };

  if (user === undefined) {
    return (
      <div className="loading" style={{ minHeight: '100vh' }}>
        <div className="spinner"></div>
        <span>Chargement du royaume...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <UserContext.Provider value={{ user: null }}>
        <LoginPage onLogin={(u) => setUser(u)} />
      </UserContext.Provider>
    );
  }

  return (
    <UserContext.Provider value={{ user, discordAuthEnabled }}>
      {showWelcome && <WelcomeGuide onClose={closeWelcome} />}
      <BrowserRouter>
        <div className="layout">
          <Sidebar user={user} />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/character" element={<CharacterPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/quests" element={<QuestsPage />} />
              <Route path="/combat" element={<CombatPage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </UserContext.Provider>
  );
}
