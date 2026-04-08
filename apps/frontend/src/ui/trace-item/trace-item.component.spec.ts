import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { TraceItemComponent } from './trace-item.component';

describe('TraceItemComponent', () => {
  let component: TraceItemComponent;
  let fixture: ComponentFixture<TraceItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TraceItemComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TraceItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have upiProducts computed property', () => {
    expect(component.upiProducts).toBeDefined();
    expect(typeof component.upiProducts).toBe('function');
  });

  it('should have canSearch computed property', () => {
    expect(component.canSearch).toBeDefined();
    expect(component.canSearch()).toBe(false);
  });

  it('should have isLoading signal initialized to false', () => {
    expect(component.isLoading()).toBe(false);
  });

  it('should have hasSearched signal initialized to false', () => {
    expect(component.hasSearched()).toBe(false);
  });

  it('should have reports signal initialized to empty array', () => {
    expect(component.reports()).toEqual([]);
  });

  it('should inject required stores', () => {
    expect(component.organizationStore).toBeDefined();
    expect(component.userStore).toBeDefined();
    expect(component.inventoryStore).toBeDefined();
  });

  it('should reset state when product changes', () => {
    component.onProductChange('prod-1');
    expect(component.selectedProductId()).toBe('prod-1');
  });

  it('should reset reports and hasSearched when UPI changes', () => {
    component.onUpiChange('upi-1');
    expect(component.selectedUpi()).toBe('upi-1');
    expect(component.reports()).toEqual([]);
    expect(component.hasSearched()).toBe(false);
  });

  it('should return empty string for unknown user', () => {
    expect(component.getUserName(undefined)).toBe('');
  });

  it('should return department label for report with department', () => {
    const report = {
      productId: 'p1',
      upi: 'u1',
      location: 'A',
      reportedBy: 'user-1',
    };
    expect(component.getDepartmentLabel(report)).toBe('');
  });

  it('should format valid timestamps', () => {
    const report = {
      productId: 'p1',
      upi: 'u1',
      location: 'A',
      reportedBy: 'user-1',
      reportTimestamp: '2026-04-01T10:00:00.000Z',
    };
    const formatted = component.formatTimestamp(report);
    expect(formatted).toBeTruthy();
    expect(formatted).not.toBe('');
  });

  it('should return empty string for missing timestamp', () => {
    const report = {
      productId: 'p1',
      upi: 'u1',
      location: 'A',
      reportedBy: 'user-1',
    };
    expect(component.formatTimestamp(report)).toBe('');
  });

  it('should have displayedColumns defined', () => {
    expect(component.displayedColumns).toEqual([
      'reportDate',
      'reportTime',
      'location',
      'holder',
      'department',
      'reporter',
    ]);
  });
});
