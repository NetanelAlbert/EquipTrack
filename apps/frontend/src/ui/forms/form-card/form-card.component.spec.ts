import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { FormCardComponent } from './form-card.component';
import {
  InventoryForm,
  FormStatus,
  FormType,
  InventoryItem,
} from '@equip-track/shared';

describe('FormCardComponent', () => {
  let component: FormCardComponent;
  let fixture: ComponentFixture<FormCardComponent>;
  let routerSpy: { navigate: jest.Mock };

  const mockItems: InventoryItem[] = [
    { productId: 'prod-1', quantity: 2 },
    { productId: 'prod-2', quantity: 1, upis: ['UPI-001'] },
  ];

  const mockCheckOutForm: InventoryForm = {
    formID: 'form-checkout-1',
    userID: 'user-123',
    organizationID: 'org-1',
    status: FormStatus.Pending,
    type: FormType.CheckOut,
    items: mockItems,
    createdAtTimestamp: Date.now(),
    lastUpdated: Date.now(),
    description: 'Test checkout form',
    createdByUserId: 'user-admin',
  };

  const mockCheckInForm: InventoryForm = {
    formID: 'form-checkin-1',
    userID: 'user-456',
    organizationID: 'org-1',
    status: FormStatus.Approved,
    type: FormType.CheckIn,
    items: mockItems,
    createdAtTimestamp: Date.now(),
    lastUpdated: Date.now(),
    description: 'Test checkin form',
    createdByUserId: 'user-admin',
  };

  beforeEach(async () => {
    routerSpy = { navigate: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [
        FormCardComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FormCardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    component.form = mockCheckOutForm;
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('onCloneForm', () => {
    it('should navigate with formType, userId, and items for checkout form', () => {
      component.form = mockCheckOutForm;
      fixture.detectChanges();

      component.onCloneForm();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/create-form'], {
        queryParams: {
          formType: FormType.CheckOut,
          userId: 'user-123',
          items: JSON.stringify(mockItems),
        },
      });
    });

    it('should navigate with formType, userId, and items for checkin form', () => {
      component.form = mockCheckInForm;
      fixture.detectChanges();

      component.onCloneForm();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/create-form'], {
        queryParams: {
          formType: FormType.CheckIn,
          userId: 'user-456',
          items: JSON.stringify(mockItems),
        },
      });
    });

    it('should preserve the original form userId in clone params', () => {
      component.form = mockCheckOutForm;
      fixture.detectChanges();

      component.onCloneForm();

      const navigateCall = routerSpy.navigate.mock.calls[0];
      const queryParams = navigateCall[1].queryParams;
      expect(queryParams.userId).toBe(mockCheckOutForm.userID);
    });
  });

  describe('onCheckIn', () => {
    it('should navigate with CheckIn formType, userId, and items', () => {
      component.form = mockCheckOutForm;
      fixture.detectChanges();

      component.onCheckIn();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/create-form'], {
        queryParams: {
          formType: FormType.CheckIn,
          userId: 'user-123',
          items: JSON.stringify(mockItems),
        },
      });
    });
  });
});
