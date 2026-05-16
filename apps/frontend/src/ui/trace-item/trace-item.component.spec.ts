import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { FormStatus, FormType } from '@equip-track/shared';
import { TraceItemComponent } from './trace-item.component';
import { ApiService } from '../../services/api.service';
import { NotificationService } from '../../services/notification.service';
import { OrganizationStore } from '../../store/organization.store';
import { UserStore } from '../../store/user.store';
import { InventoryStore } from '../../store/inventory.store';
import type { InventoryItem, Product } from '@equip-track/shared';

describe('TraceItemComponent', () => {
  let component: TraceItemComponent;
  let fixture: ComponentFixture<TraceItemComponent>;
  const executeReport = jest.fn();
  const executeOwnership = jest.fn();

  const mockApiService = {
    endpoints: {
      getItemReportHistory: { execute: executeReport },
      getItemOwnershipHistory: { execute: executeOwnership },
    },
  };

  const mockOrganizationStore = {
    products: signal<Product[]>([
      { id: 'p1', name: 'Test Product', hasUpi: true },
    ]),
    getProductName: jest.fn((id: string) => `name-${id}`),
  };

  const mockUserStore = {
    selectedOrganizationId: signal('org-1'),
    getDepartmentName: jest.fn(() => ''),
  };

  const mockInventoryStore = {
    totalInventory: signal<InventoryItem[]>([
      { productId: 'p1', quantity: 1, upis: ['UPI-1'] },
    ]),
    fetchTotalInventory: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    executeReport.mockReturnValue(
      of({ status: true, reports: [] as never[] })
    );
    executeOwnership.mockReturnValue(
      of({ status: true, ownershipHistory: [] })
    );

    await TestBed.configureTestingModule({
      imports: [
        TraceItemComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: { open: jest.fn() } },
        NotificationService,
        { provide: ApiService, useValue: mockApiService },
        { provide: OrganizationStore, useValue: mockOrganizationStore },
        { provide: UserStore, useValue: mockUserStore },
        { provide: InventoryStore, useValue: mockInventoryStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TraceItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have ownershipDisplayedColumns for the ownership table', () => {
    expect(component.ownershipDisplayedColumns).toEqual([
      'previousHolder',
      'newHolder',
      'timestamp',
      'eventType',
      'formId',
    ]);
  });

  it('loads ownership history in parallel with report history on search', async () => {
    const event = {
      previousHolderId: 'WAREHOUSE',
      newHolderId: 'user-1',
      timestamp: 1_700_000_000_000,
      formId: 'form-1',
      eventType: 'check-out' as const,
    };
    executeReport.mockReturnValue(
      of({
        status: true,
        reports: [
          {
            productId: 'p1',
            upi: 'UPI-1',
            location: 'A',
            reportedBy: 'user-1',
            reportDate: '2026-04-01',
            reportTimestamp: '2026-04-01T10:00:00.000Z',
          },
        ],
      })
    );
    executeOwnership.mockReturnValue(
      of({ status: true, ownershipHistory: [event] })
    );

    component.onProductChange('p1');
    component.onUpiChange('UPI-1');
    await component.search();

    expect(executeReport).toHaveBeenCalled();
    expect(executeOwnership).toHaveBeenCalled();
    expect(component.ownershipHistory()).toEqual([event]);
    expect(component.reports().length).toBe(1);
  });

  it('maps ownership event type to translation keys', () => {
    expect(component.ownershipEventTypeKey('check-out')).toBe(
      'trace.eventType.check-out'
    );
    expect(component.ownershipEventTypeKey('check-in')).toBe(
      'trace.eventType.check-in'
    );
  });

  it('ownershipFormListQueryParams matches forms deep-link shape for approved check-outs', () => {
    const formId = 'form-uuid-123';
    expect(component.ownershipFormListQueryParams(formId)).toEqual({
      formType: FormType.CheckOut,
      searchStatus: FormStatus.Approved,
      searchTerm: formId,
    });
  });
});
