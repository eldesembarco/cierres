# Arranca el bridge WhatsApp (whatsapp-mcp-vgp) con webhook hacia n8n.
# Corre como tarea programada "WhatsAppBridge" al logon. Loop de reinicio ante caidas.

$env:WEBHOOK_URL = "https://n8n.srv1312396.hstgr.cloud/webhook/wa-requerimientos"
$env:FORWARD_SELF = "true"   # los mensajes propios (Pablo) tambien disparan tickets con #req
$env:WHATSAPP_BRIDGE_PORT = "8080"

$bridgeDir = "C:\Users\ferra\dev\whatsapp-mcp-vgp\whatsapp-bridge"
$logFile = "C:\Users\ferra\Servicios\wa-requerimientos\bridge\bridge.log"

# Rotacion simple: si el log pasa 10 MB, se archiva uno y se empieza de nuevo
if ((Test-Path $logFile) -and ((Get-Item $logFile).Length -gt 10MB)) {
    Move-Item $logFile "$logFile.old" -Force
}

Set-Location $bridgeDir
while ($true) {
    "=== bridge start $(Get-Date -Format o) ===" | Add-Content $logFile
    # cmd /c con redireccion cruda: el log queda UTF-8 legible (PowerShell lo re-encodea mal)
    & cmd /c ".\whatsapp-bridge.exe >> `"$logFile`" 2>&1"
    "=== bridge exited $(Get-Date -Format o) - reinicio en 10s ===" | Add-Content $logFile
    Start-Sleep -Seconds 10
}
