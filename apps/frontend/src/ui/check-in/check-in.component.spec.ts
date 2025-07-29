import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheckInComponent } from './check-in.component';
import { 
  commonTestProviders, 
  createMockApiService, 
  createMockUserStore, 
  createMockFormsStore,
  createMockNotificationService
} from '../../testing/test-helpers';
import { ApiService, NotificationService } from '../../services';
import { UserStore, FormsStore } from '../../store';

describe('CheckInComponent', () => {
  let component: CheckInComponent;
  let fixture: ComponentFixture<CheckInComponent>;

  beforeEach(async () => {
    const mockApiService = createMockApiService();
    const mockUserStore = createMockUserStore();
    const mockFormsStore = createMockFormsStore();
    const mockNotificationService = createMockNotificationService();

    await TestBed.configureTestingModule({
      imports: [CheckInComponent],
      providers: [
        ...commonTestProviders,
        { provide: ApiService, useValue: mockApiService },
        { provide: UserStore, useValue: mockUserStore },
        { provide: FormsStore, useValue: mockFormsStore },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckInComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
