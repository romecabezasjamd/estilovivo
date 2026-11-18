# Configura las copias de seguridad diarias de Estilo Vivo en este ordenador:
#   1. Te pregunta en qué carpeta guardarlas (mejor dentro de OneDrive o Google Drive).
#   2. Te pide el BACKUP_TOKEN (el mismo que pusiste en Coolify) y lo guarda cifrado con tu usuario de Windows.
#   3. Crea una tarea diaria en el Programador de tareas.
#   4. Hace una primera copia para comprobar que todo funciona.
# Puedes volver a ejecutarlo cuando quieras para cambiar la carpeta, la hora o el token.
$ErrorActionPreference = 'Stop'
$ConfigDir = Join-Path $env:LOCALAPPDATA 'EstiloVivo'
$ConfigFile = Join-Path $ConfigDir 'copias.json'
$TokenFile = Join-Path $ConfigDir 'token.xml'
$Script = Join-Path $ConfigDir 'descargar-copia.ps1'
$Origen = Join-Path $PSScriptRoot 'descargar-copia.ps1'
$NombreTarea = 'Estilo Vivo - copia de seguridad diaria'

Write-Host ''
Write-Host '=== Copias de seguridad de Estilo Vivo ===' -ForegroundColor Cyan
Write-Host ''
if (-not (Test-Path $ConfigDir)) { New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null }

$anterior = $null
if (Test-Path $ConfigFile) { try { $anterior = Get-Content $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch { } }

# ---------- 1. Carpeta ----------
$sugerida = if ($anterior -and $anterior.destino) { $anterior.destino }
            elseif ($env:OneDrive) { Join-Path $env:OneDrive 'Copias Estilo Vivo' }
            else { Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Copias Estilo Vivo' }
Write-Host '1) Carpeta donde guardar las copias.'
Write-Host '   Mejor una carpeta de OneDrive o Google Drive, para que también estén en la nube.'
$destino = Read-Host "   Escribe la carpeta o pulsa Intro para usar [$sugerida]"
if ([string]::IsNullOrWhiteSpace($destino)) { $destino = $sugerida }
$destino = $destino.Trim('"', ' ')
New-Item -ItemType Directory -Path $destino -Force | Out-Null
Write-Host "   OK: $destino" -ForegroundColor Green
Write-Host ''

# ---------- Dirección del servidor ----------
$url = if ($anterior -and $anterior.url) { $anterior.url } else { 'https://estilovivo.xyoncloud.win/api/admin/backup' }
$otra = Read-Host "   Dirección del servidor: pulsa Intro para usar [$url] o escribe otra"
if (-not [string]::IsNullOrWhiteSpace($otra)) { $url = $otra.Trim() }

# ---------- 2. Token ----------
Write-Host ''
Write-Host '2) Token de las copias (BACKUP_TOKEN de Coolify). No se verá al escribirlo.'
if (Test-Path $TokenFile) { Write-Host '   Ya hay uno guardado: pulsa Intro sin escribir nada para mantenerlo.' }
$seguro = Read-Host '   BACKUP_TOKEN' -AsSecureString
if ($seguro.Length -gt 0) {
  $seguro | Export-Clixml -Path $TokenFile
  Write-Host '   OK: guardado cifrado (solo tu usuario de Windows puede leerlo).' -ForegroundColor Green
} elseif (-not (Test-Path $TokenFile)) {
  Write-Host '   No has escrito ningún token. Vuelve a ejecutar esto cuando lo tengas.' -ForegroundColor Red
  Read-Host 'Pulsa Intro para salir'
  exit 1
}

# ---------- Guardar configuración y script ----------
$json = @{ destino = $destino; url = $url } | ConvertTo-Json
[System.IO.File]::WriteAllText($ConfigFile, $json, (New-Object System.Text.UTF8Encoding($true)))
Copy-Item -Path $Origen -Destination $Script -Force

# ---------- 3. Tarea diaria ----------
Write-Host ''
$hora = Read-Host '3) ¿A qué hora cada día? Pulsa Intro para las 14:00 (si el ordenador está apagado, se hace al encenderlo)'
if ([string]::IsNullOrWhiteSpace($hora)) { $hora = '14:00' }
$accion = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Script`""
$disparador = New-ScheduledTaskTrigger -Daily -At $hora
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName $NombreTarea -Action $accion -Trigger $disparador -Settings $ajustes -Description 'Descarga una copia cifrada de Estilo Vivo y conserva las 30 últimas.' -Force | Out-Null
Write-Host "   OK: tarea '$NombreTarea' programada cada día a las $hora." -ForegroundColor Green

# ---------- 4. Primera copia ----------
Write-Host ''
Write-Host '4) Haciendo una primera copia para comprobar que todo funciona...'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Script
if ($LASTEXITCODE -eq 0) {
  Write-Host ''
  Write-Host "LISTO. La copia está en $destino" -ForegroundColor Green
  Write-Host 'A partir de ahora se hará sola cada día.'
} else {
  Write-Host ''
  Write-Host 'La primera copia ha fallado: lee el motivo de arriba. La tarea diaria queda programada igualmente.' -ForegroundColor Red
}
Write-Host ''
Read-Host 'Pulsa Intro para cerrar'
