import "zone.js";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideHttpClient } from "@angular/common/http";
import { provideRouter, RouterOutlet } from "@angular/router";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { Component } from "@angular/core";
import { WorkspaceComponent } from "./workspace.js";
@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet],
  template: "<router-outlet />",
})
class AppComponent {}
bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),
    provideAnimationsAsync(),
    provideRouter([
      { path: "", component: WorkspaceComponent },
      { path: "**", redirectTo: "" },
    ]),
  ],
}).catch(console.error);
