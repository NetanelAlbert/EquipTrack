import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import {
  FormStatus,
  FormType,
  InventoryForm,
  Product,
} from '@equip-track/shared';
import { OrganizationStore } from '../../../store/organization.store';
import { NotificationService } from '../../../services/notification.service';
import { FormInventoryTableComponent } from './form-inventory-table.component';

function makeForm(overrides: Partial<InventoryForm> = {}): InventoryForm {
  return {
    formID: 'form-table-1',
    userID: 'user-1',
    organizationID: 'org-1',
    status: FormStatus.Approved,
    type: FormType.CheckOut,
    items: [],
    createdAtTimestamp: Date.now(),
    lastUpdated: Date.now(),
    ...overrides,
  };
}

const productByIdFactory =
  (productsById: Record<string, Product | undefined>) =>
  (id: string): Product | undefined =>
    productsById[id];

describe('FormInventoryTableComponent', () => {
  let component: FormInventoryTableComponent;
  let fixture: ComponentFixture<FormInventoryTableComponent>;

  const products: Record<string, Product> = {
    'bulk-1': { id: 'bulk-1', name: 'Safety Helmet', hasUpi: false } as Product,
    'upi-1': { id: 'upi-1', name: 'Laptop', hasUpi: true } as Product,
  };

  const orgStoreMock = {
    getProduct: jest.fn(productByIdFactory(products)),
    getProductName: (id: string) => products[id]?.name ?? id,
  };

  const notificationMock = {
    showInfo: jest.fn(),
  };

  beforeEach(async () => {
    orgStoreMock.getProduct.mockClear();
    notificationMock.showInfo.mockClear();

    await TestBed.configureTestingModule({
      imports: [
        FormInventoryTableComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: OrganizationStore, useValue: orgStoreMock },
        { provide: NotificationService, useValue: notificationMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FormInventoryTableComponent);
    component = fixture.componentInstance;
  });

  function setForm(form: InventoryForm) {
    fixture.componentRef.setInput('form', form);
    fixture.detectChanges();
  }

  it('renders a row per item plus headers for each check-in event and an outstanding column', () => {
    const form = makeForm({
      items: [
        { productId: 'bulk-1', quantity: 5 },
        { productId: 'upi-1', quantity: 2, upis: ['LAP-1', 'LAP-2'] },
      ],
      checkInEvents: [
        {
          checkInEventId: 'cie-1',
          createdAtTimestamp: Date.now(),
          createdByUserId: 'wm-1',
          items: [
            { productId: 'bulk-1', quantity: 2 },
            { productId: 'upi-1', quantity: 1, upis: ['LAP-1'] },
          ],
        },
      ],
    });
    setForm(form);

    const rows = component.rows();
    expect(rows.length).toBe(2);

    const bulkRow = rows[0];
    expect(bulkRow.productName).toBe('Safety Helmet');
    expect(bulkRow.hasUpi).toBe(false);
    expect(bulkRow.eventCells[0].quantity).toBe(2);
    expect(bulkRow.outstandingCell.quantity).toBe(3);

    const upiRow = rows[1];
    expect(upiRow.hasUpi).toBe(true);
    expect(upiRow.eventCells[0].upis).toEqual(['LAP-1']);
    expect(upiRow.eventCells[0].quantity).toBe(1);
    expect(upiRow.outstandingCell.upis).toEqual(['LAP-2']);
    expect(upiRow.outstandingCell.quantity).toBe(1);

    const eventHeader = fixture.nativeElement.querySelector(
      '[data-testid="form-inventory-table-event-header-cie-1"]'
    );
    expect(eventHeader).toBeTruthy();

    const tableWrapper = fixture.nativeElement.querySelector(
      `[data-testid="form-inventory-table-${form.formID}"]`
    );
    expect(tableWrapper).toBeTruthy();
  });

  it('shows quantity numbers for UPI rows by default and UPI lists once expanded', () => {
    const form = makeForm({
      items: [{ productId: 'upi-1', quantity: 2, upis: ['LAP-1', 'LAP-2'] }],
      checkInEvents: [
        {
          checkInEventId: 'cie-1',
          createdAtTimestamp: Date.now(),
          createdByUserId: 'wm-1',
          items: [{ productId: 'upi-1', quantity: 1, upis: ['LAP-1'] }],
        },
      ],
    });
    setForm(form);

    const eventCell = (): HTMLElement =>
      fixture.nativeElement.querySelector(
        '[data-testid="form-inventory-table-cell-upi-1-event-0"]'
      );
    const outstandingCell = (): HTMLElement =>
      fixture.nativeElement.querySelector(
        '[data-testid="form-inventory-table-cell-upi-1-outstanding"]'
      );

    expect(eventCell().textContent?.trim()).toBe('1');
    expect(outstandingCell().textContent?.trim()).toBe('1');

    component.toggleRow('upi-1', true);
    fixture.detectChanges();

    expect(eventCell().textContent).toContain('LAP-1');
    expect(outstandingCell().textContent).toContain('LAP-2');
  });

  it('does not toggle non-UPI rows', () => {
    const form = makeForm({
      items: [{ productId: 'bulk-1', quantity: 5 }],
    });
    setForm(form);

    component.toggleRow('bulk-1', false);
    expect(component.isExpanded('bulk-1')).toBe(false);
  });

  it('renders a dash for UPI cells that did not return any items in an event', () => {
    const form = makeForm({
      items: [
        { productId: 'upi-1', quantity: 2, upis: ['LAP-1', 'LAP-2'] },
      ],
      checkInEvents: [
        {
          checkInEventId: 'cie-1',
          createdAtTimestamp: Date.now(),
          createdByUserId: 'wm-1',
          items: [],
        },
      ],
    });
    setForm(form);

    component.toggleRow('upi-1', true);
    fixture.detectChanges();

    const cell: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="form-inventory-table-cell-upi-1-event-0"]'
    );
    expect(cell.textContent).toContain('—');
  });
});
