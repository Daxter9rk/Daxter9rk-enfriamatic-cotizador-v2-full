import {FieldValue} from 'firebase-admin/firestore';
import {logger} from 'firebase-functions';
import {onDocumentCreated} from 'firebase-functions/v2/firestore';
import {firestore} from '../shared/admin';

export const syncEquipmentIntervention = onDocumentCreated(
  {document: 'equipmentInterventions/{interventionId}', region: 'us-central1', maxInstances: 10},
  async (event) => {
    const intervention = event.data?.data();
    if (!intervention) return;
    const equipmentId = String(intervention.equipmentId ?? '');
    if (!equipmentId) return;
    const equipmentRef = firestore.doc(`equipment/${equipmentId}`);
    const equipment = await equipmentRef.get();
    if (!equipment.exists || equipment.data()?.siteId !== intervention.siteId) {
      logger.warn('Intervention ignored due to invalid equipment relationship', {
        interventionId: event.params.interventionId,
        equipmentId,
      });
      return;
    }
    await equipmentRef.update({
      latestDiagnosis: String(intervention.diagnosis ?? '').slice(0, 2000),
      lastInterventionAt: intervention.createdAt ?? FieldValue.serverTimestamp(),
      operationalStatus: intervention.resultingStatus ?? 'unknown',
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: intervention.createdBy,
    });
  },
);
