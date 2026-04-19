<#
.SYNOPSIS
    StreamVault Backup Monitor — Watch live backup progress from your Windows PC.

.DESCRIPTION
    Connects to your StreamVault server via WebSocket and streams
    backup/restore progress in real-time to your terminal.

.USAGE
    .\monitor.ps1 -Server "api.streamvault.ca"
    .\monitor.ps1 -Server "192.168.1.50:8001"

.NOTES
    Requires PowerShell 5.1+ (built into Windows 11)
    Press Ctrl+C to stop monitoring.
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Server
)

# Build WebSocket URL
if ($Server -match "^https://") {
    $wsUrl = $Server -replace "^https://", "wss://"
} elseif ($Server -match "^http://") {
    $wsUrl = $Server -replace "^http://", "ws://"
} elseif ($Server -match ":\d+$") {
    $wsUrl = "ws://$Server"
} else {
    $wsUrl = "wss://$Server"
}
$wsUrl = "$wsUrl/api/backup/ws/logs"

Write-Host ""
Write-Host "  StreamVault Backup Monitor" -ForegroundColor Cyan
Write-Host "  Connecting to $wsUrl" -ForegroundColor DarkGray
Write-Host "  Press Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host "  ─────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

try {
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = New-Object System.Threading.CancellationToken($false)

    $connectTask = $ws.ConnectAsync([Uri]$wsUrl, $ct)
    $connectTask.Wait()

    if ($ws.State -ne 'Open') {
        Write-Host "  ERROR: Could not connect to server" -ForegroundColor Red
        exit 1
    }

    Write-Host "  Connected! Waiting for backup activity..." -ForegroundColor Green
    Write-Host ""

    $buffer = New-Object byte[] 4096

    while ($ws.State -eq 'Open') {
        $segment = New-Object System.ArraySegment[byte] -ArgumentList @(,$buffer)
        $receiveTask = $ws.ReceiveAsync($segment, $ct)
        $receiveTask.Wait()

        if ($receiveTask.Result.MessageType -eq 'Close') {
            break
        }

        $msg = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $receiveTask.Result.Count)

        # Color-code output
        if ($msg -match "ERROR") {
            Write-Host "  $msg" -ForegroundColor Red
        } elseif ($msg -match "WARNING") {
            Write-Host "  $msg" -ForegroundColor Yellow
        } elseif ($msg -match "complete|success|finished") {
            Write-Host "  $msg" -ForegroundColor Green
        } elseif ($msg -match "Starting|Dumping|Copying|Compressing|Uploading|Downloading|Extracting|Restoring") {
            Write-Host "  $msg" -ForegroundColor Cyan
        } else {
            Write-Host "  $msg" -ForegroundColor Gray
        }
    }
} catch {
    if ($_.Exception.Message -match "canceled|aborted") {
        Write-Host ""
        Write-Host "  Monitoring stopped." -ForegroundColor DarkGray
    } else {
        Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
} finally {
    if ($ws -and $ws.State -eq 'Open') {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "", $ct).Wait()
    }
    if ($ws) { $ws.Dispose() }
}

Write-Host ""
