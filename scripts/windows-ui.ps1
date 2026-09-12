param(
  [string]$Dist = (Join-Path $PSScriptRoot '../dist'),
  [string]$Output = (Join-Path $PSScriptRoot '../dist/windows-ui')
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class InstallerUI {
  public struct RECT { public int Left, Top, Right, Bottom; }
  public class Control {
    public long Handle;
    public int Id, X, Y, Width, Height;
    public string Class, Text;
    public bool Enabled;
  }
  private delegate bool EnumProc(IntPtr window, IntPtr parameter);
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc callback, IntPtr parameter);
  [DllImport("user32.dll")] private static extern bool EnumChildWindows(IntPtr parent, EnumProc callback, IntPtr parameter);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr window);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out RECT rect);
  [DllImport("user32.dll")] private static extern int GetDlgCtrlID(IntPtr window);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetWindowText(IntPtr window, StringBuilder text, int capacity);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetClassName(IntPtr window, StringBuilder text, int capacity);
  [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr window, int id);
  [DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] private static extern bool PrintWindow(IntPtr window, IntPtr dc, uint flags);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr window);
  [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] private static extern bool RedrawWindow(IntPtr window, IntPtr rect, IntPtr region, uint flags);
  public static void SetDpi() { SetProcessDpiAwarenessContext(new IntPtr(-4)); }
  public static string Text(IntPtr window) {
    var text = new StringBuilder(8192); GetWindowText(window, text, text.Capacity); return text.ToString();
  }
  public static IntPtr FindWindow(int process) {
    IntPtr result = IntPtr.Zero;
    EnumWindows((window, p) => {
      uint owner; GetWindowThreadProcessId(window, out owner);
      if (owner == process && IsWindowVisible(window)) { result = window; return false; }
      return true;
    }, IntPtr.Zero);
    return result;
  }
  public static Control[] Controls(IntPtr parent) {
    RECT frame; GetWindowRect(parent, out frame);
    var controls = new List<Control>();
    EnumChildWindows(parent, (window, p) => {
      if (!IsWindowVisible(window)) return true;
      RECT rect; GetWindowRect(window, out rect);
      var name = new StringBuilder(128); GetClassName(window, name, name.Capacity);
      controls.Add(new Control { Handle=window.ToInt64(), Id=GetDlgCtrlID(window),
        X=rect.Left-frame.Left, Y=rect.Top-frame.Top, Width=rect.Right-rect.Left,
        Height=rect.Bottom-rect.Top, Class=name.ToString(), Text=Text(window), Enabled=IsWindowEnabled(window) });
      return true;
    }, IntPtr.Zero);
    return controls.ToArray();
  }
  public static void Navigate(IntPtr window, int id) {
    var button = GetDlgItem(window, id);
    if (button == IntPtr.Zero || !IsWindowVisible(button) || !IsWindowEnabled(button)) throw new Exception("Navigation button unavailable: " + id);
    if (!PostMessage(window, 0x111, new IntPtr(id), button)) throw new Exception("Navigation failed");
  }
  public static int CheckState(IntPtr control) { return (int)SendMessage(control, 0xF0, IntPtr.Zero, IntPtr.Zero); }
  public static void Toggle(IntPtr control) { SendMessage(control, 0xF5, IntPtr.Zero, IntPtr.Zero); }
  public static void Render(IntPtr window, IntPtr dc) {
    RedrawWindow(window, IntPtr.Zero, IntPtr.Zero, 0x185);
    if (!PrintWindow(window, dc, 2)) throw new Exception("PrintWindow failed");
  }
}
'@
[InstallerUI]::SetDpi()
$Dist = (Resolve-Path $Dist).Path
$null = New-Item -ItemType Directory -Force -Path $Output
$Output = (Resolve-Path $Output).Path
$messages = Get-Content (Join-Path $PSScriptRoot '../locales/messages.json') -Raw | ConvertFrom-Json -AsHashtable
$results = [System.Collections.Generic.List[object]]::new()

function Wait-Window($Process) {
  $until = [DateTime]::UtcNow.AddSeconds(20)
  do {
    $window = [InstallerUI]::FindWindow($Process.Id)
    if ($window -ne [IntPtr]::Zero) { return $window }
    if ($Process.HasExited) { throw "Preview exited early: $($Process.ExitCode)" }
    Start-Sleep -Milliseconds 100
  } while ([DateTime]::UtcNow -lt $until)
  throw 'Native window did not appear'
}
function Wait-Text([IntPtr]$Window, [string]$Text) {
  $until = [DateTime]::UtcNow.AddSeconds(15)
  do {
    $controls = [InstallerUI]::Controls($Window)
    if (@($controls | Where-Object Text -eq $Text).Count -gt 0) { return }
    Start-Sleep -Milliseconds 100
  } while ([DateTime]::UtcNow -lt $until)
  throw "Expected native text not found: $Text; visible: $($controls.Text -join ' | ')"
}
function Save-Page([IntPtr]$Window, [string]$Name) {
  Start-Sleep -Milliseconds 150
  $controls = [InstallerUI]::Controls($Window)
  $rect = [InstallerUI+RECT]::new()
  if (![InstallerUI]::GetWindowRect($Window, [ref]$rect)) { throw 'Window bounds unavailable' }
  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top
  if ($width -lt 300 -or $height -lt 200 -or $width -gt 4000 -or $height -gt 3000) { throw 'Invalid window size' }
  # Keep Drawing calls in PowerShell: .NET 10 moved implementation interfaces into
  # private Windows assemblies which must not become C# compilation dependencies.
  $bitmap = [System.Drawing.Bitmap]::new($width, $height)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::Magenta)
      $dc = $graphics.GetHdc()
      try { [InstallerUI]::Render($Window, $dc) } finally { $graphics.ReleaseHdc($dc) }
    } finally { $graphics.Dispose() }
    $colors = [System.Collections.Generic.HashSet[int]]::new()
    for ($y = 5; $y -lt $height; $y += 5) {
      for ($x = 5; $x -lt $width; $x += 5) { $null = $colors.Add($bitmap.GetPixel($x, $y).ToArgb()) }
    }
    $bitmap.Save((Join-Path $Output "$Name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    # Directory pages have no portrait and CJK bitmap fonts can be nearly
    # monochrome. Only character pages need the high-color rendering assertion.
    $minimumColors = if ($Name -match '-(welcome|finish)$') { 100 } else { 8 }
    if ($colors.Count -lt $minimumColors) { throw "Blank or incomplete native capture: $($colors.Count) colors" }
  } finally { $bitmap.Dispose() }
  $controls | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $Output "$Name.controls.json") -Encoding utf8
  return $controls
}

foreach ($profile in Get-ChildItem (Join-Path $PSScriptRoot '../products') -Filter '*.json' | Sort-Object Name) {
  $product = Get-Content $profile.FullName -Raw | ConvertFrom-Json
  foreach ($locale in @('en', 'zh-Hans', 'ja')) {
    $name = "$($product.id)-$locale"
    $process = $null
    $window = [IntPtr]::Zero
    try {
      $exe = Join-Path $Dist "$($product.id)/preview-$locale.exe"
      $process = Start-Process -FilePath $exe -PassThru
      $window = Wait-Window $process
      $welcome = $messages[$locale].welcomeTitle.Replace('{app}', $product.name)
      Wait-Text $window $welcome
      $null = Save-Page $window "$name-welcome"
      [InstallerUI]::Navigate($window, 1)
      # The Directory page owns a native path edit; it must be reachable and Back must work.
      $until = [DateTime]::UtcNow.AddSeconds(10)
      do {
        $edits = @([InstallerUI]::Controls($window) | Where-Object Class -eq 'Edit')
        if ($edits.Count -gt 0) { break }
        Start-Sleep -Milliseconds 100
      } while ([DateTime]::UtcNow -lt $until)
      if ($edits.Count -eq 0) { throw 'Directory page not reached' }
      $null = Save-Page $window "$name-directory"
      [InstallerUI]::Navigate($window, 3)
      Wait-Text $window $welcome
      [InstallerUI]::Navigate($window, 1)
      Start-Sleep -Milliseconds 150
      [InstallerUI]::Navigate($window, 1)
      Wait-Text $window $messages[$locale].finishTitle
      $controls = Save-Page $window "$name-finish"
      $runText = $messages[$locale].runText.Replace('{app}', $product.name)
      $starText = $messages[$locale].starLink.Replace('{app}', $product.name)
      $run = @($controls | Where-Object Text -eq $runText)
      $link = @($controls | Where-Object Text -eq $starText)
      if ($run.Count -ne 1 -or $link.Count -ne 1) { throw 'Missing or duplicated localized Finish controls' }
      $handle = [IntPtr]$run[0].Handle
      $original = [InstallerUI]::CheckState($handle)
      [InstallerUI]::Toggle($handle)
      if ([InstallerUI]::CheckState($handle) -eq $original) { throw 'Run checkbox does not toggle' }
      [InstallerUI]::Toggle($handle)
      if ([InstallerUI]::CheckState($handle) -ne $original) { throw 'Run checkbox state was not restored' }
      $dpi = [InstallerUI]::GetDpiForWindow($window)
      [InstallerUI]::Navigate($window, 1)
      if (!$process.WaitForExit(10000)) { throw 'Finish did not close the preview' }
      if ($process.ExitCode -ne 0) { throw "Preview exit code $($process.ExitCode)" }
      $results.Add(@{ product=$product.id; locale=$locale; dpi=$dpi; status='passed'; pages=@('welcome','directory','finish'); interactions=@('next','back','finish','toggle-run'); executableSha256=(Get-FileHash $exe -Algorithm SHA256).Hash.ToLowerInvariant() })
      Write-Host "$name native pages and interactions passed (DPI $dpi)"
    } catch {
      if ($window -ne [IntPtr]::Zero) {
        try { $null = Save-Page $window "$name-failure" } catch { Write-Warning $_ }
      }
      $results.Add(@{ product=$product.id; locale=$locale; status='failed'; error="$($_.Exception.Message)" })
      Write-Warning "$name failed: $_"
    } finally {
      if ($null -ne $process -and !$process.HasExited) { Stop-Process -Id $process.Id -Force }
    }
  }
}
$results | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $Output 'results.json') -Encoding utf8
if (@($results | Where-Object status -eq 'failed').Count -gt 0) { throw 'Native UI verification failed; inspect screenshots and results.json' }
