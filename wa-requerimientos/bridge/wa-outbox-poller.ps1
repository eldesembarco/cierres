# Poller de la cola de salida WhatsApp (n8n Data Table wa_outbox -> bridge local /api/send).
# Corre como tarea programada "WhatsAppOutbox". Append-only + puntero local de ultimo id.

$n8nKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiNjBkNWU1YS1lYjNmLTQ4ZTItYTZlOC1iYzUyMTUzZTFhYzMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZDFhY2E0YWYtYjExMS00ZmU2LTlkZTItZmIyNWE3ODk1ZDRkIiwiaWF0IjoxNzc2OTUwMjc3fQ.K3a87ubNNw-N_ri3Q7mnYgDD2etP2l9OyoMA9Ut3L5Y"
$rowsUrl = "https://n8n.srv1312396.hstgr.cloud/api/v1/data-tables/W7rPitDcioXfqBfb/rows"
$bridgeToken = (Get-Content "C:\Users\ferra\dev\whatsapp-mcp-vgp\whatsapp-bridge\store\.bridge-token" -Raw).Trim()
$stateFile = "C:\Users\ferra\Servicios\wa-requerimientos\bridge\outbox-lastid.txt"
$logFile = "C:\Users\ferra\Servicios\wa-requerimientos\bridge\outbox.log"

function Log($m) { "$(Get-Date -Format o) $m" | Add-Content $logFile }

if ((Test-Path $logFile) -and ((Get-Item $logFile).Length -gt 5MB)) { Move-Item $logFile "$logFile.old" -Force }

# Puntero inicial: si no hay estado, arrancar desde el max id actual (no reenviar historia)
if (Test-Path $stateFile) {
    $lastId = [int](Get-Content $stateFile -Raw).Trim()
} else {
    $lastId = 0
    try {
        $all = Invoke-RestMethod -Uri $rowsUrl -Headers @{ 'X-N8N-API-KEY' = $n8nKey } -TimeoutSec 20
        foreach ($r in $all.data) { if ($r.id -gt $lastId) { $lastId = $r.id } }
    } catch { Log "WARN init: $($_.Exception.Message)" }
    Set-Content $stateFile $lastId
}
Log "poller start lastId=$lastId"

while ($true) {
    try {
        $filter = [uri]::EscapeDataString('{"type":"and","filters":[{"columnName":"id","condition":"gt","value":' + $lastId + '}]}')
        $resp = Invoke-RestMethod -Uri "$rowsUrl`?filter=$filter" -Headers @{ 'X-N8N-API-KEY' = $n8nKey } -TimeoutSec 20
        foreach ($row in ($resp.data | Sort-Object id)) {
            $body = @{ recipient = $row.recipient; message = $row.message }
            if ($row.quoted_message_id) {
                $body.quoted_message_id = $row.quoted_message_id
                $body.quoted_sender_jid = $row.quoted_sender_jid
                $body.quoted_content = $row.quoted_content
            }
            # ConvertTo-Json escapa no-ASCII como \uXXXX -> seguro para emojis
            $bytes = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress))
            try {
                $r2 = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/send" -Method Post `
                    -Headers @{ Authorization = "Bearer $bridgeToken" } `
                    -ContentType "application/json; charset=utf-8" -Body $bytes -TimeoutSec 30
                Log "sent id=$($row.id) to=$($row.recipient) ok=$($r2.success)"
            } catch {
                Log "ERROR send id=$($row.id): $($_.Exception.Message)"
            }
            # avanza siempre (un mensaje con error no debe frenar la cola)
            $lastId = $row.id
            Set-Content $stateFile $lastId
        }
    } catch {
        Log "ERROR poll: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds 5
}
