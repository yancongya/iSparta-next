; iSparta-next — electron-builder NSIS 自定义（一体安装）
; 由 nsis.include 引入；宏在 assistedInstaller / installSection / uninstaller 正确位置展开。
; 桌面固定全机安装；AE 探测命中时同步装 CEP，不显示组件选择。
; 桌面自动更与 CEP 面板热更共用同一个 NSIS 包、系统级 CEP 目录和 UAC。
; CEP 先暂存并验证，再切换；切换失败恢复旧版，成功后清当前用户的旧副本。
; AE 探测：注册表 + 全盘枚举（不只 C 盘）；未命中则跳过本次 CEP。
; 写 version.json；按 CSXS 主版本写 PlayerDebugMode
; 卸载：清理 CEP 落盘（以 version.json/manifest 认领）；保留 PlayerDebugMode（其他未签名扩展可能仍需要）

!define ISPARTA_CEP_ID "io.github.isparta-next"
!define ISPARTA_CEP_REL "resources\cep\io.github.isparta-next"
!include "FileFunc.nsh"

Var ispartaInstallDesktop
Var ispartaInstallAe
Var ispartaCepSrc
Var ispartaCepUserParent
Var ispartaCepUserDest
Var ispartaCepCommonParent
Var ispartaCepCommonDest
Var ispartaCepStage
Var ispartaCepBackup
Var ispartaResultPath
Var ispartaResultStatus
Var ispartaResultDetail
Var ispartaResultCep
Var ispartaCopyOk
Var ispartaAeDetectLabel
Var ispartaAeFound
; 静默安装日志文件（$TEMP\isparta-install.log）；静默失败无处弹窗，只能落盘
Var ispartaLogPath
; 静默/升级标记的文本形式（仅用于日志，LogicLib 宏不能直接拼进字符串）
Var ispartaSilentText
Var ispartaIsUpdatedText


; ---------- 文件级辅助函数（customHeader 在页声明之后展开） ----------
!macro customHeader
; ---------- 安装日志 ----------
; 静默安装（/S）时无人看得到任何报错，MessageBox 还会直接挂住无人值守流程，
; 所以失败一律写 $TEMP\isparta-install.log；弹窗只在交互式安装时出现。
; 用法：Push "文本" + Call ispartaLog（NSIS 的 Call 不能带参数！）
; ⚠ $0~$9 与 $R0~$R9 会被覆写，调用方不要跨行依赖
Function ispartaLog
  Pop $0
  ${If} $ispartaLogPath == ""
    StrCpy $ispartaLogPath "$TEMP\isparta-install.log"
  ${EndIf}
  FileOpen $1 $ispartaLogPath a
  ${IfNot} ${errors}
    FileWrite $1 "[${__DATE__} ${__TIME__}] $0"
    FileClose $1
  ${EndIf}
FunctionEnd

; 失败提示：交互式弹窗，/S 静默时只落日志（不阻塞无人值守流程）
Function ispartaFail
  ;栈：msg detail
  Pop $1
  Pop $0
  Push "FAIL: $0 | $1"
  Call ispartaLog
  SetErrorLevel 1
  ${IfNot} ${Silent}
    MessageBox MB_OK|MB_ICONEXCLAMATION "$0$\r$\n$\r$\n$1"
  ${EndIf}
FunctionEnd
Function ispartaWriteResult
  ; RESULTFILE 由启动更新的进程指定，避开 UAC 切换账户后的 TEMP 差异。
  ; detail 只用固定英文代码，确保 JSON 不受路径和本地化转义影响。
  ${GetParent} "$ispartaResultPath" $2
  CreateDirectory "$2"
  FileOpen $0 "$ispartaResultPath" w
  ${If} ${errors}
    Push "无法写入安装结果：$ispartaResultPath"
    Call ispartaLog
    Return
  ${EndIf}
  FileWrite $0 "{$\"status$\":$\"$ispartaResultStatus$\",$\"version$\":$\"${VERSION}$\",$\"cep$\":$\"$ispartaResultCep$\",$\"detail$\":$\"$ispartaResultDetail$\"}"
  FileClose $0
FunctionEnd
; ---------- 函数定义（顶层：NSIS 才能解析 Call 引用，避免 6010 清零代码） ----------
  Function ispartaCopyCepToParent
    StrCpy $ispartaCopyOk "0"
    ${ifNot} ${FileExists} "$ispartaCepSrc\CSXS\manifest.xml"
      Push "payload 缺失：$ispartaCepSrc\CSXS\manifest.xml"
      Call ispartaLog
      Return
    ${endIf}

    CreateDirectory "$1"
    StrCpy $ispartaCepStage "$1\${ISPARTA_CEP_ID}.isparta-new"
    StrCpy $ispartaCepBackup "$1\${ISPARTA_CEP_ID}.isparta-old"
    RMDir /r "$ispartaCepStage"
    ${If} ${FileExists} "$ispartaCepStage"
      Push "无法清理 CEP 暂存目录：$ispartaCepStage"
      Call ispartaLog
      Return
    ${EndIf}
    CreateDirectory "$ispartaCepStage"
    ClearErrors
    CopyFiles /SILENT "$ispartaCepSrc\*.*" "$ispartaCepStage"
    ${if} ${errors}
      Push "CEP 暂存复制失败：$ispartaCepSrc → $ispartaCepStage"
      Call ispartaLog
      RMDir /r "$ispartaCepStage"
      Return
    ${endIf}
    ${ifNot} ${FileExists} "$ispartaCepStage\CSXS\manifest.xml"
      Push "CEP 暂存清单缺失：$ispartaCepStage"
      Call ispartaLog
      RMDir /r "$ispartaCepStage"
      Return
    ${endIf}

    ; 版本清单（覆盖 payload 自带，补充安装时间；字段与 cep-payload-common / prepare-cep 对齐）
    ClearErrors
    FileOpen $0 "$ispartaCepStage\version.json" w
    ${if} ${errors}
      Push "CEP 暂存版本文件写入失败：$ispartaCepStage"
      Call ispartaLog
      RMDir /r "$ispartaCepStage"
      Return
    ${endIf}
    FileWrite $0 "{$\"id$\":$\"${ISPARTA_CEP_ID}$\",$\"name$\":$\"iSparta$\",$\"displayName$\":$\"iSparta-next AE$\",$\"version$\":$\"${VERSION}$\",$\"installedAt$\":$\"${__DATE__} ${__TIME__}$\",$\"payload$\":$\"${ISPARTA_CEP_REL}$\",$\"source$\":$\"nsis$\"}"
    FileClose $0
    ${If} ${FileExists} "$ispartaCepBackup"
      ${IfNot} ${FileExists} "$ispartaCepCommonDest"
        Rename "$ispartaCepBackup" "$ispartaCepCommonDest"
      ${EndIf}
    ${EndIf}
    ${If} ${FileExists} "$ispartaCepBackup"
      StrCpy $1 "$ispartaCepBackup"
      Call ispartaRemoveCepDir
      ${If} ${FileExists} "$ispartaCepBackup"
        RMDir /r "$ispartaCepStage"
        Return
      ${EndIf}
    ${EndIf}
    ${If} ${FileExists} "$ispartaCepCommonDest"
      ${IfNot} ${FileExists} "$ispartaCepCommonDest\CSXS\manifest.xml"
      ${AndIfNot} ${FileExists} "$ispartaCepCommonDest\version.json"
        Push "目标目录归属无法确认，保留原目录：$ispartaCepCommonDest"
        Call ispartaLog
        RMDir /r "$ispartaCepStage"
        Return
      ${EndIf}
      ClearErrors
      Rename "$ispartaCepCommonDest" "$ispartaCepBackup"
      ${If} ${errors}
        Push "CEP 旧版移至备份失败：$ispartaCepCommonDest"
        Call ispartaLog
        RMDir /r "$ispartaCepStage"
        Return
      ${EndIf}
    ${EndIf}
    ClearErrors
    Rename "$ispartaCepStage" "$ispartaCepCommonDest"
    ${If} ${errors}
      Push "CEP 新版切换失败，正在恢复旧版：$ispartaCepCommonDest"
      Call ispartaLog
      Rename "$ispartaCepBackup" "$ispartaCepCommonDest"
      RMDir /r "$ispartaCepStage"
      Return
    ${EndIf}
    StrCpy $ispartaCopyOk "1"
    StrCpy $1 "$ispartaCepBackup"
    Call ispartaRemoveCepDir
  FunctionEnd

  Function ispartaRemoveCepDir
    ${if} ${FileExists} "$1\CSXS\manifest.xml"
    ${orIf} ${FileExists} "$1\version.json"
      ClearErrors
      RMDir /r "$1"
      ${if} ${errors}
        ; 多为运行中的 AE 占用文件删不掉；静默安装无处弹窗，只能落日志供排查
        Push "清理另一作用域副本失败（AE 运行中占用？）：$1"
        Call ispartaLog
      ${endIf}
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

; 安装时不再询问组件；桌面固定安装，CEP 由 AE 检测结果决定。
!macro customPageAfterChangeDir
!macroend

; ---------- 安装初始化：所有安装路径统一探测 AE ----------
!macro customInit
  ; ---------- 自更新静默保证（对齐 ZCode：静默由安装器自身保证，不依赖调用方参数） ----------
  ; 面板起安装包前会在 exe 同目录写一个 `<exe>.self-update` 哨兵（见 cep-bridge.js 的
  ; runInstaller）。若带哨兵却没带 /S（旧面板忘了传 /S，或用户手动双击了自动下载的包），
  ; 这里自重启为一个静默实例；静默实例会清掉哨兵，避免后续手动重跑也静默。
  ${If} ${FileExists} "$EXEPATH.self-update"
    ${IfNot} ${Silent}
      ; 自重启静默：原实例退出，新 /S 实例无人值守装完。
      GetParameters $0
      Exec '"$EXEPATH" /S $0'
      Abort
    ${EndIf}
    ; 静默实例：清掉哨兵（必须早于真实安装逻辑，避免手动重跑也静默）
    Delete "$EXEPATH.self-update"
  ${EndIf}

  StrCpy $ispartaInstallDesktop "1"
  StrCpy $ispartaInstallAe "1"
  StrCpy $ispartaSilentText "0"
  StrCpy $ispartaIsUpdatedText "0"
  ${if} ${Silent}
    StrCpy $ispartaSilentText "1"
  ${endIf}
  ${if} ${isUpdated}
    StrCpy $ispartaIsUpdatedText "1"
  ${endIf}
  GetParameters $0
  ClearErrors
  ${GetOptions} $0 "/RESULTFILE=" $ispartaResultPath
  ${If} $ispartaResultPath == ""
    StrCpy $ispartaResultPath "$COMMONAPPDATA\iSparta\update\install-result.json"
  ${EndIf}
  StrCpy $ispartaResultStatus "installing"
  StrCpy $ispartaResultDetail "started"
  StrCpy $ispartaResultCep "skipped"
  Call ispartaWriteResult

  ; 每次安装都重新检测 AE；不沿用旧版的 CepOnly / CepInstalled。
  ; 这样静默更新与首次安装采用同一组件规则。
  Call ispartaDetectAe
  StrCpy $ispartaInstallAe $ispartaAeFound
  ${If} $ispartaInstallAe == "1"
    StrCpy $ispartaResultCep "installed"
  ${EndIf}
  Push "AE detection: $ispartaAeDetectLabel"
  Call ispartaLog

  StrCpy $ispartaCepSrc "$INSTDIR\${ISPARTA_CEP_REL}"
  StrCpy $ispartaCepUserParent "$APPDATA\Adobe\CEP\extensions"
  StrCpy $ispartaCepUserDest "$ispartaCepUserParent\${ISPARTA_CEP_ID}"
  StrCpy $ispartaCepCommonParent "$COMMONFILES\Adobe\CEP\extensions"
  StrCpy $ispartaCepCommonDest "$ispartaCepCommonParent\${ISPARTA_CEP_ID}"
!macroend

; ---------- 安装：复制扩展 / 快捷方式按需 ----------
!macro customInstall
  ; 开场留一行：静默/交互 + 是否升级 + 组件选择，排查静默失败时第一行就能定位
  Push "install start: updated=$ispartaIsUpdatedText silent=$ispartaSilentText desktop=$ispartaInstallDesktop ae=$ispartaInstallAe"
  Call ispartaLog
  StrCpy $ispartaResultStatus "success"
  StrCpy $ispartaResultDetail "complete"

  ; 安装范围由 perMachine:true 固定。

  StrCpy $ispartaCepSrc "$INSTDIR\${ISPARTA_CEP_REL}"
  StrCpy $ispartaCepUserParent "$APPDATA\Adobe\CEP\extensions"
  StrCpy $ispartaCepUserDest "$ispartaCepUserParent\${ISPARTA_CEP_ID}"
  StrCpy $ispartaCepCommonParent "$COMMONFILES\Adobe\CEP\extensions"
  StrCpy $ispartaCepCommonDest "$ispartaCepCommonParent\${ISPARTA_CEP_ID}"

  ; 落盘目标写进日志：双副本 / 作用域排查时一眼看到最终装了哪、清了哪
  Push "cep scope=all user=$ispartaCepUserDest common=$ispartaCepCommonDest"
  Call ispartaLog

  ${IfNot} ${UAC_IsAdmin}
    StrCpy $ispartaResultStatus "failed"
    StrCpy $ispartaResultDetail "admin-required"
    Push "需要管理员权限才能安装系统级 CEP。"
    Push "isparta: admin required"
    Call ispartaFail
  ${ElseIf} $ispartaInstallAe == "1"
    StrCpy $1 $ispartaCepCommonParent
    Call ispartaCopyCepToParent
    ${If} $ispartaCopyOk != "1"
      StrCpy $ispartaResultStatus "failed"
      StrCpy $ispartaResultDetail "cep-replace-failed"
      Push "After Effects 扩展更新失败；已尝试保留原有版本。"
      Push "isparta: CEP system-scope replacement failed"
      Call ispartaFail
    ${Else}
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
      ; 新版落盘后，才清理当前账户过去的用户级副本。
      StrCpy $1 $ispartaCepUserDest
      Call ispartaRemoveCepDir
    ${EndIf}
  ${Else}
    ; 没有 AE 时不触碰现有扩展，避免误删日后仍要使用的版本。
    WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepInstalled "0"
  ${EndIf}

  WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" CepOnly "0"
  Call ispartaWriteResult
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
