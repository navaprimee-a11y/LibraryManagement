export default function Header({ borrowedCount }) {
  return (
    <header className="site-header">
      <div className="header-mark" aria-hidden="true">📚</div>
      <div>
        <p className="eyebrow">READ • DISCOVER • LEARN</p>
        <h1>Library Management System</h1>
        <p className="header-subtitle">Your reading corner, all in one place.</p>
      </div>
      <div className="header-count">
        <strong>{borrowedCount}</strong>
        <span>Borrowed</span>
      </div>
    </header>
  );
}
