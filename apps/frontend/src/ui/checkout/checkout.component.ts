import { Component, computed, effect, inject, signal } from '@angular/core';
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
  InventoryForm,
  InventoryItem,
  FormStatus,
  FormType,
  UserAndUserInOrganization,
} from '@equip-track/shared';
import { OrganizationStore } from '../../store/organization.store';
import { MatExpansionModule } from '@angular/material/expansion';
import { InventoryListComponent } from '../inventory/list/inventory-list.component';
import { computedPrevious } from 'ngxtension/computed-previous';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NotificationService } from '../../services/notification.service';
import { UserStore } from '../../store/user.store';
import { FormsStore } from '../../store/forms.store';
import { Router } from '@angular/router';

@Component({
  selector: 'app-checkout',
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
  ],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
})
export class CheckoutComponent {
  private fb = inject(FormBuilder);
  private organizationStore = inject(OrganizationStore);
  private notificationService = inject(NotificationService);
  protected formsStore = inject(FormsStore);
  private userStore = inject(UserStore);
  private router = inject(Router);

  user = signal<UserAndUserInOrganization | undefined>(undefined);

  submitButton = {
    text: 'inventory.button.create-checkout',
    icon: 'check',
    color: 'primary',
  };
  form = this.fb.group({
    userID: ['', Validators.required],
    formDescription: ['', Validators.required],
  });

  users = this.organizationStore.users;
  predefinedForms = this.organizationStore.predefinedForms;
  initialItems = signal<InventoryItem[]>([]);
  itemEdited = signal(false);
  showPredefinedForms = computed(
    () => !this.itemEdited() && this.predefinedForms().length > 0
  );

  // TODO / bug: this is reseting current items added by the user
  addAllItems(items: InventoryItem[]) {
    this.initialItems.set(items);
    this.itemEdited.set(true);
  }

  async onSubmit(items: InventoryItem[]) {
    if (this.form.valid && items.length > 0) {
      const userId = this.form.get('userID')?.value;
      const formDescription = this.form.get('formDescription')?.value;
      if (!userId) return;
      if (!formDescription) return;

      const success = await this.formsStore.addCheckOutForm(
        items,
        userId,
        formDescription
      );
      if (success) {
        this.resetForm();
      }
    }
  }

  onUserChange(userId: string) {
    this.user.set(this.users().find((user) => user.user.id === userId));
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
      this.initialItems.set([]);
      this.form.reset();
      this.form.updateValueAndValidity();
      this.itemEdited.set(false);
    });
  }
}
