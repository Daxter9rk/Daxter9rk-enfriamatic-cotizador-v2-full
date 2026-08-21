import {describe, expect, it} from 'vitest';
import {createQuoteDraft, updateQuoteDraft, validateQuoteDraft} from './quoteDrafts';

const base = createQuoteDraft({clientId: 'client-1', actorId: 'admin-1', actorRole: 'admin'});

describe('quote draft application use cases', () => {
  it('creates an independent admin draft with null relations', () => {
    expect(base.requestId).toBeNull();
    expect(base.siteId).toBeNull();
    expect(base.equipmentId).toBeNull();
    expect(base.assignedTo).toBeNull();
  });

  it('forces null relations when an independent input contains operational ids', () => {
    const draft = createQuoteDraft({
      clientId: 'client-1',
      actorId: 'admin-1',
      actorRole: 'admin',
      siteId: 'site-1',
      equipmentId: 'equipment-1',
    });
    expect(draft.requestId).toBeNull();
    expect(draft.siteId).toBeNull();
    expect(draft.equipmentId).toBeNull();
  });

  it('does not assign an independent draft to an operator', () => {
    const draft = createQuoteDraft({
      clientId: 'client-1',
      actorId: 'operator-1',
      actorRole: 'operator',
    });
    expect(draft.assignedTo).toBeNull();
  });

  it('updates only an editable draft for its assigned operator', () => {
    const quote = {...base, id: 'quote-1', assignedTo: 'operator-1'} as never;
    expect(
      updateQuoteDraft(
        quote,
        {notes: '  nota ', serviceReference: ' ', technicalContext: ' contexto '},
        {id: 'operator-1', role: 'operator'},
      ),
    ).toEqual({notes: 'nota', serviceReference: null, technicalContext: 'contexto'});
    expect(() => updateQuoteDraft(quote, {}, {id: 'operator-2', role: 'operator'})).toThrow();
  });

  it('allows saving and previewing independent drafts but not issuing them', () => {
    const quote = {...base, id: 'quote-1'} as never;
    expect(validateQuoteDraft(quote, 'save')).toEqual([]);
    expect(validateQuoteDraft(quote, 'preview')).toEqual([]);
    expect(validateQuoteDraft(quote, 'issue')).toHaveLength(1);
  });
});
