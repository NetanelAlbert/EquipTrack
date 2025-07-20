import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { TranslateModule } from '@ngx-translate/core';

import { navItems, NavItem } from './nav-items';
import { AuthService } from '../../services/auth.service';
import { UserRole } from '@equip-track/shared';
import { TopBarComponent } from '../top-bar/top-bar.component';

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatSidenavModule,
    TranslateModule,
    TopBarComponent,
  ],
  templateUrl: './side-nav.component.html',
  styleUrl: './side-nav.component.scss',
})
export class SideNavComponent implements OnInit {
  isExpanded = signal<boolean>(false);
  currentItem = signal<NavItem | null>(null);
  authService = inject(AuthService);

  // Authentication state
  isAuthenticated = this.authService.isAuthenticated;
  currentRole = this.authService.currentRole;

  toggleExpanded() {
    this.isExpanded.set(!this.isExpanded());
  }

  navigateTo(item: NavItem) {
    this.currentItem.set(item);
  }

  /**
   * Handle sidenav opened change event
   */
  onOpenedChange(opened: boolean): void {
    this.isExpanded.set(opened);
  }

  filteredNavItems: NavItem[] = [];

  constructor() {
    // Use effect to react to role changes
    effect(() => {
      this.filterNavItems(this.currentRole());
    });
  }

  ngOnInit() {
    // Initial filter
    this.filterNavItems(this.currentRole());
  }

  filterNavItems(userRole: UserRole | null) {
    if (!userRole) {
      this.filteredNavItems = [];
      return;
    }

    this.filteredNavItems = navItems.filter((item) =>
      item.roles.includes(userRole)
    );
  }
}
