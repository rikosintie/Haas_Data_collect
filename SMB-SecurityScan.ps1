# SMB Security Verification Script for Windows
# This script checks SMB configuration and security settings
# Usage - .\RPi-SecurityScan.ps1 -Target 192.168.10.223

param(
    [switch]$Verbose
)

# Color output functions
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Success { Write-ColorOutput $args[0] "Green" }
function Write-Warning { Write-ColorOutput $args[0] "Yellow" }
function Write-Error { Write-ColorOutput $args[0] "Red" }
function Write-Info { Write-ColorOutput $args[0] "Cyan" }

# Check if running as Administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Main script
Clear-Host
Write-Info "================================================================"
Write-Info "        SMB Security Verification Script for Windows"
Write-Info "================================================================"
Write-Host ""

if (-not (Test-Administrator)) {
    Write-Warning "This script should be run as Administrator for complete results."
    Write-Host ""
}

# Get computer information
Write-Info "System Information:"
Write-Info "-------------------"
$computerInfo = Get-ComputerInfo -Property CsName, OsName, OsVersion, OsArchitecture
Write-Host "Computer Name: $($computerInfo.CsName)"
Write-Host "OS: $($computerInfo.OsName)"
Write-Host "Version: $($computerInfo.OsVersion)"
Write-Host "Architecture: $($computerInfo.OsArchitecture)"
Write-Host ""

# Check SMB Server status
Write-Info "SMB Server Status:"
Write-Info "-------------------"
$smbServer = Get-Service -Name LanmanServer -ErrorAction SilentlyContinue
if ($smbServer) {
    $statusColor = if ($smbServer.Status -eq "Running") { "Green" } else { "Red" }
    Write-ColorOutput "SMB Server (LanmanServer): $($smbServer.Status)" $statusColor
} else {
    Write-Error "SMB Server service not found"
}
Write-Host ""

# Check SMB Protocol versions
Write-Info "SMB Protocol Configuration:"
Write-Info "----------------------------"
try {
    $smbConfig = Get-SmbServerConfiguration

    Write-Host "SMB1 Protocol:"
    if ($smbConfig.EnableSMB1Protocol) {
        Write-Error "  [SECURITY RISK] SMB1 is ENABLED - This is a security vulnerability!"
        Write-Warning "  Recommendation: Disable SMB1 immediately"
    } else {
        Write-Success "  SMB1 is disabled (Good)"
    }

    Write-Host "`nSMB2 Protocol:"
    if ($smbConfig.EnableSMB2Protocol) {
        Write-Success "  SMB2/3 is enabled (Good)"
    } else {
        Write-Warning "  SMB2/3 is disabled - Modern clients may have issues"
    }

    Write-Host "`nEncryption Settings:"
    Write-Host "  Encrypt Data: $($smbConfig.EncryptData)"
    Write-Host "  Reject Unencrypted Access: $($smbConfig.RejectUnencryptedAccess)"

    if (-not $smbConfig.RejectUnencryptedAccess) {
        Write-Warning "  [WARNING] Unencrypted access is allowed"
    }

    Write-Host "`nSigning Settings:"
    Write-Host "  Enable Security Signature: $($smbConfig.EnableSecuritySignature)"
    Write-Host "  Require Security Signature: $($smbConfig.RequireSecuritySignature)"

    if (-not $smbConfig.RequireSecuritySignature) {
        Write-Warning "  [WARNING] SMB signing is not required"
    }

} catch {
    Write-Error "Failed to retrieve SMB configuration: $($_.Exception.Message)"
}
Write-Host ""

# Check SMB Shares
Write-Info "SMB Shares:"
Write-Info "------------"
try {
    $shares = Get-SmbShare | Where-Object { $_.Name -notlike "*$" }

    if ($shares.Count -eq 0) {
        Write-Host "No custom shares found (only administrative shares)"
    } else {
        foreach ($share in $shares) {
            Write-Host "`nShare Name: $($share.Name)"
            Write-Host "  Path: $($share.Path)"
            Write-Host "  Description: $($share.Description)"
            Write-Host "  Encrypt Data: $($share.EncryptData)"

            # Check share permissions
            $shareAccess = Get-SmbShareAccess -Name $share.Name
            Write-Host "  Permissions:"
            foreach ($access in $shareAccess) {
                $accessColor = switch ($access.AccessRight) {
                    "Full" { "Red" }
                    "Change" { "Yellow" }
                    "Read" { "Green" }
                    default { "White" }
                }
                Write-ColorOutput "    $($access.AccountName): $($access.AccessRight) ($($access.AccessControlType))" $accessColor
            }

            # Security warning for Everyone access
            $everyoneAccess = $shareAccess | Where-Object { $_.AccountName -like "*Everyone*" }
            if ($everyoneAccess) {
                Write-Error "  [SECURITY RISK] 'Everyone' group has access to this share!"
            }
        }
    }
} catch {
    Write-Error "Failed to retrieve SMB shares: $($_.Exception.Message)"
}
Write-Host ""

# Check Firewall Rules for SMB
Write-Info "Firewall Rules for SMB:"
Write-Info "------------------------"
try {
    $smbRules = Get-NetFirewallRule | Where-Object {
        $_.DisplayName -like "*File and Printer Sharing*" -or
        $_.DisplayName -like "*SMB*"
    } | Select-Object DisplayName, Enabled, Direction, Action

    if ($smbRules.Count -eq 0) {
        Write-Warning "No SMB-related firewall rules found"
    } else {
        foreach ($rule in $smbRules) {
            $statusColor = if ($rule.Enabled) { "Green" } else { "Gray" }
            Write-ColorOutput "  $($rule.DisplayName)" $statusColor
            Write-Host "    Direction: $($rule.Direction) | Action: $($rule.Action) | Enabled: $($rule.Enabled)"
        }
    }
} catch {
    Write-Error "Failed to retrieve firewall rules: $($_.Exception.Message)"
}
Write-Host ""

# Check for open SMB connections
Write-Info "Active SMB Sessions:"
Write-Info "---------------------"
try {
    $sessions = Get-SmbSession

    if ($sessions.Count -eq 0) {
        Write-Host "No active SMB sessions"
    } else {
        foreach ($session in $sessions) {
            Write-Host "`nClient: $($session.ClientComputerName)"
            Write-Host "  User: $($session.ClientUserName)"
            Write-Host "  Connected: $($session.NumOpens) open files"
            Write-Host "  Dialect: SMB $($session.Dialect)"
            Write-Host "  Encrypted: $($session.Encrypted)"
            Write-Host "  Signed: $($session.Signed)"
        }
    }
} catch {
    Write-Error "Failed to retrieve SMB sessions: $($_.Exception.Message)"
}
Write-Host ""

# Security Recommendations Summary
Write-Info "================================================================"
Write-Info "                 Security Recommendations"
Write-Info "================================================================"
Write-Host ""

$recommendations = @()

try {
    $smbConfig = Get-SmbServerConfiguration

    if ($smbConfig.EnableSMB1Protocol) {
        $recommendations += "CRITICAL: Disable SMB1 Protocol immediately"
        $recommendations += "  Command: Set-SmbServerConfiguration -EnableSMB1Protocol `$false -Force"
    }

    if (-not $smbConfig.RequireSecuritySignature) {
        $recommendations += "Enable required SMB signing for better security"
        $recommendations += "  Command: Set-SmbServerConfiguration -RequireSecuritySignature `$true -Force"
    }

    if (-not $smbConfig.EncryptData) {
        $recommendations += "Consider enabling SMB encryption"
        $recommendations += "  Command: Set-SmbServerConfiguration -EncryptData `$true -Force"
    }

    $shares = Get-SmbShare | Where-Object { $_.Name -notlike "*$" }
    foreach ($share in $shares) {
        $shareAccess = Get-SmbShareAccess -Name $share.Name
        $everyoneAccess = $shareAccess | Where-Object { $_.AccountName -like "*Everyone*" }
        if ($everyoneAccess) {
            $recommendations += "Review permissions on share: $($share.Name)"
            $recommendations += "  Remove 'Everyone' access and use specific user/group permissions"
        }
    }

    if ($recommendations.Count -eq 0) {
        Write-Success "No critical security issues found!"
    } else {
        foreach ($rec in $recommendations) {
            if ($rec -like "*Command:*") {
                Write-ColorOutput $rec "Gray"
            } elseif ($rec -like "CRITICAL:*") {
                Write-Error $rec
            } else {
                Write-Warning $rec
            }
        }
    }
} catch {
    Write-Error "Error generating recommendations: $($_.Exception.Message)"
}

Write-Host ""
Write-Info "================================================================"
Write-Info "Scan Complete - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Info "================================================================"
