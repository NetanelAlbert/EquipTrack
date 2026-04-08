
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
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { UserStore } from '../../store';
import { NavItem, navItems } from './nav-items';
import { TopBarComponent } from '../top-bar/top-bar.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [
    MatSidenavModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    RouterModule,
    TranslateModule,
    TopBarComponent
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

  currentRole = this.userStore.currentRole;

  navItems = computed(() => {
    const currentRole = this.currentRole();
    if (!currentRole) return [];

    return navItems.filter((item: NavItem) => {
      if (!item.roles || item.roles.length === 0) return true;
      return item.roles.includes(currentRole);
    });
  });

  filteredNavItems = this.navItems;

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.currentUrl.set(this.router.url);
        this.closeSidenav();
      });
  }

  ngOnInit(): void {
    this.currentUrl.set(this.router.url);
    this.checkMobile();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkMobile();
  }

  private checkMobile(): void {
    this.isMobile.set(window.innerWidth <= 960);
  }

  getSidenavMode(): 'side' | 'over' {
    return this.isMobile() ? 'over' : 'side';
  }

  onOpenedChange(opened: boolean): void {
    this.isExpanded.set(opened);
  }

  toggleExpanded(): void {
    this.isExpanded.update((expanded) => !expanded);
  }

  isActiveRoute(route: string): boolean {
    return (
      this.currentUrl() === route || this.currentUrl().startsWith(route + '/')
    );
  }

  onNavItemClick(): void {
    this.closeSidenav();
  }

  private closeSidenav(): void {
    if (this.isExpanded()) {
      this.isExpanded.set(false);
    }
  }
}
