import { algoliasearch } from 'algoliasearch';

// Algolia config — all values come from environment variables only.
// NEXT_PUBLIC_ALGOLIA_APP_ID + NEXT_PUBLIC_ALGOLIA_SEARCH_KEY: safe client-side (search-only key).
// ALGOLIA_ADMIN_KEY: server-only, must NEVER have NEXT_PUBLIC_ prefix.
const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || '';
const searchApiKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY || '';
const adminApiKey = process.env.ALGOLIA_ADMIN_KEY || '';

if (!appId || !searchApiKey) {
  console.warn('[Algolia] NEXT_PUBLIC_ALGOLIA_APP_ID or NEXT_PUBLIC_ALGOLIA_SEARCH_KEY is not set. Search will be unavailable.');
}

export const searchClient = algoliasearch(appId || 'placeholder', searchApiKey || 'placeholder');
export const adminClient = algoliasearch(appId || 'placeholder', adminApiKey || 'placeholder');

export const indexCompetition = async (competitionData: any) => {
  if (process.env.ALGOLIA_ADMIN_KEY) {
    try {
      const indexName = 'competitions';
      const record = {
        objectID: competitionData.id,
        name: competitionData.name,
        type: competitionData.type,
        status: competitionData.status,
        mats: competitionData.mats,
        location: competitionData.location || 'Online',
        startDate: competitionData.startDate || new Date().toISOString(),
        _tags: [competitionData.type, competitionData.status]
      };
      // Algoliasearch v5 syntax
      // We index the single record
      await adminClient.saveObject({
        indexName,
        body: record,
      });
      console.log(`Indexed competition ${competitionData.id} to Algolia`);
    } catch (error) {
      console.error('Algolia indexing error:', error);
    }
  }
};
