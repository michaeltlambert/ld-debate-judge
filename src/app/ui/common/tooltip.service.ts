import { Injectable, signal } from '@angular/core';
import { DEBATE_TERMS } from '../../core/glossary.data';

@Injectable({ providedIn: 'root' })
export class TooltipService {
  text = signal<string>('');
  isVisible = signal<boolean>(false);
  coords = signal<{ x: number, y: number }>({ x: 0, y: 0 });

  show(lookupKey: string, rect: DOMRect) {
    const definition = DEBATE_TERMS[lookupKey] || DEBATE_TERMS[lookupKey.trim()] || 'Definition not found.';
    this.text.set(definition);
    this.coords.set({
      x: rect.left + (rect.width / 2),
      y: rect.bottom + 8 
    });
    this.isVisible.set(true);
  }

  hide() {
    this.isVisible.set(false);
  }
}