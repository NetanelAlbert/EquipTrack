import { TestBed } from '@angular/core/testing';
import { STORAGE_KEYS } from '../utils/consts';
import { UserPreferencesService } from './user-preferences.service';

describe('UserPreferencesService', () => {
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEYS.FORM_ITEMS_VIEW);
    TestBed.resetTestingModule();
  });

  it('defaults formItemsView to table when unset in localStorage', () => {
    expect(localStorage.getItem(STORAGE_KEYS.FORM_ITEMS_VIEW)).toBeNull();

    TestBed.configureTestingModule({});
    const svc = TestBed.inject(UserPreferencesService);

    expect(svc.formItemsView()).toBe('table');
  });

  it('reads persisted formItemsView value', () => {
    localStorage.setItem(STORAGE_KEYS.FORM_ITEMS_VIEW, 'list');

    TestBed.configureTestingModule({});
    const svc = TestBed.inject(UserPreferencesService);

    expect(svc.formItemsView()).toBe('list');
  });
});
