import { Component, Input } from "@angular/core";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
@Component({
  selector: "app-loading",
  standalone: true,
  imports: [MatProgressSpinnerModule],
  template:
    '<div class="loading" role="status"><mat-spinner diameter="18" /> <span>{{label}}</span></div>',
})
export class LoadingComponent {
  @Input() label = "Working…";
}
