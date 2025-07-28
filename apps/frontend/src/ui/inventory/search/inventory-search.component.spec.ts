import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { InventorySearchComponent } from './inventory-search.component';
import { InventoryItem } from '@equip-track/shared';

describe('InventorySearchComponent', () => {
  let component: InventorySearchComponent;
  let fixture: ComponentFixture<InventorySearchComponent>;

  const mockInventoryItems: InventoryItem[] = [
    {
      productId: 'LAPTOP-001',
      quantity: 5,
      upis: ['UPI001', 'UPI002', 'UPI003', 'UPI004', 'UPI005'],
    },
    {
      productId: 'MOUSE-002',
      quantity: 10,
      upis: ['UPI006', 'UPI007'],
    },
    {
      productId: 'KEYBOARD-003',
      quantity: 3,
      upis: ['UPI008'],
    },
  ] as InventoryItem[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        InventorySearchComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InventorySearchComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('items', mockInventoryItems);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have search term as signal', () => {
    expect(component.searchTerm).toBeDefined();
    expect(typeof component.searchTerm).toBe('function');
    expect(typeof component.searchTerm.set).toBe('function');
  });

  it('should have sort options as signals', () => {
    expect(component.sortBy).toBeDefined();
    expect(typeof component.sortBy).toBe('function');
    expect(typeof component.sortBy.set).toBe('function');

    expect(component.sortDirection).toBeDefined();
    expect(typeof component.sortDirection).toBe('function');
    expect(typeof component.sortDirection.set).toBe('function');
  });

  it('should filter items by search term', () => {
    // Search for 'laptop' should find LAPTOP-001
    component.searchTerm.set('laptop');
    const filtered = component.filteredAndSortedItems();

    expect(filtered).toHaveLength(1);
    expect(filtered[0].productId).toBe('LAPTOP-001');
  });

  it('should filter items by UPI', () => {
    // Search for 'UPI006' should find MOUSE-002
    component.searchTerm.set('UPI006');
    const filtered = component.filteredAndSortedItems();

    expect(filtered).toHaveLength(1);
    expect(filtered[0].productId).toBe('MOUSE-002');
  });

  it('should sort items by productId ascending', () => {
    component.sortBy.set('productId');
    component.sortDirection.set('asc');
    const sorted = component.filteredAndSortedItems();

    expect(sorted[0].productId).toBe('KEYBOARD-003');
    expect(sorted[1].productId).toBe('LAPTOP-001');
    expect(sorted[2].productId).toBe('MOUSE-002');
  });

  it('should sort items by productId descending', () => {
    component.sortBy.set('productId');
    component.sortDirection.set('desc');
    const sorted = component.filteredAndSortedItems();

    expect(sorted[0].productId).toBe('MOUSE-002');
    expect(sorted[1].productId).toBe('LAPTOP-001');
    expect(sorted[2].productId).toBe('KEYBOARD-003');
  });

  it('should sort items by quantity ascending', () => {
    component.sortBy.set('quantity');
    component.sortDirection.set('asc');
    const sorted = component.filteredAndSortedItems();

    expect(sorted[0].quantity).toBe(3);
    expect(sorted[1].quantity).toBe(5);
    expect(sorted[2].quantity).toBe(10);
  });

  it('should sort items by quantity descending', () => {
    component.sortBy.set('quantity');
    component.sortDirection.set('desc');
    const sorted = component.filteredAndSortedItems();

    expect(sorted[0].quantity).toBe(10);
    expect(sorted[1].quantity).toBe(5);
    expect(sorted[2].quantity).toBe(3);
  });

  it('should detect active filters', () => {
    // Initially no filters active
    expect(component.hasActiveFilters()).toBe(false);

    // Add search term
    component.searchTerm.set('test');
    expect(component.hasActiveFilters()).toBe(true);

    // Clear search but change sort
    component.searchTerm.set('');
    component.sortBy.set('quantity');
    expect(component.hasActiveFilters()).toBe(true);

    // Change sort direction
    component.sortBy.set('productId');
    component.sortDirection.set('desc');
    expect(component.hasActiveFilters()).toBe(true);
  });

  it('should clear search term', () => {
    component.searchTerm.set('test');
    expect(component.searchTerm()).toBe('test');

    component.clearSearch();
    expect(component.searchTerm()).toBe('');
  });

  it('should toggle sort direction', () => {
    expect(component.sortDirection()).toBe('asc');

    component.toggleSortDirection();
    expect(component.sortDirection()).toBe('desc');

    component.toggleSortDirection();
    expect(component.sortDirection()).toBe('asc');
  });

  it('should clear all filters', () => {
    // Set some filters
    component.searchTerm.set('test');
    component.sortBy.set('quantity');
    component.sortDirection.set('desc');

    expect(component.hasActiveFilters()).toBe(true);

    // Clear all
    component.clearAllFilters();

    expect(component.searchTerm()).toBe('');
    expect(component.sortBy()).toBe('productId');
    expect(component.sortDirection()).toBe('asc');
    expect(component.hasActiveFilters()).toBe(false);
  });

  it('should emit filtered items', () => {
    let emittedItems: InventoryItem[] = [];

    component.filteredItems.subscribe((items) => {
      emittedItems = items;
    });

    // Initial items should be emitted
    expect(emittedItems).toHaveLength(3);

    // Filter items
    component.searchTerm.set('laptop');
    expect(emittedItems).toHaveLength(1);
    expect(emittedItems[0].productId).toBe('LAPTOP-001');
  });

  it('should emit filter changes', () => {
    let emittedFilters: any = null;

    component.filtersChanged.subscribe((filters) => {
      emittedFilters = filters;
    });

    // Change search term
    component.searchTerm.set('test');
    expect(emittedFilters).toEqual({
      searchTerm: 'test',
      sortBy: 'productId',
      sortDirection: 'asc',
    });

    // Change sort
    component.sortBy.set('quantity');
    expect(emittedFilters).toEqual({
      searchTerm: 'test',
      sortBy: 'quantity',
      sortDirection: 'asc',
    });
  });

  it('should update result count', () => {
    expect(component.resultCount()).toBe(3);

    component.searchTerm.set('laptop');
    expect(component.resultCount()).toBe(1);

    component.searchTerm.set('nonexistent');
    expect(component.resultCount()).toBe(0);
  });
});
