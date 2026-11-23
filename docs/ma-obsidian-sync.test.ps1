$ErrorActionPreference='Stop'
$testRoot=Join-Path ([IO.Path]::GetTempPath()) ('ma-obsidian-test-'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($testRoot) | Out-Null
[IO.File]::WriteAllText((Join-Path $testRoot 'index.md'),"---`nupdated: 2026-11-22`n---`n# Índice`n")
[IO.File]::WriteAllText((Join-Path $testRoot 'log.md'),"# Log`n")
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$partial='queries/ma/2025/2025-bionexo-tasy.md'
$partialPath=Join-Path $testRoot $partial
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($partialPath)) | Out-Null
[IO.File]::Copy((Join-Path $repo ('wiki/'+$partial)),$partialPath)
& (Join-Path $PSScriptRoot 'ma-obsidian-sync.ps1') -Apply -TestDirectory $testRoot
if(@(Get-ChildItem -LiteralPath $testRoot -Recurse -Filter '*.md' -File).Count -ne 8){throw 'Quantidade incorreta após retomada parcial'}
$indexHash=(Get-FileHash -LiteralPath (Join-Path $testRoot 'index.md')).Hash
$logHash=(Get-FileHash -LiteralPath (Join-Path $testRoot 'log.md')).Hash
& (Join-Path $PSScriptRoot 'ma-obsidian-sync.ps1') -Apply -TestDirectory $testRoot
if((Get-FileHash -LiteralPath (Join-Path $testRoot 'index.md')).Hash -ne $indexHash -or (Get-FileHash -LiteralPath (Join-Path $testRoot 'log.md')).Hash -ne $logHash){throw 'Reaplicação duplicou conteúdo'}
[IO.File]::AppendAllText($partialPath,"`nAlteração concorrente que deve ser preservada.`n")
$changedHash=(Get-FileHash -LiteralPath $partialPath).Hash
$rejected=$false
try{& (Join-Path $PSScriptRoot 'ma-obsidian-sync.ps1') -Apply -TestDirectory $testRoot}catch{$rejected=$true}
if(-not $rejected -or (Get-FileHash -LiteralPath $partialPath).Hash -ne $changedHash){throw 'Divergência não foi preservada'}
if(Test-Path -LiteralPath (Join-Path $testRoot '_EM EDIÇÃO.md')){throw 'Trava temporária não foi liberada'}
'PASS: retoma gravação parcial, reaplica sem duplicar e preserva divergências.'
