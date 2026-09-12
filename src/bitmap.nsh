; Render once at the native control's pixel size. Resizing a large HBITMAP in
; STATIC uses a low-quality stretch on Windows; GDI+ supplies filtered sampling.
; MUI still owns the returned HBITMAP and frees it when each page is destroyed.
!macroundef MUI_INTERNAL_FULLWINDOW_LOADWIZARDIMAGE
!macro MUI_INTERNAL_FULLWINDOW_LOADWIZARDIMAGE _un _hwndImg _ImgPath _RetImgHandle
  System::Store "S"
  StrCpy $0 ${_hwndImg}
  StrCpy $1 "${_ImgPath}"
  StrCpy $2 0 ; GDI+ startup token
  StrCpy $3 0 ; source GpBitmap
  StrCpy $4 0 ; target GpBitmap
  StrCpy $5 0 ; target GpGraphics
  StrCpy $6 0 ; final HBITMAP, transferred to MUI
  StrCpy $R9 0 ; explicit module reference until after GdiplusShutdown
  StrCpy $8 1 ; GDI+ status (zero means success)

  System::Call '*(i 0, i 0, i 0, i 0) p.r7'
  ${If} $7 P<> 0
    System::Call 'user32::GetClientRect(p r0, p r7) i.r8'
    ${If} $8 <> 0
      System::Call '*$7(i, i, i .R0, i .R1)'
    ${Else}
      StrCpy $R0 0
      StrCpy $R1 0
    ${EndIf}
    System::Free $7
  ${Else}
    StrCpy $R0 0
    StrCpy $R1 0
  ${EndIf}

  ${If} $R0 > 0
  ${AndIf} $R1 > 0
  ${AndIf} $R0 <= 4096
  ${AndIf} $R1 <= 8192
    ; Load only the operating system library; no installer-local codec or DLL.
    System::Call 'kernel32::LoadLibraryW(w "$SYSDIR\gdiplus.dll") p.R9'
    ${If} $R9 P<> 0
      ; GdiplusStartupInput: UINT32, aligned pointer, BOOL, BOOL.
      !if ${NSIS_PTR_SIZE} > 4
        System::Call '*(i 1, i 0, p 0, i 0, i 1) p.r7'
      !else
        System::Call '*(i 1, p 0, i 0, i 1) p.r7'
      !endif
      ${If} $7 P<> 0
        System::Call 'gdiplus::GdiplusStartup(*p .r2, p r7, p 0) i.r8'
        System::Free $7
      ${Else}
        StrCpy $8 1
      ${EndIf}
      ${If} $8 = 0
        System::Call 'gdiplus::GdipCreateBitmapFromFile(w r1, *p .r3) i.r8'
      ${EndIf}
      ${If} $8 = 0
        System::Call 'gdiplus::GdipGetImageWidth(p r3, *i .R2) i.r8'
      ${EndIf}
      ${If} $8 = 0
        System::Call 'gdiplus::GdipGetImageHeight(p r3, *i .R3) i.r8'
      ${EndIf}
      ${If} $8 = 0
      ${AndIf} $R2 > 0
      ${AndIf} $R3 > 0
        ; Contain the entire portrait, including at font-dependent dialog sizes.
        StrCpy $R4 $R0
        System::Call 'kernel32::MulDiv(i $R0, i $R3, i $R2) i.R5'
        ${If} $R5 > $R1
          StrCpy $R5 $R1
          System::Call 'kernel32::MulDiv(i $R1, i $R2, i $R3) i.R4'
        ${EndIf}
        IntOp $R6 $R0 - $R4
        IntOp $R6 $R6 / 2
        IntOp $R7 $R1 - $R5
        IntOp $R7 $R7 / 2
        ${If} $R4 > 0
        ${AndIf} $R5 > 0
          ; PixelFormat24bppRGB: an opaque white canvas avoids alpha fringes.
          System::Call 'gdiplus::GdipCreateBitmapFromScan0(i $R0, i $R1, i 0, i 0x21808, p 0, *p .r4) i.r8'
          ${If} $8 = 0
            System::Call 'gdiplus::GdipGetImageGraphicsContext(p r4, *p .r5) i.r8'
          ${EndIf}
          ${If} $8 = 0
            System::Call 'gdiplus::GdipGraphicsClear(p r5, i 0xFFFFFFFF) i.r8'
          ${EndIf}
          ${If} $8 = 0
            ; HighQualityBicubic = 7, PixelOffsetModeHalf = 4.
            System::Call 'gdiplus::GdipSetInterpolationMode(p r5, i 7) i.r8'
          ${EndIf}
          ${If} $8 = 0
            System::Call 'gdiplus::GdipSetPixelOffsetMode(p r5, i 4) i.r8'
          ${EndIf}
          ${If} $8 = 0
            ; UnitPixel = 2: source dimensions are pixels, independent of BMP DPI.
            System::Call 'gdiplus::GdipDrawImageRectRectI(p r5, p r3, i $R6, i $R7, i $R4, i $R5, i 0, i 0, i $R2, i $R3, i 2, p 0, p 0, p 0) i.r8'
          ${EndIf}
          ${If} $5 P<> 0
            System::Call 'gdiplus::GdipDeleteGraphics(p r5)'
            StrCpy $5 0
          ${EndIf}
          ${If} $8 = 0
            System::Call 'gdiplus::GdipCreateHBITMAPFromBitmap(p r4, *p .r6, i 0xFFFFFFFF) i.r8'
            ${If} $8 <> 0
            ${AndIf} $6 P<> 0
              System::Call 'gdi32::DeleteObject(p r6)'
              StrCpy $6 0
            ${EndIf}
          ${EndIf}
        ${EndIf}
      ${EndIf}
    ${EndIf}
  ${EndIf}

  ; All GDI+ resources have local lifetime, even on a failed intermediate call.
  ${If} $5 P<> 0
    System::Call 'gdiplus::GdipDeleteGraphics(p r5)'
  ${EndIf}
  ${If} $4 P<> 0
    System::Call 'gdiplus::GdipDisposeImage(p r4)'
  ${EndIf}
  ${If} $3 P<> 0
    System::Call 'gdiplus::GdipDisposeImage(p r3)'
  ${EndIf}
  ${If} $2 P<> 0
    System::Call 'gdiplus::GdiplusShutdown(p r2)'
  ${EndIf}
  ${If} $R9 P<> 0
    System::Call 'kernel32::FreeLibrary(p $R9)'
  ${EndIf}

  ${If} $6 P<> 0
    SendMessage $0 ${STM_SETIMAGE} ${IMAGE_BITMAP} $6 $9
    ${If} $9 P<> 0
    ${AndIf} $9 P<> $6
      System::Call 'gdi32::DeleteObject(p r9)'
    ${EndIf}
    ; Some Windows STATIC versions copy a bitmap. Return the actual control
    ; handle to MUI and release our original only when a distinct copy exists.
    SendMessage $0 ${STM_GETIMAGE} ${IMAGE_BITMAP} 0 $9
    ${If} $9 P<> $6
      System::Call 'gdi32::DeleteObject(p r6)'
      StrCpy $6 $9
    ${EndIf}
  ${EndIf}
  StrCpy ${_RetImgHandle} $6
  System::Store "L"

  ${If} ${_RetImgHandle} P= 0
    ; Artwork must remain available if a native graphics operation fails.
    !insertmacro MUI_LOADANDASPECTSTRETCHIMAGETOCONTROLHEIGHT ${_hwndImg} "${_ImgPath}" Auto "${_RetImgHandle}"
  ${EndIf}
!macroend
