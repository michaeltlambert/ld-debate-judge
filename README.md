DebateMate: Lincoln-Douglas Adjudication System

📘 Project Overview

DebateMate is a single-page Angular application designed to help judges score Lincoln-Douglas (LD) debates. It combines a high-precision timer, a complex "flowing" (note-taking) system, and an automated ballot that exports to PDF.

Tech Stack

Framework: Angular v21 (Standalone Components)

State Management: Angular Signals (No NgRx or RxJS subscriptions needed)

Styling: Tailwind CSS v4 (Using the new OKLCH color space)

Export Engine: html-to-image + jspdf

🏗 Architectural Breakdown

1. State Management (The "Heartbeat")

We use Angular Signals for reactive state. This is a departure from older Angular (RxJS/Observables).

Source of Truth: Data lives in Services (debate.service.ts, tooltip.service.ts).

Reactivity: Components inject these services and read signals (e.g., debate.timer()). When a signal updates, the UI updates automatically with fine-grained reactivity.

Persistence: We use effect() in flow.component.ts. This acts like a "side effect" watcher—whenever the arguments signal changes, it automatically saves to localStorage.

2. The "Portal" Pattern (Tooltips)

Problem: Displaying a tooltip inside a scrolling element (overflow: auto) often causes the tooltip to be clipped or hidden.
Solution:

Trigger: TermComponent (the word) detects the mouse hover and calculates screen coordinates (getBoundingClientRect).

Service: TooltipService receives these coordinates.

Display: GlobalTooltipComponent sits at the very root of AppComponent. It reads the coordinates from the service and renders the tooltip "floating" above the entire app. This bypasses all CSS stacking contexts.

3. PDF Export Strategy

We use html-to-image instead of html2canvas.

Why? Tailwind v4 uses modern CSS features (like oklch colors) that older libraries cannot parse. html-to-image serializes the DOM more accurately.

The Trick: Before taking the snapshot, we temporarily set overflow: visible on the flow sheet. This forces the browser to render the entire list of arguments (even the ones scrolled out of view) so they appear in the PDF.

📂 Folder Structure

src/app/
├── services/
│   ├── debate.service.ts       # Manages the 3 clocks (Speech, Aff Prep, Neg Prep)
│   ├── pdf.service.ts          # Handles DOM-to-Image conversion and PDF generation
│   └── tooltip.service.ts      # Global coordinate system for the floating definitions
├── components/
│   ├── timer.component.ts      # The sticky header with clocks
│   ├── flow.component.ts       # The complex grid for note-taking (Drag/Drop logic logic)
│   ├── ballot.component.ts     # Scoring form with validation (30pt max)
│   ├── term.component.ts       # The text trigger (underline)
│   └── global-tooltip.ts       # The actual popup box
├── data/
│   └── glossary.data.ts        # Static dictionary of debate terms
└── main.ts                     # Bootstraps the application


🚀 How to Run

Install: npm install

Run: npm start

Build: npm run build

👨‍💻 For Junior Developers: Tasks to Try

Add a "Reset Round" button: Clear localStorage and reset all timers in DebateService.

Theme Switcher: Use Tailwind's dark: modifier to add a Dark Mode.

Undo/Redo: Implement a history stack in FlowComponent to undo deleted arguments.