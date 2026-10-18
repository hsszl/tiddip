$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$gameRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dist = Join-Path $gameRoot 'dist'
$output = Join-Path $dist 'tiddip-gaogame.zip'
$pending = Join-Path $dist 'tiddip-gaogame.pending.zip'
$files = @('app.cjs', 'package.json', 'rules.js', 'range.js')

# Only these two source directories belong in a release. Reject symlinks and
# unexpected files rather than silently publishing private or generated files.
foreach ($folder in @('client', 'server')) {
    $directory = Join-Path $gameRoot $folder
    $entries = @(Get-Item -LiteralPath $directory) + @(Get-ChildItem -LiteralPath $directory -Recurse -Force)
    foreach ($entry in $entries) {
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Symlinks are not allowed in the upload package: $($entry.FullName)"
        }
        if ($entry.PSIsContainer) { continue }
        $relative = $entry.FullName.Substring($gameRoot.Length + 1).Replace('\', '/')
        if ($relative -match '(^|/)\.' -or $relative -match '\.test\.js$' -or
            $entry.Extension -notin @('.js', '.html', '.css', '.svg')) {
            throw "Unexpected runtime file: $relative"
        }
        $files += $relative
    }
}

New-Item -ItemType Directory -Path $dist -Force | Out-Null
foreach ($path in @($dist, $output, $pending)) {
    if ((Test-Path -LiteralPath $path) -and
        ((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Output path cannot be a symlink: $path"
    }
}
$stream = [IO.File]::Open($pending, [IO.FileMode]::Create)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($relative in ($files | Sort-Object)) {
        $source = Join-Path $gameRoot $relative
        if ($relative -eq 'package.json') {
            # Development commands refer to directories intentionally omitted.
            $package = Get-Content -LiteralPath $source -Raw | ConvertFrom-Json
            $package.scripts = [pscustomobject]@{ start = 'node app.cjs' }
            $entry = $archive.CreateEntry($relative)
            $writer = [IO.StreamWriter]::new($entry.Open(), [Text.UTF8Encoding]::new($false))
            try { $writer.Write(($package | ConvertTo-Json -Depth 10)) }
            finally { $writer.Dispose() }
        } else {
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive, $source, $relative, [IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
    }
} finally {
    $archive.Dispose()
}

# Replace only the generated archive, never source files or private data.
Move-Item -LiteralPath $pending -Destination $output -Force
Write-Output "Upload: $output ($($files.Count) files)"
