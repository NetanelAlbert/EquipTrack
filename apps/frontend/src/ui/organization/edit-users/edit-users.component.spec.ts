import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { EditUsersComponent } from './edit-users.component';
import { OrganizationStore } from '../../../store/organization.store';
import { OrganizationService } from '../../../services/organization.service';
import { UserStore } from '../../../store/user.store';
import { NotificationService } from '../../../services/notification.service';

describe('EditUsersComponent', () => {
  let component: EditUsersComponent;
  let fixture: ComponentFixture<EditUsersComponent>;
  let queryParamsSubject: Subject<Record<string, string>>;

  beforeEach(async () => {
    queryParamsSubject = new Subject<Record<string, string>>();

    await TestBed.configureTestingModule({
      imports: [
        EditUsersComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { queryParams: queryParamsSubject.asObservable() },
        },
        {
          provide: OrganizationStore,
          useValue: {
            users: signal([]),
            invitingUserStatus: { isLoading: signal(false) },
            getUsersStatus: signal({ isLoading: false }),
          },
        },
        {
          provide: OrganizationService,
          useValue: {
            getUsers: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: UserStore,
          useValue: {
            currentOrganization: signal({
              departments: [
                {
                  id: 'dep-1',
                  name: 'Dept 1',
                  subDepartments: [{ id: 'sub-1', name: 'Sub 1' }],
                },
              ],
            }),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            showSuccess: jest.fn(),
            showError: jest.fn(),
            showInfo: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditUsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should pre-fill email from query params', () => {
    queryParamsSubject.next({ email: 'test@example.com' });

    expect(component.inviteForm.value.email).toBe('test@example.com');
  });

  it('should update sub-department options when department changes', () => {
    component.inviteForm.controls['departmentId'].setValue('dep-1');

    expect(component.subDepartmentOptions()).toEqual([
      { id: 'sub-1', name: 'Sub 1' },
    ]);
  });

  it('should unsubscribe from queryParams when destroyed', () => {
    expect(queryParamsSubject.observed).toBe(true);

    fixture.destroy();

    expect(queryParamsSubject.observed).toBe(false);
  });

  it('should clear sub-department options when department with no sub-departments is selected', () => {
    component.inviteForm.controls['departmentId'].setValue('non-existent');

    expect(component.subDepartmentOptions()).toBeUndefined();
  });
});
