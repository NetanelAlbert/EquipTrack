import { Injectable, signal } from '@angular/core';
import { Organization } from '@equip-track/shared';

export interface SelectedOrganizationInfo {
  organizationId: string;
  organization: Organization;
  selectedAt: number; // timestamp for potential cache invalidation
}

@Injectable({
  providedIn: 'root',
})
export class OrganizationSelectionService {
  private readonly SELECTED_ORG_KEY = 'equip-track-selected-org';

  // Signal to track currently selected organization
  public selectedOrganization = signal<Organization | null>(null);
  public selectedOrganizationId = signal<string | null>(null);

  constructor() {
    this.initializeSelectedOrganization();
  }

  /**
   * Initialize selected organization from localStorage on service creation
   */
  private initializeSelectedOrganization(): void {
    const stored = this.getSelectedOrganization();
    if (stored) {
      this.selectedOrganization.set(stored.organization);
      this.selectedOrganizationId.set(stored.organizationId);
    }
  }

  /**
   * Set selected organization and persist to localStorage
   */
  setSelectedOrganization(organization: Organization): void {
    try {
      const selectedInfo: SelectedOrganizationInfo = {
        organizationId: organization.id,
        organization,
        selectedAt: Date.now(),
      };

      localStorage.setItem(this.SELECTED_ORG_KEY, JSON.stringify(selectedInfo));

      // Update signals
      this.selectedOrganization.set(organization);
      this.selectedOrganizationId.set(organization.id);

      console.log('Organization selected and stored:', organization.name);
    } catch (error) {
      console.error('Failed to store selected organization:', error);
    }
  }

  /**
   * Get selected organization from localStorage
   */
  getSelectedOrganization(): SelectedOrganizationInfo | null {
    try {
      const stored = localStorage.getItem(this.SELECTED_ORG_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to retrieve selected organization:', error);
      return null;
    }
  }

  /**
   * Get selected organization ID (convenience method)
   */
  getSelectedOrganizationId(): string | null {
    const stored = this.getSelectedOrganization();
    return stored?.organizationId || null;
  }

  /**
   * Clear selected organization from localStorage and signals
   */
  clearSelectedOrganization(): void {
    try {
      localStorage.removeItem(this.SELECTED_ORG_KEY);

      // Update signals
      this.selectedOrganization.set(null);
      this.selectedOrganizationId.set(null);

      console.log('Selected organization cleared');
    } catch (error) {
      console.error('Failed to clear selected organization:', error);
    }
  }

  /**
   * Check if an organization is currently selected
   */
  hasSelectedOrganization(): boolean {
    return this.selectedOrganizationId() !== null;
  }

  /**
   * Check if a specific organization ID matches the selected one
   */
  isOrganizationSelected(organizationId: string): boolean {
    return this.selectedOrganizationId() === organizationId;
  }

  /**
   * Update organization info (e.g., when organization data changes)
   */
  updateSelectedOrganizationInfo(organization: Organization): void {
    const currentSelected = this.getSelectedOrganization();
    if (currentSelected && currentSelected.organizationId === organization.id) {
      this.setSelectedOrganization(organization);
    }
  }
}
