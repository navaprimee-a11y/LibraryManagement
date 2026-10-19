export default function Home({ totalBooks, availableBooks, borrowedCount, overdueCount, onBrowse }) {
  return (
    <section className="home-panel">
      <div className="home-copy">
        <p className="eyebrow">WELCOME TO YOUR LIBRARY</p>
        <h2>Make room for one more story.</h2>
        <p>Explore the collection, borrow a book, and keep track of what you read.</p>
        <button className="button button-primary" onClick={onBrowse}>Browse books</button>
      </div>
      <div className="stats-grid">
        <Stat value={totalBooks} label="Total books" />
        <Stat value={availableBooks} label="Available" />
        <Stat value={borrowedCount} label="Borrowed" />
        <Stat value={overdueCount} label="Overdue" />
      </div>
    </section>
  );
}

function Stat({ value, label }) {
  return <div className="stat-card"><strong>{value}</strong><span>{label}</span></div>;
}
