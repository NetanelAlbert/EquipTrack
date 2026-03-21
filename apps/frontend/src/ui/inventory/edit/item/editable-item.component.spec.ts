import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { EditableItemComponent } from './editable-item.component';

describe('EditableItemComponent', () => {
  let component: EditableItemComponent;
  let fixture: ComponentFixture<EditableItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        EditableItemComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditableItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
