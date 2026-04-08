import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { FormsStore } from '../../store/forms.store';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { FormsTabContentComponent } from './forms-tab-content/forms-tab-content.component';
import { FormQueryParams } from '../../utils/forms.medels';
import { ActivatedRoute } from '@angular/router';
import { FormStatus, FormType } from '@equip-track/shared';

const formTypeToTabIndex: Record<FormType, number> = {
  [FormType.CheckOut]: 0,
  [FormType.CheckIn]: 1,
};

@Component({
  selector: 'app-forms',
  standalone: true,
  imports: [
    MatTabsModule,
    MatProgressSpinnerModule,
    TranslateModule,
    FormsTabContentComponent
],
  templateUrl: './forms.component.html',
  styleUrl: './forms.component.scss',
})
export class FormsComponent implements OnInit {
  private readonly queryParams = signal<FormQueryParams | undefined>(undefined);

  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly formsStore = inject(FormsStore);
  readonly checkOutQueryParams = computed(() =>
    this.queryParams()?.formType === FormType.CheckOut
      ? this.queryParams()
      : undefined
  );
  readonly checkInQueryParams = computed(() =>
    this.queryParams()?.formType === FormType.CheckIn
      ? this.queryParams()
      : undefined
  );

  selectedTabIndex = formTypeToTabIndex[FormType.CheckOut];

  ngOnInit(): void {
    this.formsStore.fetchForms();
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (
        params['formType'] &&
        params['searchStatus'] &&
        params['searchTerm']
      ) {
        const formType = params['formType'] as FormType;
        this.selectedTabIndex = formTypeToTabIndex[formType];
        this.queryParams.set({
          formType,
          searchStatus: params['searchStatus'] as FormStatus,
          searchTerm: params['searchTerm'],
        });
      } else {
        this.queryParams.set(undefined);
      }
    });
  }
}
