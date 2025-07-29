import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TraceProductComponent } from './trace-product.component';
import { 
  commonTestProviders, 
  createMockApiService, 
  createMockUserStore,
  createMockNotificationService
} from '../../testing/test-helpers';
import { ApiService, NotificationService } from '../../services';
import { UserStore } from '../../store';

describe('TraceProductComponent', () => {
  let component: TraceProductComponent;
  let fixture: ComponentFixture<TraceProductComponent>;

  beforeEach(async () => {
    const mockApiService = createMockApiService();
    const mockUserStore = createMockUserStore();
    const mockNotificationService = createMockNotificationService();

    await TestBed.configureTestingModule({
      imports: [TraceProductComponent],
      providers: [
        ...commonTestProviders,
        { provide: ApiService, useValue: mockApiService },
        { provide: UserStore, useValue: mockUserStore },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TraceProductComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});