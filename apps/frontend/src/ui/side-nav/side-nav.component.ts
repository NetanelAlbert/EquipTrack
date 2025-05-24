import { Component, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { UserRole } from '@equip-track/shared';
import { TranslateModule } from '@ngx-translate/core';
import { TopBarComponent } from '../top-bar/top-bar.component';

export interface NavItem {
  icon: string;
  labelKey: string;
  route: string;
  roles: UserRole[];
}

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatListModule,
    MatSidenavModule,
    MatButtonModule,
    TranslateModule,
    TopBarComponent,
  ],
  templateUrl: './side-nav.component.html',
  styleUrls: ['./side-nav.component.scss'],
})
export class SideNavComponent implements OnInit {
  userRole = input<UserRole>(UserRole.Customer);
  isExpanded = signal<boolean>(false);
  toggleExpanded() {
    this.isExpanded.set(!this.isExpanded());
    console.log('toggleExpanded', this.isExpanded());
  }

  navItems: NavItem[] = [
    {
      icon: 'inventory',
      labelKey: 'navigation.my-items',
      route: '/my-items',
      roles: [UserRole.Customer, UserRole.WarehouseManager, UserRole.Admin],
    },
    {
      icon: 'report',
      labelKey: 'navigation.reports',
      route: '/reports',
      roles: [UserRole.Customer, UserRole.WarehouseManager, UserRole.Admin],
    },
    {
      icon: 'description',
      labelKey: 'navigation.my-forms',
      route: '/my-forms',
      roles: [UserRole.Customer],
    },
    {
      icon: 'login',
      labelKey: 'navigation.check-in',
      route: '/check-in',
      roles: [UserRole.Customer],
    },
    {
      icon: 'edit',
      labelKey: 'navigation.edit-products',
      route: '/edit-products',
      roles: [UserRole.WarehouseManager, UserRole.Admin],
    },
    {
      icon: 'inventory',
      labelKey: 'navigation.all-inventory',
      route: '/all-inventory',
      roles: [UserRole.WarehouseManager, UserRole.Admin],
    },
    {
      icon: 'people',
      labelKey: 'navigation.inventory-by-users',
      route: '/inventory-by-users',
      roles: [UserRole.WarehouseManager, UserRole.Admin],
    },
    {
      icon: 'list_alt',
      labelKey: 'navigation.checkouts',
      route: '/checkouts',
      roles: [UserRole.WarehouseManager, UserRole.Admin],
    },
    {
      icon: 'assignment',
      labelKey: 'navigation.open-forms',
      route: '/open-forms',
      roles: [UserRole.WarehouseManager, UserRole.Admin],
    },
    {
      icon: 'check_circle',
      labelKey: 'navigation.approve-check-in',
      route: '/approve-check-in',
      roles: [UserRole.WarehouseManager, UserRole.Admin],
    },
    {
      icon: 'track_changes',
      labelKey: 'navigation.trace-product',
      route: '/trace-product',
      roles: [UserRole.WarehouseManager, UserRole.Admin],
    },
    {
      icon: 'admin_panel_settings',
      labelKey: 'navigation.admin-dashboard',
      route: '/admin',
      roles: [UserRole.Admin],
    },
  ];

  filteredNavItems: NavItem[] = [];

  ngOnInit() {
    this.filterNavItems();
  }

  filterNavItems() {
    this.filteredNavItems = this.navItems.filter((item) =>
      item.roles.includes(this.userRole())
    );
  }
}
