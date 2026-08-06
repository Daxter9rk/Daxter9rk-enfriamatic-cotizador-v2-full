import {FieldValue} from 'firebase-admin/firestore';
import {logger} from 'firebase-functions';
import {onDocumentCreated} from 'firebase-functions/v2/firestore';
import {firestore} from '../shared/admin';
import {buildDomainAuditRecord, domainAuditId} from '../audit/domainEvent';

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
    const actorUid = String(intervention.createdBy ?? '');
    const actor = await firestore.doc(`users/${actorUid}`).get();
    const actorData = actor.data() ?? {};
    if (!actor.exists || !['admin', 'operator'].includes(String(actorData.role))) return;
    const eventCode = 'equipment.intervention_created';
    const auditRef = firestore.doc(`auditLogs/${domainAuditId(event.id, eventCode)}`);
    const batch = firestore.batch();
    batch.update(equipmentRef, {
      latestDiagnosis: String(intervention.diagnosis ?? '').slice(0, 2000),
      lastInterventionAt: intervention.createdAt ?? FieldValue.serverTimestamp(),
      operationalStatus: intervention.resultingStatus ?? 'unknown',
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorUid,
    });
    batch.set(
      auditRef,
      buildDomainAuditRecord({
        sourceEventId: event.id,
        eventCode,
        actorUid,
        actorDisplayNameSnapshot: String(
          intervention.responsibleName ?? actorData.displayName ?? 'Usuario autorizado',
        ),
        actorRoleSnapshot: actorData.role as 'admin' | 'operator',
        resourceType: 'equipment',
        resourceId: equipmentId,
        resourceLabelSnapshot: String(equipment.data()?.name ?? equipmentId),
        result: 'success',
        route: `/equipment/${equipmentId}`,
        occurredAt: intervention.createdAt ?? FieldValue.serverTimestamp(),
      }),
      {merge: false},
    );
    await batch.commit();
  },
);
