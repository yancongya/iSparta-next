// 事件名称

// 设置ITEM相关的函数

// 增加一项
export const ITEMS_ADD = 'ITEMS_ADD'

// 删除一项
export const ITEMS_REMOVE = 'ITEMS_REMOVE'

// 运行中强制删除选中项
export const ITEMS_REMOVE_FORCE = 'ITEMS_REMOVE_FORCE'

// 将选中且进行中的任务标记为已中断
export const ITEMS_MARK_ABORTED = 'ITEMS_MARK_ABORTED'

// 删除所有
export const ALL_REMOVE = 'ALL_REMOVE'

// 设置basic属性
export const ITEMS_EDIT_BASIC = 'ITEMS_EDIT_BASIC'

// 设置参数
export const ITEMS_EDIT_OPTIONS = 'ITEMS_EDIT_OPTIONS'

// 设置多项的参数
export const ITEMS_EDIT_MULTI_OPTIONS = 'ITEMS_EDIT_MULTI_OPTIONS'

// 设置压缩的进度
export const ITEMS_EDIT_PROCESS = 'ITEMS_EDIT_PROCESS'

// 落盘保底改名回写（转换中 locked，绕过锁；按每项 index 写 per-format 的实际产物名）
export const ITEMS_APPLY_NAME_OVERRIDE = 'ITEMS_APPLY_NAME_OVERRIDE'

// 预检里用户明确选择「直接覆盖源文件」：标记该任务允许覆盖，processor 的保底改名放行
export const ITEMS_SET_SOURCE_OVERWRITE = 'ITEMS_SET_SOURCE_OVERWRITE'

// 设置多选
export const MULTI_SELECT = 'MULTI_SELECT'

// 设置单选
export const SINGLE_SELECT = 'SINGLE_SELECT'

// 设置选中
export const SET_SELECTED = 'SET_SELECTED'

// 设置全选
export const ALL_SELECTED = 'ALL_SELECTED'

// 按索引集合设置选中（框选）
export const ITEMS_SET_SELECTED = 'ITEMS_SET_SELECTED'

// 取消全选
export const NONE_SELECTED = 'NONE_SELECTED'

// 设置锁定
export const SET_LOCK = 'SET_LOCK'
