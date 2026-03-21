import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { EditableInventoryComponent } from './editable-inventory.component';

describe('EditableInventoryComponent', () => {
  let component: EditableInventoryComponent;
  let fixture: ComponentFixture<EditableInventoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        EditableInventoryComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditableInventoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
