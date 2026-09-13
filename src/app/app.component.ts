import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { ToastContainerComponent } from './shared/toast-container.component';
import { LightboxComponent } from './shared/lightbox.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent, LightboxComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  /** Se inyecta acá (no solo en el shell) para que el modo oscuro ya esté aplicado en el login. */
  private readonly theme = inject(ThemeService);
}
