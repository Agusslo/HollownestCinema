import { Component, inject, signal } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private authService = inject(Auth);
  private router = inject(Router);

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
      this.router.navigateByUrl('/');
    } catch (e) {
      this.error.set((e as Error).message);
    }
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
