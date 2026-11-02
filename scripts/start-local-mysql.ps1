$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$databaseDir = Join-Path $projectRoot 'storage\mysql'
$serverPath = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe'

function Test-DatabasePort {
    $connection = New-Object System.Net.Sockets.TcpClient
    try {
        $connection.Connect('127.0.0.1', 3310)
        return $true
    } catch {
        return $false
    } finally {
        $connection.Dispose()
    }
}

if (-not (Test-Path -LiteralPath $serverPath)) {
    throw "MySQL Server 8.0 was not found at $serverPath. Install MySQL and follow README.md."
}
if (-not (Test-Path -LiteralPath (Join-Path $databaseDir 'mysql'))) {
    throw 'The project-local database has not been initialized. Follow the MySQL setup in README.md.'
}
if (Test-DatabasePort) {
    Write-Host 'Port 3310 already has a listener. Skipping MySQL startup.'
    exit 0
}
$databaseProcess = Start-Process -FilePath $serverPath -ArgumentList @(
    '--no-defaults',
    ('--datadir="' + $databaseDir + '"'),
    '--port=3310',
    '--bind-address=127.0.0.1',
    '--mysqlx=OFF',
    '--log-error=local-mysql.log'
) -WindowStyle Hidden -PassThru
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if ($databaseProcess.HasExited) {
        throw 'MySQL exited. Check storage/mysql/local-mysql.log.'
    }
    if (Test-DatabasePort) {
        Write-Host 'Project-local MySQL is listening on 127.0.0.1:3310.'
        exit 0
    }
    Start-Sleep -Seconds 1
}
throw 'MySQL did not become ready within 30 seconds. Check storage/mysql/local-mysql.log.'
