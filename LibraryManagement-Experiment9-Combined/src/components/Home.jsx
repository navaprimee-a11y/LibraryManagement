import React from 'react';

const Home = ({ totalBooks, availableBooks, borrowedCount }) => {
  return (
    <div className="home">
      <h2>Welcome to the Library! 🏛️</h2>
      <div className="stats">
        <div className="stat-card">
          <h3>{totalBooks}</h3>
          <p>Total Books</p>
        </div>
        <div className="stat-card">
          <h3>{availableBooks}</h3>
          <p>Available</p>
        </div>
        <div className="stat-card">
          <h3>{borrowedCount}</h3>
          <p>Borrowed</p>
        </div>
      </div>
    </div>
  );
};

export default Home;
