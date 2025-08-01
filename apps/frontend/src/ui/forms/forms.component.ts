import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsStore } from '../../store/forms.store';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';
import { FormsTabContentComponent } from './forms-tab-content/forms-tab-content.component';

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
  formsStore = inject(FormsStore);

  ngOnInit(): void {
    this.formsStore.fetchForms();
  }
}
