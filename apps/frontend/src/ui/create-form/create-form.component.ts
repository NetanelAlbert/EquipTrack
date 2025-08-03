import {
  Component,
  computed,
  inject,
  OnInit,
  Signal,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
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
import { MatExpansionModule } from '@angular/material/expansion';
import { InventoryListComponent } from '../inventory/list/inventory-list.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NotificationService } from '../../services/notification.service';
import { UserStore } from '../../store/user.store';
import { FormsStore } from '../../store/forms.store';
import { InventoryStore } from '../../store/inventory.store';
import { MatRadioModule } from '@angular/material/radio';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { CreateFormQueryParams } from '../../utils/forms.medels';

interface CreateFormConfig {
  explanationKey: string;
  submitButtonTextKey: string;
  limitItems: Signal<InventoryItem[]>;
}

@Component({
  selector: 'app-create-form',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    ReactiveFormsModule,
    EditableInventoryComponent,
    TranslateModule,
    MatExpansionModule,
    InventoryListComponent,
    MatProgressSpinnerModule,
    MatRadioModule,
  ],
  templateUrl: './create-form.component.html',
  styleUrls: ['./create-form.component.scss'],
})
export class CreateFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private organizationStore = inject(OrganizationStore);
  private notificationService = inject(NotificationService);
  protected formsStore = inject(FormsStore);
  private userStore = inject(UserStore);
  private inventoryStore = inject(InventoryStore);
  private route = inject(ActivatedRoute);
  form = this.fb.group({
    userID: ['', Validators.required],
    formDescription: ['', Validators.required],
    formType: [FormType.CheckOut, Validators.required],
  });

  userId = toSignal(this.form.get('userID')?.valueChanges || of(), {
    initialValue: '',
  });
  formType = toSignal(this.form.get('formType')?.valueChanges || of(), {
    initialValue: FormType.CheckOut,
  });

  users = this.organizationStore.users;
  predefinedForms = this.organizationStore.predefinedForms;
  itemsToAdd = signal<InventoryItem[] | null>(null);
  itemEdited = signal(false);
  showPredefinedForms = computed(
    () => !this.itemEdited() && this.predefinedForms().length > 0
  );

  createFormConfig: Signal<CreateFormConfig> = computed(() => {
    return this.formType() === FormType.CheckOut
      ? {
          explanationKey: 'create-form.explanation.check-out',
          submitButtonTextKey: 'create-form.submit-button.check-out',
          limitItems: this.inventoryStore.getWarehouseInventory(),
        }
      : {
          explanationKey: 'create-form.explanation.check-in',
          submitButtonTextKey: 'create-form.submit-button.check-in',
          limitItems: this.inventoryStore.getUserInventory(this.userId() ?? ''),
        };
  });

  submitButton = computed(() => ({
    text: this.createFormConfig().submitButtonTextKey,
    icon: 'check',
    color: 'primary',
  }));

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      console.log('params', params);
      if (params['formType'] && params['items']) {
        this.form.patchValue({
          userID: params['userId'],
          formType: params['formType'],
        });
        const items = JSON.parse(params['items']) as InventoryItem[];
        console.log('items', items);
        items.forEach((item, index) => {
          console.log('item', index, item);
        });
        this.addAllItems(items);
      }
    });
  }

  addAllItems(items: InventoryItem[]) {
    this.itemsToAdd.set(items);
    this.itemEdited.set(true);
  }

  async onSubmit(items: InventoryItem[]) {
    const formDescription = this.form.get('formDescription')?.value;
    const userId = this.userId();
    const formType = this.formType();
    if (
      this.form.valid &&
      items.length > 0 &&
      userId &&
      formDescription &&
      formType
    ) {
      // TODO: add check-in form
      const success = await this.formsStore.addForm(
        formType,
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

  userDescription(user: UserAndUserInOrganization) {
    const department = user.userInOrganization.department;
    const departmentName = this.userStore.getDepartmentName(
      department?.id ?? ''
    );
    const subDepartmentName = this.userStore.getDepartmentName(
      department?.subDepartmentId ?? ''
    );
    const roleDescription = department?.roleDescription;
    let departmentDescription = [departmentName, subDepartmentName]
      .filter(Boolean)
      .join(' / ');
    if (roleDescription) {
      departmentDescription += ` (${roleDescription})`;
    }
    return `${user.user.name}: ${departmentDescription}`;
  }

  onItemsEdited() {
    this.itemEdited.set(true);
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
