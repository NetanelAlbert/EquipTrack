import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { MyItemsComponent } from './my-items.component';

describe('MyItemsComponent', () => {
  let component: MyItemsComponent;
  let fixture: ComponentFixture<MyItemsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MyItemsComponent,
        HttpClientTestingModule,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MyItemsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have computed property for current user inventory', () => {
    expect(component.currentUserInventory).toBeDefined();
    expect(typeof component.currentUserInventory).toBe('function');
  });

  it('should inject required stores', () => {
    expect(component.userStore).toBeDefined();
    expect(component.inventoryStore).toBeDefined();
  });
});
