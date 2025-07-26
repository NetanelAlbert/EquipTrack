import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { InventoryByUsersComponent } from './inventory-by-users.component';
import { OrganizationService } from '../../../services/organization.service';

describe('InventoryByUsersComponent', () => {
  let component: InventoryByUsersComponent;
  let fixture: ComponentFixture<InventoryByUsersComponent>;
  let organizationService: OrganizationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        InventoryByUsersComponent,
        HttpClientTestingModule,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryByUsersComponent);
    component = fixture.componentInstance;
    organizationService = TestBed.inject(OrganizationService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have selectedUserID as a signal', () => {
    expect(component.selectedUserID).toBeDefined();
    expect(typeof component.selectedUserID).toBe('function');
    expect(typeof component.selectedUserID.set).toBe('function');
  });

  it('should have userItems as a computed property', () => {
    expect(component.userItems).toBeDefined();
    expect(typeof component.userItems).toBe('function');
  });

  it('should inject required stores and services', () => {
    expect(component.inventoryStore).toBeDefined();
    expect(component.organizationStore).toBeDefined();
    expect(component.organizationService).toBeDefined();
  });

  it('should handle WAREHOUSE selection correctly', () => {
    // Set selectedUserID to WAREHOUSE
    component.selectedUserID.set('WAREHOUSE');

    // The computed should react and use warehouse inventory
    const userItems = component.userItems();
    expect(Array.isArray(userItems)).toBe(true);
  });

  it('should handle user selection correctly', () => {
    // Set selectedUserID to a test user ID
    const testUserId = 'test-user-123';
    component.selectedUserID.set(testUserId);

    // The computed should react and use user inventory
    const userItems = component.userItems();
    expect(Array.isArray(userItems)).toBe(true);
  });

  it('should return empty array when no user selected', () => {
    // Ensure no user is selected
    component.selectedUserID.set(undefined);

    // Should return empty array
    const userItems = component.userItems();
    expect(userItems).toEqual([]);
  });

  it('should have user loading computed properties', () => {
    expect(component.isLoadingUsers).toBeDefined();
    expect(typeof component.isLoadingUsers).toBe('function');

    expect(component.usersError).toBeDefined();
    expect(typeof component.usersError).toBe('function');

    expect(component.hasUsers).toBeDefined();
    expect(typeof component.hasUsers).toBe('function');
  });

  it('should have onUserChange method', () => {
    expect(component.onUserChange).toBeDefined();
    expect(typeof component.onUserChange).toBe('function');
  });

  it('should have loadUsers method', () => {
    expect(component.loadUsers).toBeDefined();
    expect(typeof component.loadUsers).toBe('function');
  });

  it('should call getUsers on OrganizationService during ngOnInit', () => {
    const spy = jest.spyOn(organizationService, 'getUsers');
    component.ngOnInit();
    expect(spy).toHaveBeenCalled();
  });

  it('should call loadUsers method which calls organizationService.getUsers', () => {
    const spy = jest.spyOn(organizationService, 'getUsers');
    component.loadUsers();
    expect(spy).toHaveBeenCalled();
  });
});
