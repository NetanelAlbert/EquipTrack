import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';
import { TopBarComponent } from '../top-bar/top-bar.component';
import { NavItem, navItems } from './nav-items';
import { UserStore } from '../../store/user.store';

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
  isExpanded = signal<boolean>(false);
  currentItem = signal<NavItem | null>(null);
  userStore = inject(UserStore);
  userRole = this.userStore.activeOrganization.role;
  toggleExpanded() {
    this.isExpanded.set(!this.isExpanded());
  }

  navigateTo(item: NavItem) {
    this.currentItem.set(item);
  }

  filteredNavItems: NavItem[] = [];

  ngOnInit() {
    this.filterNavItems();
  }

  filterNavItems() {
    this.filteredNavItems = navItems.filter((item) =>
      item.roles.includes(this.userRole())
    );
  }
}
