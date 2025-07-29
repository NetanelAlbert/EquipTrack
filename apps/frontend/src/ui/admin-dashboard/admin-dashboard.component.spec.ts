import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { 
  commonTestProviders, 
  createMockApiService, 
  createMockUserStore,
  createMockNotificationService
} from '../../testing/test-helpers';
import { ApiService, NotificationService } from '../../services';
import { UserStore } from '../../store';

describe('AdminDashboardComponent', () => {
  let component: AdminDashboardComponent;
  let fixture: ComponentFixture<AdminDashboardComponent>;

  beforeEach(async () => {
    const mockApiService = createMockApiService();
    const mockUserStore = createMockUserStore();
    const mockNotificationService = createMockNotificationService();

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        ...commonTestProviders,
        { provide: ApiService, useValue: mockApiService },
        { provide: UserStore, useValue: mockUserStore },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});