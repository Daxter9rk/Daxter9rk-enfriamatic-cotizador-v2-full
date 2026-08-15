import {setGlobalOptions} from 'firebase-functions/v2';
import {onRequest} from 'firebase-functions/v2/https';
import {logger} from 'firebase-functions';

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10,
});

export const healthCheck = onRequest({region: 'us-central1'}, (_request, response) => {
  logger.info('Health check completed', {
    service: 'enfriamatic-cotizador-v2',
    environment: 'dev',
  });
  response.status(200).json({
    ok: true,
    service: 'enfriamatic-cotizador-v2',
    environment: 'dev',
  });
});

export {recordLogin} from './auth/recordLogin';
export {recordActivity} from './auth/recordActivity';
export {createUser} from './users/createUser';
export {updateUser} from './users/updateUser';
export {claimPrimaryAdmin} from './users/claimPrimaryAdmin';
export {issueQuote} from './quotes/issueQuote';
export {createCorrection} from './quotes/createCorrection';
export {transitionQuote} from './quotes/transitionQuote';
export {transitionRequest} from './requests/transitionRequest';
export {assignRequest} from './requests/assignRequest';
export {downloadQuotePdf} from './documents/downloadQuotePdf';
export {auditDomainWrite} from './audit/domainWrite';
export {syncEquipmentIntervention} from './equipment/syncIntervention';
export {
  upsertCatalogImage,
  deleteCatalogImage,
  getCatalogImageContent,
} from './catalog/catalogImageCallables';
