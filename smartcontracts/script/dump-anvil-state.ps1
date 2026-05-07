# Dump Anvil state to a file
# Usage: powershell -ExecutionPolicy Bypass -File script/dump-anvil-state.ps1 [output-file] [rpc-url]
#
# anvil_dumpState returns a 0x-prefixed hex-encoded gzipped JSON blob.
# anvil --load-state expects the decompressed JSON written directly to disk.
param(
    [string]$OutputFile = "anvil-state.json",
    [string]$RpcUrl = "http://127.0.0.1:8545"
)

Write-Host "Dumping Anvil state to $OutputFile..."

$body = '{"jsonrpc":"2.0","method":"anvil_dumpState","params":[],"id":1}'
$response = Invoke-RestMethod -Uri $RpcUrl -Method Post -ContentType "application/json" -Body $body

if ($response.result) {
    # Strip 0x prefix and decode hex -> bytes
    $hex = $response.result -replace '^0x', ''
    $bytes = [byte[]] ($hex -split '(.{2})' | Where-Object { $_ } | ForEach-Object { [Convert]::ToByte($_, 16) })

    # Decompress gzip
    $inputStream  = New-Object System.IO.MemoryStream(,$bytes)
    $gzipStream   = New-Object System.IO.Compression.GZipStream($inputStream, [System.IO.Compression.CompressionMode]::Decompress)
    $outputStream = New-Object System.IO.MemoryStream
    $gzipStream.CopyTo($outputStream)
    $gzipStream.Close()
    $json = [System.Text.Encoding]::UTF8.GetString($outputStream.ToArray())

    # Write decompressed JSON to file
    $outPath = Join-Path $PWD $OutputFile
    [System.IO.File]::WriteAllText($outPath, $json)
    Write-Host "State saved to $OutputFile ($(((Get-Item $outPath).Length / 1KB).ToString('N1')) KB)"
} else {
    Write-Host "ERROR: No state returned from Anvil" -ForegroundColor Red
    exit 1
}

