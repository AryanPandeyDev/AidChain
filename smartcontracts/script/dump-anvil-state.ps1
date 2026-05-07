# Dump Anvil state to a file
# Usage: powershell -ExecutionPolicy Bypass -File script/dump-anvil-state.ps1 [output-file] [rpc-url]
param(
    [string]$OutputFile = "anvil-state.json",
    [string]$RpcUrl = "http://127.0.0.1:8545"
)

Write-Host "Dumping Anvil state to $OutputFile..."

$body = '{"jsonrpc":"2.0","method":"anvil_dumpState","params":[],"id":1}'
$response = Invoke-RestMethod -Uri $RpcUrl -Method Post -ContentType "application/json" -Body $body

if ($response.result) {
    [System.IO.File]::WriteAllText(
        (Join-Path $PWD $OutputFile),
        $response.result
    )
    Write-Host "State saved to $OutputFile ($(((Get-Item $OutputFile).Length / 1KB).ToString('N1')) KB)"
} else {
    Write-Host "ERROR: No state returned from Anvil" -ForegroundColor Red
    exit 1
}
