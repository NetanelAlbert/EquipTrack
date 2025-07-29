import { UserRole } from '@equip-track/shared';

export interface NavItem {
  icon: string;
  labelKey: string;
  route: string;
  roles: UserRole[];
  loadComponent?: () => Promise<any>; // Function for lazy loading
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
    icon: 'description',
    labelKey: 'navigation.my-forms',
    route: 'my-forms',
    roles: [UserRole.Customer],
    loadComponent: () =>
      import('../forms/forms.component').then((m) => m.FormsComponent),
  },
  // TODO: Implement check-in
  // {
  //   icon: 'login',
  //   labelKey: 'navigation.check-in',
  //   route: 'check-in',
  //   roles: [UserRole.Customer],
  //   loadComponent: () =>
  //     import('../check-in/check-in.component').then((m) => m.CheckInComponent),
  // },
  {
    icon: 'edit',
    labelKey: 'navigation.edit-products',
    route: 'edit-products',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    loadComponent: () =>
      import('../organization/edit-products/edit-products.component').then(
        (m) => m.EditProductsComponent
      ),
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
  },
  {
    icon: 'list_alt',
    labelKey: 'navigation.checkout',
    route: 'checkout',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    loadComponent: () =>
      import('../checkout/checkout.component').then((m) => m.CheckoutComponent),
  },
  {
    icon: 'assignment',
    labelKey: 'navigation.forms',
    route: 'forms',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    loadComponent: () =>
      import('../forms/forms.component').then((m) => m.FormsComponent),
  },
  {
    icon: 'track_changes',
    labelKey: 'navigation.trace-product',
    route: 'trace-product',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    loadComponent: () =>
      import('../trace-product/trace-product.component').then((m) => m.TraceProductComponent),
  },
  {
    icon: 'admin_panel_settings',
    labelKey: 'navigation.admin-dashboard',
    route: 'admin',
    roles: [UserRole.Admin],
    loadComponent: () =>
      import('../admin-dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
  },
];
