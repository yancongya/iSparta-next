; iSparta-next — electron-builder NSIS 自定义（一体安装）
; 由 nsis.include 引入；宏在 assistedInstaller / installSection / uninstaller 正确位置展开。
; 组件页：☑ 桌面版  ☑ AE 扩展（至少选其一；可只装桌面）
; 安装：复制 CEP payload → %APPDATA%\Adobe\CEP\extensions\io.github.isparta-next
;       （管理员/所有用户时可同时落 Common Files）；写 version.json；写 PlayerDebugMode
; 卸载：清理 CEP 落盘（以 version.json/manifest 认领）；保留 PlayerDebugMode（其他未签名扩展可能仍需要）

!define ISPARTA_CEP_ID "io.github.isparta-next"
!define ISPARTA_CEP_REL "resources\cep\io.github.isparta-next"

Var ispartaInstallDesktop
Var ispartaInstallAe
Var ispartaChkDesktop
Var ispartaChkAe
Var ispartaCepSrc
Var ispartaCepUserParent
Var ispartaCepUserDest
Var ispartaCepCommonParent
Var ispartaCepCommonDest
Var ispartaCopyOk

; ---------- 文件级辅助函数（customHeader 在页声明之后展开） ----------
!macro customHeader
  Function ispartaEnablePlayerDebugMode
    ; 未签名 CEP：对常见 CSXS 主版本写 HKCU PlayerDebugMode=1
    WriteRegStr HKCU "Software\Adobe\CSXS.6"  "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.7"  "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.8"  "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.9"  "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.10" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.11" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.12" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.13" "PlayerDebugMode" "1"
    WriteRegStr HKCU "Software\Adobe\CSXS.14" "PlayerDebugMode" "1"
  FunctionEnd

  ; $ispartaCepSrc = payload 源目录；$ispartaCepUserParent/$1 = 目标父目录
  ; 成功 $ispartaCopyOk=1，并在 $1\<EXT_ID> 落盘 + 写 version.json
  Function ispartaCopyCepToParent
    StrCpy $ispartaCopyOk "0"
    ${ifNot} ${FileExists} "$ispartaCepSrc\CSXS\manifest.xml"
      Return
    ${endIf}

    RMDir /r "$1\${ISPARTA_CEP_ID}"
    CreateDirectory "$1"
    ClearErrors
    ; CopyFiles 目录 → 递归整树，落到父目录下同名子目录
    CopyFiles /SILENT "$ispartaCepSrc" "$1"
    ${if} ${errors}
      Return
    ${endIf}

    ; 版本清单（覆盖 payload 自带，补充安装时间；字段与 cep-payload-common / prepare-cep 对齐）
    ClearErrors
    FileOpen $0 "$1\${ISPARTA_CEP_ID}\version.json" w
    ${ifNot} ${errors}
      FileWrite $0 "{$\"id$\":$\"${ISPARTA_CEP_ID}$\",$\"name$\":$\"iSparta$\",$\"displayName$\":$\"iSparta-next AE$\",$\"version$\":$\"${VERSION}$\",$\"installedAt$\":$\"${__DATE__} ${__TIME__}$\",$\"payload$\":$\"${ISPARTA_CEP_REL}$\",$\"source$\":$\"nsis$\"}"
      FileClose $0
    ${endIf}
    StrCpy $ispartaCopyOk "1"
  FunctionEnd

  ; $1 = 要删除的扩展目录；仅当含本扩展 manifest/version.json 时删除
  Function ispartaRemoveCepDir
    ${if} ${FileExists} "$1\CSXS\manifest.xml"
    ${orIf} ${FileExists} "$1\version.json"
      RMDir /r "$1"
    ${endIf}
  FunctionEnd
!macroend

; ---------- 组件页（在「选择安装位置」之后、「正在安装」之前） ----------
!macro customPageAfterChangeDir
  Function ispartaComponentsPre
    ${if} ${Silent}
      Abort
    ${endIf}
    !insertmacro MUI_HEADER_TEXT "选择组件" "勾选要安装的桌面版与 After Effects 扩展"

    nsDialogs::Create 1018
    Pop $0
    ${if} $0 == "error"
      Abort
    ${endIf}

    ${NSD_CreateLabel} 0u 0u 100% 24u "选择要安装的组件（至少一项）：桌面工作台和 / 或 After Effects 扩展面板。"
    Pop $0

    ${NSD_CreateCheckbox} 10u 36u 90% 20u "桌面版 iSparta-next（开始菜单 / 桌面快捷方式）"
    Pop $ispartaChkDesktop
    ${if} $ispartaInstallDesktop == "1"
      ${NSD_Check} $ispartaChkDesktop
    ${endIf}

    ${NSD_CreateCheckbox} 10u 64u 90% 20u "After Effects 扩展 iSparta（CEP 面板）"
    Pop $ispartaChkAe
    ${if} $ispartaInstallAe == "1"
      ${NSD_Check} $ispartaChkAe
    ${endIf}

    ${NSD_CreateLabel} 10u 96u 90% 48u "AE 扩展将安装到 $APPDATA\Adobe\CEP\extensions\${ISPARTA_CEP_ID}$\r$\n未签名扩展会自动开启 CSXS PlayerDebugMode。安装后请重启 After Effects。"
    Pop $0

    nsDialogs::Show
  FunctionEnd

  Function ispartaComponentsLeave
    StrCpy $ispartaInstallDesktop "0"
    StrCpy $ispartaInstallAe "0"
    ${NSD_GetState} $ispartaChkDesktop $0
    ${if} $0 == ${BST_CHECKED}
      StrCpy $ispartaInstallDesktop "1"
    ${endIf}
    ${NSD_GetState} $ispartaChkAe $0
    ${if} $0 == ${BST_CHECKED}
      StrCpy $ispartaInstallAe "1"
    ${endIf}

    ${if} $ispartaInstallDesktop == "0"
    ${andIf} $ispartaInstallAe == "0"
      MessageBox MB_OK|MB_ICONEXCLAMATION "请至少选择一个组件：桌面版或 After Effects 扩展。"
      Abort
    ${endIf}
  FunctionEnd

  PageEx custom
    PageCallbacks ispartaComponentsPre ispartaComponentsLeave
    Caption " "
  PageExEnd
!macroend

; ---------- 安装初始化：默认组件 / 升级保留上次选择 ----------
!macro customInit
  StrCpy $ispartaInstallDesktop "1"
  StrCpy $ispartaInstallAe "1"

  ReadRegStr $0 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepInstalled
  ${if} ${isUpdated}
    ${if} $0 == "0"
      StrCpy $ispartaInstallAe "0"
    ${elseif} $0 == "1"
      StrCpy $ispartaInstallAe "1"
    ${else}
      ${if} ${FileExists} "$APPDATA\Adobe\CEP\extensions\${ISPARTA_CEP_ID}\CSXS\manifest.xml"
        StrCpy $ispartaInstallAe "1"
      ${else}
        StrCpy $ispartaInstallAe "0"
      ${endIf}
    ${endIf}
  ${endIf}

  StrCpy $ispartaCepSrc "$INSTDIR\${ISPARTA_CEP_REL}"
  StrCpy $ispartaCepUserParent "$APPDATA\Adobe\CEP\extensions"
  StrCpy $ispartaCepUserDest "$ispartaCepUserParent\${ISPARTA_CEP_ID}"
  StrCpy $ispartaCepCommonParent "$COMMONFILES\Adobe\CEP\extensions"
  StrCpy $ispartaCepCommonDest "$ispartaCepCommonParent\${ISPARTA_CEP_ID}"
!macroend

; ---------- 安装：复制扩展 / 快捷方式按需 ----------
!macro customInstall
  StrCpy $ispartaCepSrc "$INSTDIR\${ISPARTA_CEP_REL}"
  StrCpy $ispartaCepUserParent "$APPDATA\Adobe\CEP\extensions"
  StrCpy $ispartaCepUserDest "$ispartaCepUserParent\${ISPARTA_CEP_ID}"
  StrCpy $ispartaCepCommonParent "$COMMONFILES\Adobe\CEP\extensions"
  StrCpy $ispartaCepCommonDest "$ispartaCepCommonParent\${ISPARTA_CEP_ID}"

  ${if} $ispartaInstallAe == "1"
    StrCpy $1 $ispartaCepUserParent
    Call ispartaCopyCepToParent
    ${if} $ispartaCopyOk != "1"
      MessageBox MB_OK|MB_ICONEXCLAMATION "After Effects 扩展复制失败。$\r$\n可手动将 $ispartaCepSrc 复制到 $APPDATA\Adobe\CEP\extensions\${ISPARTA_CEP_ID}$\r$\n或使用已签名 ZXP / ExManCmd 安装后重试。"
    ${else}
      Call ispartaEnablePlayerDebugMode
      WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepInstalled "1"
      WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepUserPath "$ispartaCepUserDest"

      ; 多落盘：管理员时同步 Common Files（供所有用户）
      ${if} ${UAC_IsAdmin}
        StrCpy $1 $ispartaCepCommonParent
        Call ispartaCopyCepToParent
        ${if} $ispartaCopyOk == "1"
          WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepCommonPath "$ispartaCepCommonDest"
        ${endIf}
      ${endIf}
    ${endIf}
  ${else}
    StrCpy $1 $ispartaCepUserDest
    Call ispartaRemoveCepDir
    StrCpy $1 $ispartaCepCommonDest
    Call ispartaRemoveCepDir
    WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepInstalled "0"
  ${endIf}

  ${if} $ispartaInstallDesktop != "1"
    ; 仅扩展：去掉快捷方式（应用文件仍安装，供 payload 与更新）
    Delete "$newDesktopLink"
    Delete "$newStartMenuLink"
    Delete "$oldDesktopLink"
    Delete "$oldStartMenuLink"
    WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepOnly "1"
  ${else}
    WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepOnly "0"
  ${endIf}
!macroend

; ---------- 卸载：清理 CEP 落盘（替换默认 RMDir /r $INSTDIR） ----------
!macro customRemoveFiles
  StrCpy $1 "$APPDATA\Adobe\CEP\extensions\${ISPARTA_CEP_ID}"
  Call ispartaRemoveCepDir

  StrCpy $1 "$COMMONFILES\Adobe\CEP\extensions\${ISPARTA_CEP_ID}"
  Call ispartaRemoveCepDir

  ReadRegStr $1 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepUserPath
  ${if} $1 != ""
    Call ispartaRemoveCepDir
  ${endIf}
  ReadRegStr $1 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepCommonPath
  ${if} $1 != ""
    Call ispartaRemoveCepDir
  ${endIf}

  RMDir /r $INSTDIR
!macroend

; PlayerDebugMode 故意不回滚：其他未签名 Adobe 扩展可能仍依赖该开关。
