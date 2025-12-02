/**
 * Project ID management utility
 * Provides consistent project ID storage and retrieval across the application
 */

export class ProjectManager {
  private static readonly PROJECT_ID_KEY = 'aibase_current_project';

  /**
   * Get the current project ID from localStorage
   * Returns null if no project is set
   */
  static getCurrentProjectId(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    return localStorage.getItem(this.PROJECT_ID_KEY);
  }

  /**
   * Set the current project ID
   */
  static setCurrentProjectId(projectId: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.PROJECT_ID_KEY, projectId);
      // Dispatch custom event for cross-component synchronization
      window.dispatchEvent(new CustomEvent('projectChanged', { detail: { projectId } }));
    }
  }

  /**
   * Check if a project ID is set
   */
  static hasProjectId(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return !!localStorage.getItem(this.PROJECT_ID_KEY);
  }

  /**
   * Clear the stored project ID
   */
  static clearProjectId(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.PROJECT_ID_KEY);
      window.dispatchEvent(new CustomEvent('projectChanged', { detail: { projectId: null } }));
    }
  }
}
