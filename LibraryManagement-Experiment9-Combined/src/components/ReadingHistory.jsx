import React from 'react';

const ReadingHistory = ({ history }) => {
  if (history.length === 0) {
    return <p className="no-books">No reading history yet.</p>;
  }

  return (
    <div className="reading-history">
      <h2>📚 Reading History</h2>
      {history.map((item, index) => (
        <div key={index} className="history-item">
          <h4>{item.title}</h4>
          <p>Borrowed: {item.borrowedDate} | Returned: {item.returnedDate}</p>
        </div>
      ))}
    </div>
  );
};

export default ReadingHistory;
