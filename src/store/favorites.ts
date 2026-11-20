import { create } from 'zustand';
import api from '@/lib/api-client';
import type { Business } from '@/types';

/**
 * The signed-in user's saved businesses. Every heart button and the dashboard's Favorites tab read
 * this one list, so they never disagree. It is loaded once after sign-in and cleared on sign-out.
 * A tap changes the list straight away and puts it back if the server says no.
 */
interface FavoritesState {
  businesses: Business[];
  isLoading: boolean;
  load: () => Promise<void>;
  reset: () => void;
  toggle: (business: Business) => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  businesses: [],
  isLoading: false,

  load: async () => {
    set({ isLoading: true });
    try {
      const res = await api.getFavorites();
      set({ businesses: Array.isArray(res.data) ? res.data : [] });
    } catch {
      // A background read: stay quiet and keep whatever the list showed.
    } finally {
      set({ isLoading: false });
    }
  },

  reset: () => set({ businesses: [], isLoading: false }),

  toggle: async (business) => {
    const wasSaved = get().businesses.some((b) => b.id === business.id);
    const without = (list: Business[]) => list.filter((b) => b.id !== business.id);

    set((state) => ({
      businesses: wasSaved ? without(state.businesses) : [{ ...business, isFavorite: true }, ...without(state.businesses)],
    }));

    try {
      if (wasSaved) await api.removeFavorite(business.id);
      else await api.addFavorite(business.id);
    } catch {
      // The api client has already shown the error. Undo the change.
      set((state) => ({
        businesses: wasSaved ? [business, ...without(state.businesses)] : without(state.businesses),
      }));
    }
  },
}));

/** Has the signed-in user saved this business? */
export function useIsFavorite(businessId: string | undefined | null): boolean {
  return useFavoritesStore((state) => !!businessId && state.businesses.some((b) => b.id === businessId));
}
