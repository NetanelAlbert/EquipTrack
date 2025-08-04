import { UserRole } from '@equip-track/shared';

export interface NavItem {
  icon: string;
  labelKey: string;
  route: string;
  roles: UserRole[];
  loadComponent: () => Promise<any>; // Function for lazy loading
  canDeactivateCheck?: boolean;
}

export const navItems: NavItem[] = [
  {
    icon: 'inventory',
    labelKey: 'navigation.my-items',
    route: 'my-items',
    roles: [UserRole.Customer, UserRole.WarehouseManager, UserRole.Admin],
    loadComponent: () =>
      import('../my-items/my-items.component').then((m) => m.MyItemsComponent),
  },
  {
    icon: 'report',
    labelKey: 'navigation.today-report',
    route: 'today-report',
    roles: [UserRole.Customer, UserRole.WarehouseManager, UserRole.Admin],
    loadComponent: () =>
      import('../reports/reporting/today-report.component').then(
        (m) => m.TodayReportComponent
      ),
  },
  {
    icon: 'history',
    labelKey: 'navigation.reports-history',
    route: 'reports-history',
    roles: [UserRole.WarehouseManager, UserRole.Admin, UserRole.Customer],
    loadComponent: () =>
      import('../reports/history/reports-history.component').then(
        (m) => m.ReportsHistoryComponent
      ),
  },
  {
    // todo: should use same component as forms ?
    icon: 'description',
    labelKey: 'navigation.my-forms',
    route: 'my-forms',
    roles: [UserRole.Customer],
    loadComponent: () =>
      import('../forms/forms.component').then((m) => m.FormsComponent),
  },
  {
    icon: 'edit',
    labelKey: 'navigation.edit-products',
    route: 'edit-products',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    loadComponent: () =>
      import('../organization/edit-products/edit-products.component').then(
        (m) => m.EditProductsComponent
      ),
    canDeactivateCheck: true,
  },
  {
    icon: 'group',
    labelKey: 'navigation.edit-users',
    route: 'edit-users',
    roles: [UserRole.Admin],
    loadComponent: () =>
      import('../organization/edit-users/edit-users.component').then(
        (m) => m.EditUsersComponent
      ),
    canDeactivateCheck: true,
  },
  {
    icon: 'inventory',
    labelKey: 'navigation.all-inventory',
    route: 'all-inventory',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    loadComponent: () =>
      import('../inventory/all-inventory/all-inventory.component').then(
        (m) => m.AllInventoryComponent
      ),
  },
  {
    icon: 'people',
    labelKey: 'navigation.inventory-by-users',
    route: 'inventory-by-users',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    loadComponent: () =>
      import('../inventory/by-users/inventory-by-users.component').then(
        (m) => m.InventoryByUsersComponent
      ),
  },
  {
    icon: 'add_box',
    labelKey: 'navigation.add-inventory',
    route: 'add-inventory',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    loadComponent: () =>
      import('../inventory/add/add-inventory.component').then(
        (m) => m.AddInventoryComponent
      ),
    canDeactivateCheck: true,
  },
  {
    icon: 'remove_circle',
    labelKey: 'navigation.remove-inventory',
    route: 'remove-inventory',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    loadComponent: () =>
      import('../inventory/remove/remove-inventory.component').then(
        (m) => m.RemoveInventoryComponent
      ),
    canDeactivateCheck: true,
  },
  {
    icon: 'list_alt',
    labelKey: 'navigation.create-form',
    route: 'create-form',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    loadComponent: () =>
      import('../create-form/create-form.component').then(
        (m) => m.CreateFormComponent
      ),
    canDeactivateCheck: true,
  },
  {
    icon: 'assignment',
    labelKey: 'navigation.forms',
    route: 'forms',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    loadComponent: () =>
      import('../forms/forms.component').then((m) => m.FormsComponent),
  },
  // TODO: Implement trace product and admin dashboard
  // {
  //   icon: 'track_changes',
  //   labelKey: 'navigation.trace-product',
  //   route: 'trace-product',
  //   roles: [UserRole.WarehouseManager, UserRole.Admin],
  //   // loadComponent omitted - will use DummyComponent (eager loaded)
  // },
  // {
  //   icon: 'admin_panel_settings',
  //   labelKey: 'navigation.admin-dashboard',
  //   route: 'admin',
  //   roles: [UserRole.Admin],
  //   // loadComponent omitted - will use DummyComponent (eager loaded)
  // },
];
