import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, MatIconModule, TranslateModule],
  template: `
    <div class="empty-state">
      <mat-icon>inventory_2</mat-icon>
      <p>{{ message | translate }}</p>
    </div>
  `,
  styles: [
    `
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        background-color: var(--color-bg-primary);
        border-radius: 8px;
        border: 1px solid var(--color-border-light);
        animation: fadeIn 0.3s ease-out;

        mat-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          color: var(--color-accent);
          opacity: 0.7;
          margin-bottom: 16px;
        }

        p {
          margin: 0;
          color: #e0e0e0;
          opacity: 0.7;
          text-align: center;
          font-size: 1.1rem;
        }
      }
    `,
  ],
})
export class EmptyStateComponent {
  @Input() message!: string;
}
