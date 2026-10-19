import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchApiRecommendations } from '../store/librarySlice';

const useApiRecommendations = (category = 'Fiction') => {
  const dispatch = useDispatch();
  const { apiRecommendations: recommendations, recommendationsLoading: loading, recommendationsError: error } = useSelector((state) => state.library);

  useEffect(() => {
    // The thunk deduplicates an already-pending request for this category.
    // Do not abort it during React StrictMode's development-only effect cleanup;
    // doing so produces a misleading '(canceled)' entry in the Network panel.
    dispatch(fetchApiRecommendations({ category }));
  }, [dispatch, category]);

  return { recommendations, loading, error };
};

export default useApiRecommendations;
