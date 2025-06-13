import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsStore } from '../../store/forms.store';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';
import { FormCardComponent } from './form-card/form-card.component';
import { EmptyStateComponent } from './empty-state/empty-state.component';

@Component({
  selector: 'app-forms',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    TranslateModule,
    FormCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './forms.component.html',
  styleUrl: './forms.component.scss',
})
export class FormsComponent implements OnInit {
  formsStore = inject(FormsStore);

  ngOnInit(): void {
    this.formsStore.fetchForms();
  }
}
