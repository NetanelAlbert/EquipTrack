import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserFormsStore } from '../../store/user-forms.store';
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
export class FormsComponent {
  formsStore = inject(UserFormsStore);
}
