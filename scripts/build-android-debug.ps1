[CmdletBinding()]
param(
    [switch]$SkipWebBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$setFlowToolRoot = if ($env:SETFLOW_ANDROID_TOOLS) {
    $env:SETFLOW_ANDROID_TOOLS
} else {
    "E:\Tools\SetFlowAndroid"
}
$setFlowJavaHome = Join-Path $setFlowToolRoot "jdk21\jdk-21.0.12+8"
$setFlowSdkRoot = Join-Path $setFlowToolRoot "android-sdk"
$setFlowGradle = Join-Path $setFlowToolRoot "gradle\gradle-8.14.3\bin\gradle.bat"
$setFlowGradleHome = Join-Path $setFlowToolRoot "gradle-home"
$setFlowRepositoryRoot = Split-Path -Parent $PSScriptRoot
$setFlowAndroidRoot = Join-Path $setFlowRepositoryRoot "android"
$setFlowApk = Join-Path $setFlowAndroidRoot "app\build\outputs\apk\debug\app-debug.apk"

$setFlowRequiredPaths = @(
    $setFlowJavaHome,
    $setFlowSdkRoot,
    $setFlowGradle
)
$setFlowMissingPaths = @(
    $setFlowRequiredPaths | Where-Object { -not (Test-Path -LiteralPath $_) }
)
if ($setFlowMissingPaths.Count -gt 0) {
    $setFlowMissingList = $setFlowMissingPaths -join [Environment]::NewLine
    throw "SetFlow Android toolchain is incomplete:$([Environment]::NewLine)$setFlowMissingList$([Environment]::NewLine)Android SDK licenses must be accepted by the user before installation continues."
}

$env:JAVA_HOME = $setFlowJavaHome
$env:ANDROID_HOME = $setFlowSdkRoot
$env:ANDROID_SDK_ROOT = $setFlowSdkRoot
$env:GRADLE_USER_HOME = $setFlowGradleHome

Push-Location $setFlowRepositoryRoot
try {
    if (-not $SkipWebBuild) {
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "Web production build failed." }
    }

    & npx cap sync android
    if ($LASTEXITCODE -ne 0) { throw "Capacitor Android sync failed." }

    Push-Location $setFlowAndroidRoot
    try {
        & $setFlowGradle --no-daemon test assembleDebug
        if ($LASTEXITCODE -ne 0) { throw "Android debug build failed." }
    } finally {
        Pop-Location
    }

    if (-not (Test-Path -LiteralPath $setFlowApk)) {
        throw "Gradle completed without producing the expected APK: $setFlowApk"
    }

    $setFlowHash = Get-FileHash -Algorithm SHA256 -LiteralPath $setFlowApk
    [pscustomobject]@{
        Apk = $setFlowApk
        Sha256 = $setFlowHash.Hash.ToLowerInvariant()
    } | Format-List
} finally {
    Pop-Location
}
