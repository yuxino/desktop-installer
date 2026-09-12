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
!include "FileFunc.nsh"
!include "${__FILEDIR__}\theme.nsh"
Var PreviewReport
!define MUI_WELCOMEFINISHPAGE_BITMAP "${__FILEDIR__}\sidebar.bmp"
!define MUI_PAGE_CUSTOMFUNCTION_PRE PreviewNoop
!define MUI_PAGE_CUSTOMFUNCTION_SHOW PreviewWelcomeShow
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
!define MUI_PAGE_CUSTOMFUNCTION_SHOW PreviewFinishShow
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE PreviewNoop
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "Japanese"
!define PRODUCTNAME "@APP@"
!define VERSION "0.0.0"
!ifndef PREVIEW_LANGUAGE_DIR
!define PREVIEW_LANGUAGE_DIR "${__FILEDIR__}"
!endif
; Direct previews read plain UTF-8; CI supplies Tauri's BOM-prefixed copies.
!include /CHARSET=UTF8 "${PREVIEW_LANGUAGE_DIR}\English.nsh"
!include /CHARSET=UTF8 "${PREVIEW_LANGUAGE_DIR}\SimpChinese.nsh"
!include /CHARSET=UTF8 "${PREVIEW_LANGUAGE_DIR}\Japanese.nsh"
Function .onInit
  !ifdef PREVIEW_LANGUAGE
  StrCpy $LANGUAGE ${PREVIEW_LANGUAGE}
  !endif
  ${GetParameters} $0
  ${GetOptions} $0 "/UIREPORT=" $PreviewReport
  ClearErrors
FunctionEnd
Function PreviewNoop
FunctionEnd
; Optional CI evidence is read in the owning process: GDI bitmap handles cannot
; be inspected with GetObject from an external automation process.
!macro PreviewRecordBitmap PAGE HANDLE
  ${If} $PreviewReport != ""
    System::Store "S"
    SendMessage ${HANDLE} ${STM_GETIMAGE} ${IMAGE_BITMAP} 0 $0
    System::Alloc 32
    Pop $1
    System::Call 'gdi32::GetObjectW(p r0, i 32, p r1) i.r2'
    ${If} $2 > 0
      System::Call '*$1(i, i .R0, i .R1, i, &i2, &i2 .R2)'
      System::Call 'user32::GetClientRect(p ${HANDLE}, p r1)'
      System::Call '*$1(i, i, i .R3, i .R4)'
      WriteINIStr "$PreviewReport" "${PAGE}" "width" "$R0"
      WriteINIStr "$PreviewReport" "${PAGE}" "height" "$R1"
      WriteINIStr "$PreviewReport" "${PAGE}" "bits" "$R2"
      WriteINIStr "$PreviewReport" "${PAGE}" "controlWidth" "$R3"
      WriteINIStr "$PreviewReport" "${PAGE}" "controlHeight" "$R4"
    ${EndIf}
    System::Free $1
    System::Store "L"
  ${EndIf}
!macroend
Function PreviewWelcomeShow
  !insertmacro PreviewRecordBitmap welcome $mui.WelcomePage.Image
FunctionEnd
Function PreviewFinishShow
  !insertmacro PreviewRecordBitmap finish $mui.FinishPage.Image
FunctionEnd
Section "Preview only"
  Nop
SectionEnd
