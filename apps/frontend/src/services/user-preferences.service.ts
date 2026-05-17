import { computed, Injectable, signal } from '@angular/core';
import { STORAGE_KEYS } from '../utils/consts';

/**
 * The visual representation used for the inventory items inside a form card.
 * - `list`: the legacy vertical list (one item per row, UPI drill-down).
 * - `table`: the cross-tab table with one column per check-in event and an
 *   outstanding column on the far right.
 */
export type FormItemsView = 'list' | 'table';

export interface FormItemsViewOption {
  value: FormItemsView;
  labelKey: string;
}

const DEFAULT_FORM_ITEMS_VIEW: FormItemsView = 'table';

const FORM_ITEMS_VIEW_OPTIONS: readonly FormItemsViewOption[] = [
  { value: 'list', labelKey: 'settings.form-items-view.list' },
  { value: 'table', labelKey: 'settings.form-items-view.table' },
];

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private readonly formItemsViewSignal = signal<FormItemsView>(
    this.readFormItemsView()
  );

  readonly formItemsView = computed(() => this.formItemsViewSignal());
  readonly availableFormItemsViews = FORM_ITEMS_VIEW_OPTIONS;

  setFormItemsView(view: FormItemsView): void {
    if (view !== 'list' && view !== 'table') {
      return;
    }
    this.formItemsViewSignal.set(view);
    try {
      localStorage.setItem(STORAGE_KEYS.FORM_ITEMS_VIEW, view);
    } catch (error) {
      console.error('Failed to persist form items view preference:', error);
    }
  }

  isSupportedFormItemsView(value: unknown): value is FormItemsView {
    return value === 'list' || value === 'table';
  }

  private readFormItemsView(): FormItemsView {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.FORM_ITEMS_VIEW);
      if (this.isSupportedFormItemsView(stored)) {
        return stored;
      }
    } catch (error) {
      console.error('Failed to read form items view preference:', error);
    }
    return DEFAULT_FORM_ITEMS_VIEW;
  }
}
