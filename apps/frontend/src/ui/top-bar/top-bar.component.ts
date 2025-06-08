import { AfterViewInit, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { UserStore, OrganizationStore } from '../../store';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'top-bar',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    TranslateModule,
  ],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent implements AfterViewInit {
  userStore = inject(UserStore);
  organizationStore = inject(OrganizationStore);
  titleService = inject(Title);
  routerService = inject(Router);
  translateService = inject(TranslateService);

  menuOpen = input<boolean>(false);
  menuClicked = output<void>();

  pageTitle = '';

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
}
