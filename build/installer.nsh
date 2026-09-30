; iSparta-next — electron-builder NSIS 自定义（一体安装）
; 由 nsis.include 引入；宏在 assistedInstaller / installSection / uninstaller 正确位置展开。
; 组件页：☑ 桌面版  ☑ AE 扩展（至少选其一；可只装桌面）
; 安装范围互斥（§9）：系统级 Common Files（推荐，需管理员）或用户级 %APPDATA%，二选一禁双写
; AE 探测：注册表 + 全盘枚举（不只 C 盘）；识别失败仍可装 / 手动选目录
; 写 version.json；按 CSXS 主版本写 PlayerDebugMode
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
Var ispartaCepScope
Var ispartaRadUser
Var ispartaRadAll
Var ispartaAeDetectLabel
Var ispartaAeFound

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

  ; ---------- AE 多盘探测（注册表优先 + 全盘枚举，不只 C 盘） ----------
  ; 结果：$ispartaAeFound="1" 且 $ispartaAeDetectLabel 含检测到的版本列表
  Function ispartaDetectAe
    StrCpy $ispartaAeFound "0"
    StrCpy $ispartaAeDetectLabel ""

    ; 1) 注册表（与盘符无关，安装器必写）
    StrCpy $R9 "0"
    ${Do}
      EnumRegKey $R8 HKLM "SOFTWARE\Adobe\After Effects" $R9
      ${If} $R8 == ""
        ${Break}
      ${EndIf}
      StrCpy $ispartaAeFound "1"
      ${If} $ispartaAeDetectLabel == ""
        StrCpy $ispartaAeDetectLabel "AE $R8"
      ${Else}
        StrCpy $ispartaAeDetectLabel "$ispartaAeDetectLabel / AE $R8"
      ${EndIf}
      IntOp $R9 $R9 + 1
    ${Loop}

    StrCpy $R9 "0"
    ${Do}
      EnumRegKey $R8 HKLM "SOFTWARE\WOW6432Node\Adobe\After Effects" $R9
      ${If} $R8 == ""
        ${Break}
      ${EndIf}
      StrCpy $ispartaAeFound "1"
      ${If} $ispartaAeDetectLabel == ""
        StrCpy $ispartaAeDetectLabel "AE $R8"
      ${Else}
        StrCpy $ispartaAeDetectLabel "$ispartaAeDetectLabel / AE $R8"
      ${EndIf}
      IntOp $R9 $R9 + 1
    ${Loop}

    ; 2) 全盘固定盘枚举兜底（D/E/F…，覆盖手动挪盘/绿色安装）
    DriveGet $R7 "List" "Fixed"
    ${Do} ${While} $R7 != ""
      StrCpy $R8 $R7 3
      StrCpy $R7 $R7 "" 3
      ${If} ${FileExists} "$R8Program Files\Adobe\Adobe After Effects*\Support Files"
        ${If} $ispartaAeFound != "1"
          StrCpy $ispartaAeDetectLabel "已检测到 AE（目录）"
        ${EndIf}
        StrCpy $ispartaAeFound "1"
      ${ElseIf} ${FileExists} "$R8Program Files (x86)\Adobe\Adobe After Effects*\Support Files"
        ${If} $ispartaAeFound != "1"
          StrCpy $ispartaAeDetectLabel "已检测到 AE（目录）"
        ${EndIf}
        StrCpy $ispartaAeFound "1"
      ${EndIf}
    ${Loop}

    ${If} $ispartaAeFound == "0"
      StrCpy $ispartaAeDetectLabel "未检测到 After Effects（仍可安装，装 AE 后自动加载）"
    ${EndIf}
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

    ; 安装范围互斥（§9）：系统级 vs 用户级，二选一禁双写
    ${NSD_CreateGroupBox} 10u 96u 90% 74u "AE 扩展安装范围（二选一，不重复落盘）"
    Pop $0

    ${NSD_CreateRadioButton} 20u 114u 88% 18u "所有用户 —— 统一 CEP 目录（推荐，需管理员）"
    Pop $ispartaRadAll
    ${if} $ispartaCepScope == "all"
      ${NSD_Check} $ispartaRadAll
    ${elseIf} $ispartaCepScope == ""
      ${NSD_Check} $ispartaRadAll
    ${endIf}

    ${NSD_CreateRadioButton} 20u 134u 88% 18u "仅当前用户（免管理员，不提权）"
    Pop $ispartaRadUser
    ${if} $ispartaCepScope == "user"
      ${NSD_Check} $ispartaRadUser
    ${endIf}

    ${NSD_CreateLabel} 20u 154u 88% 14u "推荐管理员安装：所有用户 × 所有 AE 版本一份拷贝"
    Pop $0

    ; AE 探测结果展示
    Call ispartaDetectAe
    ${NSD_CreateLabel} 10u 176u 90% 30u "AE 检测：$ispartaAeDetectLabel"
    Pop $ispartaAeDetectLabel

    ${NSD_CreateLabel} 10u 210u 90% 40u "未签名扩展会自动开启 CSXS PlayerDebugMode。安装后请重启 After Effects。识别不到 AE 时仍可安装（装 AE 后自动加载），或解压 zip 手动放入 CEP extensions 目录。"
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

    ; 安装范围互斥：读单选
    StrCpy $ispartaCepScope "user"
    ${NSD_GetState} $ispartaRadAll $0
    ${if} $0 == ${BST_CHECKED}
      StrCpy $ispartaCepScope "all"
    ${endIf}

    ; 选「所有用户」但当前非管理员 → UAC 提权推荐
    ${if} $ispartaInstallAe == "1"
    ${andIf} $ispartaCepScope == "all"
    ${andIfNot} ${UAC_IsAdmin}
      MessageBox MB_YESNO|MB_ICONQUESTION "推荐以管理员身份安装到统一 CEP 目录（所有用户 × 所有 AE 版本一份拷贝）。$\r$\n是否以管理员继续？$\r$\n选「否」则退回仅当前用户安装。" IDYES ispartaElevate IDNO ispartaFallbackUser
      ispartaElevate:
        ; UAC 提权重跑（electron-builder 自带 UAC.nsh：UAC_RunElevated → UAC::_ 0）
        !insertmacro UAC_RunElevated
        Quit
      ispartaFallbackUser:
        StrCpy $ispartaCepScope "user"
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
  StrCpy $ispartaCepScope "all"

  ReadRegStr $0 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepInstalled
  ${if} ${isUpdated}
    ${if} $0 == "0"
      StrCpy $ispartaInstallAe "0"
    ${elseif} $0 == "1"
      StrCpy $ispartaInstallAe "1"
    ${else}
      ${if} ${FileExists} "$APPDATA\Adobe\CEP\extensions\${ISPARTA_CEP_ID}\CSXS\manifest.xml"
        StrCpy $ispartaInstallAe "1"
      ${elseif} ${FileExists} "$COMMONFILES\Adobe\CEP\extensions\${ISPARTA_CEP_ID}\CSXS\manifest.xml"
        StrCpy $ispartaInstallAe "1"
      ${else}
        StrCpy $ispartaInstallAe "0"
      ${endIf}
    ${endIf}
  ${endIf}

  ; 升级保留上次安装范围（互斥两选一）
  ReadRegStr $0 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepScope
  ${if} $0 == "user"
    StrCpy $ispartaCepScope "user"
  ${elseif} $0 == "all"
    StrCpy $ispartaCepScope "all"
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
    ; 安装范围互斥（§9）：只落一处，禁止 APPDATA 与 Common Files 双写
    ${if} $ispartaCepScope == "all"
    ${andIf} ${UAC_IsAdmin}
      ; 系统级：统一 Common Files（所有用户 × 所有 AE 版本）
      StrCpy $1 $ispartaCepCommonParent
      Call ispartaCopyCepToParent
      ${if} $ispartaCopyOk != "1"
        MessageBox MB_OK|MB_ICONEXCLAMATION "After Effects 扩展复制到统一 CEP 目录失败。$\r$\n可手动复制到 $ispartaCepCommonDest$\r$\n或改用「仅当前用户」重新安装。"
      ${else}
        Call ispartaEnablePlayerDebugMode
        WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepInstalled "1"
        WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepScope "all"
        WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepCommonPath "$ispartaCepCommonDest"
        ; 清旧的用户级残留，避免双份加载
        StrCpy $1 $ispartaCepUserDest
        Call ispartaRemoveCepDir
      ${endIf}
    ${else}
      ; 用户级：仅当前用户（免管理员）
      StrCpy $1 $ispartaCepUserParent
      Call ispartaCopyCepToParent
      ${if} $ispartaCopyOk != "1"
        MessageBox MB_OK|MB_ICONEXCLAMATION "After Effects 扩展复制失败。$\r$\n可手动将 $ispartaCepSrc 复制到 $APPDATA\Adobe\CEP\extensions\${ISPARTA_CEP_ID}$\r$\n或使用已签名 ZXP / ExManCmd 安装后重试。"
      ${else}
        Call ispartaEnablePlayerDebugMode
        WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepInstalled "1"
        WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepScope "user"
        WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepUserPath "$ispartaCepUserDest"
        ; 清旧的系统级残留，避免双份加载
        StrCpy $1 $ispartaCepCommonDest
        Call ispartaRemoveCepDir
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
