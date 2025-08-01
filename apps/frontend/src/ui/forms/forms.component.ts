import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsStore } from '../../store/forms.store';
import { MatTabsModule } from '@angular/material/tabs';
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
    CommonModule,
    MatTabsModule,
    TranslateModule,
    FormsTabContentComponent,
  ],
  templateUrl: './forms.component.html',
  styleUrl: './forms.component.scss',
})
export class FormsComponent implements OnInit {
  private readonly queryParams = signal<FormQueryParams | undefined>(undefined);

  private readonly route = inject(ActivatedRoute);

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

  selectedTabIndex = formTypeToTabIndex[FormType.CheckIn];

  ngOnInit(): void {
    this.formsStore.fetchForms();
    this.route.queryParams.subscribe((params) => {
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
