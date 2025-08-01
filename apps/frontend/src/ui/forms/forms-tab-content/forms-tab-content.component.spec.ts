import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { FormsTabContentComponent } from './forms-tab-content.component';
import { InventoryForm, FormStatus, FormType } from '@equip-track/shared';

describe('FormsTabContentComponent', () => {
  let component: FormsTabContentComponent;
  let fixture: ComponentFixture<FormsTabContentComponent>;

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
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        FormsTabContentComponent,
        BrowserAnimationsModule,
        TranslateModule.forRoot(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FormsTabContentComponent);
    component = fixture.componentInstance;
    component.forms = mockForms;
    component.emptyStateMessage = 'forms.empty-test';
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
    expect(filtered.length).toBe(1);
    expect(filtered[0].status).toBe(FormStatus.Pending);
  });

  it('should sort forms by newest first', () => {
    component.sortBy.set('newest');
    const filtered = component.filteredForms();
    expect(filtered[0].formID).toBe('form1'); // newer form first
  });

  it('should sort forms by oldest first', () => {
    component.sortBy.set('oldest');
    const filtered = component.filteredForms();
    expect(filtered[0].formID).toBe('form2'); // older form first
  });

  it('should clear all filters', () => {
    component.searchTerm.set('test');
    component.statusFilter.set('approved');
    component.sortBy.set('oldest');

    component.clearFilters();

    expect(component.searchTerm()).toBe('');
    expect(component.statusFilter()).toBe('all');
    expect(component.sortBy()).toBe('newest');
  });
});
