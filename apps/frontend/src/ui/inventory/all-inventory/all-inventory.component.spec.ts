import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { AllInventoryComponent } from './all-inventory.component';

describe('AllInventoryComponent', () => {
  let component: AllInventoryComponent;
  let fixture: ComponentFixture<AllInventoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AllInventoryComponent,
        HttpClientTestingModule,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AllInventoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have loading state computed property', () => {
    expect(component.isLoading).toBeDefined();
    expect(typeof component.isLoading).toBe('function');
  });

  it('should have error message computed property', () => {
    expect(component.errorMessage).toBeDefined();
    expect(typeof component.errorMessage).toBe('function');
  });

  it('should have hasInventory computed property', () => {
    expect(component.hasInventory).toBeDefined();
    expect(typeof component.hasInventory).toBe('function');
  });

  it('should inject required stores', () => {
    expect(component.inventoryStore).toBeDefined();
    expect(component.organizationStore).toBeDefined();
  });

  it('should have loadInventory method', () => {
    expect(component.loadInventory).toBeDefined();
    expect(typeof component.loadInventory).toBe('function');
  });

  it('should call loadInventory in ngOnInit', () => {
    const spy = jest.spyOn(component, 'loadInventory');
    component.ngOnInit();
    expect(spy).toHaveBeenCalled();
  });
});
