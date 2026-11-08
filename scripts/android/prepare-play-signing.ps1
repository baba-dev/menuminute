#Requires -Version 5.1
<#
.SYNOPSIS
  Create the MenuMinute Google Play upload key on Windows without installing Java.
.DESCRIPTION
  Downloads the official Eclipse Temurin JDK 17 ZIP, verifies the vendor SHA-256,
  runs keytool locally, and deletes the temporary Java files. The private key
  NEVER leaves this computer unless you explicitly back it up or upload it to
  GitHub Actions as an encrypted environment secret.
  Do not run this script on an untrusted or shared computer.
#>
[CmdletBinding()]
param(
    [string] $OutputDirectory = (Join-Path $env:USERPROFILE "MenuMinute-Play-Signing")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not [Environment]::Is64BitOperatingSystem) {
    throw "This script requires 64-bit Windows. Use a trusted Windows x64 PC."
}

$store = Join-Path $OutputDirectory "menuminute-upload.jks"
if (Test-Path -LiteralPath $store) {
    throw "A signing key already exists at $store. Refusing to overwrite it. Back up and reuse the original."
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$work = Join-Path ([IO.Path]::GetTempPath()) ("menuminute-jdk17-" + [guid]::NewGuid().ToString("N"))
$archive = Join-Path $work "jdk17.zip"
$extract = Join-Path $work "jdk"
New-Item -ItemType Directory -Force -Path $work | Out-Null

try {
    # Available on Windows PowerShell 5.1; does not change system-wide settings.
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $api = "https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse"
    Write-Host "Retrieving Eclipse Temurin 17 portable JDK metadata..."
    $assets = @(Invoke-RestMethod -Uri $api)
    if ($assets.Count -lt 1 -or $null -eq $assets[0].binary.package) {
        throw "No official Windows x64 JDK 17 package was found."
    }

    $pkg = $assets[0].binary.package
    $source = [uri] $pkg.link
    if ($source.Scheme -ne "https" -or [string]$pkg.checksum -notmatch '^[A-Fa-f0-9]{64}$') {
        throw "JDK metadata did not provide a trustworthy HTTPS URL and SHA-256."
    }

    Write-Host "Downloading portable Java ZIP (no installation)..."
    Invoke-WebRequest -Uri $source.AbsoluteUri -OutFile $archive -UseBasicParsing
    $computed = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
    if (-not $computed.Equals([string]$pkg.checksum, [StringComparison]::OrdinalIgnoreCase)) {
        throw "SHA-256 mismatch. Refusing to execute downloaded Java."
    }
    Write-Host "SHA-256 verified. Extracting temporary JDK..."
    Expand-Archive -LiteralPath $archive -DestinationPath $extract

    $keytool = Get-ChildItem -LiteralPath $extract -Recurse -File -Filter "keytool.exe" |
        Select-Object -First 1
    if ($null -eq $keytool) {
        throw "keytool.exe was not found in the verified JDK archive."
    }

    Write-Host ""
    Write-Host "Creating the MenuMinute upload key. Choose a long, unique password."
    Write-Host "You may press Enter at the separate key-password prompt to reuse the keystore password."
    Write-Host "Keep both passwords in your private password manager; never paste them into chat."
    Write-Host ""
    & $keytool.FullName -genkeypair -v `
        -keystore $store `
        -storetype JKS `
        -alias "menuminute-upload" `
        -keyalg RSA `
        -keysize 3072 `
        -sigalg SHA256withRSA `
        -validity 10000 `
        -dname "CN=MenuMinute Upload, O=BabaBuilds, L=Pilani, ST=Rajasthan, C=IN"

    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $store)) {
        throw "Key generation failed. Check the previous error; do not reuse a partial keystore."
    }
    Write-Host ""
    Write-Host "UPLOAD KEY CREATED: $store"
    Write-Host "Alias: menuminute-upload"
    Write-Host "NEXT: Make an encrypted offline backup. Then follow docs/android-release/signing-setup.md"
    Write-Host "IMPORTANT: The upload certificate is NOT the Play App Signing certificate for assetlinks.json."
} finally {
    if (Test-Path -LiteralPath $work) {
        Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
    }
}
