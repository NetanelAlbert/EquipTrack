import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { GoogleSignInComponent } from './google-sign-in.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('GoogleSignInComponent', () => {
  let component: GoogleSignInComponent;
  let fixture: ComponentFixture<GoogleSignInComponent>;
  let mockSnackBar: jasmine.Spy;
  let mockTranslateService: any;
  let mockGoogleApi: any;

  beforeEach(async () => {
    // Create mocks
    mockSnackBar = jasmine.createSpy('open');
    mockTranslateService = {
      instant: jasmine
        .createSpy('instant')
        .and.returnValue('Mocked translation'),
      currentLang: 'en',
    };

    // Mock Google API
    mockGoogleApi = {
      accounts: {
        id: {
          initialize: jasmine.createSpy('initialize'),
          renderButton: jasmine.createSpy('renderButton'),
          prompt: jasmine.createSpy('prompt'),
          disableAutoSelect: jasmine.createSpy('disableAutoSelect'),
        },
      },
    };

    // Setup window.google mock
    (window as any).google = mockGoogleApi;

    await TestBed.configureTestingModule({
      imports: [GoogleSignInComponent, NoopAnimationsModule],
      providers: [
        { provide: MatSnackBar, useValue: { open: mockSnackBar } },
        { provide: TranslateService, useValue: mockTranslateService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GoogleSignInComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    // Clean up global mocks
    delete (window as any).google;
    delete (window as any).onGoogleLibraryLoad;
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should render correctly with default properties', () => {
      fixture.detectChanges();

      expect(component.buttonType()).toBe('standard');
      expect(component.buttonTheme()).toBe('filled_blue');
      expect(component.buttonSize()).toBe('large');
      expect(component.buttonText()).toBe('signin_with');
      expect(component.disabled()).toBe(false);
      expect(component.showFallbackButton()).toBe(true);
    });

    it('should initialize Google Sign-In when Google API is available', fakeAsync(() => {
      spyOn(component as any, 'setupGoogleSignIn');

      fixture.detectChanges();
      tick();

      expect((component as any).setupGoogleSignIn).toHaveBeenCalled();
    }));

    it('should wait for Google library to load when not immediately available', fakeAsync(() => {
      // Remove Google API temporarily
      delete (window as any).google;

      spyOn(component as any, 'setupGoogleSignIn');

      fixture.detectChanges();
      tick();

      // setupGoogleSignIn should not be called yet
      expect((component as any).setupGoogleSignIn).not.toHaveBeenCalled();

      // Simulate Google library loading
      (window as any).google = mockGoogleApi;
      if (window.onGoogleLibraryLoad) {
        window.onGoogleLibraryLoad();
      }
      tick();

      expect((component as any).setupGoogleSignIn).toHaveBeenCalled();
    }));
  });

  describe('Google Sign-In Setup', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should initialize Google Identity Services with correct configuration', () => {
      expect(mockGoogleApi.accounts.id.initialize).toHaveBeenCalledWith({
        client_id:
          '64930861221-3571tfrilm698f11h0p15ph8hi4klt1j.apps.googleusercontent.com',
        callback: jasmine.any(Function),
        auto_select: false,
        cancel_on_tap_outside: true,
        context: 'signin',
      });
    });

    it('should render Google button with correct configuration', () => {
      expect(mockGoogleApi.accounts.id.renderButton).toHaveBeenCalledWith(
        jasmine.any(HTMLElement),
        {
          type: 'standard',
          theme: 'filled_blue',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: '280',
          locale: 'en',
        }
      );
    });

    it('should handle initialization errors gracefully', () => {
      spyOn(component as any, 'handleError');
      spyOn(console, 'error');

      // Trigger an error in setupGoogleSignIn
      mockGoogleApi.accounts.id.initialize.and.throwError('Test error');

      // Re-trigger setup
      (component as any).setupGoogleSignIn();

      expect((component as any).handleError).toHaveBeenCalledWith(
        'Failed to load Google Sign-In'
      );
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Credential Response Handling', () => {
    let mockCredentialResponse: any;

    beforeEach(() => {
      fixture.detectChanges();

      mockCredentialResponse = {
        credential: 'mock.jwt.token',
        select_by: 'user',
      };
    });

    it('should handle successful credential response', fakeAsync(() => {
      spyOn(component.signInSuccess, 'emit');
      spyOn(component as any, 'showSuccess');

      // Get the callback function from the initialize call
      const initializeCall =
        mockGoogleApi.accounts.id.initialize.calls.mostRecent();
      const callback = initializeCall.args[0].callback;

      // Execute callback with mock response
      callback(mockCredentialResponse);
      tick();

      expect(component.signInSuccess.emit).toHaveBeenCalledWith(
        'mock.jwt.token'
      );
      expect((component as any).showSuccess).toHaveBeenCalledWith(
        'Successfully signed in with Google'
      );
      expect(component.isLoading).toBe(false);
    }));

    it('should handle credential response without credential', fakeAsync(() => {
      spyOn(component as any, 'handleError');

      const initializeCall =
        mockGoogleApi.accounts.id.initialize.calls.mostRecent();
      const callback = initializeCall.args[0].callback;

      // Execute callback with response missing credential
      callback({ select_by: 'user' });
      tick();

      expect((component as any).handleError).toHaveBeenCalledWith(
        'Failed to process Google sign-in'
      );
      expect(component.isLoading).toBe(false);
    }));

    it('should emit signInError on credential processing failure', fakeAsync(() => {
      spyOn(component.signInError, 'emit');

      const initializeCall =
        mockGoogleApi.accounts.id.initialize.calls.mostRecent();
      const callback = initializeCall.args[0].callback;

      // Execute callback with invalid response
      callback({});
      tick();

      expect(component.signInError.emit).toHaveBeenCalledWith(
        'Failed to process Google sign-in'
      );
    }));
  });

  describe('Fallback Button', () => {
    beforeEach(() => {
      component.isGoogleLoaded = false;
      component.fallbackClicked = false;
      fixture.detectChanges();
    });

    it('should show fallback button when Google is not loaded', () => {
      const fallbackButton =
        fixture.nativeElement.querySelector('.fallback-button');
      expect(fallbackButton).toBeTruthy();
    });

    it('should handle fallback button click', () => {
      spyOn(component as any, 'handleError');

      component.onFallbackButtonClick();

      expect(component.fallbackClicked).toBe(true);
      expect((component as any).handleError).toHaveBeenCalledWith(
        'Google Sign-In is currently unavailable'
      );
    });
  });

  describe('Error States', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should show error state when fallback is clicked', () => {
      component.fallbackClicked = true;
      fixture.detectChanges();

      const errorState = fixture.nativeElement.querySelector('.error-state');
      expect(errorState).toBeTruthy();
    });

    it('should handle error with snack bar', () => {
      spyOn(component.signInError, 'emit');

      (component as any).handleError('Test error message');

      expect(component.signInError.emit).toHaveBeenCalledWith(
        'Test error message'
      );
      expect(mockSnackBar).toHaveBeenCalledWith(
        'Mocked translation',
        'Mocked translation',
        {
          duration: 5000,
          panelClass: ['error-snackbar'],
        }
      );
    });

    it('should show success message with snack bar', () => {
      (component as any).showSuccess('Test success message');

      expect(mockSnackBar).toHaveBeenCalledWith(
        'Mocked translation',
        'Mocked translation',
        {
          duration: 3000,
          panelClass: ['success-snackbar'],
        }
      );
    });
  });

  describe('Loading States', () => {
    it('should show loading overlay when isLoading is true', () => {
      component.isLoading = true;
      fixture.detectChanges();

      const loadingOverlay =
        fixture.nativeElement.querySelector('.loading-overlay');
      expect(loadingOverlay).toBeTruthy();
    });

    it('should hide loading overlay when isLoading is false', () => {
      component.isLoading = false;
      fixture.detectChanges();

      const loadingOverlay =
        fixture.nativeElement.querySelector('.loading-overlay');
      expect(loadingOverlay).toBeFalsy();
    });

    it('should disable google button container when loading', () => {
      component.isLoading = true;
      fixture.detectChanges();

      const buttonContainer = fixture.nativeElement.querySelector(
        '.google-button-container'
      );
      expect(buttonContainer?.classList.contains('disabled')).toBe(true);
    });
  });

  describe('Material Design Compliance', () => {
    it('should use Material Design components', () => {
      component.isGoogleLoaded = false;
      fixture.detectChanges();

      const matButton = fixture.nativeElement.querySelector(
        'button[mat-raised-button]'
      );
      const matIcon = fixture.nativeElement.querySelector('mat-icon');

      expect(matButton).toBeTruthy();
      expect(matIcon).toBeTruthy();
    });

    it('should apply proper Material Design classes', () => {
      component.isLoading = true;
      fixture.detectChanges();

      const spinner = fixture.nativeElement.querySelector('mat-spinner');
      expect(spinner).toBeTruthy();
      expect(spinner?.getAttribute('diameter')).toBe('24');
    });

    it('should follow Material Design color schemes', () => {
      component.isGoogleLoaded = false;
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.fallback-button');
      expect(button?.getAttribute('color')).toBe('primary');
    });
  });
});
