#!/bin/bash
# iSparta-next · AE 扩展 —— 双击安装（macOS）
#
# Finder 里双击本文件即在「终端」执行：给 Adobe CSXS 写 PlayerDebugMode=1，
# 这是 AE 能加载未签名 CEP 扩展的前提。逻辑与 install-as-admin 完全一致
# （本文件只是它的双击入口，经 bash 调用，不依赖其可执行位）。
#
# 若首次双击提示「无法打开 / 身份不明」：右键本文件 → 打开 → 打开；
# 或在终端执行：xattr -d com.apple.quarantine "安装扩展.command"

cd "$(dirname "$0")" || exit 1

echo "=== iSparta-next · 开启 CEP 调试模式 ==="
echo

if [ ! -f ./install-as-admin ]; then
  echo "错误：未找到 install-as-admin，请确认本文件位于 install/ 目录内。"
  read -r -p "按回车关闭窗口..."
  exit 1
fi

bash ./install-as-admin

echo
echo "接下来："
echo "  1. 把 io.github.isparta-next 文件夹复制到"
echo "     ~/Library/Application Support/Adobe/CEP/extensions/"
echo "  2. 打开 AE → 首选项 → 脚本和表达式 → 勾选「允许脚本写入文件和访问网络」"
echo "  3. 重启 AE → 窗口 → 扩展 → iSparta-next"
echo
read -r -p "按回车关闭窗口..."
