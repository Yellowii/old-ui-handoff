param([Parameter(Mandatory=$true)][string]$PackageRoot, [Parameter(Mandatory=$true)][string]$ZipPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = (Resolve-Path $PackageRoot).Path
if (Test-Path $ZipPath) { throw "Archive already exists: $ZipPath" }
$forbidden = '(?i)(^|/)(node_modules|dist|public|dist-ui|build-output|asset-cache|cache|history|reports)(/|$)|^Assets(/|$)|\.(glb|gltf|bin|tga|ktx2?|dds|apk|npk|ppk|wppk|png|jpe?g|webp|gif|bmp|ogg|mp3|wav|mp4|webm)$'
$files = @(Get-ChildItem -LiteralPath $root -Recurse -File)
foreach ($file in $files) {
  $relative = $file.FullName.Substring($root.Length + 1).Replace('\','/')
  if ($relative -match $forbidden) { throw "Forbidden package entry: $relative" }
}
[System.IO.Compression.ZipFile]::CreateFromDirectory($root, $ZipPath, [System.IO.Compression.CompressionLevel]::Optimal, $true)
$archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
try {
  $manifest = Get-Content -LiteralPath (Join-Path $root 'docs/FILE-MANIFEST.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $expected = @{}
  foreach ($file in $manifest.files) { $expected[$file.path] = $file.sha256 }
  $expected['docs/FILE-MANIFEST.json'] = (Get-FileHash -LiteralPath (Join-Path $root 'docs/FILE-MANIFEST.json') -Algorithm SHA256).Hash.ToLowerInvariant()
  $prefix = (Split-Path $root -Leaf) + '/'
  $seen = @{}
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    foreach ($entry in $archive.Entries) {
      $name = $entry.FullName.Replace('\','/')
      if ($name.EndsWith('/')) { continue }
      if (!$name.StartsWith($prefix)) { throw "Unexpected archive root: $name" }
      $relative = $name.Substring($prefix.Length)
      if ($relative -match $forbidden) { throw "Forbidden archive entry: $relative" }
      if (!$expected.ContainsKey($relative)) { throw "Unexpected archive entry: $relative" }
      if ($seen.ContainsKey($relative)) { throw "Duplicate archive entry: $relative" }
      $stream = $entry.Open()
      try { $actual = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant() } finally { $stream.Dispose() }
      if ($actual -ne $expected[$relative]) { throw "Archive content hash mismatch: $relative" }
      $seen[$relative] = $true
    }
    if ($seen.Count -ne $expected.Count) { throw 'Archive is missing expected files' }
  } finally { $sha.Dispose() }
} finally { $archive.Dispose() }
[PSCustomObject]@{Archive=$ZipPath; Files=$seen.Count; Bytes=(Get-Item -LiteralPath $ZipPath).Length; SHA256=(Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant(); ContentHashesVerified=$true; ForbiddenEntries=0} | ConvertTo-Json
