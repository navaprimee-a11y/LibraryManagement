import { configureStore } from '@reduxjs/toolkit';
import libraryReducer from './librarySlice';
import libraryMiddleware from './libraryMiddleware';

export const store = configureStore({
  reducer: {
    library: libraryReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(libraryMiddleware),
  devTools: import.meta.env.DEV,
});

export default store;
