import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';

(window as any).global = window;

bootstrapApplication(AppComponent)
  .catch((err) => console.error(err));
