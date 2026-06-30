import { algoliasearch } from 'algoliasearch';

// Initialize the client
// Using dummy keys if not present in env, so it doesn't crash during build
const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || 'dummy_app_id';
const searchApiKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY || 'dummy_search_key';
const adminApiKey = process.env.ALGOLIA_ADMIN_KEY || 'dummy_admin_key';

export const searchClient = algoliasearch(appId, searchApiKey);
export const adminClient = algoliasearch(appId, adminApiKey);

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
