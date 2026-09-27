import { adminDb } from '@taikaix/backend/lib/firebase-admin';
import { fetchWithCache } from '@taikaix/backend/lib/redis';
import type { Category, Athlete, Competition } from '@taikaix/backend/types';

export class PublicService {
  /**
   * Fetches public competition data including categories, while stripping PII from athletes.
   * Cached for 60 seconds in Redis.
   */
  static async getPublicCompetition(id: string) {
    const cacheKey = `comp:public:${id}`;

    return await fetchWithCache(cacheKey, 60, async () => {
      const compSnap = await adminDb.collection('competitions').doc(id).get();
      if (!compSnap.exists) {
        throw new Error('NOT_FOUND: Competition not found');
      }
      
      const compData = (compSnap.data() || {}) as Partial<Competition>;
      
      const catSnap = await adminDb.collection('competitions').doc(id).collection('categories').get();
      const categories: Category[] = catSnap.docs.map(d => {
        const catData = (d.data() || {}) as Partial<Category>;
        const sanitizedAthletes = catData.athletes
          ? catData.athletes.map(({ phone: _p, email: _e, ...safe }: Athlete) => safe as Athlete)
          : undefined;

        return {
          id: d.id,
          ...catData,
          name: catData.name || '',
          athletes: sanitizedAthletes,
        };
      });

      return {
        ...compData,
        categories
      };
    });
  }

  /**
   * Fetches the competition schedule, stripping athletes entirely to minimize payload size.
   * Cached for 60 seconds in Redis.
   */
  static async getSchedule(id: string) {
    const cacheKey = `comp:schedule:${id}`;

    return await fetchWithCache(cacheKey, 60, async () => {
      const catSnap = await adminDb.collection('competitions').doc(id).collection('categories').orderBy('scheduledStartTime').get();
      const categories = catSnap.docs.map(d => {
        const { athletes: _a, ...safeData } = (d.data() || {}) as Partial<Category>;
        return { id: d.id, ...safeData, name: safeData.name || '' };
      });

      return {
        categories
      };
    });
  }
}
