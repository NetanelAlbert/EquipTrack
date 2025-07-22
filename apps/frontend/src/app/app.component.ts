import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SideNavComponent } from '../ui/side-nav/side-nav.component';
import { MatSidenavModule } from '@angular/material/sidenav';

@Component({
  standalone: true,
  imports: [RouterModule, TranslateModule, SideNavComponent, MatSidenavModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'frontend';
  backendMessage = '';
  supportedLanguages = ['en'];

  constructor(translate: TranslateService) {
    translate.setDefaultLang('en');
    const browserLang = translate.getBrowserLang() || 'en';
    if (this.supportedLanguages.includes(browserLang)) {
      translate.use(browserLang);
    }
  }
}
