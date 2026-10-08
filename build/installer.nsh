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
Var ispartaAeDetectLabel
Var ispartaAeFound
; 组件页控件句柄：范围小标题 / 范围路径说明 / AE 检测行（供勾选联动时整体禁用）
Var ispartaAeScopeLabel
Var ispartaAeScopeTip
Var ispartaAeLabel
; 范围路径文案（由 $installMode 推导，见 ispartaResolveScope）
Var ispartaAeScopeText


; ---------- 文件级辅助函数（customHeader 在页声明之后展开） ----------
!macro customHeader
; ---------- 函数定义（顶层：NSIS 才能解析 Call 引用，避免 6010 清零代码） ----------
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

  Function ispartaRemoveCepDir
    ${if} ${FileExists} "$1\CSXS\manifest.xml"
    ${orIf} ${FileExists} "$1\version.json"
      RMDir /r "$1"
    ${endIf}
  FunctionEnd

  Function un.ispartaRemoveCepDir
    ${if} ${FileExists} "$1\CSXS\manifest.xml"
    ${orIf} ${FileExists} "$1\version.json"
      RMDir /r "$1"
    ${endIf}
  FunctionEnd

  Function ispartaScanAeDir
    FindFirst $0 $1 "$R6\After Effects *"
    ${DoWhile} $1 != ""
      ${If} ${FileExists} "$R6\$1\Support Files"
        ${If} $ispartaAeFound != "1"
          StrCpy $ispartaAeDetectLabel "已检测到 AE（目录扫描）"
        ${EndIf}
        StrCpy $ispartaAeFound "1"
      ${EndIf}
      FindNext $0 $1
    ${Loop}
    FindClose $0
  FunctionEnd

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
    ; DriveGet 部分 makensis 不认；FileExists 不支持通配符 → 用 FindFirst 扫目录
    StrCpy $R7 "CDEFGHIJKLMNOPQRSTUVWXYZ"
    ${DoWhile} $R7 != ""
      StrCpy $R8 $R7 1
      StrCpy $R7 $R7 "" 1
      StrCpy $R6 "$R8:\Program Files\Adobe"
      Call ispartaScanAeDir
      StrCpy $R6 "$R8:\Program Files (x86)\Adobe"
      Call ispartaScanAeDir
    ${Loop}

    ${If} $ispartaAeFound == "0"
      StrCpy $ispartaAeDetectLabel "未检测到 After Effects（仍可安装，装 AE 后自动加载）"
    ${EndIf}
  FunctionEnd



  ; $ispartaCepSrc = payload 源目录；$ispartaCepUserParent/$1 = 目标父目录
  ; 成功 $ispartaCopyOk=1，并在 $1\<EXT_ID> 落盘 + 写 version.json

  ; $1 = 要删除的扩展目录；仅当含本扩展 manifest/version.json 时删除

  ; 卸载段只能调 un. 前缀函数

  ; $R6 = Adobe 父目录；找 After Effects * 子目录

  ; ---------- AE 多盘探测（注册表优先 + 全盘枚举，不只 C 盘） ----------
  ; 结果：$ispartaAeFound="1" 且 $ispartaAeDetectLabel 含检测到的版本列表
!macroend

; ---------- 组件页（在「选择安装位置」之后、「正在安装」之前） ----------
; 版式：左右两张等宽卡片（桌面版 / After Effects 扩展）。
; **安装范围只问一次**：由 electron-builder 自带的「安装模式」页决定（所有用户 / 仅当前用户），
; 组件页不再放 radio 重复提问，只把结果只读展示出来（见 ispartaResolveScope）。
; 整页高度控制在 ~102u（MUI 页面区约 300u × 140u）。
!macro customPageAfterChangeDir
  ; AE 复选框 ↔ 范围说明联动：没勾 AE 就把位置说明灰掉
  Function ispartaSyncAeScope
    ${NSD_GetState} $ispartaChkAe $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $1 "1"
    ${Else}
      StrCpy $1 "0"
    ${EndIf}
    EnableWindow $ispartaAeScopeLabel $1
    EnableWindow $ispartaAeScopeTip $1
  FunctionEnd

  ; 安装范围的**唯一真相源**：electron-builder 的 $installMode（"all" / "CurrentUser"）。
  ; 该页在选「所有用户」时已负责 UAC 提权，这里只做映射 + 生成展示文案。
  ; customInstall（含 silent 升级）也会 Call 它，保证无人值守路径同样正确。
  Function ispartaResolveScope
    ${if} $installMode == "all"
      StrCpy $ispartaCepScope "all"
      StrCpy $ispartaAeScopeText "Common Files（所有用户共用）"
    ${elseIf} $installMode == "CurrentUser"
      StrCpy $ispartaCepScope "user"
      StrCpy $ispartaAeScopeText "%APPDATA%（仅当前用户）"
    ${else}
      ; 兜底：拿不到安装模式时按当前进程权限推断
      ${if} ${UAC_IsAdmin}
        StrCpy $ispartaCepScope "all"
        StrCpy $ispartaAeScopeText "Common Files（所有用户共用）"
      ${else}
        StrCpy $ispartaCepScope "user"
        StrCpy $ispartaAeScopeText "%APPDATA%（仅当前用户）"
      ${endIf}
    ${endIf}
  FunctionEnd

  Function ispartaAeToggle
    ; nsDialogs 回调会压控件 HWND（有的版本再压一个通知码）；栈空时 Pop 返回空串，多弹一次是安全的
    Pop $0
    Pop $0
    Call ispartaSyncAeScope
  FunctionEnd

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

    ; ---- 左卡：桌面版 ----
    ${NSD_CreateGroupBox} 0% 2u 48% 68u "桌面版"
    Pop $0

    ${NSD_CreateCheckbox} 3% 14u 42% 10u "iSparta-next 主程序"
    Pop $ispartaChkDesktop
    ${if} $ispartaInstallDesktop == "1"
      ${NSD_Check} $ispartaChkDesktop
    ${endIf}

    ${NSD_CreateLabel} 6% 26u 39% 9u "创建开始菜单与桌面快捷方式"
    Pop $0

    ${NSD_CreateLabel} 6% 36u 39% 9u "APNG / WebP / GIF 序列转换"
    Pop $0

    ${NSD_CreateLabel} 6% 46u 39% 9u "可与 AE 扩展分开勾选"
    Pop $0

    ; ---- 右卡：AE 扩展 ----
    ${NSD_CreateGroupBox} 52% 2u 48% 68u "After Effects 扩展"
    Pop $0

    ${NSD_CreateCheckbox} 55% 14u 42% 10u "iSparta CEP 面板"
    Pop $ispartaChkAe
    ${if} $ispartaInstallAe == "1"
      ${NSD_Check} $ispartaChkAe
    ${endIf}

    ; 安装范围不再重复提问：直接跟随「安装模式」页的选择
    Call ispartaResolveScope

    ${NSD_CreateLabel} 58% 26u 39% 9u "安装位置（跟随安装模式）"
    Pop $ispartaAeScopeLabel

    ${NSD_CreateLabel} 58% 37u 39% 10u "$ispartaAeScopeText"
    Pop $ispartaAeScopeTip

    ${NSD_CreateLabel} 58% 49u 39% 14u "与主程序保持同一安装范围"
    Pop $0

    ; ---- 状态行：AE 探测结果（只读展示，不占用卡片宽度） ----
    Call ispartaDetectAe
    ${NSD_CreateLabel} 0% 74u 100% 10u "AE 检测：$ispartaAeDetectLabel"
    Pop $ispartaAeLabel

    ${NSD_CreateLabel} 0% 86u 100% 18u "装后请重启 After Effects；未签名扩展会自动开启 PlayerDebugMode。"
    Pop $0

    ; 勾选联动（先按当前状态同步一次，覆盖「升级时继承上次选择」的情况）
    GetFunctionAddress $0 ispartaAeToggle
    nsDialogs::OnClick $ispartaChkAe $0
    Call ispartaSyncAeScope

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

    ; 安装范围已由「安装模式」页决定（选「所有用户」时该页已完成 UAC 提权），
    ; 组件页只负责勾选组件，不再重复提问，也不在这里申请提权。

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
  ; 安装范围不在这里定：由「安装模式」页 → $installMode → ispartaResolveScope 推导

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

  StrCpy $ispartaCepSrc "$INSTDIR\${ISPARTA_CEP_REL}"
  StrCpy $ispartaCepUserParent "$APPDATA\Adobe\CEP\extensions"
  StrCpy $ispartaCepUserDest "$ispartaCepUserParent\${ISPARTA_CEP_ID}"
  StrCpy $ispartaCepCommonParent "$COMMONFILES\Adobe\CEP\extensions"
  StrCpy $ispartaCepCommonDest "$ispartaCepCommonParent\${ISPARTA_CEP_ID}"
!macroend

; ---------- 安装：复制扩展 / 快捷方式按需 ----------
!macro customInstall
  ; 安装范围：与主程序安装模式一致（silent 升级不经组件页，这里兜底重推一次）
  Call ispartaResolveScope

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
        WriteRegStr HKCU "Software\Adobe\CSXS.6" "PlayerDebugMode" "1"
        WriteRegStr HKCU "Software\Adobe\CSXS.7" "PlayerDebugMode" "1"
        WriteRegStr HKCU "Software\Adobe\CSXS.8" "PlayerDebugMode" "1"
        WriteRegStr HKCU "Software\Adobe\CSXS.9" "PlayerDebugMode" "1"
        WriteRegStr HKCU "Software\Adobe\CSXS.10" "PlayerDebugMode" "1"
        WriteRegStr HKCU "Software\Adobe\CSXS.11" "PlayerDebugMode" "1"
        WriteRegStr HKCU "Software\Adobe\CSXS.12" "PlayerDebugMode" "1"
        WriteRegStr HKCU "Software\Adobe\CSXS.13" "PlayerDebugMode" "1"
        WriteRegStr HKCU "Software\Adobe\CSXS.14" "PlayerDebugMode" "1"
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
        WriteRegStr HKCU "Software\Adobe\CSXS.6" "PlayerDebugMode" "1"
        WriteRegStr HKCU "Software\Adobe\CSXS.7" "PlayerDebugMode" "1"
        WriteRegStr HKCU "Software\Adobe\CSXS.8" "PlayerDebugMode" "1"
        WriteRegStr HKCU "Software\Adobe\CSXS.9" "PlayerDebugMode" "1"
        WriteRegStr HKCU "Software\Adobe\CSXS.10" "PlayerDebugMode" "1"
        WriteRegStr HKCU "Software\Adobe\CSXS.11" "PlayerDebugMode" "1"
        WriteRegStr HKCU "Software\Adobe\CSXS.12" "PlayerDebugMode" "1"
        WriteRegStr HKCU "Software\Adobe\CSXS.13" "PlayerDebugMode" "1"
        WriteRegStr HKCU "Software\Adobe\CSXS.14" "PlayerDebugMode" "1"
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
  Call un.ispartaRemoveCepDir

  StrCpy $1 "$COMMONFILES\Adobe\CEP\extensions\${ISPARTA_CEP_ID}"
  Call un.ispartaRemoveCepDir

  ReadRegStr $1 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepUserPath
  ${if} $1 != ""
    Call un.ispartaRemoveCepDir
  ${endIf}
  ReadRegStr $1 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepCommonPath
  ${if} $1 != ""
    Call un.ispartaRemoveCepDir
  ${endIf}

  RMDir /r $INSTDIR
!macroend

; PlayerDebugMode 故意不回滚：其他未签名 Adobe 扩展可能仍依赖该开关。
