import { Component, Input } from "@angular/core";
import { Source } from "./services.js";
import { MatExpansionModule } from "@angular/material/expansion";
@Component({
  selector: "app-source-references",
  standalone: true,
  imports: [MatExpansionModule],
  template: ` @if (sources.length) {
    <div class="references">
      <h3>Source references</h3>
      <mat-accordion multi>
        @for (source of sources; track source.id) {
          <mat-expansion-panel
            ><mat-expansion-panel-header
              ><mat-panel-title
                >[{{ source.id }}] Page {{ source.page }}</mat-panel-title
              ><mat-panel-description>{{
                source.heading
              }}</mat-panel-description></mat-expansion-panel-header
            ><small>{{ source.filename }}</small>
            <p class="clause">{{ source.excerpt }}</p></mat-expansion-panel
          >
        }
      </mat-accordion>
    </div>
  }`,
})
export class SourceReferencesComponent {
  @Input() sources: Source[] = [];
}
