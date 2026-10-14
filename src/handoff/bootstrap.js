import {configureHandoffServices} from './services.js';
import {createDemoCatalogProvider, demoCatalog} from './demo-catalog.js';

configureHandoffServices(window.oldUiHandoffServices || {
  catalogProvider: createDemoCatalogProvider(),
  assetResolver: async () => { throw new Error('Fixture has no game assets'); },
  fixtureMode: true,
  catalogExtras: {metadata: demoCatalog.metadata, social: [], voiceCatalogs: []},
});
await import('../appearance/demo.js');
