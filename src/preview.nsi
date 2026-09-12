; Native UI fixture. No real app is installed, launched, or uninstalled.
Unicode true
ManifestDPIAware true
ManifestDPIAwareness PerMonitorV2
RequestExecutionLevel user
SetCompressor /SOLID lzma
Name "@APP@ UI preview"
!ifdef PREVIEW_OUTPUT
OutFile "${PREVIEW_OUTPUT}"
!else
OutFile "preview-only-setup.exe"
!endif
InstallDir "$TEMP\yuxino-installer-preview"
!include "MUI2.nsh"
!include "${__FILEDIR__}\theme.nsh"
!define MUI_WELCOMEFINISHPAGE_BITMAP "${__FILEDIR__}\sidebar.bmp"
!define MUI_PAGE_CUSTOMFUNCTION_PRE PreviewNoop
!define MUI_PAGE_CUSTOMFUNCTION_SHOW PreviewNoop
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE PreviewNoop
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
; Match both of Tauri's Finish-page controls. Neither callback changes the system.
!define MUI_FINISHPAGE_SHOWREADME
!define MUI_FINISHPAGE_SHOWREADME_TEXT "$(createDesktop)"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION PreviewNoop
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION PreviewNoop
!define MUI_PAGE_CUSTOMFUNCTION_PRE PreviewNoop
!define MUI_PAGE_CUSTOMFUNCTION_SHOW PreviewNoop
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE PreviewNoop
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "Japanese"
!define PRODUCTNAME "@APP@"
!define VERSION "0.0.0"
!include "${__FILEDIR__}\English.nsh"
!include "${__FILEDIR__}\SimpChinese.nsh"
!include "${__FILEDIR__}\Japanese.nsh"
!ifdef PREVIEW_LANGUAGE
Function .onInit
  StrCpy $LANGUAGE ${PREVIEW_LANGUAGE}
FunctionEnd
!endif
Function PreviewNoop
FunctionEnd
Section "Preview only"
  Nop
SectionEnd
