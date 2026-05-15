import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { FormsTabContentComponent } from './forms-tab-content.component';
import {
  InventoryForm,
  FormStatus,
  FormType,
  UserRole,
  UserState,
} from '@equip-track/shared';
import { OrganizationStore } from '../../../store/organization.store';
import { UserStore } from '../../../store/user.store';

describe('FormsTabContentComponent', () => {
  let component: FormsTabContentComponent;
  let fixture: ComponentFixture<FormsTabContentComponent>;
  let organizationStore: InstanceType<typeof OrganizationStore>;
  let userStore: InstanceType<typeof UserStore>;

  const mockForms: InventoryForm[] = [
    {
      formID: 'form1',
      userID: 'user1',
      organizationID: 'org1',
      status: FormStatus.Pending,
      type: FormType.CheckOut,
      items: [],
      createdAtTimestamp: Date.now(),
      lastUpdated: Date.now(),
      description: 'Test form 1',
    },
    {
      formID: 'form2',
      userID: 'user2',
      organizationID: 'org1',
      status: FormStatus.Approved,
      type: FormType.CheckOut,
      items: [],
      createdAtTimestamp: Date.now() - 1000,
      lastUpdated: Date.now(),
      description: 'Test form 2',
    },
    {
      formID: 'form3',
      userID: 'user3',
      organizationID: 'org1',
      status: FormStatus.Pending,
      type: FormType.CheckOut,
      items: [],
      createdAtTimestamp: Date.now() - 2000,
      lastUpdated: Date.now(),
      description: 'Test form 3',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FormsTabContentComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    organizationStore = TestBed.inject(OrganizationStore);
    userStore = TestBed.inject(UserStore);

    userStore.setOrganizations([
      {
        id: 'org1',
        name: 'Test Org',
        imageUrl: null,
        departments: [
          { id: 'dept-a', name: 'Engineering', subDepartments: [] },
          {
            id: 'dept-b',
            name: 'Operations',
            subDepartments: [
              { id: 'sub-dept-b1', name: 'Logistics', subDepartments: [] },
            ],
          },
        ],
      },
    ]);
    userStore.setUserInOrganizations([
      { organizationId: 'org1', userId: 'admin-user', role: UserRole.Admin },
    ]);
    userStore.selectOrganization('org1');

    organizationStore.setUsers([
      {
        user: {
          id: 'user1',
          name: 'Alice',
          email: 'alice@test.com',
          state: UserState.Active,
        },
        userInOrganization: {
          organizationId: 'org1',
          userId: 'user1',
          role: UserRole.Customer,
          department: { id: 'dept-a', roleDescription: 'Dev' },
        },
      },
      {
        user: {
          id: 'user2',
          name: 'Bob',
          email: 'bob@test.com',
          state: UserState.Active,
        },
        userInOrganization: {
          organizationId: 'org1',
          userId: 'user2',
          role: UserRole.Customer,
          department: { id: 'dept-b', roleDescription: 'Ops' },
        },
      },
      {
        user: {
          id: 'user3',
          name: 'Charlie',
          email: 'charlie@test.com',
          state: UserState.Active,
        },
        userInOrganization: {
          organizationId: 'org1',
          userId: 'user3',
          role: UserRole.Customer,
          department: {
            id: 'dept-b',
            roleDescription: 'Logistics',
            subDepartmentId: 'sub-dept-b1',
          },
        },
      },
    ]);

    fixture = TestBed.createComponent(FormsTabContentComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('forms', mockForms);
    fixture.componentRef.setInput('emptyStateMessage', 'forms.empty-test');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter forms by search term', () => {
    component.searchTerm.set('form1');
    const filtered = component.filteredForms();
    expect(filtered.length).toBe(1);
    expect(filtered[0].formID).toBe('form1');
  });

  it('should filter forms by status', () => {
    component.statusFilter.set('pending');
    const filtered = component.filteredForms();
    expect(filtered.length).toBe(2);
    expect(filtered.every((f) => f.status === FormStatus.Pending)).toBe(true);
  });

  it('should sort forms by newest first', () => {
    component.statusFilter.set('all');
    component.sortBy.set('newest');
    const filtered = component.filteredForms();
    expect(filtered[0].formID).toBe('form1');
  });

  it('should sort forms by oldest first', () => {
    component.statusFilter.set('all');
    component.sortBy.set('oldest');
    const filtered = component.filteredForms();
    expect(filtered[0].formID).toBe('form3');
  });

  it('should clear all filters including department and user', () => {
    component.searchTerm.set('test');
    component.statusFilter.set('approved');
    component.sortBy.set('oldest');
    component.filterDepartmentId.set('dept-a');
    component.filterUserId.set('user1');

    component.clearFilters();

    expect(component.searchTerm()).toBe('');
    expect(component.statusFilter()).toBe('all');
    expect(component.sortBy()).toBe('newest');
    expect(component.filterDepartmentId()).toBe('all');
    expect(component.filterUserId()).toBe('all');
  });

  describe('department filter options', () => {
    it('should list all departments and sub-departments', () => {
      const options = component.departmentFilterOptions();
      expect(options.length).toBe(3);
      expect(options.map((o) => o.id)).toEqual([
        'dept-a',
        'dept-b',
        'sub-dept-b1',
      ]);
    });
  });

  describe('user filter options', () => {
    it('should list all users when no department filter is set', () => {
      component.filterDepartmentId.set('all');
      const options = component.userFilterOptions();
      expect(options.length).toBe(3);
    });

    it('should list only users in the selected department', () => {
      component.filterDepartmentId.set('dept-a');
      const options = component.userFilterOptions();
      expect(options.length).toBe(1);
      expect(options[0].id).toBe('user1');
    });

    it('should list users matching sub-department', () => {
      component.filterDepartmentId.set('sub-dept-b1');
      const options = component.userFilterOptions();
      expect(options.length).toBe(1);
      expect(options[0].id).toBe('user3');
    });
  });

  describe('filtering with showUserFilters enabled', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('showUserFilters', true);
      component.statusFilter.set('all');
      fixture.detectChanges();
    });

    it('should filter forms by specific user', () => {
      component.filterUserId.set('user1');
      const filtered = component.filteredForms();
      expect(filtered.length).toBe(1);
      expect(filtered[0].userID).toBe('user1');
    });

    it('should filter forms by department', () => {
      component.filterDepartmentId.set('dept-a');
      const filtered = component.filteredForms();
      expect(filtered.length).toBe(1);
      expect(filtered[0].userID).toBe('user1');
    });

    it('should show all forms when department is all', () => {
      component.filterDepartmentId.set('all');
      const filtered = component.filteredForms();
      expect(filtered.length).toBe(3);
    });

    it('should filter by department when user is all', () => {
      component.filterDepartmentId.set('dept-b');
      component.filterUserId.set('all');
      const filtered = component.filteredForms();
      expect(filtered.length).toBe(2);
      expect(filtered.map((f) => f.userID).sort()).toEqual(['user2', 'user3']);
    });

    it('should reset user filter when department changes', () => {
      component.filterUserId.set('user1');
      component.onDepartmentChange('dept-b');
      expect(component.filterUserId()).toBe('all');
      expect(component.filterDepartmentId()).toBe('dept-b');
    });

    it('user filter overrides department filter', () => {
      component.filterDepartmentId.set('dept-a');
      component.filterUserId.set('user2');
      const filtered = component.filteredForms();
      expect(filtered.length).toBe(1);
      expect(filtered[0].userID).toBe('user2');
    });
  });

  describe('filtering with showUserFilters disabled', () => {
    it('should not apply user or department filters', () => {
      fixture.componentRef.setInput('showUserFilters', false);
      component.statusFilter.set('all');
      component.filterDepartmentId.set('dept-a');
      component.filterUserId.set('user1');
      fixture.detectChanges();

      const filtered = component.filteredForms();
      expect(filtered.length).toBe(3);
    });
  });
});
