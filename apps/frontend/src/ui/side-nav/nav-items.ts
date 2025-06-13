import { UserRole } from '@equip-track/shared';
import { MyItemsComponent } from '../my-items/my-items.component';
import { DummyComponent } from '../dummy/dummy.component';
import { Type } from '@angular/core';
import { CheckInComponent } from '../check-in/check-in.component';
import { FormsComponent } from '../forms/forms.component';
import { TodayReportComponent } from '../reports/reporting/today-report.component';
import { ReportsHistoryComponent } from '../reports/history/reports-history.component';
import { EditProductsComponent } from '../organization/edit-products/edit-products.component';
import { AllInventoryComponent } from '../inventory/all-inventory/all-inventory.component';
import { InventoryByUsersComponent } from '../inventory/by-users/inventory-by-users.component';
import { CheckoutComponent } from '../checkout/checkout.component';

export interface NavItem {
  icon: string;
  labelKey: string;
  route: string;
  roles: UserRole[];
  component: Type<unknown>;
}

export const navItems: NavItem[] = [
  {
    icon: 'inventory',
    labelKey: 'navigation.my-items',
    route: 'my-items',
    roles: [UserRole.Customer, UserRole.WarehouseManager, UserRole.Admin],
    component: MyItemsComponent,
  },
  {
    icon: 'report',
    labelKey: 'navigation.today-report',
    route: 'today-report',
    roles: [UserRole.Customer, UserRole.WarehouseManager, UserRole.Admin],
    component: TodayReportComponent,
  },
  {
    icon: 'history',
    labelKey: 'navigation.reports-history',
    route: 'reports-history',
    roles: [UserRole.WarehouseManager, UserRole.Admin, UserRole.Customer],
    component: ReportsHistoryComponent,
  },
  {
    icon: 'description',
    labelKey: 'navigation.my-forms',
    route: 'my-forms',
    roles: [UserRole.Customer],
    component: FormsComponent,
  },
  {
    icon: 'login',
    labelKey: 'navigation.check-in',
    route: 'check-in',
    roles: [UserRole.Customer],
    component: CheckInComponent,
  },
  {
    icon: 'edit',
    labelKey: 'navigation.edit-products',
    route: 'edit-products',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    component: EditProductsComponent,
  },
  {
    icon: 'inventory',
    labelKey: 'navigation.all-inventory',
    route: 'all-inventory',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    component: AllInventoryComponent,
  },
  {
    icon: 'people',
    labelKey: 'navigation.inventory-by-users',
    route: 'inventory-by-users',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    component: InventoryByUsersComponent,
  },
  {
    icon: 'list_alt',
    labelKey: 'navigation.checkout',
    route: 'checkout',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    component: CheckoutComponent,
  },
  {
    icon: 'assignment',
    labelKey: 'navigation.forms',
    route: 'forms',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    component: FormsComponent,
  },
  {
    icon: 'track_changes',
    labelKey: 'navigation.trace-product',
    route: 'trace-product',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    component: DummyComponent,
  },
  {
    icon: 'admin_panel_settings',
    labelKey: 'navigation.admin-dashboard',
    route: 'admin',
    roles: [UserRole.Admin],
    component: DummyComponent,
  },
];
