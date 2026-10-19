export default function Profile({ memberInfo, borrowedCount, historyCount }) {
  return (
    <section className="content-panel profile-panel">
      <div className="profile-avatar" aria-hidden="true">👤</div>
      <p className="eyebrow">MEMBER DETAILS</p>
      <h2>{memberInfo.name}</h2>
      <p className="profile-intro">Your library membership information.</p>
      <dl className="profile-details">
        <div><dt>Email</dt><dd>{memberInfo.email}</dd></div>
        <div><dt>Member ID</dt><dd>{memberInfo.memberId}</dd></div>
        <div><dt>Membership</dt><dd>{memberInfo.membershipType}</dd></div>
        <div><dt>Joined</dt><dd>{memberInfo.joinDate}</dd></div>
        <div><dt>Books currently borrowed</dt><dd>{borrowedCount}</dd></div>
        <div><dt>Books returned</dt><dd>{historyCount}</dd></div>
      </dl>
    </section>
  );
}
