import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

export const MemberLayout = () => (
  <section className="member-layout">
    <div className="member-heading"><p className="eyebrow">MEMBER AREA</p><h2>Member Dashboard</h2><p>Manage your loans, history, recommendations, and account.</p></div>
    <nav className="member-navigation" aria-label="Member dashboard navigation">
      <NavLink to="/member" end>Overview</NavLink>
      <NavLink to="/member/borrowed">Borrowed Books</NavLink>
      <NavLink to="/member/history">Reading History</NavLink>
      <NavLink to="/member/recommendations">Recommendations</NavLink>
      <NavLink to="/member/profile">Profile</NavLink>
    </nav>
    <div className="member-content"><Outlet /></div>
  </section>
);

export const MemberOverview = ({ memberInfo, borrowedBooks, holdRequests, books, confirmationMessage }) => (
  <div className="page-panel">
    {confirmationMessage && <p className="notice" role="status">{confirmationMessage}</p>}
    <h3>Welcome back, {memberInfo.name}</h3>
    <p>Your member ID is <strong>{memberInfo.memberId}</strong>. Here is your current library snapshot.</p>
    <div className="stats dashboard-stats">
      <div className="stat-card"><h3>{books.length}</h3><p>Catalogue titles</p></div>
      <div className="stat-card"><h3>{borrowedBooks.length}</h3><p>Books checked out</p></div>
      <div className="stat-card"><h3>{holdRequests.filter((item) => item.status === 'Waiting').length}</h3><p>Active holds</p></div>
    </div>
    <p className="flow-hint">STEP 4 OF 4 · Continue to <NavLink to="/member/borrowed">Borrowed Books</NavLink> to renew or return a title.</p>
  </div>
);
