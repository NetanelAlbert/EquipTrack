import { inject, Injectable } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root',
})
export class AppInitService {
  iconRegistry = inject(MatIconRegistry);
  sanitizer = inject(DomSanitizer);
  private icons = ['delete', 'add', 'expand_more', 'expand_less', 'save'];

  initializeApp(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.initIcons();
        resolve();
      } catch (error) {
        console.error(`Failed to initialize app: ${error}`);
        reject(`Error: ${error}`);
      }
    });
  }

  private initIcons() {
    this.icons.forEach((icon) => {
      this.iconRegistry.addSvgIcon(
        icon,
        this.sanitizer.bypassSecurityTrustResourceUrl(
          `assets/icons/${icon}.svg`
        )
      );
    });
  }
}
