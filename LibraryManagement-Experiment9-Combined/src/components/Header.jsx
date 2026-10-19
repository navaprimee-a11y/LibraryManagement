import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from './common/Button';

const Header = ({ borrowedCount = 0 }) => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <>
      <header className="header">
        <Link className="header-brand" to="/" aria-label="Library Management System home">
          <h1>📚 Library Management System</h1>
        </Link>
        <p>Discover your next great read</p>
        <div className="header-utilities">
          {isAuthenticated && <span className="signed-in-label">Signed in as <strong>{user?.name || user?.memberId}</strong></span>}
        </div>
      </header>
      <nav className="navigation" aria-label="Main navigation">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/books">Browse Books</NavLink>
        <NavLink to="/borrowed">Borrowed ({borrowedCount})</NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/profile">Profile</NavLink>
        <NavLink to="/member">Member Dashboard</NavLink>
        {isAuthenticated && <><NavLink to="/manage/books">Manage Books</NavLink><NavLink to="/manage/borrowings">Manage Loans</NavLink></>}
        {isAuthenticated
          ? <Button variant="ghost" className="nav-logout" onClick={handleLogout}>Sign out</Button>
          : <><NavLink to="/login">Login</NavLink><NavLink to="/register">Register</NavLink></>}
      </nav>
    </>
  );
};

export default Header;
