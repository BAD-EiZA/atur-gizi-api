param(
  [string]$EnvFile = ".env",
  [string]$Environment = "production"
)

if (-not (Test-Path $EnvFile)) {
  Write-Error "Missing $EnvFile"
  exit 1
}

$skip = @(
  'PORT'
)

Get-Content $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) { return }
  $idx = $line.IndexOf('=')
  if ($idx -lt 1) { return }
  $key = $line.Substring(0, $idx).Trim()
  $val = $line.Substring($idx + 1).Trim()
  if ($val.StartsWith('"') -and $val.EndsWith('"')) {
    $val = $val.Substring(1, $val.Length - 2)
  }
  if ($skip -contains $key) { return }
  if ([string]::IsNullOrWhiteSpace($val)) {
    Write-Host "skip empty $key"
    return
  }

  Write-Host "Setting $key ($Environment)..."
  $val | vercel env add $key $Environment --force 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    # older CLI may not support --force; try remove+add silently
    vercel env rm $key $Environment -y 2>$null | Out-Null
    $val | vercel env add $key $Environment 2>&1 | Out-Null
  }
}

Write-Host "Done pushing env to $Environment"
