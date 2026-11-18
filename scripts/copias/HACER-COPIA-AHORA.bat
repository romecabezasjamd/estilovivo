@echo off
rem Doble clic para hacer una copia de seguridad de Estilo Vivo ahora mismo (antes hay que usar PROGRAMAR-COPIAS.bat una vez).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\EstiloVivo\descargar-copia.ps1"
pause
