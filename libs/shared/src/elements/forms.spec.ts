import {
  FormStatus,
  FormType,
  InventoryForm,
  getOutstandingItems,
  hasRecordedReturns,
  isFullyReturned,
} from './forms';

function makeForm(overrides: Partial<InventoryForm> = {}): InventoryForm {
  return {
    userID: 'user-1',
    formID: 'form-1',
    organizationID: 'org-1',
    items: [],
    type: FormType.CheckOut,
    status: FormStatus.Approved,
    createdAtTimestamp: 0,
    lastUpdated: 0,
    ...overrides,
  };
}

describe('getOutstandingItems', () => {
  it('returns all items when there are no check-in events', () => {
    const form = makeForm({
      items: [{ productId: 'bulk-1', quantity: 5 }],
    });
    expect(getOutstandingItems(form)).toEqual([{ productId: 'bulk-1', quantity: 5 }]);
  });

  it('reduces bulk quantity by returned amount', () => {
    const form = makeForm({
      items: [{ productId: 'bulk-1', quantity: 5 }],
      checkInEvents: [
        {
          checkInEventId: 'cie-1',
          items: [{ productId: 'bulk-1', quantity: 2 }],
          createdAtTimestamp: 1,
          createdByUserId: 'wm-1',
        },
      ],
    });
    expect(getOutstandingItems(form)).toEqual([{ productId: 'bulk-1', quantity: 3 }]);
  });

  it('removes bulk item when fully returned', () => {
    const form = makeForm({
      items: [{ productId: 'bulk-1', quantity: 3 }],
      checkInEvents: [
        {
          checkInEventId: 'cie-1',
          items: [{ productId: 'bulk-1', quantity: 3 }],
          createdAtTimestamp: 1,
          createdByUserId: 'wm-1',
        },
      ],
    });
    expect(getOutstandingItems(form)).toEqual([]);
  });

  it('accumulates returns across multiple check-in events', () => {
    const form = makeForm({
      items: [{ productId: 'bulk-1', quantity: 10 }],
      checkInEvents: [
        {
          checkInEventId: 'cie-1',
          items: [{ productId: 'bulk-1', quantity: 3 }],
          createdAtTimestamp: 1,
          createdByUserId: 'wm-1',
        },
        {
          checkInEventId: 'cie-2',
          items: [{ productId: 'bulk-1', quantity: 4 }],
          createdAtTimestamp: 2,
          createdByUserId: 'wm-1',
        },
      ],
    });
    expect(getOutstandingItems(form)).toEqual([{ productId: 'bulk-1', quantity: 3 }]);
  });

  it('removes returned UPIs for UPI products', () => {
    const form = makeForm({
      items: [{ productId: 'upi-1', quantity: 3, upis: ['A', 'B', 'C'] }],
      checkInEvents: [
        {
          checkInEventId: 'cie-1',
          items: [{ productId: 'upi-1', quantity: 1, upis: ['B'] }],
          createdAtTimestamp: 1,
          createdByUserId: 'wm-1',
        },
      ],
    });
    expect(getOutstandingItems(form)).toEqual([
      { productId: 'upi-1', quantity: 2, upis: ['A', 'C'] },
    ]);
  });

  it('returns empty array when all UPIs returned', () => {
    const form = makeForm({
      items: [{ productId: 'upi-1', quantity: 2, upis: ['A', 'B'] }],
      checkInEvents: [
        {
          checkInEventId: 'cie-1',
          items: [{ productId: 'upi-1', quantity: 2, upis: ['A', 'B'] }],
          createdAtTimestamp: 1,
          createdByUserId: 'wm-1',
        },
      ],
    });
    expect(getOutstandingItems(form)).toEqual([]);
  });

  it('handles mixed bulk and UPI products', () => {
    const form = makeForm({
      items: [
        { productId: 'bulk-1', quantity: 4 },
        { productId: 'upi-1', quantity: 2, upis: ['X', 'Y'] },
      ],
      checkInEvents: [
        {
          checkInEventId: 'cie-1',
          items: [
            { productId: 'bulk-1', quantity: 2 },
            { productId: 'upi-1', quantity: 1, upis: ['X'] },
          ],
          createdAtTimestamp: 1,
          createdByUserId: 'wm-1',
        },
      ],
    });
    expect(getOutstandingItems(form)).toEqual([
      { productId: 'bulk-1', quantity: 2 },
      { productId: 'upi-1', quantity: 1, upis: ['Y'] },
    ]);
  });
});

describe('isFullyReturned', () => {
  it('returns false when there are no check-in events', () => {
    const form = makeForm({ items: [{ productId: 'bulk-1', quantity: 1 }] });
    expect(isFullyReturned(form)).toBe(false);
  });

  it('returns true when all items have been returned', () => {
    const form = makeForm({
      items: [{ productId: 'bulk-1', quantity: 2 }],
      checkInEvents: [
        {
          checkInEventId: 'cie-1',
          items: [{ productId: 'bulk-1', quantity: 2 }],
          createdAtTimestamp: 1,
          createdByUserId: 'wm-1',
        },
      ],
    });
    expect(isFullyReturned(form)).toBe(true);
  });

  it('returns false when items are only partially returned', () => {
    const form = makeForm({
      items: [{ productId: 'bulk-1', quantity: 5 }],
      checkInEvents: [
        {
          checkInEventId: 'cie-1',
          items: [{ productId: 'bulk-1', quantity: 3 }],
          createdAtTimestamp: 1,
          createdByUserId: 'wm-1',
        },
      ],
    });
    expect(isFullyReturned(form)).toBe(false);
  });

  it('returns true for form with no items', () => {
    const form = makeForm({ items: [] });
    expect(isFullyReturned(form)).toBe(true);
  });
});

describe('hasRecordedReturns', () => {
  it('returns false when there are no check-in events', () => {
    const form = makeForm({
      items: [{ productId: 'bulk-1', quantity: 2 }],
    });
    expect(hasRecordedReturns(form)).toBe(false);
  });

  it('returns false when checkInEvents is an empty array', () => {
    const form = makeForm({
      items: [{ productId: 'bulk-1', quantity: 2 }],
      checkInEvents: [],
    });
    expect(hasRecordedReturns(form)).toBe(false);
  });

  it('returns true when at least one check-in event exists', () => {
    const form = makeForm({
      items: [{ productId: 'bulk-1', quantity: 5 }],
      checkInEvents: [
        {
          checkInEventId: 'cie-1',
          items: [{ productId: 'bulk-1', quantity: 1 }],
          createdAtTimestamp: 1,
          createdByUserId: 'wm-1',
        },
      ],
    });
    expect(hasRecordedReturns(form)).toBe(true);
  });
});
