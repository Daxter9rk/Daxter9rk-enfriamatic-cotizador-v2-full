$ErrorActionPreference = 'Stop'
$reviewBytes = New-Object byte[] 24
$reviewGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
$reviewGenerator.GetBytes($reviewBytes)
$reviewGenerator.Dispose()
$reviewPassword = [Convert]::ToBase64String($reviewBytes)

$env:REVIEW_ADMIN_EMAIL = 'review-promoted-admin@enfriamatic.local'
$env:REVIEW_ADMIN_PASSWORD = $reviewPassword
$env:REVIEW_OPERATOR_EMAIL = 'review-operator@enfriamatic.local'
$env:REVIEW_OPERATOR_PASSWORD = $reviewPassword
$env:REVIEW_INACTIVE_EMAIL = 'review-inactive@enfriamatic.local'
$env:REVIEW_INACTIVE_PASSWORD = $reviewPassword
$env:REVIEW_NO_PROFILE_EMAIL = 'review-no-profile@enfriamatic.local'
$env:REVIEW_NO_PROFILE_PASSWORD = $reviewPassword

foreach ($reviewAction in @('provision', 'disable', 'restore', 'cleanup')) {
  & npm.cmd run review-users:dev -- --target=emulator "--action=$reviewAction"
  if ($LASTEXITCODE -ne 0) {
    throw "Falló el ciclo seguro de usuarios DEV en la acción $reviewAction."
  }
}

Write-Output 'Ciclo de usuarios de revisión completado en Emulator Suite.'
