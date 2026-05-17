import { Component, inject } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../services/language.service';
import { UserPreferencesService } from '../../services/user-preferences.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    TranslateModule
],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private readonly languageService = inject(LanguageService);
  private readonly userPreferencesService = inject(UserPreferencesService);

  readonly selectedLanguage = this.languageService.language;
  readonly availableLanguages = this.languageService.availableLanguages;

  readonly selectedFormItemsView = this.userPreferencesService.formItemsView;
  readonly availableFormItemsViews =
    this.userPreferencesService.availableFormItemsViews;

  onLanguageChange(event: MatSelectChange): void {
    if (this.languageService.isSupportedLanguage(event.value)) {
      this.languageService.setLanguage(event.value);
    }
  }

  onFormItemsViewChange(event: MatSelectChange): void {
    if (this.userPreferencesService.isSupportedFormItemsView(event.value)) {
      this.userPreferencesService.setFormItemsView(event.value);
    }
  }
}
