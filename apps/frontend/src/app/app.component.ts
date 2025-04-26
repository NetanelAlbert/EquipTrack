import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  standalone: true,
  imports: [RouterModule, TranslateModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'frontend';
  backendMessage = '';
  supportedLanguages = ['en'];

  constructor(private translate: TranslateService) {
    translate.setDefaultLang('en');
    const browserLang = translate.getBrowserLang() || 'en';
    if (this.supportedLanguages.includes(browserLang)) {
      translate.use(browserLang);
    }
  }

  ngOnInit(): void {
    fetch('http://localhost:3000/')
      .then((response) => response.json())
      .then((data) => {
        const { message } = data;
        this.backendMessage = message;
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
        this.backendMessage = 'Error connecting backend';
      });
  }
}
