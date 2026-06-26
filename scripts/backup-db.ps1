$backupDir = "C:\Users\peyto\bot\backups"
$retentionDays = 7

$date = Get-Date -Format "yyyy-MM-dd-HHmmss"
$file = Join-Path $backupDir "cassiebotdb-$date.sql"

$env:PGPASSWORD = "42810"
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" --host=localhost --port=5432 --username=postgres --dbname=cassiebotdb --file=$file --format=plain --no-owner --no-acl

$zipFile = "$file.zip"
Compress-Archive -Path $file -DestinationPath $zipFile -CompressionLevel Optimal
Remove-Item $file

Get-ChildItem $backupDir -Filter "*.zip" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$retentionDays) } | Remove-Item

Write-Host "Backup created: $zipFile"
