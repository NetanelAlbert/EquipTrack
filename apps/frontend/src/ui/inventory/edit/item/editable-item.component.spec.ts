import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { FormBuilder, ValidatorFn } from '@angular/forms';
import { EditableItemComponent } from './editable-item.component';
import { OrganizationStore } from '../../../../store';
import { emptyItem } from '../form.mudels';

describe('EditableItemComponent', () => {
  let component: EditableItemComponent;
  let fixture: ComponentFixture<EditableItemComponent>;
  let fb: FormBuilder;
  const noopLimit: ValidatorFn = () => null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        EditableItemComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
    }).compileComponents();

    fb = TestBed.inject(FormBuilder);
    const store = TestBed.inject(OrganizationStore);
    store.setProducts([
      { id: 'upi-prod', name: 'Serial tracked', hasUpi: true },
      { id: 'bulk-prod', name: 'Bulk', hasUpi: false },
    ]);

    fixture = TestBed.createComponent(EditableItemComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('control', emptyItem(fb, noopLimit));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should cap UPI form fields at MAX_UPI_QUANTITY when quantity is huge', () => {
    component.productIdControl().setValue('upi-prod');
    fixture.detectChanges();

    component.quantityControl().setValue(10_000);
    fixture.detectChanges();

    expect(component.upisControl().length).toBe(
      EditableItemComponent.MAX_UPI_QUANTITY
    );
    expect(component.quantityControl().value).toBe(
      EditableItemComponent.MAX_UPI_QUANTITY
    );
  });

  it('should not grow the upis array for non-UPI products when quantity is large', () => {
    component.productIdControl().setValue('bulk-prod');
    fixture.detectChanges();

    const before = component.upisControl().length;
    component.quantityControl().setValue(5000);
    fixture.detectChanges();

    expect(component.upisControl().length).toBe(before);
    expect(component.quantityControl().value).toBe(5000);
  });

  it('should not add another UPI row when already at the limit', () => {
    component.productIdControl().setValue('upi-prod');
    fixture.detectChanges();
    component.quantityControl().setValue(EditableItemComponent.MAX_UPI_QUANTITY);
    fixture.detectChanges();

    const len = component.upisControl().length;
    const addBtn = fixture.debugElement.query(
      By.css('[data-testid="editable-item-add-upi"]')
    );
    addBtn.nativeElement.click();
    fixture.detectChanges();

    expect(component.upisControl().length).toBe(len);
  });
});
