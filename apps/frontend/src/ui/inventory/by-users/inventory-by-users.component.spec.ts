import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { InventoryByUsersComponent } from './inventory-by-users.component';
import { OrganizationService } from '../../../services/organization.service';
import {
  UserAndUserInOrganization,
  UserRole,
  UserState,
} from '@equip-track/shared';

describe('InventoryByUsersComponent', () => {
  let component: InventoryByUsersComponent;
  let fixture: ComponentFixture<InventoryByUsersComponent>;
  let organizationService: OrganizationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        InventoryByUsersComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    organizationService = TestBed.inject(OrganizationService);
    jest.spyOn(organizationService, 'getUsers').mockResolvedValue(undefined);

    fixture = TestBed.createComponent(InventoryByUsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have selectedUserIds as a signal', () => {
    expect(component.selectedUserIds).toBeDefined();
    expect(typeof component.selectedUserIds).toBe('function');
    expect(typeof component.selectedUserIds.set).toBe('function');
  });

  it('should have tableData as a computed property', () => {
    expect(component.tableData).toBeDefined();
    expect(typeof component.tableData).toBe('function');
  });

  it('should inject required stores and services', () => {
    expect(component.inventoryStore).toBeDefined();
    expect(component.organizationStore).toBeDefined();
    expect(component.organizationService).toBeDefined();
  });

  it('should handle WAREHOUSE selection correctly', () => {
    component.selectedUserIds.set(['WAREHOUSE']);

    const rows = component.tableData();
    expect(Array.isArray(rows)).toBe(true);
  });

  it('should handle user selection correctly', () => {
    const testUserId = 'test-user-123';
    component.selectedUserIds.set(['WAREHOUSE', testUserId]);

    const rows = component.tableData();
    expect(Array.isArray(rows)).toBe(true);
  });

  it('should return empty table when no users selected', () => {
    component.selectedUserIds.set([]);

    const rows = component.tableData();
    expect(rows).toEqual([]);
  });

  it('should have user loading computed properties', () => {
    expect(component.isLoadingUsers).toBeDefined();
    expect(typeof component.isLoadingUsers).toBe('function');

    expect(component.usersError).toBeDefined();
    expect(typeof component.usersError).toBe('function');

    expect(component.hasUsers).toBeDefined();
    expect(typeof component.hasUsers).toBe('function');
  });

  it('should have loadUsers method', () => {
    expect(component.loadUsers).toBeDefined();
    expect(typeof component.loadUsers).toBe('function');
  });

  it('should call getUsers on OrganizationService during ngOnInit', () => {
    const spy = jest.spyOn(organizationService, 'getUsers');
    const f = TestBed.createComponent(InventoryByUsersComponent);
    f.detectChanges();
    expect(spy).toHaveBeenCalled();
  });

  it('should call loadUsers method which calls organizationService.getUsers', () => {
    const spy = jest.spyOn(organizationService, 'getUsers');
    component.loadUsers();
    expect(spy).toHaveBeenCalled();
  });

  describe('onAddUserSelected', () => {
    const mockUser: UserAndUserInOrganization = {
      user: {
        id: 'user-42',
        name: 'Jane Doe',
        email: 'jane@example.com',
        state: UserState.Active,
      },
      userInOrganization: {
        organizationId: 'org-1',
        userId: 'user-42',
        role: UserRole.Customer,
      },
    };

    it('should extract the user id when ng-select emits the full item object', () => {
      const addSpy = jest.spyOn(component, 'addUser');
      component.onAddUserSelected(mockUser);
      expect(addSpy).toHaveBeenCalledWith('user-42');
    });

    it('should still work when called with a plain string id', () => {
      const addSpy = jest.spyOn(component, 'addUser');
      component.onAddUserSelected('user-42');
      expect(addSpy).toHaveBeenCalledWith('user-42');
    });

    it('should not call addUser when called with null', () => {
      const addSpy = jest.spyOn(component, 'addUser');
      component.onAddUserSelected(null);
      expect(addSpy).not.toHaveBeenCalled();
    });
  });

  describe('department filter', () => {
    const userInDeptA: UserAndUserInOrganization = {
      user: { id: 'user-a', name: 'Alice', email: 'a@x.com', state: UserState.Active },
      userInOrganization: {
        organizationId: 'org-1',
        userId: 'user-a',
        role: UserRole.Customer,
        department: { id: 'dept-1', roleDescription: '', subDepartmentId: undefined },
      },
    };

    const userInDeptB: UserAndUserInOrganization = {
      user: { id: 'user-b', name: 'Bob', email: 'b@x.com', state: UserState.Active },
      userInOrganization: {
        organizationId: 'org-1',
        userId: 'user-b',
        role: UserRole.Customer,
        department: { id: 'dept-2', roleDescription: '' },
      },
    };

    const userInSubDept: UserAndUserInOrganization = {
      user: { id: 'user-c', name: 'Charlie', email: 'c@x.com', state: UserState.Active },
      userInOrganization: {
        organizationId: 'org-1',
        userId: 'user-c',
        role: UserRole.Customer,
        department: { id: 'dept-1', roleDescription: '', subDepartmentId: 'sub-1' },
      },
    };

    const userNoDept: UserAndUserInOrganization = {
      user: { id: 'user-d', name: 'Dave', email: 'd@x.com', state: UserState.Active },
      userInOrganization: {
        organizationId: 'org-1',
        userId: 'user-d',
        role: UserRole.Customer,
      },
    };

    function setStoreUsers(users: UserAndUserInOrganization[]) {
      for (const u of users) {
        component.organizationStore.addUser(u);
      }
    }

    it('should default filterDepartmentId to "all"', () => {
      expect(component.filterDepartmentId()).toBe('all');
    });

    it('should return all users when filter is "all"', () => {
      setStoreUsers([userInDeptA, userInDeptB, userNoDept]);
      component.filterDepartmentId.set('all');

      const filtered = component.usersFilteredByDepartment();
      expect(filtered.length).toBe(3);
    });

    it('should filter users by main department id', () => {
      setStoreUsers([userInDeptA, userInDeptB, userNoDept]);
      component.filterDepartmentId.set('dept-1');

      const filtered = component.usersFilteredByDepartment();
      expect(filtered.length).toBe(1);
      expect(filtered[0].user.id).toBe('user-a');
    });

    it('should filter users by sub-department id', () => {
      setStoreUsers([userInDeptA, userInSubDept, userInDeptB]);
      component.filterDepartmentId.set('sub-1');

      const filtered = component.usersFilteredByDepartment();
      expect(filtered.length).toBe(1);
      expect(filtered[0].user.id).toBe('user-c');
    });

    it('should exclude users without a department when filtering', () => {
      setStoreUsers([userInDeptA, userNoDept]);
      component.filterDepartmentId.set('dept-1');

      const filtered = component.usersFilteredByDepartment();
      expect(filtered.every((u) => u.user.id !== 'user-d')).toBe(true);
    });

    it('availableUsersForSelection should respect department filter', () => {
      setStoreUsers([userInDeptA, userInDeptB]);
      component.filterDepartmentId.set('dept-1');
      component.selectedUserIds.set(['WAREHOUSE']);

      const available = component.availableUsersForSelection();
      expect(available.length).toBe(1);
      expect(available[0].user.id).toBe('user-a');
    });

    it('showAllUsers should only add users matching the department filter', () => {
      setStoreUsers([userInDeptA, userInDeptB, userInSubDept]);
      component.filterDepartmentId.set('dept-1');
      component.showAllUsers();

      const ids = component.selectedUserIds();
      expect(ids).toContain('WAREHOUSE');
      expect(ids).toContain('user-a');
      expect(ids).not.toContain('user-b');
    });
  });
});
