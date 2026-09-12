; Presentation only. Keep MUI2's page generation and all native callbacks.
; Called after the page's full-window layout, before it is shown.
; The main dialog owns the selected language font and its dialog-unit metrics.
; nsDialogs' child keeps its template metrics after WM_SETFONT, so mapping with
; that child can move labels underneath the wider, correctly sized portrait.
!macro YuxinoMoveControl HANDLE X Y WIDTH HEIGHT
  Push $0
  Push $1
  Push $2
  Push $3
  Push $4
  System::Call '*(i ${X}, i ${Y}, i ${WIDTH}, i ${HEIGHT}) p.r0'
  System::Call 'user32::MapDialogRect(p $HWNDPARENT, p r0)'
  System::Call '*$0(i .r1, i .r2, i .r3, i .r4)'
  System::Free $0
  ; SWP_NOZORDER | SWP_NOACTIVATE preserves focus, tab order, and handlers.
  System::Call 'user32::SetWindowPos(p ${HANDLE}, p 0, i r1, i r2, i r3, i r4, i 0x14)'
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
!macroend

; Wrap only the small page entry macros. The stock page declaration, controls,
; default values, PRE / LEAVE hooks, run/shortcut actions, and reboot path remain.
!macroundef MUI_PAGE_WELCOME
!macro MUI_PAGE_WELCOME
  !verbose push
  !verbose ${MUI_VERBOSE}
  !ifdef MUI_PAGE_CUSTOMFUNCTION_SHOW
    !define YUXINO_WELCOME_PREVIOUS_SHOW "${MUI_PAGE_CUSTOMFUNCTION_SHOW}"
    !undef MUI_PAGE_CUSTOMFUNCTION_SHOW
  !endif
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW YuxinoWelcomeLayout
  !insertmacro MUI_PAGE_INIT
  !insertmacro MUI_PAGEDECLARATION_WELCOME
  Function YuxinoWelcomeLayout
    !ifdef YUXINO_WELCOME_PREVIOUS_SHOW
      Call "${YUXINO_WELCOME_PREVIOUS_SHOW}"
      !undef YUXINO_WELCOME_PREVIOUS_SHOW
    !endif
    !insertmacro YuxinoMoveControl $mui.WelcomePage.Title @TITLE@
    !insertmacro YuxinoMoveControl $mui.WelcomePage.Text @WELCOME_TEXT@
  FunctionEnd
  !verbose pop
!macroend

!macroundef MUI_PAGE_FINISH
!macro MUI_PAGE_FINISH
  !verbose push
  !verbose ${MUI_VERBOSE}
  !ifdef MUI_PAGE_CUSTOMFUNCTION_SHOW
    !define YUXINO_FINISH_PREVIOUS_SHOW "${MUI_PAGE_CUSTOMFUNCTION_SHOW}"
    !undef MUI_PAGE_CUSTOMFUNCTION_SHOW
  !endif
  !ifdef MUI_FINISHPAGE_RUN
    !define YUXINO_LAYOUT_RUN
  !endif
  !ifdef MUI_FINISHPAGE_SHOWREADME
    !define YUXINO_LAYOUT_SHORTCUT
  !endif
  !ifdef MUI_FINISHPAGE_LINK
    !define YUXINO_LAYOUT_LINK
  !endif
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW YuxinoFinishLayout
  !insertmacro MUI_PAGE_INIT
  !insertmacro MUI_PAGEDECLARATION_FINISH
  Function YuxinoFinishLayout
    !ifdef YUXINO_FINISH_PREVIOUS_SHOW
      Call "${YUXINO_FINISH_PREVIOUS_SHOW}"
      !undef YUXINO_FINISH_PREVIOUS_SHOW
    !endif
    ; Native reboot instructions and radio buttons keep their original layout.
    IfRebootFlag yuxino_finish_native
    !insertmacro YuxinoMoveControl $mui.FinishPage.Title @TITLE@
    !insertmacro YuxinoMoveControl $mui.FinishPage.Text @FINISH_TEXT@
    !ifdef YUXINO_LAYOUT_RUN
      !insertmacro YuxinoMoveControl $mui.FinishPage.Run @RUN@
      !undef YUXINO_LAYOUT_RUN
    !endif
    !ifdef YUXINO_LAYOUT_SHORTCUT
      !insertmacro YuxinoMoveControl $mui.FinishPage.ShowReadme @SHORTCUT@
      !undef YUXINO_LAYOUT_SHORTCUT
    !endif
    !ifdef YUXINO_LAYOUT_LINK
      !insertmacro YuxinoMoveControl $mui.FinishPage.Link @LINK@
      !undef YUXINO_LAYOUT_LINK
    !endif
    yuxino_finish_native:
  FunctionEnd
  !verbose pop
!macroend
