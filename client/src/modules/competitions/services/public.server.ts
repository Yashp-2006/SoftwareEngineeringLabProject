import { adminDb } from '@taikaix/backend/lib/firebase-admin';
import { fetchWithCache } from '@taikaix/backend/lib/redis';

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
      
      const compData = compSnap.data() || {};
      
      const catSnap = await adminDb.collection('competitions').doc(id).collection('categories').get();
      const categories = catSnap.docs.map((d: any) => {
        const catData = d.data() || {};
        if (catData.athletes) {
          catData.athletes = catData.athletes.map(({ phone: _p, email: _e, ...safe }: any) => safe);
        }
        return { id: d.id, ...catData };
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
      const categories = catSnap.docs.map((d: any) => {
        const { athletes, ...safeData } = d.data() || {};
        return { id: d.id, ...safeData };
      });

      return {
        categories
      };
    });
  }
}
