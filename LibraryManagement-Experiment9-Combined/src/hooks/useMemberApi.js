import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSampleMember } from '../store/librarySlice';

// The public sample record is global Redux state; it remains separate from the
// real account held by AuthContext.
const useMemberApi = () => {
  const dispatch = useDispatch();
  const { sampleApiMember: member, sampleMemberLoading: loading, sampleMemberError: error } = useSelector((state) => state.library);

  useEffect(() => {
    if (member) return undefined;
    const request = dispatch(fetchSampleMember());
    return () => request.abort();
  }, [dispatch, member]);

  return { member, loading, error };
};

export default useMemberApi;
