import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TraceProductComponent } from './trace-product.component';

describe('TraceProductComponent', () => {
  let component: TraceProductComponent;
  let fixture: ComponentFixture<TraceProductComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TraceProductComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TraceProductComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});