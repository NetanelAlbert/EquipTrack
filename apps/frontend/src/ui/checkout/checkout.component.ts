import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EditableInventoryComponent } from '../inventory/edit/editable-inventory.component';
import {
  InventoryForm,
  InventoryItem,
  FormStatus,
  FormType,
} from '@equip-track/shared';
import { OrganizationStore } from '../../store/organization.store';
import { CheckoutStore } from './checkout.store';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { InventoryListComponent } from '../inventory/list/inventory-list.component';
import { computedPrevious } from 'ngxtension/computed-previous';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserStore } from '../../store/user.store';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
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
  public checkoutStore = inject(CheckoutStore);
  private snackBar = inject(MatSnackBar);
  private translate = inject(TranslateService);
  private userStore = inject(UserStore);

  form = this.fb.group({
    userID: ['', Validators.required],
  });

  users = this.organizationStore.users;
  predefinedForms = this.organizationStore.predefinedForms;
  initialItems = signal<InventoryItem[]>([]);
  itemEdited = signal(false);
  showPredefinedForms = computed(
    () => !this.itemEdited() && this.predefinedForms().length > 0
  );

  constructor() {
    this.setEffects();
  }

  getProductName(productId: string): string {
    return this.organizationStore.getProduct(productId)?.name ?? productId;
  }

  // TODO / bug: this is reseting current items added by the user
  addAllItems(items: InventoryItem[]) {
    this.initialItems.set(items);
    this.itemEdited.set(true);
  }

  async onSubmit(items: InventoryItem[]) {
    if (this.form.valid && items.length > 0) {
      const userId = this.form.get('userID')?.value;
      if (!userId) return;

      const formData: InventoryForm = {
        userID: userId,
        organizationID: this.userStore.activeOrganization.organizationID(),
        type: FormType.CheckOut,
        formID: crypto.randomUUID(),
        items,
        status: FormStatus.Pending,
        createdAtTimestamp: Date.now(),
        lastUpdated: Date.now(),
      };

      void this.checkoutStore.createCheckoutForm(userId, formData);
    }
  }

  onItemsEdited() {
    console.log('onItemsEdited');
    this.itemEdited.set(true);
  }

  private setEffects() {
    const previousSending = computedPrevious(this.checkoutStore.sending);
    effect(() => {
      if (previousSending()) {
        if (this.checkoutStore.error()) {
          this.snackBar.open(
            this.translate.instant('checkout.error'),
            this.translate.instant('common.close'),
            { duration: 3000 }
          );
        } else {
          this.resetForm();
          this.snackBar.open(
            this.translate.instant('checkout.success'),
            this.translate.instant('common.close'),
            { duration: 3000 }
          );
        }
      }
    });
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
