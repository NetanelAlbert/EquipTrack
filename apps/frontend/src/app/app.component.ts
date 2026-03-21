import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SideNavComponent } from '../ui/side-nav/side-nav.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { LanguageService } from '../services/language.service';

@Component({
  standalone: true,
  imports: [RouterModule, TranslateModule, SideNavComponent, MatSidenavModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly languageService = inject(LanguageService);

  title = 'frontend';
  backendMessage = '';

  constructor() {
    this.languageService.initializeLanguage();
  }
}
