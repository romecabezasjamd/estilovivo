# Descarga una copia de seguridad cifrada de Estilo Vivo y la guarda con la fecha en tu carpeta de copias.
# Conserva las 30 más recientes y avisa si algo falla. Lo ejecuta cada día el Programador de tareas
# (ver programar-copias.ps1). También puedes ejecutarlo a mano cuando quieras.
#
# Configuración (la crea programar-copias.ps1, NO está en el repositorio):
#   %LOCALAPPDATA%\EstiloVivo\copias.json   carpeta de destino y dirección del servidor
#   %LOCALAPPDATA%\EstiloVivo\token.xml     el BACKUP_TOKEN, cifrado con tu usuario de Windows (solo tú puedes leerlo)
param(
  [string]$Destino,
  [string]$Url,
  [int]$Conservar = 30,
  [string]$ArchivoToken  # solo para pruebas: otro archivo de token
)

$ErrorActionPreference = 'Stop'
$ConfigDir = Join-Path $env:LOCALAPPDATA 'EstiloVivo'
$ConfigFile = Join-Path $ConfigDir 'copias.json'
$TokenFile = if ($ArchivoToken) { $ArchivoToken } else { Join-Path $ConfigDir 'token.xml' }
$LogFile = Join-Path $ConfigDir 'copias.log'
$UrlPorDefecto = 'https://estilovivo.xyoncloud.win/api/admin/backup'

function Escribir-Log([string]$texto) {
  $linea = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $texto
  Write-Host $linea
  try {
    if (-not (Test-Path $ConfigDir)) { New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null }
    Add-Content -Path $LogFile -Value $linea -Encoding UTF8
  } catch { }
}

function Avisar([string]$titulo, [string]$texto, [bool]$esError) {
  # Aviso en la esquina de la pantalla (funciona también cuando lo lanza el Programador de tareas)
  try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $n = New-Object System.Windows.Forms.NotifyIcon
    $n.Icon = if ($esError) { [System.Drawing.SystemIcons]::Error } else { [System.Drawing.SystemIcons]::Information }
    $n.BalloonTipIcon = if ($esError) { 'Error' } else { 'Info' }
    $n.BalloonTipTitle = $titulo
    $n.BalloonTipText = $texto
    $n.Visible = $true
    $n.ShowBalloonTip(15000)
    Start-Sleep -Seconds 8
    $n.Dispose()
  } catch { }
}

function Fallo([string]$motivo) {
  Escribir-Log "ERROR: $motivo"
  if ($script:Carpeta -and (Test-Path $script:Carpeta)) {
    $aviso = Join-Path $script:Carpeta 'ULTIMA-COPIA-FALLO.txt'
    $texto = "La copia de seguridad de Estilo Vivo del $(Get-Date -Format 'dd/MM/yyyy HH:mm') ha fallado.`r`n`r`nMotivo: $motivo`r`n`r`nMás detalles en: $LogFile`r`nCuando una copia salga bien, este aviso se borra solo."
    try { [System.IO.File]::WriteAllText($aviso, $texto, (New-Object System.Text.UTF8Encoding($true))) } catch { }
  }
  Avisar 'Estilo Vivo: la copia ha FALLADO' $motivo $true
  exit 1
}

# ---------- Configuración ----------
$config = $null
if (Test-Path $ConfigFile) {
  try { $config = Get-Content $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch { }
}
if (-not $Destino -and $config) { $Destino = $config.destino }
if (-not $Url -and $config -and $config.url) { $Url = $config.url }
if (-not $Url) { $Url = $UrlPorDefecto }
$script:Carpeta = $Destino
if (-not $Destino) { Fallo 'No sé dónde guardar las copias. Ejecuta primero PROGRAMAR-COPIAS.bat.' }
if (-not (Test-Path $Destino)) {
  try { New-Item -ItemType Directory -Path $Destino -Force | Out-Null } catch { Fallo "No se puede crear la carpeta $Destino" }
}
if (-not (Test-Path $TokenFile)) { Fallo 'Falta el token de las copias. Ejecuta primero PROGRAMAR-COPIAS.bat.' }

try {
  $seguro = Import-Clixml -Path $TokenFile
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
} catch {
  Fallo 'No se puede leer el token guardado. Vuelve a ejecutar PROGRAMAR-COPIAS.bat.'
}

# ---------- Descarga ----------
Add-Type -AssemblyName System.Net.Http
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$nombre = 'estilovivo-copia-{0}.evbk' -f (Get-Date -Format 'yyyyMMdd-HHmmss')
$final = Join-Path $Destino $nombre
$parcial = "$final.descargando"
Escribir-Log "Descargando copia de $Url ..."

$cliente = New-Object System.Net.Http.HttpClient
$cliente.Timeout = [TimeSpan]::FromMinutes(60)
$cliente.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue('Bearer', $token)
$token = $null
try {
  $respuesta = $cliente.GetAsync($Url, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
  $codigo = [int]$respuesta.StatusCode
  if ($codigo -ne 200) {
    $motivo = switch ($codigo) {
      401 { 'El servidor no acepta el token (401). Comprueba que BACKUP_TOKEN en Coolify es el mismo que escribiste.' }
      404 { 'Las copias no están activadas en el servidor (404): faltan BACKUP_TOKEN o BACKUP_PASSWORD en Coolify, o no se ha desplegado.' }
      429 { 'Demasiadas copias seguidas (429). Prueba dentro de una hora.' }
      default { "El servidor respondió con el código $codigo." }
    }
    Fallo $motivo
  }
  $entrada = $respuesta.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
  $salida = [System.IO.File]::Create($parcial)
  try { $entrada.CopyTo($salida) } finally { $salida.Dispose(); $entrada.Dispose() }
} catch {
  if (Test-Path $parcial) { Remove-Item $parcial -Force -ErrorAction SilentlyContinue }
  Fallo "No se pudo descargar: $($_.Exception.GetBaseException().Message)"
} finally {
  $cliente.Dispose()
}

# ---------- Comprobación ----------
$tamano = (Get-Item $parcial).Length
$cabecera = New-Object byte[] 6
$fs = [System.IO.File]::OpenRead($parcial)
try { [void]$fs.Read($cabecera, 0, 6) } finally { $fs.Dispose() }
if ($tamano -lt 1024 -or [System.Text.Encoding]::ASCII.GetString($cabecera) -ne "EVBK1`n") {
  Remove-Item $parcial -Force -ErrorAction SilentlyContinue
  Fallo "El archivo descargado no es una copia válida ($tamano bytes)."
}
Move-Item -Path $parcial -Destination $final -Force
$mb = [math]::Round($tamano / 1MB, 1)
Escribir-Log "Copia guardada: $final ($mb MB)"

# ---------- Conservar solo las más recientes ----------
$copias = Get-ChildItem -Path $Destino -Filter 'estilovivo-copia-*.evbk' | Sort-Object Name -Descending
if ($copias.Count -gt $Conservar) {
  foreach ($vieja in ($copias | Select-Object -Skip $Conservar)) {
    Remove-Item $vieja.FullName -Force
    Escribir-Log "Borrada copia antigua: $($vieja.Name)"
  }
}
Get-ChildItem -Path $Destino -Filter '*.descargando' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
$aviso = Join-Path $Destino 'ULTIMA-COPIA-FALLO.txt'
if (Test-Path $aviso) { Remove-Item $aviso -Force -ErrorAction SilentlyContinue }
exit 0
