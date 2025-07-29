import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, NotificationService } from '../../services';
import { UserStore } from '../../store';
import { ItemReport, TraceItemRequest, ORGANIZATION_ID_PATH_PARAM } from '@equip-track/shared';
import { firstValueFrom } from 'rxjs';

interface TraceResult {
  productId: string;
  upi: string;
  currentLocation?: string;
  lastReportedAt?: string;
  reportHistory: ItemReport[];
}

@Component({
  selector: 'app-trace-product',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="trace-product-container">
      <div class="search-section">
        <h2>Product Tracing</h2>
        <p>Track the history and current location of specific products by their Product ID and UPI code.</p>
        
        <form class="search-form" (ngSubmit)="searchProduct()" #searchForm="ngForm">
          <div class="input-group">
            <label for="productId">Product ID</label>
            <input 
              type="text" 
              id="productId" 
              name="productId"
              [(ngModel)]="searchCriteria.productId" 
              placeholder="Enter product ID" 
              required>
          </div>
          
          <div class="input-group">
            <label for="upi">UPI Code</label>
            <input 
              type="text" 
              id="upi" 
              name="upi"
              [(ngModel)]="searchCriteria.upi" 
              placeholder="Enter UPI code" 
              required>
          </div>
          
          <button 
            type="submit" 
            class="search-button"
            [disabled]="loading() || !searchForm.form.valid">
            {{ loading() ? 'Searching...' : 'Trace Product' }}
          </button>
        </form>
      </div>

      @if (error()) {
        <div class="error-section">
          <h3>Error</h3>
          <p>{{ error() }}</p>
        </div>
      }

      @if (result()) {
        <div class="results-section">
          <h3>Trace Results</h3>
          <div class="result-summary">
            <div class="summary-item">
              <strong>Product ID:</strong> {{ result()!.productId }}
            </div>
            <div class="summary-item">
              <strong>UPI:</strong> {{ result()!.upi }}
            </div>
            <div class="summary-item">
              <strong>Current Location:</strong> 
              {{ result()!.currentLocation || 'Unknown' }}
            </div>
            <div class="summary-item">
              <strong>Last Reported:</strong> 
              {{ result()!.lastReportedAt || 'Never' }}
            </div>
          </div>

          @if (result()!.reportHistory.length > 0) {
            <div class="history-section">
              <h4>Report History</h4>
              <div class="history-list">
                @for (report of result()!.reportHistory; track report.reportDate + report.location) {
                  <div class="history-item">
                    <div class="history-date">{{ formatDate(report.reportDate) }}</div>
                    <div class="history-location">{{ report.location }}</div>
                  </div>
                }
              </div>
            </div>
          } @else {
            <div class="no-history">
              <p>No report history found for this item.</p>
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './trace-product.component.scss',
})
export class TraceProductComponent {
  apiService = inject(ApiService);
  notificationService = inject(NotificationService);
  userStore = inject(UserStore);

  searchCriteria = {
    productId: '',
    upi: '',
  };

  loading = signal(false);
  error = signal<string | null>(null);
  result = signal<TraceResult | null>(null);

  async searchProduct(): Promise<void> {
    const selectedOrganizationId = this.userStore.selectedOrganizationId();
    if (!selectedOrganizationId) {
      this.notificationService.showError('Please select an organization first');
      return;
    }

    if (!this.searchCriteria.productId.trim() || !this.searchCriteria.upi.trim()) {
      this.notificationService.showError('Please enter both Product ID and UPI');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    try {
      const request: TraceItemRequest = {
        productId: this.searchCriteria.productId.trim(),
        upi: this.searchCriteria.upi.trim(),
      };

      const response = await firstValueFrom(
        this.apiService.endpoints.traceItem.execute(request, {
          [ORGANIZATION_ID_PATH_PARAM]: selectedOrganizationId,
        })
      );

      if (response.status) {
        this.result.set({
          productId: response.productId,
          upi: response.upi,
          currentLocation: response.currentLocation,
          lastReportedAt: response.lastReportedAt,
          reportHistory: response.history,
        });
        
        this.notificationService.showSuccess('Product trace completed successfully');
      } else {
        this.error.set('Failed to trace product');
        this.notificationService.showError('Failed to trace product');
      }
    } catch (error) {
      console.error('Error tracing product:', error);
      this.error.set('Error occurred while tracing product');
      this.notificationService.showError('Error occurred while tracing product');
    } finally {
      this.loading.set(false);
    }
  }

  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  }
}