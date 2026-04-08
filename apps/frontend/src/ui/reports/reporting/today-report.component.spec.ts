import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { TodayReportComponent } from './today-report.component';
import { ItemReport } from '@equip-track/shared';

function makeItemReport(
  overrides: Partial<ItemReport> = {}
): ItemReport {
  return {
    productId: 'prod-1',
    upi: 'upi-1',
    location: '',
    reportedBy: '',
    ...overrides,
  };
}

describe('TodayReportComponent', () => {
  let component: TodayReportComponent;
  let fixture: ComponentFixture<TodayReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TodayReportComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TodayReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('shouldShowInput', () => {
    it('should show input for unreported items', () => {
      const item = makeItemReport({ location: '' });
      expect(component.shouldShowInput(item)).toBe(true);
    });

    it('should hide input for reported items by default', () => {
      const item = makeItemReport({
        location: 'Building A',
        reportedBy: 'user-1',
      });
      jest
        .spyOn(component, 'isReportedItem')
        .mockReturnValue(true);

      expect(component.shouldShowInput(item)).toBe(false);
    });

    it('should show input for a reported item after onRowFocus', () => {
      const item = makeItemReport({
        productId: 'prod-1',
        upi: 'upi-1',
        location: 'Building A',
        reportedBy: 'user-1',
      });
      jest
        .spyOn(component, 'isReportedItem')
        .mockReturnValue(true);

      component.onRowFocus(item);

      expect(component.shouldShowInput(item)).toBe(true);
    });
  });

  describe('clicking a reported location cell (regression)', () => {
    it('should stay in edit mode after focusout caused by DOM swap', fakeAsync(() => {
      const item = makeItemReport({
        productId: 'prod-1',
        upi: 'upi-1',
        location: 'Building A',
        reportedBy: 'user-1',
      });
      jest
        .spyOn(component, 'isReportedItem')
        .mockReturnValue(true);

      component.onRowFocus(item);
      expect(component.shouldShowInput(item)).toBe(true);

      const focusoutEvent = new FocusEvent('focusout', {
        relatedTarget: null,
      });
      const fakeCell = document.createElement('td');
      Object.defineProperty(focusoutEvent, 'currentTarget', {
        value: fakeCell,
      });
      component.onLocationCellBlur(focusoutEvent, item);

      expect(component.shouldShowInput(item)).toBe(true);

      tick(100);
    }));

    it('should exit edit mode when focus genuinely leaves the cell', fakeAsync(() => {
      const item = makeItemReport({
        productId: 'prod-1',
        upi: 'upi-1',
        location: 'Building A',
        reportedBy: 'user-1',
      });
      jest
        .spyOn(component, 'isReportedItem')
        .mockReturnValue(true);

      component.onRowFocus(item);
      expect(component.shouldShowInput(item)).toBe(true);

      tick(100);

      const outsideElement = document.createElement('button');
      document.body.appendChild(outsideElement);
      const focusoutEvent = new FocusEvent('focusout', {
        relatedTarget: outsideElement,
      });
      const fakeCell = document.createElement('td');
      Object.defineProperty(focusoutEvent, 'currentTarget', {
        value: fakeCell,
      });
      component.onLocationCellBlur(focusoutEvent, item);

      expect(component.shouldShowInput(item)).toBe(false);
      document.body.removeChild(outsideElement);
    }));
  });

  describe('useLastLocation — no direct mutation of store objects', () => {
    it('should set the location on the local item without mutating the original', () => {
      const original = makeItemReport({
        productId: 'prod-1',
        upi: 'upi-1',
        location: '',
      });
      const localCopy = { ...original };

      component.useLastLocation(localCopy, 'Building B');

      expect(localCopy.location).toBe('Building B');
      expect(original.location).toBe('');
    });
  });

  describe('clearLocation — no direct mutation of store objects', () => {
    it('should clear the location on the local item without mutating the original', () => {
      const original = makeItemReport({
        productId: 'prod-1',
        upi: 'upi-1',
        location: 'Building A',
      });
      const localCopy = { ...original };

      component.clearLocation(localCopy);

      expect(localCopy.location).toBe('');
      expect(original.location).toBe('Building A');
    });
  });
});
