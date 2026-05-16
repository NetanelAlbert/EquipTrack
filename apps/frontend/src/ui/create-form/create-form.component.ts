import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { NgSelectModule } from '@ng-select/ng-select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { EditableInventoryComponent } from '../inventory/edit/editable-inventory.component';
import {
  FormType,
  InventoryItem,
  UserAndUserInOrganization,
} from '@equip-track/shared';
import { OrganizationStore } from '../../store/organization.store';
import { OrganizationService } from '../../services/organization.service';
import { MatExpansionModule } from '@angular/material/expansion';
import { InventoryListComponent } from '../inventory/list/inventory-list.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NotificationService } from '../../services/notification.service';
import { UserStore } from '../../store/user.store';
import { FormsStore } from '../../store/forms.store';
import { InventoryStore } from '../../store/inventory.store';
import { UserDisplayComponent } from '../shared/user-display/user-display.component';
import { userMatchesSelectSearch } from '../shared/user-select-search';
import { MatTooltipModule } from '@angular/material/tooltip';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { CanComponentDeactivate } from '../../app/guards/unsaved-changes.guard';

@Component({
  selector: 'app-create-form',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    NgSelectModule,
    MatButtonModule,
    MatIconModule,
    ReactiveFormsModule,
    EditableInventoryComponent,
    TranslateModule,
    MatExpansionModule,
    InventoryListComponent,
    MatProgressSpinnerModule,
    UserDisplayComponent,
    MatTooltipModule,
  ],
  templateUrl: './create-form.component.html',
  styleUrls: ['./create-form.component.scss'],
})
export class CreateFormComponent implements OnInit, CanComponentDeactivate {
  private fb = inject(FormBuilder);
  private organizationStore = inject(OrganizationStore);
  private organizationService = inject(OrganizationService);
  private notificationService = inject(NotificationService);
  protected formsStore = inject(FormsStore);
  private userStore = inject(UserStore);
  private inventoryStore = inject(InventoryStore);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  form = this.fb.group({
    userID: [null as string | null, Validators.required],
    formDescription: ['', Validators.required],
  });

  userId = toSignal(this.form.get('userID')?.valueChanges || of(), {
    initialValue: '',
  });

  users = this.organizationStore.users;
  predefinedForms = this.organizationStore.predefinedForms;

  readonly userSelectSearchFn = (
    term: string,
    item: UserAndUserInOrganization
  ) =>
    userMatchesSelectSearch(term, item, (id) =>
      this.userStore.getDepartmentName(id) ?? ''
    );

  itemsToAdd = signal<InventoryItem[] | null>(null);
  itemEdited = signal(false);
  showPredefinedForms = computed(
    () => !this.itemEdited() && this.predefinedForms().length > 0
  );

  readonly limitItems = computed(() => this.inventoryStore.getWarehouseInventory()());

  readonly submitButton = {
    text: 'create-form.submit-button.check-out',
    icon: 'check',
    color: 'primary',
  };

  constructor() {
    effect(() => {
      void this.inventoryStore.ensureUserInventoryLoaded('WAREHOUSE');
    });
  }

  ngOnInit(): void {
    this.formsStore.resetAddFormStatus();
    void this.organizationService.getUsers();
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        if (params['items']) {
          this.form.patchValue({ userID: params['userId'] });
          try {
            const items = JSON.parse(params['items']) as InventoryItem[];
            this.addAllItems(items);
          } catch (e) {
            console.error('Failed to parse items from query params:', e);
            this.notificationService.showError('errors.api.general');
          }
        }
        void this.inventoryStore.ensureUserInventoryLoaded('WAREHOUSE', { forceRefresh: true });
      });
  }

  addAllItems(items: InventoryItem[]) {
    this.itemsToAdd.set(items);
    this.itemEdited.set(true);
  }

  async onSubmit(items: InventoryItem[]) {
    const formDescription = this.form.get('formDescription')?.value;
    const userId = this.userId();
    if (
      this.form.valid &&
      items.length > 0 &&
      userId &&
      formDescription
    ) {
      const success = await this.formsStore.addForm(
        FormType.CheckOut,
        items,
        userId,
        formDescription
      );
      if (success) {
        this.resetForm();
      }
    } else {
      this.form.updateValueAndValidity();
      this.notificationService.showError('forms.form-invalid');
    }
  }

  onItemsEdited() {
    this.itemEdited.set(true);
  }

  hasUnsavedChanges(): boolean {
    return this.itemEdited();
  }

  private resetForm() {
    setTimeout(() => {
      this.itemsToAdd.set(null);
      this.form.reset();
      this.form.updateValueAndValidity();
      this.itemEdited.set(false);
    });
  }
}
