import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { provideRouter } from '@angular/router';
import { importProvidersFrom } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

export const commonTestProviders = [
  importProvidersFrom(HttpClientTestingModule),
  importProvidersFrom(TranslateModule.forRoot()),
  importProvidersFrom(BrowserAnimationsModule),
  provideRouter([]),
];

export const createMockTranslateService = () => ({
  instant: jest.fn().mockImplementation((key: string) => key),
  get: jest.fn().mockImplementation((key: string) => key),
  onLangChange: { subscribe: jest.fn() },
  onTranslationChange: { subscribe: jest.fn() },
  onDefaultLangChange: { subscribe: jest.fn() },
});

export const createMockApiService = () => ({
  endpoints: {
    getUsers: {
      execute: jest.fn().mockResolvedValue({ status: true, users: [] }),
    },
    getProducts: {
      execute: jest.fn().mockResolvedValue({ status: true, products: [] }),
    },
    traceItem: {
      execute: jest.fn().mockResolvedValue({ 
        status: true, 
        productId: 'test', 
        upi: 'test',
        history: [],
        currentLocation: 'test',
        lastReportedAt: 'test'
      }),
    },
  },
});

export const createMockUserStore = () => ({
  selectedOrganizationId: jest.fn().mockReturnValue('test-org-id'),
  currentOrganization: jest.fn().mockReturnValue({ id: 'test-org-id', name: 'Test Org' }),
  user: jest.fn().mockReturnValue({ id: 'test-user', name: 'Test User' }),
  currentRole: jest.fn().mockReturnValue('admin'),
});

export const createMockFormsStore = () => ({
  requestCheckIn: jest.fn().mockResolvedValue(undefined),
});

export const createMockInventoryStore = () => ({
  fetchInventory: jest.fn().mockResolvedValue(undefined),
});

export const createMockNotificationService = () => ({
  showSuccess: jest.fn(),
  showError: jest.fn(),
  showInfo: jest.fn(),
});

export const createMockOrganizationService = () => ({
  getUsers: jest.fn().mockResolvedValue(undefined),
});