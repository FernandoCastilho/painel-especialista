param([switch]$Apply,[string]$TestDirectory)
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$wiki='G:\Meu Drive\Obsidian\30. Recursos\LLM Wiki'
if($TestDirectory){
  $testPath=[IO.Path]::GetFullPath($TestDirectory)
  $tempRoot=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if(-not $testPath.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($testPath) -notmatch '^ma-obsidian-test-[a-f0-9]{32}$'){throw 'Pasta de teste fora do temporário dedicado'}
  $wiki=$testPath
}
$manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'ma-obsidian-manifest.json') -Raw | ConvertFrom-Json
$allowed=@('concepts/ma-panorama.md')+@($manifest.files.relative | Where-Object {$_ -match '^queries/ma/2025/[a-z0-9-]+\.md$'})
if($manifest.files.Count -ne 6){throw 'Manifesto deve conter as seis notas revisadas'}
foreach($entry in $manifest.files){
  if($entry.relative -notin $allowed){throw 'Destino fora do escopo'}
  $source=Join-Path $repo ('wiki/'+$entry.relative)
  if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $entry.sha256){throw 'Arquivo alterado depois da revisão'}
}
if(-not $Apply){$manifest.files | Select-Object relative,sha256; return}
$lock=Join-Path $wiki '_EM EDIÇÃO.md'
$identity='M&A codex 2026-11-23 '+[guid]::NewGuid().ToString('N')
$stream=[IO.File]::Open($lock,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try{$bytes=[Text.Encoding]::UTF8.GetBytes($identity);$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
$receipt=@()
try{
  $indexPath=Join-Path $wiki 'index.md'
  $logPath=Join-Path $wiki 'log.md'
  $indexBefore=[IO.File]::ReadAllText($indexPath)
  $logBefore=[IO.File]::ReadAllText($logPath)
  $indexEntry="`n`n## Fusões e aquisições`n- [[30. Recursos/LLM Wiki/concepts/ma-panorama|Panorama e histórico de M&A]] — cinco transações de dezembro de 2025; cobertura parcial, com fontes e histórico por operação.`n"
  $logEntry="`n`n## 2026-11-23 — M&A — acervo inicial`nCodex criou seis notas (panorama e cinco operações) autorizadas na implementação de M&A, com fontes públicas, datas distintas, cobertura parcial e histórico. Índice atualizado. Notas brutas e demais registros preservados. Referência [[30. Recursos/LLM Wiki/concepts/ma-panorama]].`n"
  if($indexBefore -match '(?i)fusões e aquisições|ma-panorama|queries/ma/' -and -not $indexBefore.Contains($indexEntry)){throw 'Referência anterior divergente de M&A no índice; preservar'}
  foreach($entry in $manifest.files){
    $destination=Join-Path $wiki $entry.relative
    $absolute=[IO.Path]::GetFullPath($destination)
    if(-not $absolute.StartsWith($wiki+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Destino fora do wiki'}
    if((Test-Path -LiteralPath $destination) -and (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $entry.sha256){throw ('Nota divergente; não será sobrescrita: '+$entry.relative)}
  }
  foreach($entry in $manifest.files){
    $source=Join-Path $repo ('wiki/'+$entry.relative)
    $destination=Join-Path $wiki $entry.relative
    if(Test-Path -LiteralPath $destination){$receipt+=@{relative=$entry.relative;sha256=$entry.sha256;verified=$true};continue}
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination)) | Out-Null
    $bytes=[IO.File]::ReadAllBytes($source)
    $stream=[IO.File]::Open($destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try{$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}
    if((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -ne $entry.sha256){throw 'Hash diferente após gravar'}
    $receipt+=@{relative=$entry.relative;sha256=$entry.sha256;verified=$true}
  }
  if([IO.File]::ReadAllText($indexPath) -cne $indexBefore -or [IO.File]::ReadAllText($logPath) -cne $logBefore){throw 'Índice ou log mudou durante a operação; preservar alteração concorrente'}
  $indexAfter=if($indexBefore.Contains($indexEntry)){$indexBefore}else{($indexBefore -replace '(?m)^updated: .+$','updated: 2026-11-23')+$indexEntry}
  [IO.File]::WriteAllText($indexPath,$indexAfter,[Text.UTF8Encoding]::new($false))
  if([IO.File]::ReadAllText($indexPath) -cne $indexAfter){throw 'Índice não confere após gravação'}
  if([IO.File]::ReadAllText($logPath) -cne $logBefore){throw 'Log alterado por outro processo'}
  $logAfter=if($logBefore.Contains($logEntry)){$logBefore}else{$logBefore+$logEntry}
  [IO.File]::WriteAllText($logPath,$logAfter,[Text.UTF8Encoding]::new($false))
  if([IO.File]::ReadAllText($logPath) -cne $logAfter){throw 'Log não confere após gravação'}
  if(-not $TestDirectory){$receipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'ma-obsidian-receipt.json') -Encoding utf8}
  'Verificado: seis notas, índice e log do Obsidian.'
}finally{
  if((Test-Path -LiteralPath $lock) -and [IO.File]::ReadAllText($lock) -ceq $identity){Remove-Item -LiteralPath $lock}
}
