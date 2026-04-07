import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslateModule } from '@ngx-translate/core';
import { NavigationEnd, Router } from '@angular/router';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { Subject } from 'rxjs';

import { SideNavComponent } from './side-nav.component';

describe('SideNavComponent', () => {
  let component: SideNavComponent;
  let fixture: ComponentFixture<SideNavComponent>;
  let routerEvents$: Subject<unknown>;

  beforeEach(async () => {
    routerEvents$ = new Subject();

    await TestBed.configureTestingModule({
      imports: [
        SideNavComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
        MatIconTestingModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: Router,
          useValue: {
            url: '/my-items',
            events: routerEvents$.asObservable(),
            navigate: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SideNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with sidenav collapsed', () => {
    expect(component.isExpanded()).toBe(false);
  });

  it('should toggle sidenav expanded state', () => {
    component.toggleExpanded();
    expect(component.isExpanded()).toBe(true);

    component.toggleExpanded();
    expect(component.isExpanded()).toBe(false);
  });

  it('should close sidenav on nav item click', () => {
    component.isExpanded.set(true);
    component.onNavItemClick();
    expect(component.isExpanded()).toBe(false);
  });

  it('should close sidenav on NavigationEnd event', () => {
    component.isExpanded.set(true);

    routerEvents$.next(new NavigationEnd(1, '/forms', '/forms'));

    expect(component.isExpanded()).toBe(false);
  });

  it('should not expand sidenav on NavigationEnd when already collapsed', () => {
    component.isExpanded.set(false);

    routerEvents$.next(new NavigationEnd(1, '/forms', '/forms'));

    expect(component.isExpanded()).toBe(false);
  });

  it('should sync isExpanded via onOpenedChange', () => {
    component.onOpenedChange(true);
    expect(component.isExpanded()).toBe(true);

    component.onOpenedChange(false);
    expect(component.isExpanded()).toBe(false);
  });

  it('should return "over" mode on mobile and "side" on desktop', () => {
    component.isMobile.set(true);
    expect(component.getSidenavMode()).toBe('over');

    component.isMobile.set(false);
    expect(component.getSidenavMode()).toBe('side');
  });
});
