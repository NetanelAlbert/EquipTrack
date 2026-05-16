import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { FormsStore } from '../../store/forms.store';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { FormsTabContentComponent } from './forms-tab-content/forms-tab-content.component';
import { FormQueryParams } from '../../utils/forms.medels';
import { ActivatedRoute } from '@angular/router';
import { FormStatus, FormType, UserRole } from '@equip-track/shared';
import { UserStore } from '../../store/user.store';
import { OrganizationService } from '../../services/organization.service';

@Component({
  selector: 'app-forms',
  standalone: true,
  imports: [
    MatTabsModule,
    MatProgressSpinnerModule,
    TranslateModule,
    FormsTabContentComponent,
  ],
  templateUrl: './forms.component.html',
  styleUrl: './forms.component.scss',
})
export class FormsComponent implements OnInit {
  private readonly queryParams = signal<FormQueryParams | undefined>(undefined);

  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly userStore = inject(UserStore);
  private readonly organizationService = inject(OrganizationService);

  readonly formsStore = inject(FormsStore);
  readonly checkOutQueryParams = computed(() =>
    this.queryParams()?.formType === FormType.CheckOut
      ? this.queryParams()
      : undefined
  );

  readonly showUserFilters = computed(() => {
    const role = this.userStore.currentRole();
    return role === UserRole.Admin || role === UserRole.WarehouseManager;
  });

  selectedTabIndex = 0;

  ngOnInit(): void {
    this.formsStore.fetchForms();

    if (this.showUserFilters()) {
      this.organizationService.getUsers();
    }

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (
        params['formType'] &&
        params['searchStatus'] &&
        params['searchTerm']
      ) {
        this.queryParams.set({
          formType: FormType.CheckOut,
          searchStatus: params['searchStatus'] as FormStatus,
          searchTerm: params['searchTerm'],
        });
      } else {
        this.queryParams.set(undefined);
      }
    });
  }
}
