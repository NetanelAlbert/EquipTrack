import { AfterViewInit, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { RouterModule } from '@angular/router';
import { UserStore } from '../../store/user.store';
import { AuthStore } from '../../store/auth.store';
import { OrganizationStore } from '../../store';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { User } from '@equip-track/shared';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'top-bar',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    TranslateModule,
    RouterModule,
  ],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent implements AfterViewInit {
  userStore = inject(UserStore);
  authStore = inject(AuthStore);
  authService = inject(AuthService);
  organizationStore = inject(OrganizationStore);
  titleService = inject(Title);
  routerService = inject(Router);
  translateService = inject(TranslateService);

  menuOpen = input<boolean>(false);
  menuClicked = output<void>();

  pageTitle = '';

  currentUser = this.userStore.user;

  constructor() {
    this.detectTitleChange();
  }

  ngAfterViewInit(): void {
    this.setPageTitle();
  }

  private detectTitleChange() {
    this.routerService.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.setPageTitle();
      });
  }

  private setPageTitle() {
    setTimeout(() => {
      const titleKey = this.titleService.getTitle();
      this.pageTitle = this.translateService.instant(titleKey);
      this.titleService.setTitle(this.pageTitle);
    }, 100);
  }

  isRTL(): boolean {
    return document.dir === 'rtl' || document.documentElement.dir === 'rtl';
  }

  /**
   * Get user initials from current user
   */
  getUserInitials(user: User | null): string {
    if (!user?.name) {
      return '?';
    }
    return user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  /**
   * Handle user sign out
   */
  onSignOut(): void {
    this.authService.signOut();
  }

  /**
   * Navigate to user profile (placeholder)
   */
  onViewProfile(): void {
    // TODO: Implement user profile page
    console.log('Navigate to user profile');
  }

  /**
   * Navigate to settings (placeholder)
   */
  onSettings(): void {
    // TODO: Implement settings page
    console.log('Navigate to settings');
  }

  /**
   * Handle organization switching
   */
  onSwitchOrganization(): void {
    // Clear the persisted organization selection
    this.userStore.clearPersistedOrganizationSelection();
    // Update state to empty organization
    this.userStore.selectOrganization('');
    // Navigate to home page
    this.routerService.navigate(['/']);
  }
}
