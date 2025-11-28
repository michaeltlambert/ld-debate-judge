import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

// Needed for some older jspdf versions, though strict mode handles it mostly.
(window as any).global = window;

bootstrapApplication(AppComponent)
  .catch((err) => console.error(err));