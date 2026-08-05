export function reauthenticationErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as {code?: unknown}).code ?? '')
      : '';
  if (['auth/wrong-password', 'auth/invalid-credential'].includes(code)) {
    return 'La contraseña es incorrecta. Verifícala e inténtalo de nuevo.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Se bloquearon temporalmente los intentos. Espera unos minutos e inténtalo de nuevo.';
  }
  if (['auth/user-token-expired', 'auth/user-disabled'].includes(code)) {
    return 'Tu sesión ya no es válida. Inicia sesión nuevamente para conservar la seguridad.';
  }
  if (code === 'auth/network-request-failed') {
    return 'No fue posible contactar el servicio de acceso. Revisa tu conexión e inténtalo de nuevo.';
  }
  return 'No fue posible confirmar tu identidad. Inténtalo de nuevo o inicia sesión nuevamente.';
}

export function supportsPasswordReauthentication(providerIds: string[]): boolean {
  return providerIds.includes('password');
}
