import { Component, inject, signal } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { ModoInvitado } from '../../../core/services/modo-invitado';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private authService = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private modoInvitado = inject(ModoInvitado);

  // A dónde volver después de ingresar: la pantalla de butacas manda al
  // login con ?volver=/pelicula/... para que el usuario no pierda la
  // función que estaba eligiendo. Sólo se aceptan rutas internas de la app
  // ('/algo', nunca '//otro-sitio.com' ni 'https://...'), así nadie puede
  // armar un link de login que redirija a una página externa.
  private destino(): string {
    const volver = this.route.snapshot.queryParamMap.get('volver');
    return volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : '/';
  }

  protected error = signal<string | null>(null);
  protected mostrarPassword = signal(false);

  protected formulario = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected togglePassword(): void {
    this.mostrarPassword.update((valor) => !valor);
  }

  protected async login() {
    this.error.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { email, password } = this.formulario.getRawValue();

    try {
      await this.authService.login(email, password);
      this.router.navigateByUrl(this.destino());
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  // Comprar sin cuenta (la consigna lo permite) es una opción que se
  // elige acá o en la pantalla de butacas.
  protected continuarComoInvitado() {
    this.modoInvitado.activar();
    this.router.navigateByUrl(this.destino());
  }

  // Acceso rápido para la corrección del TP: completa el formulario con la
  // cuenta de administrador de prueba e ingresa directamente.
  protected entrarComoAdmin() {
    this.formulario.setValue({ email: 'admin@gmail.com', password: '123456' });
    this.login();
  }

  protected async loginConGoogle() {
    this.error.set(null);
    try {
      await this.authService.loginConGoogle();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }
}