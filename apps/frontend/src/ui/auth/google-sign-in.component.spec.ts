import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule } from '@ngx-translate/core';
import { GoogleSignInComponent } from './google-sign-in.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('GoogleSignInComponent', () => {
  let component: GoogleSignInComponent;
  let fixture: ComponentFixture<GoogleSignInComponent>;
  let mockSnackBar: jest.Mock;
  let mockGoogleApi: {
    accounts: {
      id: {
        initialize: jest.Mock;
        renderButton: jest.Mock;
        prompt: jest.Mock;
        disableAutoSelect: jest.Mock;
      };
    };
  };

  beforeEach(async () => {
    mockSnackBar = jest.fn();

    mockGoogleApi = {
      accounts: {
        id: {
          initialize: jest.fn(),
          renderButton: jest.fn(),
          prompt: jest.fn(),
          disableAutoSelect: jest.fn(),
        },
      },
    };

    (window as unknown as { google: typeof mockGoogleApi }).google =
      mockGoogleApi;

    await TestBed.configureTestingModule({
      imports: [
        GoogleSignInComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [{ provide: MatSnackBar, useValue: { open: mockSnackBar } }],
    }).compileComponents();

    fixture = TestBed.createComponent(GoogleSignInComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    delete (window as unknown as { google?: unknown }).google;
    delete (window as unknown as { onGoogleLibraryLoad?: unknown })
      .onGoogleLibraryLoad;
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
      jest.spyOn(component as unknown as { setupGoogleSignIn: () => void }, 'setupGoogleSignIn');

      fixture.detectChanges();
      tick();

      expect(
        (component as unknown as { setupGoogleSignIn: jest.Mock })
          .setupGoogleSignIn
      ).toHaveBeenCalled();
    }));

    it('should wait for Google library to load when not immediately available', fakeAsync(() => {
      delete (window as unknown as { google?: unknown }).google;

      jest.spyOn(component as unknown as { setupGoogleSignIn: () => void }, 'setupGoogleSignIn');

      fixture.detectChanges();
      tick();

      expect(
        (component as unknown as { setupGoogleSignIn: jest.Mock })
          .setupGoogleSignIn
      ).not.toHaveBeenCalled();

      (window as unknown as { google: typeof mockGoogleApi }).google =
        mockGoogleApi;
      if (window.onGoogleLibraryLoad) {
        window.onGoogleLibraryLoad();
      }
      tick();

      expect(
        (component as unknown as { setupGoogleSignIn: jest.Mock })
          .setupGoogleSignIn
      ).toHaveBeenCalled();
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
        callback: expect.any(Function),
        auto_select: false,
        cancel_on_tap_outside: true,
        context: 'signin',
        use_fedcm_for_prompt: false,
        itp_support: false,
      });
    });

    it('should render Google button with correct configuration', () => {
      expect(mockGoogleApi.accounts.id.renderButton).toHaveBeenCalledWith(
        expect.any(HTMLElement),
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
      jest.spyOn(
        component as unknown as { handleError: (m: string) => void },
        'handleError'
      );
      jest.spyOn(console, 'error').mockImplementation(() => undefined);

      mockGoogleApi.accounts.id.initialize.mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      (component as unknown as { setupGoogleSignIn: () => void }).setupGoogleSignIn();

      expect(
        (component as unknown as { handleError: jest.Mock }).handleError
      ).toHaveBeenCalledWith('Failed to load Google Sign-In');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Credential Response Handling', () => {
    let mockCredentialResponse: {
      credential: string;
      select_by: string;
    };

    beforeEach(() => {
      fixture.detectChanges();

      mockCredentialResponse = {
        credential: 'mock.jwt.token',
        select_by: 'user',
      };
    });

    it('should handle successful credential response', fakeAsync(() => {
      jest.spyOn(component.signInSuccess, 'emit');

      const initializeCall =
        mockGoogleApi.accounts.id.initialize.mock.calls.at(-1);
      expect(initializeCall).toBeDefined();
      const callback = (initializeCall![0] as { callback: (r: unknown) => void })
        .callback;

      callback(mockCredentialResponse);
      tick(100);

      expect(component.signInSuccess.emit).toHaveBeenCalledWith('mock.jwt.token');
      tick(150);
      expect(component.isLoading).toBe(false);
    }));

    it('should handle credential response without credential', fakeAsync(() => {
      jest.spyOn(
        component as unknown as { handleError: (m: string) => void },
        'handleError'
      );

      const initializeCall =
        mockGoogleApi.accounts.id.initialize.mock.calls.at(-1);
      const callback = (initializeCall![0] as { callback: (r: unknown) => void })
        .callback;

      callback({ select_by: 'user' });
      tick(200);

      expect(
        (component as unknown as { handleError: jest.Mock }).handleError
      ).toHaveBeenCalledWith('Failed to process Google sign-in');
      expect(component.isLoading).toBe(false);
    }));

    it('should emit signInError on credential processing failure', fakeAsync(() => {
      jest.spyOn(component.signInError, 'emit');

      const initializeCall =
        mockGoogleApi.accounts.id.initialize.mock.calls.at(-1);
      const callback = (initializeCall![0] as { callback: (r: unknown) => void })
        .callback;

      callback({});
      tick(200);

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
      jest.spyOn(
        component as unknown as { handleError: (m: string) => void },
        'handleError'
      );

      component.onFallbackButtonClick();

      expect(component.fallbackClicked).toBe(true);
      expect(
        (component as unknown as { handleError: jest.Mock }).handleError
      ).toHaveBeenCalledWith('Google Sign-In is currently unavailable');
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
      jest.spyOn(component.signInError, 'emit');

      (component as unknown as { handleError: (m: string) => void }).handleError(
        'Test error message'
      );

      expect(component.signInError.emit).toHaveBeenCalledWith(
        'Test error message'
      );
      expect(mockSnackBar).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          duration: 5000,
          panelClass: ['error-snackbar'],
        })
      );
    });

    it('should show success message with snack bar', () => {
      (component as unknown as { showSuccess: (m: string) => void }).showSuccess(
        'Test success message'
      );

      expect(mockSnackBar).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          duration: 3000,
          panelClass: ['success-snackbar'],
        })
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
      expect(spinner?.getAttribute('diameter')).toBe('32');
    });

    it('should follow Material Design color schemes', () => {
      component.isGoogleLoaded = false;
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.fallback-button');
      expect(button?.getAttribute('color')).toBe('primary');
    });
  });
});
