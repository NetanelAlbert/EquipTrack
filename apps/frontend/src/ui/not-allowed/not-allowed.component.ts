import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-not-allowed',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    RouterModule,
    TranslateModule,
  ],
  template: `
    <div class="not-allowed-container">
      <mat-icon class="error-icon">error_outline</mat-icon>
      <h1>{{ 'errors.not-allowed.title' | translate }}</h1>
      <p>{{ 'errors.not-allowed.message' | translate }}</p>
      <button mat-raised-button color="primary" routerLink="/">
        {{ 'errors.not-allowed.back-home' | translate }}
      </button>
    </div>
  `,
  styles: [
    `
      .not-allowed-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        text-align: center;
        padding: 20px;
      }

      .error-icon {
        font-size: 64px;
        height: 64px;
        width: 64px;
        color: var(--color-error);
        margin-bottom: 20px;
      }

      h1 {
        margin-bottom: 16px;
        color: var(--color-text-primary);
      }

      p {
        margin-bottom: 24px;
        color: var(--color-text-secondary);
      }
    `,
  ],
})
export class NotAllowedComponent {}
