import { UserRole } from '@equip-track/shared';
import { MyItemsComponent } from '../my-items/my-items.component';
import { DummyComponent } from '../dummy/dummy.component';
import { Type } from '@angular/core';
import { CheckInComponent } from '../check-in/check-in.component';
import { FormsComponent } from '../forms/forms.component';

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
    labelKey: 'navigation.reports',
    route: 'reports',
    roles: [UserRole.Customer, UserRole.WarehouseManager, UserRole.Admin],
    component: DummyComponent,
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
    component: DummyComponent,
  },
  {
    icon: 'inventory',
    labelKey: 'navigation.all-inventory',
    route: 'all-inventory',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    component: DummyComponent,
  },
  {
    icon: 'people',
    labelKey: 'navigation.inventory-by-users',
    route: 'inventory-by-users',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    component: DummyComponent,
  },
  {
    icon: 'list_alt',
    labelKey: 'navigation.checkouts',
    route: 'checkouts',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    component: DummyComponent,
  },
  {
    icon: 'assignment',
    labelKey: 'navigation.open-forms',
    route: 'open-forms',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    component: DummyComponent,
  },
  {
    icon: 'check_circle',
    labelKey: 'navigation.approve-check-in',
    route: 'approve-check-in',
    roles: [UserRole.WarehouseManager, UserRole.Admin],
    component: DummyComponent,
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
