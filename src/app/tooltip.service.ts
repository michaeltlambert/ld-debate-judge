import { Injectable, signal } from '@angular/core';
import { DEBATE_TERMS } from './glossary.data';

/**
 * Service Pattern: "The Portal"
 * This service allows deeply nested components (like a word inside the Flow Sheet)
 * to communicate with the root component (GlobalTooltipComponent).
 */
@Injectable({ providedIn: 'root' })
export class TooltipService {
  
  // The content to display
  text = signal<string>('');
  
  // Visibility state
  isVisible = signal<boolean>(false);
  
  // Screen coordinates (X/Y) relative to the viewport
  coords = signal<{ x: number, y: number }>({ x: 0, y: 0 });

  /**
   * Called by TermComponent on mouseenter.
   * @param lookupKey - The dictionary key (e.g., "Value Criterion")
   * @param rect - The bounding box of the word element
   */
  show(lookupKey: string, rect: DOMRect) {
    // Fuzzy matching: try exact key, then trimmed key
    const definition = DEBATE_TERMS[lookupKey] || DEBATE_TERMS[lookupKey.trim()] || 'Definition not found.';
    
    this.text.set(definition);
    
    // Position logic: Center the tooltip horizontally under the word
    this.coords.set({
      x: rect.left + (rect.width / 2),
      y: rect.bottom + 8 // Add 8px padding so it doesn't overlap the word
    });
    
    this.isVisible.set(true);
  }

  hide() {
    this.isVisible.set(false);
  }
}