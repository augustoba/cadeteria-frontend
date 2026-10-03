import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
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

  constructor() {
    const router = inject(Router);
    this.theme.enRuta(location.pathname);
    router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.theme.enRuta(e.urlAfterRedirects);
    });
  }
}
