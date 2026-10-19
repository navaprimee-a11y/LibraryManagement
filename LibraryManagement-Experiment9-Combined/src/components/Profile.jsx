import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { validateProfile } from '../utils/validation';
import Button from './common/Button';
import Input from './common/Input';
import useMemberApi from '../hooks/useMemberApi';
import Loading from './common/Loading';
import { getApiProfile, getAuthApiError } from '../services/authApi';

const Profile = ({ memberInfo }) => {
  const { user, updateUser } = useAuth();
  const { member: apiMember, loading: memberApiLoading, error: memberApiError } = useMemberApi();
  const [form, setForm] = useState(() => ({
    name: user?.name || memberInfo?.name || '',
    memberId: user?.memberId || memberInfo?.memberId || '',
    email: user?.email || memberInfo?.email || '',
    phone: user?.phone || memberInfo?.phone || '',
    membershipType: user?.membershipType || memberInfo?.membershipType || 'Standard',
  }));
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileApiError, setProfileApiError] = useState('');

  useEffect(() => {
    let active = true;
    setProfileLoading(true);
    setProfileApiError('');
    getApiProfile()
      .then(({ user: apiProfile }) => {
        if (!active || !apiProfile) return;
        setForm({
          name: apiProfile.name || '',
          memberId: apiProfile.memberId || '',
          email: apiProfile.email || '',
          phone: apiProfile.phone || '',
          membershipType: apiProfile.membershipType || 'Standard',
        });
      })
      .catch((error) => { if (active) setProfileApiError(getAuthApiError(error)); })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [user?.accountId]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      name: user?.name || memberInfo?.name || current.name,
      memberId: user?.memberId || memberInfo?.memberId || current.memberId,
      email: user?.email || memberInfo?.email || current.email,
      phone: user?.phone || memberInfo?.phone || current.phone,
      membershipType: user?.membershipType || memberInfo?.membershipType || current.membershipType,
    }));
  }, [user, memberInfo]);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setErrors((current) => ({ ...current, [event.target.name]: '' }));
    setSaved(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateProfile(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const result = await updateUser({ ...form, name: form.name.trim(), memberId: form.memberId.trim(), email: form.email.trim(), phone: form.phone.trim() });
    if (!result?.ok) {
      setErrors((current) => ({ ...current, ...(result?.errors || { form: 'Unable to save profile changes.' }) }));
      setSaved(false);
      return;
    }
    setSaved(true);
  };

  return (
    <section className="profile-page page-panel">
      <div className="profile-heading"><p className="eyebrow">YOUR ACCOUNT</p><h2>Member Profile</h2><p>Keep your contact details accurate so library notices reach you.</p></div>
      {profileLoading && <Loading label="Loading your protected member profile…" />}
      {profileApiError && <p className="error-message" role="alert">{profileApiError}</p>}
      <form className="profile-form" onSubmit={submit} noValidate>
        <div className="form-grid-two">
          <Input label="Full name" name="name" value={form.name} onChange={handleChange} required error={errors.name} autoComplete="name" />
          <Input label="Member ID" name="memberId" value={form.memberId} onChange={handleChange} required error={errors.memberId} />
          <Input label="Email address" name="email" type="email" value={form.email} onChange={handleChange} required error={errors.email} autoComplete="email" />
          <Input label="Phone number" name="phone" type="tel" value={form.phone} onChange={handleChange} required error={errors.phone} placeholder="10–15 digits" autoComplete="tel" />
          <Input label="Membership type" name="membershipType" value={form.membershipType} onChange={handleChange} required error={errors.membershipType} />
        </div>
        {errors.form && <p className="error-message" role="alert">{errors.form}</p>}
        {saved && <p className="notice" role="status">Profile saved successfully through the protected member API.</p>}
        <Button type="submit">Save profile changes →</Button>
      </form>

      <section className="api-member-card" aria-labelledby="api-member-heading">
        <p className="eyebrow">EXPERIMENT 5 · REST API + FETCH</p>
        <h3 id="api-member-heading">Sample member record from the API</h3>
        <p className="api-member-note">This read-only example is fetched from DummyJSON to demonstrate asynchronous member data. It is not your signed-in library account and will not overwrite your profile.</p>
        {memberApiLoading && <Loading label="Fetching sample member information…" />}
        {memberApiError && <p className="error-message" role="alert">{memberApiError}</p>}
        {!memberApiLoading && apiMember && (
          <div className="api-member-details">
            {apiMember.image && <img src={apiMember.image} alt="Sample API member" loading="lazy" />}
            <div><strong>{apiMember.name}</strong><span>API member ID: {apiMember.id}</span><span>Username: {apiMember.username}</span></div>
            <div><span>Email: {apiMember.email}</span><span>Phone: {apiMember.phone}</span><span>Endpoint: dummyjson.com/users/1</span></div>
          </div>
        )}
      </section>
    </section>
  );
};

export default Profile;
