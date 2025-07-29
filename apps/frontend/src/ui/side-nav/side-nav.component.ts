import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
  HostListener,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UserStore } from '../../store';
import { NavItem, navItems } from './nav-items';
import { TopBarComponent } from '../top-bar/top-bar.component';

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [
    CommonModule,
    MatSidenavModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    RouterModule,
    TranslateModule,
    TopBarComponent,
  ],
  templateUrl: './side-nav.component.html',
  styleUrl: './side-nav.component.scss',
})
export class SideNavComponent implements OnInit {
  userStore = inject(UserStore);
  router = inject(Router);

  opened = input<boolean>(false);
  currentUrl = signal<string>('');
  isExpanded = signal<boolean>(false);
  isMobile = signal<boolean>(false);

  // Authentication state from UserStore
  currentRole = this.userStore.currentRole;

  // Filtered navigation items based on user role
  navItems = computed(() => {
    const currentRole = this.currentRole();
    if (!currentRole) return [];

    return navItems.filter((item: NavItem) => {
      if (!item.roles || item.roles.length === 0) return true;
      return item.roles.includes(currentRole);
    });
  });

  // For template compatibility
  filteredNavItems = this.navItems;

  ngOnInit(): void {
    this.currentUrl.set(this.router.url);
    this.checkMobile();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    this.checkMobile();
  }

  /**
   * Check if the screen size is mobile
   */
  private checkMobile(): void {
    this.isMobile.set(window.innerWidth <= 960);
  }

  /**
   * Get sidenav mode based on screen size
   */
  getSidenavMode(): 'side' | 'over' {
    return this.isMobile() ? 'over' : 'side';
  }

  /**
   * Handle sidenav opened change event
   */
  onOpenedChange(opened: boolean): void {
    this.isExpanded.set(opened);
  }

  /**
   * Toggle expanded state
   */
  toggleExpanded(): void {
    this.isExpanded.update((expanded) => !expanded);
  }

  isActiveRoute(route: string): boolean {
    return (
      this.currentUrl() === route || this.currentUrl().startsWith(route + '/')
    );
  }

  onNavItemClick(): void {
    // Update current URL when navigation item is clicked
    this.currentUrl.set(this.router.url);
    
    // Close sidebar on mobile when navigation item is clicked
    if (this.isMobile() && this.isExpanded()) {
      this.isExpanded.set(false);
    }
  }
}
